// Leer una planilla `.xlsx` — T-031, CU-13.
//
// Devuelve las celdas de la primera hoja, con su fila, su columna y su valor ya
// interpretado. No sabe nada de gastos: eso lo decide el mapeo (T-032 y
// `docs/MAPEO-EXCEL.md`). Acá termina el formato y empieza el significado.
//
// ── Las tres cosas que un .xlsx esconde ─────────────────────────────────────
//
//   1. **El texto no está en la hoja.** Excel guarda cada texto una sola vez en
//      `xl/sharedStrings.xml` y en la celda pone un número que es su posición en
//      esa lista. Una celda con `t="s"` y `<v>4</v>` no dice «4»: dice «el
//      cuarto texto». Sin resolver eso, todos los rubros de la planilla se leen
//      como números.
//   2. **Las fechas son números.** `46082` es el 1 de marzo de 2026. Lo único
//      que lo distingue de un importe de 46 082 € es **el formato de la celda**,
//      que vive en `xl/styles.xml`, en otra parte del archivo.
//   3. **Las celdas vacías no existen.** Si la fila 7 no tiene nada en la
//      columna B, no hay ninguna celda B7: hay un hueco. Recorrer las celdas que
//      hay y asumir que están todas corre las columnas.

import { leerZip } from './zip.js';
import { recorrerXml } from './xml.js';
import { normalizarClave } from '../core/modelo.js';

/** Los formatos de fecha que Excel trae de fábrica. */
const FORMATOS_DE_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/**
 * Abre una planilla y devuelve sus celdas.
 *
 * **Nunca tira**: devuelve `{ filas }` o `{ error }` con un motivo en castellano.
 * Quien la llama es alguien que eligió un archivo en su teléfono y pudo haber
 * elegido cualquier cosa.
 *
 * `filas` es un `Map` de número de fila a `Map` de letra de columna a
 * `{ valor, esFecha }`.
 */
export async function leerPlanilla(bytes, { hoja: buscada } = {}) {
  const zip = await leerZip(bytes);
  if (zip.error) return { error: zip.error };

  const hoja = buscarHoja(zip.entradas, buscada);
  if (!hoja) {
    if (buscada !== undefined && buscada !== null) {
      const nombres = hojasDelLibro(zip.entradas).map((h) => h.nombre);
      return {
        error: `Este archivo no tiene ninguna hoja llamada "${buscada}". ` +
          (nombres.length > 0
            ? `Las que tiene son: ${nombres.join(', ')}.`
            : 'No se pudo leer la lista de hojas.'),
      };
    }
    return {
      error: 'Este archivo no tiene ninguna hoja de cálculo adentro. ' +
        '¿Puede ser que sea un documento de Word, o un .xlsx dañado?',
    };
  }

  const textos = leerTextosCompartidos(zip.entradas.get('xl/sharedStrings.xml'));
  const formatos = leerFormatos(zip.entradas.get('xl/styles.xml'));

  return { filas: leerCeldas(hoja, textos, formatos) };
}

/**
 * Las hojas del libro, con su nombre y dónde está cada una.
 *
 * **Ahora sí siguiendo las relaciones del libro**, que es lo correcto. La
 * versión anterior agarraba `sheet1.xml` por su nombre de archivo y lo decía:
 * "si algún día hace falta la segunda hoja, hay que hacerlo bien". Hizo falta
 * —los ahorros conjuntos son la TERCERA hoja (T-042)— y el atajo no alcanzaba:
 * el orden de los archivos `sheetN.xml` no tiene por qué ser el de las pestañas,
 * y el nombre visible ("Ahorros conjuntos") solo está en `workbook.xml`.
 *
 * Son dos archivos y hay que cruzarlos: `workbook.xml` dice nombre → `r:id`, y
 * `workbook.xml.rels` dice `r:id` → archivo.
 */
export function hojasDelLibro(entradas) {
  const libro = entradas.get('xl/workbook.xml');
  const relaciones = entradas.get('xl/_rels/workbook.xml.rels');
  if (!libro) return [];

  const porId = new Map();
  if (relaciones) {
    recorrerXml(relaciones, {
      alAbrir(nombre, atributos) {
        if (nombre !== 'Relationship') return;
        const destino = String(atributos.Target ?? '');
        if (destino === '') return;
        // El destino puede venir relativo (`worksheets/sheet1.xml`) o absoluto
        // (`/xl/worksheets/sheet1.xml`): las dos formas son válidas y las
        // escriben programas distintos.
        const ruta = destino.startsWith('/')
          ? destino.slice(1)
          : `xl/${destino.replace(/^\.?\//, '')}`;
        porId.set(atributos.Id, ruta);
      },
    });
  }

  const hojas = [];
  recorrerXml(libro, {
    alAbrir(nombre, atributos) {
      if (nombre !== 'sheet') return;
      const ruta = porId.get(atributos['r:id'] ?? atributos.id);
      if (ruta) hojas.push({ nombre: String(atributos.name ?? ''), ruta });
    },
  });
  return hojas;
}

/**
 * La hoja pedida por nombre, o la primera si no se pide ninguna.
 *
 * El nombre se compara **normalizado** (RN-03): la pestaña puede llamarse
 * "Ahorros conjuntos", "AHORROS CONJUNTOS" o traer un espacio de más, y las
 * tres son la misma pestaña para quien la mira.
 */
function buscarHoja(entradas, buscada) {
  const hojas = hojasDelLibro(entradas);

  if (buscada !== undefined && buscada !== null) {
    const clave = normalizarClave(String(buscada));
    const encontrada = hojas.find((h) => normalizarClave(h.nombre) === clave);
    return encontrada ? entradas.get(encontrada.ruta) ?? null : null;
  }

  if (hojas.length > 0 && entradas.has(hojas[0].ruta)) return entradas.get(hojas[0].ruta);

  // Sin `workbook.xml` legible, el atajo de siempre: es mejor leer algo que
  // negarse a abrir un archivo que quizá está bien.
  if (entradas.has('xl/worksheets/sheet1.xml')) return entradas.get('xl/worksheets/sheet1.xml');
  const alguna = [...entradas.keys()].filter((n) => n.startsWith('xl/worksheets/') && n.endsWith('.xml')).sort();
  return alguna.length > 0 ? entradas.get(alguna[0]) : null;
}

/** La lista de textos compartidos, en orden. Ver el punto 1 de arriba. */
export function leerTextosCompartidos(xml) {
  const textos = [];
  if (!xml) return textos;

  let dentroDeUno = false;
  let juntando = '';

  recorrerXml(xml, {
    alAbrir(nombre) {
      if (nombre === 'si') { dentroDeUno = true; juntando = ''; }
    },
    alTexto(texto) {
      // Se acumula: un mismo texto puede venir partido en varios `<t>` cuando
      // tiene partes con formatos distintos —una palabra en negrita—, y quedarse
      // con el último trozo perdería el resto de la palabra.
      if (dentroDeUno) juntando += texto;
    },
    alCerrar(nombre) {
      if (nombre === 'si') { textos.push(juntando); dentroDeUno = false; }
    },
  });

  return textos;
}

/**
 * Qué estilos son de fecha. Devuelve un `Set` de números de estilo.
 *
 * Hay que cruzar dos cosas: los formatos propios del archivo (`numFmts`, que
 * dicen su código, como `dd/mm/yyyy`) y la lista de estilos (`cellXfs`, que dice
 * qué formato usa cada uno). Una celda dice `s="4"`, el estilo 4 dice
 * `numFmtId="165"`, y el formato 165 dice `mm/yy`.
 */
export function leerFormatos(xml) {
  const deFecha = new Set();
  if (!xml) return deFecha;

  const propios = new Map();
  let enEstilos = false;
  let estilo = 0;

  recorrerXml(xml, {
    alAbrir(nombre, at) {
      if (nombre === 'numFmt') {
        // Un formato es de fecha si su código nombra días, meses o años. Se
        // sacan primero las comillas: un formato de moneda puede llevar el texto
        // "MXN" adentro, y esa "m" no es un mes.
        const codigo = String(at.formatCode ?? '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
        propios.set(Number(at.numFmtId), /[ymd]/i.test(codigo));
        return;
      }
      if (nombre === 'cellXfs') { enEstilos = true; estilo = 0; return; }
      if (nombre === 'xf' && enEstilos) {
        const formato = Number(at.numFmtId ?? 0);
        if (FORMATOS_DE_FECHA.has(formato) || propios.get(formato) === true) deFecha.add(estilo);
        estilo += 1;
      }
    },
    alCerrar(nombre) {
      if (nombre === 'cellXfs') enEstilos = false;
    },
  });

  return deFecha;
}

/** La letra de columna de una referencia: `AN17` → `AN`. */
export function columnaDe(referencia) {
  const letras = /^([A-Z]+)/.exec(referencia);
  return letras ? letras[1] : '';
}

/** El número de fila de una referencia: `AN17` → `17`. */
export function filaDe(referencia) {
  const numero = /(\d+)$/.exec(referencia);
  return numero ? Number(numero[1]) : 0;
}

/** Recorre las celdas de la hoja y las agrupa por fila. */
function leerCeldas(xml, textos, estilosDeFecha) {
  const filas = new Map();

  let referencia = '';
  let tipo = '';
  let estilo = 0;
  let juntando = '';
  let dentroDeValor = false;

  recorrerXml(xml, {
    alAbrir(nombre, at) {
      if (nombre === 'c') {
        referencia = at.r ?? '';
        tipo = at.t ?? 'n';
        estilo = Number(at.s ?? 0);
        juntando = '';
        // Una celda vacía con formato (`<c r="B2" s="1"/>`) no aporta nada:
        // existe para llevar un borde o un color. No hace falta descartarla acá
        // —al cerrar ya se descarta lo que no tiene valor— y tener las dos cosas
        // haría creer que una de ellas hace algo. Se deja la de abajo, que
        // cubre también la celda que abre y cierra sin nada adentro.
        return;
      }
      if (nombre === 'v' || nombre === 't') { dentroDeValor = true; juntando = juntando || ''; }
    },
    alTexto(texto) {
      if (dentroDeValor) juntando += texto;
    },
    alCerrar(nombre) {
      if (nombre === 'v' || nombre === 't') { dentroDeValor = false; return; }
      if (nombre !== 'c' || referencia === '' || juntando === '') return;

      const celda = interpretar(juntando, tipo, estilo, textos, estilosDeFecha);
      if (celda === null) return;

      const fila = filaDe(referencia);
      if (!filas.has(fila)) filas.set(fila, new Map());
      filas.get(fila).set(columnaDe(referencia), celda);
    },
  });

  return filas;
}

/**
 * Qué es lo que hay adentro de una celda.
 *
 * `t="s"` es un índice a la lista de textos compartidos; `t="inlineStr"` y
 * `t="str"` son texto tal cual; `t="b"` es un booleano escrito como 0 o 1; sin
 * `t`, es un número — y si su estilo es de fecha, es una fecha.
 */
function interpretar(crudo, tipo, estilo, textos, estilosDeFecha) {
  if (tipo === 's') {
    const cual = Number(crudo);
    return { valor: textos[cual] ?? '', esFecha: false };
  }
  if (tipo === 'inlineStr' || tipo === 'str') return { valor: crudo, esFecha: false };
  if (tipo === 'b') return { valor: crudo === '1', esFecha: false };
  // `t="e"` es un error de fórmula (#¡DIV/0!). No es un dato: se descarta acá y
  // la celda queda como si estuviera vacía, que es lo que efectivamente es.
  if (tipo === 'e') return null;

  const numero = Number(crudo);
  if (!Number.isFinite(numero)) return { valor: crudo, esFecha: false };
  return { valor: numero, esFecha: estilosDeFecha.has(estilo) };
}

/**
 * Un número de serie de Excel como fecha `AAAA-MM-DD`.
 *
 * Excel cuenta días desde el 1900-01-01 y **cree que 1900 fue bisiesto**, cosa
 * que no fue: el error está en el formato desde 1985, por compatibilidad con
 * Lotus 1-2-3, y no se puede arreglar sin romper todas las planillas del mundo.
 * El desplazamiento de 25569 días desde la época de Unix ya lo tiene en cuenta.
 *
 * Devuelve `null` si el número no cae en un rango de fechas creíble, en vez de
 * inventar una: un importe leído como fecha daría el año 3 000 y entraría igual.
 */
export function fechaDeSerie(serie) {
  if (!Number.isFinite(serie) || serie < 1 || serie > 2958465) return null;

  const dias = Math.floor(serie);
  const fecha = new Date((dias - 25569) * 86400000);
  if (Number.isNaN(fecha.getTime())) return null;

  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}
