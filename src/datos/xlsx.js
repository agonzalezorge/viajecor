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
import { mesesConMovimientos, movimientosDelMes, porRubro, porDia, totalesDelMes,
  matrizMesRubro } from '../core/calculos.js';
import { movimientoEnEuros, faltaCambioPara } from '../core/cambio.js';
import { TIPO_GASTO, TIPO_INGRESO, mesDe, hoy, rubrosDe } from '../core/modelo.js';
import { formatearMes, formatearMesCorto, formatearRubro } from '../core/formato.js';
import { FONDOS_RUBRO, franjaDeRubro } from '../core/paleta.js';

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

// Estilos, por número, tal como los define `FORMATOS` más abajo.
const NORMAL = 0;
const TITULO = 1;
const ENCABEZADO = 2;
const EUROS = 3;
const MES_CORTO = 4;
const BANDA = 5;
const TIPO = 6;
const CELDA = 7;
const CENTRADA = 8;
const EUROS_TOTAL = 9;

// Los encabezados de rubro con su color empiezan acá; la celda del rubro en la
// lista de movimientos, ocho más adelante. Se suma la franja del rubro (1 a 8).
const RUBRO_ENCABEZADO_BASE = 9;
const RUBRO_CELDA_BASE = 17;

function celda(col, fila, valor, estilo = NORMAL) {
  const ref = `${columnaDeExcel(col)}${fila}`;
  const s = estilo ? ` s="${estilo}"` : '';

  // Sin valor: una celda que solo lleva formato. Es lo que da los bordes de una
  // fila y lo que sostiene las celdas de al lado de una banda combinada.
  if (valor === '' || valor === null || valor === undefined) {
    return estilo === NORMAL ? '' : `<c r="${ref}"${s}/>`;
  }

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
function aDosDecimales(euros) {
  // Se rechaza lo que no es un número en vez de convertirlo. `Math.round('' *
  // 100)` da 0 sin decir nada, y una celda de dinero en 0 se lee exactamente
  // igual que un 0 de verdad: sería un importe inventado con aspecto de dato.
  // Lo destapó una mutación (2026-08-27) que parecía inofensiva justamente
  // porque esta conversión la tapaba.
  if (typeof euros !== 'number' || !Number.isFinite(euros)) {
    throw new Error(`Un importe de la planilla no es un número: ${JSON.stringify(euros)}.`);
  }
  return Math.round(euros * 100) / 100;
}

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
  const combinadas = [];

  return {
    /**
     * Pone una celda. Sin valor pero con estilo, escribe una celda **vacía con
     * formato**: es lo que hace falta para los bordes de una fila y para las
     * celdas de al lado de una banda combinada.
     *
     * La primera versión ponía un espacio en esos casos. Andaba, pero dejaba la
     * planilla llena de celdas que *parecen* vacías y no lo son: filtrar,
     * ordenar o contar en Excel las trata como texto.
     */
    poner(fila, col, valor, estilo = NORMAL) {
      const vacia = valor === '' || valor === null || valor === undefined;
      if (vacia && estilo === NORMAL) return;
      celdas.set(`${fila}|${col}`, { fila, col, valor: vacia ? null : valor, estilo });
    },
    /**
     * Une varias celdas en una, para las bandas de título.
     *
     * En Excel una celda combinada **sigue siendo varias celdas**: la de arriba
     * a la izquierda lleva el valor y las otras tienen que existir igual, aunque
     * sea vacías, o el archivo queda inconsistente. Por eso quien llama a esto
     * escribe también las celdas de al lado con un espacio.
     */
    combinar(desdeFila, desdeCol, hastaFila, hastaCol) {
      combinadas.push(
        `${columnaDeExcel(desdeCol)}${desdeFila}:${columnaDeExcel(hastaCol)}${hastaFila}`
      );
    },
    combinadas: () => combinadas,
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

// La primera columna del bloque de la derecha. Los rubros se escriben a lo
// ancho desde acá, como en la planilla original.
const COL_RESUMEN = 9;

/**
 * Escribe el bloque de un mes en la rejilla y devuelve dónde sigue el siguiente.
 *
 * A la izquierda, los movimientos uno por fila con el acumulado del mes. A la
 * derecha, los resúmenes que en la planilla original son fórmulas: gastos por
 * rubro, ingresos por rubro, los totales y el gasto por día.
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

  // La banda amarilla con el mes, cruzando el ancho, como en la original.
  const filaDelTitulo = n;
  for (let col = 0; col <= COL_RESUMEN + 8; col += 1) {
    rejilla.poner(n, col, col === 0 ? formatearMes(mes).toUpperCase().replace(' DE ', ' ') : null, TITULO);
  }
  rejilla.combinar(n, 0, n, COL_RESUMEN + 8);
  n += 2;

  // La banda rosa de "INGRESOS Y GASTOS" sobre las columnas de la izquierda.
  const ENCABEZADOS = ['G/Acum./Mes', 'Comentarios', 'DÍA', 'MES', 'DETALLES', 'RUBRO', 'MONTO', 'I/G'];
  for (let col = 0; col < ENCABEZADOS.length; col += 1) {
    rejilla.poner(n, col, col === 0 ? 'INGRESOS Y GASTOS' : null, BANDA);
  }
  rejilla.combinar(n, 0, n, ENCABEZADOS.length - 1);
  const filaDelResumen = n;
  n += 1;

  for (const [col, titulo] of ENCABEZADOS.entries()) rejilla.poner(n, col, titulo, ENCABEZADO);
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

    rejilla.poner(n, 0, movimiento.tipo === TIPO_GASTO && !falta ? aDosDecimales(acumulado) : null, EUROS);
    rejilla.poner(n, 1, movimiento.comentario || null, CELDA);
    rejilla.poner(n, 2, Number(movimiento.fecha.slice(8, 10)), CENTRADA);
    rejilla.poner(n, 3, fechaDeExcel(`${mes}-01`), MES_CORTO);
    rejilla.poner(n, 4, [movimiento.detalle, motivo].filter(Boolean).join(' — ') || null, CELDA);
    // El rubro va con SU color, el mismo que tiene en la app (T-909, T-916).
    rejilla.poner(n, 5, formatearRubro(movimiento.rubro),
      RUBRO_CELDA_BASE + franjaDeRubro(movimiento.tipo, movimiento.rubro, estado?.rubros));
    rejilla.poner(n, 6, euros === null ? null : aDosDecimales(euros), EUROS);
    rejilla.poner(n, 7, movimiento.tipo, TIPO);
    n += 1;
  }

  const ultimaDeLaIzquierda = n;
  const ultimaDeLaDerecha = escribirResumen(rejilla, estado, mes, filaDelResumen);

  return {
    siguiente: Math.max(ultimaDeLaIzquierda, ultimaDeLaDerecha) + 1,
    sinConvertir,
    filaDelTitulo,
  };
}

/**
 * Todos los rubros de un tipo, con su total del mes — T-915.
 *
 * **Incluye los que no se usaron, en cero.** Es lo contrario de lo que hace la
 * app en pantalla, donde `porRubro()` devuelve solo los rubros con movimientos:
 * en un celular, ocho columnas en cero son ruido que tapa las tres que importan.
 *
 * En una planilla es al revés, y por eso el usuario lo pidió (2026-08-27): con
 * todos los rubros siempre presentes, cada uno cae **en el mismo lugar todos los
 * meses**, se pueden comparar meses de un vistazo y se pueden arrastrar
 * fórmulas. El mismo dato quiere formas distintas según dónde se lo mire.
 *
 * El orden es el de la lista de rubros, no el del tamaño: si fuera por tamaño,
 * cada mes tendría las columnas en otro lugar y se perdería justamente lo que
 * hace útil tenerlas todas.
 */
function todosLosRubros(estado, mes, tipo) {
  const conMovimientos = new Map(porRubro(estado, mes, tipo).map((r) => [r.rubro, r.total]));

  // El tercer elemento es el rubro sin formatear: lo necesita el color, que se
  // calcula con la clave y no con la etiqueta que se muestra.
  return rubrosDe(tipo, estado?.rubros).map((rubro) => [
    formatearRubro(rubro),
    aEuros(conMovimientos.get(rubro) ?? 0),
    rubro,
  ]);
}

/**
 * Los bloques de la derecha, con los rubros **a lo ancho** — T-916.
 *
 * Es la forma de la planilla original: una fila de encabezados con los ocho
 * rubros y una fila de valores debajo, con una columna `TOTAL` al final. Puestos
 * así, los doce meses del año quedan uno debajo del otro y se leen como una
 * tabla; puestos en filas, cada mes es una lista que hay que recorrer.
 *
 * Devuelve la última fila que ocupó.
 */
function escribirResumen(rejilla, estado, mes, desde) {
  let n = desde;

  const bloque = (titulo, columnas, tipo) => {
    // La banda rosa del título, cruzando el ancho del bloque.
    for (let i = 0; i <= columnas.length; i += 1) {
      rejilla.poner(n, COL_RESUMEN + i, i === 0 ? titulo : null, BANDA);
    }
    rejilla.combinar(n, COL_RESUMEN, n, COL_RESUMEN + columnas.length);
    n += 1;

    // Los encabezados, cada uno con el color de su rubro.
    for (const [i, [etiqueta]] of columnas.entries()) {
      const estilo = tipo === null
        ? ENCABEZADO
        : RUBRO_ENCABEZADO_BASE + franjaDeRubro(tipo, columnas[i][2] ?? etiqueta, estado?.rubros);
      rejilla.poner(n, COL_RESUMEN + i, etiqueta.toUpperCase(), estilo);
    }
    rejilla.poner(n, COL_RESUMEN + columnas.length, 'TOTAL', ENCABEZADO);
    n += 1;

    // Y la fila de valores, con su total al final.
    let total = 0;
    for (const [i, [, valor]] of columnas.entries()) {
      total += valor;
      rejilla.poner(n, COL_RESUMEN + i, aDosDecimales(valor), EUROS);
    }
    rejilla.poner(n, COL_RESUMEN + columnas.length, aDosDecimales(total), EUROS_TOTAL);
    n += 2;  // una fila de aire entre bloques
  };

  bloque('GASTOS POR TIPO', todosLosRubros(estado, mes, TIPO_GASTO), TIPO_GASTO);
  bloque('INGRESOS POR TIPO', todosLosRubros(estado, mes, TIPO_INGRESO), TIPO_INGRESO);

  const totales = totalesDelMes(estado, mes);
  // Los totales no llevan color de rubro: no son rubros. Y el saldo se llama
  // "SALDO MENSUAL", como en la planilla original.
  bloqueDeTotales(rejilla, n, totales);
  n += 4;  // tres filas del bloque más una de aire, como los demás

  // El gasto por día lleva TODOS los días del mes, también los de cero: es un
  // calendario, y a un calendario al que le faltan días no se lo puede leer.
  const dias = porDia(estado, mes);
  for (let i = 0; i <= dias.length; i += 1) {
    rejilla.poner(n, COL_RESUMEN + i, i === 0 ? 'GASTO POR DÍA' : null, BANDA);
  }
  rejilla.combinar(n, COL_RESUMEN, n, COL_RESUMEN + dias.length);
  n += 1;
  for (const [i, dia] of dias.entries()) {
    rejilla.poner(n, COL_RESUMEN + i, dia.dia, ENCABEZADO);
    rejilla.poner(n + 1, COL_RESUMEN + i, aDosDecimales(aEuros(dia.gasto)), EUROS);
  }
  n += 2;

  return n;
}

/** El bloque de totales: gastos, ingresos y saldo mensual. */
function bloqueDeTotales(rejilla, fila, totales) {
  for (let i = 0; i < 3; i += 1) {
    rejilla.poner(fila, COL_RESUMEN + i, i === 0 ? 'TOTALES' : null, BANDA);
  }
  rejilla.combinar(fila, COL_RESUMEN, fila, COL_RESUMEN + 2);

  for (const [i, etiqueta] of ['GASTOS', 'INGRESOS', 'SALDO MENSUAL'].entries()) {
    rejilla.poner(fila + 1, COL_RESUMEN + i, etiqueta, ENCABEZADO);
  }
  for (const [i, valor] of [totales.gastos, totales.ingresos, totales.saldo].entries()) {
    rejilla.poner(fila + 2, COL_RESUMEN + i, aDosDecimales(aEuros(valor)), EUROS_TOTAL);
  }
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
<col min="10" max="18" width="14"/>
</cols><sheetData>${rejilla.aXml()}</sheetData>${
  // Las celdas combinadas van DESPUÉS de sheetData: el esquema de una hoja fija
  // el orden de sus partes y Excel se niega a abrir el archivo si se altera.
  rejilla.combinadas().length > 0
    ? `<mergeCells count="${rejilla.combinadas().length}">${
        rejilla.combinadas().map((r) => `<mergeCell ref="${r}"/>`).join('')
      }</mergeCells>`
    : ''
}</worksheet>`,
    sinConvertir,
    meses: meses.length,
  };
}

/**
 * La hoja de análisis: la matriz mes × rubro — T-910. Es la hoja `Analisis1` de
 * la planilla original.
 *
 * **Cuenta exactamente lo mismo que la pantalla de evolución** (T-021): los
 * mismos meses, los mismos rubros siempre —los ocho de gasto y los cuatro de
 * ingreso—, el mismo criterio para el total y el promedio. No es una casualidad: las dos leen `matrizMesRubro()`. Dos
 * cálculos separados para la misma tabla terminan diciendo cosas distintas, y el
 * usuario no tendría forma de saber a cuál creerle.
 *
 * **La regla del promedio va escrita en la propia hoja**, debajo de la tabla.
 * Es toda la diferencia con `Analisis1`: ahí el total sumaba once meses y el
 * promedio promediaba diez, y no estaba dicho en ningún lado (L-006, ADR-031).
 * Una planilla que se abre dentro de un año tiene que poder explicarse sola.
 */
export function hojaDeAnalisis(estado, mesActual = mesDe(hoy())) {
  const rejilla = nuevaRejilla();
  const matriz = matrizMesRubro(estado, mesActual);
  // Los rubros de gasto, los de ingreso, y gastos, ingresos y saldo.
  const ancho = matriz.rubros.length + matriz.rubrosIngreso.length + 3;
  const COL_GASTOS = 2 + matriz.rubros.length;
  const COL_ING_1 = COL_GASTOS + 1;
  const COL_INGRESOS = COL_ING_1 + matriz.rubrosIngreso.length;

  // La banda de título, como los bloques de la otra hoja.
  for (let i = 0; i <= ancho; i += 1) {
    rejilla.poner(1, 1 + i, i === 0 ? 'EVOLUCIÓN MES A MES' : null, BANDA);
  }
  rejilla.combinar(1, 1, 1, 1 + ancho);

  // Una fila de rótulos arriba de los encabezados, que dice de qué es cada
  // bloque. Hace falta porque `otros` está en los rubros de gasto y en los de
  // ingreso, y son cosas distintas (RN-02): dos columnas llamadas "OTROS" en la
  // misma hoja, sin nada que las separe, es un número leído en la columna
  // equivocada. La pantalla lleva la misma banda, por el mismo motivo.
  rejilla.poner(2, 2, 'RUBROS DE GASTO', ENCABEZADO);
  rejilla.combinar(2, 2, 2, 1 + matriz.rubros.length);
  rejilla.poner(2, COL_ING_1, 'RUBROS DE INGRESO', ENCABEZADO);
  rejilla.combinar(2, COL_ING_1, 2, COL_INGRESOS - 1);

  // Los encabezados: el mes, los rubros con su color, y las tres cuentas.
  rejilla.poner(3, 1, 'MES', ENCABEZADO);
  for (const [i, rubro] of matriz.rubros.entries()) {
    rejilla.poner(3, 2 + i, formatearRubro(rubro).toUpperCase(),
      RUBRO_ENCABEZADO_BASE + franjaDeRubro(TIPO_GASTO, rubro, estado?.rubros));
  }
  for (const [i, rubro] of matriz.rubrosIngreso.entries()) {
    rejilla.poner(3, COL_ING_1 + i, formatearRubro(rubro).toUpperCase(),
      RUBRO_ENCABEZADO_BASE + franjaDeRubro(TIPO_INGRESO, rubro, estado?.rubros));
  }
  rejilla.poner(3, COL_GASTOS, 'GASTOS', ENCABEZADO);
  rejilla.poner(3, COL_INGRESOS, 'INGRESOS', ENCABEZADO);
  rejilla.poner(3, COL_INGRESOS + 1, 'SALDO', ENCABEZADO);

  // Una fila por mes, del más viejo al más nuevo — como `Analisis1`. En la
  // pantalla van al revés porque ahí lo primero que se mira es el mes pasado;
  // en una planilla se lee de arriba abajo como una línea de tiempo.
  let n = 4;
  const filaDeValores = (etiqueta, valores, estilo) => {
    rejilla.poner(n, 1, etiqueta, MES_CORTO);
    for (const [i, valor] of valores.rubros.entries()) {
      rejilla.poner(n, 2 + i, aDosDecimales(aEuros(valor)), estilo);
    }
    for (const [i, valor] of valores.rubrosIngreso.entries()) {
      rejilla.poner(n, COL_ING_1 + i, aDosDecimales(aEuros(valor)), estilo);
    }
    rejilla.poner(n, COL_GASTOS, aDosDecimales(aEuros(valores.gastos)), EUROS_TOTAL);
    rejilla.poner(n, COL_INGRESOS, aDosDecimales(aEuros(valores.ingresos)), EUROS_TOTAL);
    rejilla.poner(n, COL_INGRESOS + 1, aDosDecimales(aEuros(valores.saldo)), EUROS_TOTAL);
    n += 1;
  };

  for (const fila of matriz.filas) {
    filaDeValores(formatearMesCorto(fila.mes), fila, EUROS);
  }

  if (matriz.total !== null) {
    filaDeValores('TOTAL', matriz.total, EUROS_TOTAL);
    filaDeValores('PROMEDIO', matriz.promedio, EUROS_TOTAL);

    const meses = matriz.mesesDelPromedio === 1 ? '1 mes' : `${matriz.mesesDelPromedio} meses`;
    rejilla.poner(n + 1, 1, matriz.dejaAfuera === null
      ? `El promedio es sobre ${meses}.`
      : `El promedio es sobre los ${meses} terminados: deja afuera ${formatearMesCorto(matriz.dejaAfuera)}, que todavía va por la mitad. El total sí lo incluye.`);
  }

  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_HOJA}"><cols>
<col min="1" max="1" width="12"/><col min="2" max="${1 + ancho}" width="14"/>
</cols><sheetData>${rejilla.aXml()}</sheetData>${
  rejilla.combinadas().length > 0
    ? `<mergeCells count="${rejilla.combinadas().length}">${
        rejilla.combinadas().map((r) => `<mergeCell ref="${r}"/>`).join('')
      }</mergeCells>`
    : ''
}</worksheet>`,
    filas: matriz.filas.length,
  };
}

/**
 * Los estilos de la planilla.
 *
 * Excel necesita este archivo aunque no se use ninguno: sin él, no abre. Y su
 * orden interno es rígido —`numFmts`, `fonts`, `fills`, `borders`,
 * `cellStyleXfs`, `cellXfs`— y no perdona.
 *
 * Se genera en vez de escribirse a mano porque hay un relleno por rubro: doce
 * colores escritos uno por uno serían doce oportunidades de equivocarse en un
 * índice, y un índice equivocado no da error, **pinta la celda de otro color**.
 */
function estilos() {
  // Los rellenos: los dos que Excel exige primero, después los de las bandas, y
  // al final los ocho de los rubros. El orden fija los números de más abajo.
  const rellenos = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    relleno('FFFF00'),   // 2 · la banda del mes, amarilla como la original
    relleno('F2D9E6'),   // 3 · las bandas de título de bloque, rosas
    relleno('E8E8E8'),   // 4 · los encabezados de columna
    ...FONDOS_RUBRO.map((color) => relleno(color.slice(1).toUpperCase())),  // 5..12
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS_HOJA}">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>
<numFmt numFmtId="165" formatCode="mm/yy"/>
</numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF444444"/><name val="Calibri"/></font>
</fonts>
<fills count="${rellenos.length}">${rellenos.join('')}</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right>
<top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom>
<diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${FORMATOS.length}">${FORMATOS.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const relleno = (rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;

/**
 * Un formato de celda. Los nombres dicen para qué es cada uno, porque en el XML
 * son números y un número equivocado no da error: cambia cómo se ve el dato.
 */
const formato = ({ numero = 0, fuente = 0, relleno: fill = 0, borde = 0, centrado = false } = {}) =>
  `<xf numFmtId="${numero}" fontId="${fuente}" fillId="${fill}" borderId="${borde}" xfId="0"` +
  ` applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"` +
  `${centrado ? ' applyAlignment="1"><alignment horizontal="center"/></xf>' : '/>'}`;

// El orden de esta lista fija los números que usa la hoja. Agregar uno al final
// es seguro; meterlo en el medio corre todos los de abajo.
const FORMATOS = [
  formato(),                                                        // 0 NORMAL
  formato({ fuente: 1, relleno: 2, centrado: true, borde: 1 }),      // 1 TITULO (banda del mes)
  formato({ fuente: 2, relleno: 4, borde: 1, centrado: true }),      // 2 ENCABEZADO
  formato({ numero: 164, borde: 1 }),                                // 3 EUROS
  formato({ numero: 165, borde: 1, centrado: true }),                // 4 MES_CORTO
  formato({ fuente: 2, relleno: 3, borde: 1, centrado: true }),      // 5 BANDA (título de bloque)
  formato({ fuente: 3, borde: 1, centrado: true }),                  // 6 TIPO (la I/G, en rojo)
  formato({ borde: 1 }),                                             // 7 CELDA (texto con borde)
  formato({ borde: 1, centrado: true }),                             // 8 CENTRADA
  formato({ numero: 164, fuente: 2, relleno: 4, borde: 1 }),         // 9 EUROS_TOTAL
  // 10..17 · un encabezado por rubro, con su color. Tienen que quedar al final:
  // la hoja los busca sumando la franja del rubro a RUBRO_BASE.
  ...FONDOS_RUBRO.map((_, i) => formato({ fuente: 2, relleno: 5 + i, borde: 1, centrado: true })),
  // 18..25 · la celda del rubro en la lista de movimientos, con el mismo color.
  ...FONDOS_RUBRO.map((_, i) => formato({ relleno: 5 + i, borde: 1, centrado: true })),
];

/**
 * La planilla entera, lista para guardar. Devuelve `{ nombre, bytes, tipo,
 * sinConvertir, meses }`.
 */
export function crearPlanilla(estado, { fecha = hoy() } = {}) {
  const hoja = hojaDeMovimientos(estado);
  const analisis = hojaDeAnalisis(estado);

  const partes = [
    {
      nombre: '[Content_Types].xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS_TIPOS}">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
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
<sheets><sheet name="Ingresos y gastos" sheetId="1" r:id="rId1"/><sheet name="Evolución" sheetId="2" r:id="rId3"/></sheets>
</workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_PAQUETE}">
<Relationship Id="rId1" Type="${NS_RELACIONES}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${NS_RELACIONES}/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="${NS_RELACIONES}/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`,
    },
    { nombre: 'xl/styles.xml', contenido: estilos() },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja.xml },
    { nombre: 'xl/worksheets/sheet2.xml', contenido: analisis.xml },
  ];

  return {
    nombre: nombreDeLaPlanilla(fecha),
    bytes: crearZip(partes),
    tipo: TIPO_XLSX,
    sinConvertir: hoja.sinConvertir,
    meses: hoja.meses,
    filasDeAnalisis: analisis.filas,
    cuantos: (estado.movimientos ?? []).length,
  };
}
