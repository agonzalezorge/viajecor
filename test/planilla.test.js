// T-031 · Leer una planilla `.xlsx`.
//
// La prueba que más vale de este archivo no está acá: es la comparación de las
// **1.614 celdas** de la copia de estructura contra openpyxl, celda por celda,
// con cero diferencias. Un lector de formatos que solo se prueba contra sí mismo
// lee bien exactamente los archivos que él mismo escribe.
//
// Lo que sí se prueba acá son las tres cosas que un `.xlsx` esconde y que un
// lector ingenuo lee mal **sin dar ningún error**: el texto que no está en la
// hoja, las fechas que son números, y los huecos donde debería haber celdas.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  leerPlanilla, leerTextosCompartidos, leerFormatos, fechaDeSerie, columnaDe, filaDe,
} from '../src/datos/planilla.js';
import { crearZip } from '../src/datos/zip.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const EJEMPLO = () => readFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx'));

/** Un .xlsx armado a mano, para poder probar casos que no están en el ejemplo. */
function planillaCon(hoja, extra = {}) {
  return crearZip([
    { nombre: 'xl/worksheets/sheet1.xml', contenido:
      `<?xml version="1.0"?><worksheet><sheetData>${hoja}</sheetData></worksheet>` },
    ...Object.entries(extra).map(([nombre, contenido]) => ({ nombre, contenido })),
  ]);
}

// ── Las referencias ──────────────────────────────────────────────────────────

test('una referencia se parte en columna y fila, también más allá de la Z', () => {
  assert.equal(columnaDe('C6'), 'C');
  assert.equal(filaDe('C6'), 6);
  assert.equal(columnaDe('AN17'), 'AN');
  assert.equal(filaDe('AN17'), 17);
});

// ── Las fechas ───────────────────────────────────────────────────────────────

test('un número de serie se convierte a la fecha correcta', () => {
  // Excel cuenta días desde 1900 y cree que 1900 fue bisiesto. Si el
  // desplazamiento estuviera corrido por un día, TODAS las fechas de la planilla
  // caerían en el mes anterior o el siguiente, y la importación entera quedaría
  // mal sin dar un solo error.
  assert.equal(fechaDeSerie(25569), '1970-01-01');
  assert.equal(fechaDeSerie(45931), '2025-10-01');
  assert.equal(fechaDeSerie(46082), '2026-03-01');
});

test('un número que no puede ser una fecha devuelve null', () => {
  // Un importe leído como fecha daría el año 3000 y entraría igual. Mejor nada
  // que una fecha inventada.
  assert.equal(fechaDeSerie(0), null);
  assert.equal(fechaDeSerie(-5), null);
  assert.equal(fechaDeSerie(99999999), null);
  assert.equal(fechaDeSerie(NaN), null);
});

test('una celda con formato de fecha se marca como fecha', async () => {
  const bytes = planillaCon('<row r="1"><c r="A1" s="1"><v>46082</v></c></row>', {
    'xl/styles.xml': '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
  });
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(1).get('A').esFecha, true);
  assert.equal(fechaDeSerie(filas.get(1).get('A').valor), '2026-03-01');
});

test('un número con formato de importe NO se marca como fecha', async () => {
  const bytes = planillaCon('<row r="1"><c r="A1" s="0"><v>46082</v></c></row>', {
    'xl/styles.xml': '<styleSheet><cellXfs><xf numFmtId="0"/></cellXfs></styleSheet>',
  });
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(1).get('A').esFecha, false);
});

test('un formato propio del archivo se reconoce por su código', () => {
  // Excel no numera los formatos personalizados: los define el archivo. Un
  // "mm/yy" con id 165 es tan fecha como el 14 de fábrica.
  const deFecha = leerFormatos(
    '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="mm/yy"/>' +
    '<numFmt numFmtId="166" formatCode="#,##0.00"/></numFmts>' +
    '<cellXfs><xf numFmtId="0"/><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs></styleSheet>'
  );

  assert.equal(deFecha.has(1), true, 'el estilo con mm/yy es de fecha');
  assert.equal(deFecha.has(2), false, 'el de importe no');
  assert.equal(deFecha.has(0), false);
});

test('una "m" adentro de un texto entre comillas no convierte el formato en fecha', () => {
  // Un formato de moneda puede llevar texto: `#,##0.00 "MXN"`. Esa "m" no es un
  // mes, y tomarla por tal convertiría todos los importes en fechas del año 2126.
  const deFecha = leerFormatos(
    '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;MXN&quot;"/></numFmts>' +
    '<cellXfs><xf numFmtId="165"/></cellXfs></styleSheet>'
  );

  assert.equal(deFecha.has(0), false);
});

// ── Los textos compartidos ───────────────────────────────────────────────────

test('el texto de una celda sale de la lista compartida', async () => {
  // Excel guarda cada texto una vez y en la celda pone su posición. Sin resolver
  // eso, todos los rubros de la planilla se leen como números.
  const bytes = planillaCon('<row r="1"><c r="A1" t="s"><v>1</v></c></row>', {
    'xl/sharedStrings.xml': '<sst><si><t>gastos fijos</t></si><si><t>supermercado</t></si></sst>',
  });
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(1).get('A').valor, 'supermercado');
});

test('un texto partido en varios trozos se junta', () => {
  // Pasa cuando una parte del texto tiene otro formato — una palabra en negrita.
  const textos = leerTextosCompartidos('<sst><si><t>Bar</t><t>celona26</t></si></sst>');

  assert.deepEqual(textos, ['Barcelona26']);
});

test('sin lista compartida, la planilla se lee igual', async () => {
  // Las planillas escritas por esta app usan texto en la celda (`inlineStr`).
  const bytes = planillaCon('<row r="1"><c r="A1" t="inlineStr"><is><t>Roma</t></is></c></row>');
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(1).get('A').valor, 'Roma');
});

// ── Los huecos ───────────────────────────────────────────────────────────────

test('las celdas se guardan por su letra de columna, no por su posición', async () => {
  // En un .xlsx las celdas vacías NO EXISTEN: si la fila no tiene nada en B, no
  // hay ninguna celda B. Recorrerlas en orden y asumir que están todas corre
  // todas las columnas siguientes — el rubro se lee del monto y el monto del
  // tipo, sin un solo error.
  const bytes = planillaCon('<row r="7"><c r="A7"><v>1</v></c><c r="D7"><v>4</v></c></row>');
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(7).get('A').valor, 1);
  assert.equal(filas.get(7).get('B'), undefined);
  assert.equal(filas.get(7).get('D').valor, 4);
});

test('una celda vacía con formato no cuenta como celda', async () => {
  // `<c r="B2" s="1"/>` existe para llevar un color o un borde. Tomarla por un
  // dato metería celdas vacías donde no hay nada.
  const bytes = planillaCon('<row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c><c r="B2" s="1"/></row>');
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(2).size, 1);
  assert.equal(filas.get(2).get('B'), undefined);
});

test('un error de fórmula no se lee como dato', async () => {
  // `#¡DIV/0!` no es un valor: la celda está tan vacía como si no tuviera nada.
  const bytes = planillaCon('<row r="1"><c r="A1" t="e"><v>#DIV/0!</v></c></row>');
  const { filas } = await leerPlanilla(bytes);

  assert.equal(filas.get(1), undefined);
});

// ── Archivos que no son lo que dicen ser ─────────────────────────────────────

test('un archivo que no es un ZIP se rechaza explicando por qué', async () => {
  // Un .xls viejo, un PDF, una foto: cualquier cosa que alguien elija por error
  // en el selector de archivos de su teléfono.
  const { error } = await leerPlanilla(
    new TextEncoder().encode('esto no es un xlsx, es un texto largo cualquiera')
  );

  assert.match(error, /no es un \.xlsx/i);
  assert.match(error, /\.xls viejo|otro programa/i, 'el mensaje tiene que sugerir qué puede haber pasado');
});

test('un archivo vacío o diminuto se rechaza sin tirar', async () => {
  for (const bytes of [new Uint8Array(0), new TextEncoder().encode('PK')]) {
    const { error } = await leerPlanilla(bytes);
    assert.match(error, /vacío|demasiado chico/i);
  }
});

test('un ZIP sin hojas se rechaza explicando por qué', async () => {
  const bytes = crearZip([{ nombre: 'algo.txt', contenido: 'hola' }]);
  const { error } = await leerPlanilla(bytes);

  assert.match(error, /no tiene ninguna hoja/i);
});

test('leer una planilla nunca tira, pase lo que pase', async () => {
  for (const basura of [new Uint8Array(0), new Uint8Array([1, 2, 3]), new TextEncoder().encode('PK'), null]) {
    await assert.doesNotReject(() => leerPlanilla(basura));
  }
});

// ── La planilla de verdad ────────────────────────────────────────────────────

test('la copia de estructura se lee entera', async () => {
  // No se fija un número exacto de filas: el generador de la copia usa una
  // semilla fija pero su contenido cambia cuando se le agregan rarezas nuevas
  // —y se le van a seguir agregando a medida que aparezcan en la planilla
  // real—. Lo que este test cuida es que se lea COMPLETA y con sentido, no que
  // tenga un tamaño en particular.
  const { filas, error } = await leerPlanilla(new Uint8Array(await EJEMPLO()));

  assert.equal(error, undefined);
  assert.ok(filas.size > 250, `se leyeron solo ${filas.size} filas`);

  // Los cuatro títulos de mes y sus cuatro filas de encabezados tienen que estar.
  const textos = [...filas.values()].map((celdas) => celdas.get('A')?.valor);
  assert.equal(textos.filter((t) => t === 'G/Acum./Mes').length, 4);
  assert.equal(textos.filter((t) => typeof t === 'string' && /^\w+ 20\d\d$/.test(t)).length, 4);
});

test('y sus columnas caen donde tienen que caer', async () => {
  const { filas } = await leerPlanilla(new Uint8Array(await EJEMPLO()));
  const encabezados = filas.get(5);

  assert.equal(encabezados.get('A').valor, 'G/Acum./Mes');
  assert.equal(encabezados.get('C').valor, 'DÍA');
  assert.equal(encabezados.get('F').valor, 'RUBRO');
  assert.equal(encabezados.get('H').valor, 'I/G');

  const primera = filas.get(6);
  assert.equal(primera.get('C').valor, 23);
  assert.equal(fechaDeSerie(primera.get('D').valor), '2025-10-01');
  assert.equal(primera.get('D').esFecha, true);
  assert.equal(primera.get('F').valor, 'comida hecha');
  assert.equal(primera.get('G').valor, 12.29);
  assert.equal(primera.get('H').valor, 'G');
});

test('las mayúsculas inconsistentes se leen tal cual, sin arreglarlas', async () => {
  // El lector devuelve lo que dice el archivo. Normalizar es del mapeo (T-032):
  // si el lector "arreglara" el texto, no habría forma de saber qué decía
  // realmente la planilla cuando algo sale mal.
  const { filas } = await leerPlanilla(new Uint8Array(await EJEMPLO()));
  const rubros = new Set();
  for (const celdas of filas.values()) {
    const rubro = celdas.get('F');
    if (rubro && typeof rubro.valor === 'string') rubros.add(rubro.valor);
  }

  assert.ok(rubros.has('entretenimiento'));
  assert.ok(rubros.has('ENTRETENIMIENTO'), 'las mayúsculas del original tienen que llegar');
});

test('el cierre del ZIP se busca desde el final, no desde el principio', async () => {
  // Un ZIP puede tener datos adelante —hay instaladores que son un ejecutable
  // con un ZIP pegado atrás— y esos datos pueden contener por casualidad la
  // firma del cierre. Buscándola desde el principio, la primera coincidencia es
  // basura y el archivo entero se lee mal.
  //
  // Acá se le pega adelante, a propósito, una firma de cierre falsa.
  const valido = planillaCon('<row r="1"><c r="A1"><v>42</v></c></row>');
  const firmaFalsa = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(40).fill(0)]);
  const conBasura = new Uint8Array(firmaFalsa.length + valido.length);
  conBasura.set(firmaFalsa, 0);
  conBasura.set(valido, firmaFalsa.length);

  const { filas, error } = await leerPlanilla(conBasura);

  assert.equal(error, undefined, `se leyó la firma falsa: ${error}`);
  assert.equal(filas.get(1).get('A').valor, 42);
});
