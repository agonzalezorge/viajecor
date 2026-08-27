// Exportar a `.xlsx` con la forma de la planilla — T-906, CU-07.
//
// El usuario viene de un Excel que usó durante meses y lo conoce de memoria.
// Este archivo produce una planilla con **la misma forma**: bloques mensuales,
// los mismos encabezados, las mismas columnas, el mismo bloque de totales a la
// derecha. La diferencia está en una sola cosa, y es la razón de ser de la app:
//
//   **Los totales son números calculados, no fórmulas con rangos escritos a
//   mano.** El Excel original suma `$G$8:$G$1027`; la fila 1028 existe y no se
//   suma, y nadie se entera nunca. Ese es L-001, y es por lo que este proyecto
//   existe. Acá el total lo calcula la app recorriendo todo, sin ningún tope.
//
// ── Decisiones de producto que tomó el usuario (2026-08-27) ──────────────────
//
//   - La columna «G/Acum./Mes» y el bloque «GASTOS POR TIPO» se rellenan con
//     los números ya calculados.
//   - La columna MONTO lleva **el equivalente en euros**, una sola moneda, para
//     que sumar la columna dé un número con sentido.
//
// Un movimiento en otra moneda al que le falta el tipo de cambio **no se puede
// convertir**. No se descarta ni se pone en cero: entra con el monto vacío y el
// motivo escrito en DETALLES. Una fila que desaparece en silencio es exactamente
// la falla que la app viene a eliminar.
//
// ── Sobre las direcciones que va a ver la guardia de privacidad ──────────────
//
// Las constantes `NS_*` de más abajo son **espacios de nombres de XML**:
// identificadores que el formato exige escribir tal cual, no direcciones. Nadie
// se conecta ahí, y Excel abre un .xlsx sin conexión. Están permitidas de forma
// explícita y acotada en `tools/privacidad.mjs`. Ver ADR-027.
//
// (Este comentario no las escribe: la guardia solo acepta las cadenas exactas
// de su lista, y un ejemplo suelto en un comentario es una dirección más. Frenó
// la construcción cuando estaban escritas acá, que es justo lo que se le pide.)

import { crearZip } from './zip.js';
import { mesesConMovimientos, movimientosDelMes, porRubro, porDia, totalesDelMes } from '../core/calculos.js';
import { movimientoEnEuros, faltaCambioPara } from '../core/cambio.js';
import { TIPO_GASTO, TIPO_INGRESO, mesDe, hoy } from '../core/modelo.js';
import { formatearMes, formatearRubro } from '../core/formato.js';

const NS_HOJA = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_RELACIONES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PAQUETE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_TIPOS = 'http://schemas.openxmlformats.org/package/2006/content-types';

export const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** El nombre del archivo: la fecha adelante, para que ordenen solos. */
export function nombreDeLaPlanilla(fecha = hoy()) {
  return `viajecor-${fecha}.xlsx`;
}

// Escapa para XML, que no es lo mismo que escapar para HTML: acá hay que
// escapar también las comillas, porque en el XML de una hoja el texto puede
// caer dentro de un atributo. Se llama distinto que el `escapar()` de la
// interfaz a propósito.
const escaparXml = (texto) => String(texto)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const LETRAS_DE_COLUMNA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const columnaDeExcel = (n) => (n < 26 ? LETRAS_DE_COLUMNA[n] : LETRAS_DE_COLUMNA[Math.floor(n / 26) - 1] + LETRAS_DE_COLUMNA[n % 26]);

// Estilos, por número, tal como los define `estilos()` más abajo.
const NORMAL = 0;
const TITULO = 1;
const ENCABEZADO = 2;
const EUROS = 3;
const MES_LARGO = 4;

function celda(col, fila, valor, estilo = NORMAL) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const ref = `${columnaDeExcel(col)}${fila}`;
  const s = estilo ? ` s="${estilo}"` : '';

  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

/**
 * Una fecha como el número de serie que usa Excel.
 *
 * Excel cuenta días desde el 1900-01-01 y **cree que 1900 fue bisiesto**, cosa
 * que no fue. El error está en el formato desde 1985, por compatibilidad con
 * Lotus 1-2-3, y no se puede arreglar sin romper todas las planillas del mundo:
 * el desplazamiento de 25569 días desde la época de Unix ya lo tiene en cuenta.
 */
export function fechaDeExcel(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return Math.round(Date.UTC(anio, mes - 1, dia) / 86400000) + 25569;
}

/** De céntimos a euros, que es como Excel espera un importe. */
const aEuros = (centimos) => centimos / 100;

/**
 * Dos decimales, que es lo que Excel va a mostrar.
 *
 * No es `redondear()` de `core/dinero.js`: aquella trabaja en unidades mínimas
 * enteras (ADR-005) y esta pasa a euros con coma para Excel, que es el único
 * lugar de la app donde el dinero deja de ser entero. Se llama distinto a
 * propósito, para que nadie use una creyendo que es la otra.
 */
const aDosDecimales = (euros) => Math.round(euros * 100) / 100;

/**
 * Una rejilla de celdas, que después se convierte en el XML de la hoja.
 *
 * Existe porque los bloques de la derecha (`GASTOS POR TIPO`, `TOTALES`, `GASTO
 * POR DÍA`) ocupan las mismas filas que los movimientos de la izquierda, y en el
 * XML de una hoja **cada fila se escribe una sola vez, con sus celdas en orden**.
 * La primera versión escribía las filas y después les pegaba las celdas de la
 * derecha con un `replace` sobre el texto del XML: andaba, y era exactamente la
 * clase de código que funciona hasta que alguien agrega un bloque más.
 */
function nuevaRejilla() {
  const celdas = new Map();

  return {
    poner(fila, col, valor, estilo = NORMAL) {
      if (valor === '' || valor === null || valor === undefined) return;
      celdas.set(`${fila}|${col}`, { fila, col, valor, estilo });
    },
    aXml() {
      const porFila = new Map();
      for (const celda of celdas.values()) {
        if (!porFila.has(celda.fila)) porFila.set(celda.fila, []);
        porFila.get(celda.fila).push(celda);
      }

      return [...porFila.keys()].sort((a, b) => a - b).map((fila) => {
        const contenido = porFila.get(fila)
          .sort((a, b) => a.col - b.col)
          .map((c) => celda(c.col, c.fila, c.valor, c.estilo))
          .join('');
        return `<row r="${fila}">${contenido}</row>`;
      }).join('');
    },
  };
}

// Las dos columnas del bloque de la derecha.
const COL_RESUMEN = 9;
const COL_RESUMEN_VALOR = 10;

/**
 * Escribe el bloque de un mes en la rejilla y devuelve dónde sigue el siguiente.
 *
 * A la izquierda van los movimientos, uno por fila, con el acumulado del mes.
 * A la derecha van los resúmenes que la planilla original tenía como fórmulas:
 * gastos por rubro, ingresos por rubro, los totales y el gasto por día.
 *
 * Todo eso está **calculado sobre todas las filas**, sin ningún rango escrito a
 * mano. Es la única diferencia con la planilla original, y es la razón de ser de
 * la app (L-001).
 */
function escribirMes(rejilla, estado, mes, desde) {
  const movimientos = movimientosDelMes(estado.movimientos, mes)
    .slice()
    // Por fecha y, a igual fecha, por orden de carga: el mismo criterio con el
    // que se ven en la app, para que la planilla y la pantalla cuenten lo mismo.
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado).localeCompare(String(b.creado)));

  let n = desde + 1;
  rejilla.poner(n, 0, formatearMes(mes).toUpperCase().replace(' DE ', ' '), TITULO);
  n += 2;

  rejilla.poner(n, 0, 'INGRESOS Y GASTOS', ENCABEZADO);
  rejilla.poner(n, COL_RESUMEN, 'GASTOS POR TIPO', ENCABEZADO);
  // Dos filas más abajo: una es la de los encabezados (`RUBRO` / `MONTO`) que se
  // escriben justo debajo. Con una sola, el primer rubro los pisaba — y como la
  // rejilla guarda una celda por posición, lo hacía en silencio.
  const filaDelResumen = n + 2;
  n += 1;

  for (const [i, titulo] of ['G/Acum./Mes', 'Comentarios', 'DÍA', 'MES', 'DETALLES', 'RUBRO', 'MONTO', 'I/G'].entries()) {
    rejilla.poner(n, i, titulo, ENCABEZADO);
  }
  rejilla.poner(n, COL_RESUMEN, 'RUBRO', ENCABEZADO);
  rejilla.poner(n, COL_RESUMEN_VALOR, 'MONTO', ENCABEZADO);
  n += 1;

  // ── Los movimientos ────────────────────────────────────────────────────────
  let acumulado = 0;
  let sinConvertir = 0;

  for (const movimiento of movimientos) {
    const falta = faltaCambioPara(movimiento, estado.tipos_cambio);
    let euros = null;

    if (falta) {
      sinConvertir += 1;
    } else {
      euros = aEuros(movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas));
      if (movimiento.tipo === TIPO_GASTO) acumulado += euros;
    }

    // El detalle del usuario se conserva entero; el motivo se agrega al lado.
    const motivo = falta
      ? `falta el tipo de cambio de ${movimiento.moneda} para ${mesDe(movimiento.fecha)}`
      : '';

    if (movimiento.tipo === TIPO_GASTO && !falta) {
      rejilla.poner(n, 0, aDosDecimales(acumulado), EUROS);
    }
    rejilla.poner(n, 1, movimiento.comentario);
    rejilla.poner(n, 2, Number(movimiento.fecha.slice(8, 10)));
    rejilla.poner(n, 3, fechaDeExcel(`${mes}-01`), MES_LARGO);
    rejilla.poner(n, 4, [movimiento.detalle, motivo].filter(Boolean).join(' — '));
    rejilla.poner(n, 5, formatearRubro(movimiento.rubro));
    rejilla.poner(n, 6, euros === null ? '' : aDosDecimales(euros), EUROS);
    rejilla.poner(n, 7, movimiento.tipo);
    n += 1;
  }

  const ultimaDeLaIzquierda = n;
  const ultimaDeLaDerecha = escribirResumen(rejilla, estado, mes, filaDelResumen);

  return { siguiente: Math.max(ultimaDeLaIzquierda, ultimaDeLaDerecha) + 1, sinConvertir };
}

/** Los bloques de la derecha. Devuelve la última fila que ocupó. */
function escribirResumen(rejilla, estado, mes, desde) {
  let n = desde;

  const bloque = (titulo, filas) => {
    if (titulo !== null) {
      rejilla.poner(n, COL_RESUMEN, titulo, ENCABEZADO);
      rejilla.poner(n, COL_RESUMEN_VALOR, 'MONTO', ENCABEZADO);
      n += 1;
    }
    for (const [etiqueta, valor] of filas) {
      rejilla.poner(n, COL_RESUMEN, etiqueta);
      rejilla.poner(n, COL_RESUMEN_VALOR, aDosDecimales(valor), EUROS);
      n += 1;
    }
    n += 1; // una fila de aire entre bloques
  };

  // El encabezado de este primero ya lo escribió `escribirMes`, junto con el
  // título "GASTOS POR TIPO" que va una fila más arriba.
  bloque(null, porRubro(estado, mes, TIPO_GASTO).map((r) => [formatearRubro(r.rubro), aEuros(r.total)]));

  const ingresos = porRubro(estado, mes, TIPO_INGRESO);
  if (ingresos.length > 0) {
    bloque('INGRESOS POR TIPO', ingresos.map((r) => [formatearRubro(r.rubro), aEuros(r.total)]));
  }

  const totales = totalesDelMes(estado, mes);
  bloque('TOTALES', [
    ['Gastos', aEuros(totales.gastos)],
    ['Ingresos', aEuros(totales.ingresos)],
    ['Saldo', aEuros(totales.saldo)],
  ]);

  // El gasto por día lleva **todos** los días del mes, también los de cero: es
  // un calendario, y un calendario al que le faltan días no se puede leer.
  bloque('GASTO POR DÍA', porDia(estado, mes).map((d) => [d.dia, aEuros(d.gasto)]));

  return n - 1;
}

/**
 * La hoja entera: un bloque por mes, del más viejo al más nuevo, como la
 * planilla original.
 */
export function hojaDeMovimientos(estado) {
  const meses = mesesConMovimientos(estado.movimientos ?? []).slice().sort();
  const rejilla = nuevaRejilla();
  let n = 1;
  let sinConvertir = 0;

  for (const mes of meses) {
    const bloque = escribirMes(rejilla, estado, mes, n);
    sinConvertir += bloque.sinConvertir;
    n = bloque.siguiente;
  }

  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_HOJA}"><cols>
<col min="1" max="1" width="12"/><col min="2" max="2" width="18"/>
<col min="3" max="3" width="6"/><col min="4" max="4" width="16"/>
<col min="5" max="5" width="28"/><col min="6" max="6" width="16"/>
<col min="7" max="7" width="12"/><col min="8" max="8" width="5"/>
<col min="10" max="10" width="16"/><col min="11" max="11" width="12"/>
</cols><sheetData>${rejilla.aXml()}</sheetData></worksheet>`,
    sinConvertir,
    meses: meses.length,
  };
}

/**
 * Los estilos. Excel necesita este archivo aunque no se use ninguno: sin él, no
 * abre.
 */
function estilos() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS_HOJA}">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>
<numFmt numFmtId="165" formatCode="mmmm\\ yyyy"/>
</numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/**
 * La planilla entera, lista para guardar. Devuelve `{ nombre, bytes, tipo,
 * sinConvertir, meses }`.
 */
export function crearPlanilla(estado, { fecha = hoy() } = {}) {
  const hoja = hojaDeMovimientos(estado);

  const partes = [
    {
      nombre: '[Content_Types].xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS_TIPOS}">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      nombre: '_rels/.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_PAQUETE}">
<Relationship Id="rId1" Type="${NS_RELACIONES}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS_HOJA}" xmlns:r="${NS_RELACIONES}">
<sheets><sheet name="Ingresos y gastos" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_PAQUETE}">
<Relationship Id="rId1" Type="${NS_RELACIONES}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${NS_RELACIONES}/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { nombre: 'xl/styles.xml', contenido: estilos() },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja.xml },
  ];

  return {
    nombre: nombreDeLaPlanilla(fecha),
    bytes: crearZip(partes),
    tipo: TIPO_XLSX,
    sinConvertir: hoja.sinConvertir,
    meses: hoja.meses,
    cuantos: (estado.movimientos ?? []).length,
  };
}
