// T-906 · La planilla `.xlsx` con la forma de la planilla original.
//
// Lo que se comprueba acá es que los NÚMEROS estén bien y que nada se pierda en
// silencio. Que Excel abra el archivo no se puede comprobar desde `node --test`:
// eso se hizo leyéndolo con dos programas independientes —openpyxl y exceljs—,
// y queda anotado en el PLAN. Lo que sí se puede comprobar acá es lo que Excel
// va a mostrar cuando lo abra.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crearPlanilla, hojaDeMovimientos, hojaDeAnalisis, fechaDeExcel, nombreDeLaPlanilla, TIPO_XLSX,
} from '../src/datos/xlsx.js';
import { crearMovimiento, TIPO_GASTO } from '../src/core/modelo.js';
import { franjaDeRubro } from '../src/core/paleta.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';

function estadoCon(movimientos, cambios = []) {
  return {
    ...estadoInicial(),
    monedas: monedasIniciales(),
    tipos_cambio: cambios,
    movimientos,
  };
}

const mov = (fecha, rubro, monto, tipo = 'G', moneda = 'EUR', extra = {}) =>
  crearMovimiento(
    { tipo, rubro, monto, moneda, fecha, comentario: '', detalle: '', ...extra },
    { decimales: 2, creado: fecha }
  );

/** Saca un archivo de adentro del .xlsx, que es un ZIP. */
async function leerDelZip(bytes, nombre) {
  const { writeFile, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');

  const carpeta = await mkdtemp(join(tmpdir(), 'viajecor-'));
  const archivo = join(carpeta, 'planilla.xlsx');
  await writeFile(archivo, bytes);
  // `-p` escupe el contenido por la salida en vez de extraerlo a un archivo.
  // Extraerlo obligaba a leerlo después por su nombre, y el nombre puede llevar
  // corchetes —`[Content_Types].xml`— que `unzip` interpreta como comodín: hay
  // que escribirlo `[[]Content_Types].xml` para buscarlo y `[Content_Types].xml`
  // para leerlo. Con `-p` no hay dos nombres.
  return execFileSync('unzip', ['-p', archivo, nombre], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/** El número de fila de una referencia. `AN17` es la fila 17, no `NaN`. */
const filaDe = (ref) => Number(ref.match(/\d+/)[0]);

/** La letra de columna de una referencia. */
const colDe = (ref) => ref.match(/^[A-Z]+/)[0];

/** La fila donde está una etiqueta de la columna J. */
function filaDe_(enJ, nombre) {
  const encontrado = enJ.find(([, v]) => v === nombre);
  assert.ok(encontrado, `no está la etiqueta ${nombre}`);
  return encontrado[0].slice(1);
}

/** Las celdas de la hoja de movimientos, como `{ A6: '54.3' }`. */
function celdasDe(estado) {
  return celdasDelXml(hojaDeMovimientos(estado).xml);
}

/** Lo mismo para el XML de cualquier hoja: lo usa también la de análisis. */
function celdasDelXml(xml) {
  const celdas = {};
  // Dos formas de celda: con contenido (`<c …>…</c>`) y vacía con formato
  // (`<c … />`). Un regex que solo entiende la primera no falla: se desalinea y
  // empareja el cierre de OTRA celda, así que devuelve valores de vecinas.
  for (const [, ref, cuerpo] of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>(.*?)<\/c>)/g)) {
    if (cuerpo === undefined) continue;  // vacía: no tiene valor que mirar
    const numero = cuerpo.match(/<v>([^<]*)<\/v>/);
    const texto = cuerpo.match(/<t[^>]*>([^<]*)<\/t>/);
    celdas[ref] = numero ? numero[1] : texto?.[1];
  }
  return celdas;
}

// ── La fecha de Excel ────────────────────────────────────────────────────────

test('la fecha de Excel usa el desplazamiento correcto', () => {
  // Excel cuenta días desde 1900 y CREE que 1900 fue bisiesto, cosa que no fue.
  // El error está en el formato desde 1985 y no se puede arreglar: el 25569 lo
  // tiene en cuenta. Si esto estuviera corrido por un día, todos los meses de
  // la planilla dirían el mes anterior.
  assert.equal(fechaDeExcel('1970-01-01'), 25569);
  assert.equal(fechaDeExcel('2025-10-01'), 45931);
  assert.equal(fechaDeExcel('2026-03-01'), 46082);
});

test('el archivo se llama con la fecha adelante, para que ordenen solos', () => {
  assert.equal(nombreDeLaPlanilla('2026-08-27'), 'viajecor-2026-08-27.xlsx');
});

// ── La forma de la planilla ──────────────────────────────────────────────────

test('los encabezados son los de la planilla original', () => {
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.equal(celdas.A4, 'INGRESOS Y GASTOS');
  assert.equal(celdas.J4, 'GASTOS POR TIPO');
  assert.equal(celdas.A5, 'G/Acum./Mes');
  assert.equal(celdas.B5, 'Comentarios');
  assert.equal(celdas.C5, 'DÍA');
  assert.equal(celdas.D5, 'MES');
  assert.equal(celdas.E5, 'DETALLES');
  assert.equal(celdas.F5, 'RUBRO');
  assert.equal(celdas.G5, 'MONTO');
  assert.equal(celdas.H5, 'I/G');
});

test('el título del mes se escribe como en la planilla, sin el "de"', () => {
  // "OCTUBRE 2025", no "OCTUBRE DE 2025". Es la planilla que el usuario conoce
  // de memoria: la forma importa tanto como los números.
  const celdas = celdasDe(estadoCon([mov('2025-10-05', 'supermercado', '10')]));

  assert.equal(celdas.A2, 'OCTUBRE 2025');
});

test('cada mes es un bloque, del más viejo al más nuevo', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-04-03', 'salud', '60'),
    mov('2026-03-02', 'supermercado', '10'),
  ]));

  assert.equal(celdas.A2, 'MARZO 2026');
  assert.ok(Object.entries(celdas).some(([, v]) => v === 'ABRIL 2026'));
});

// ── Los números ──────────────────────────────────────────────────────────────

test('el monto va en euros con dos decimales', () => {
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '54,30')]));

  assert.equal(celdas.G6, '54.3');
});

test('un gasto en otra moneda se convierte a euros', () => {
  const cambios = [crearCambio(
    { moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) },
    { creado: '2026-03-01' }
  )];
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'viajes', '10000', 'G', 'CRC')], cambios));

  // 10 000 colones a 630 por euro = 15,87 €.
  assert.equal(celdas.G6, '15.87');
});

test('el acumulado del mes es la suma corrida de los gastos', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '54,30'),
    mov('2026-03-05', 'comida hecha', '12,50'),
    mov('2026-03-12', 'transporte', '18,40'),
  ]));

  assert.equal(celdas.A6, '54.3');
  assert.equal(celdas.A7, '66.8');
  assert.equal(celdas.A8, '85.2');
});

test('los ingresos no entran en el acumulado de gastos', () => {
  // Sumarlos daría un "acumulado" que no es ni gasto ni saldo: un número que no
  // significa nada y que igual se ve creíble.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '54,30'),
    mov('2026-03-10', 'trabajo', '2500', 'I'),
    mov('2026-03-12', 'transporte', '18,40'),
  ]));

  assert.equal(celdas.A6, '54.3');
  assert.equal(celdas.A7, undefined, 'la fila del ingreso no lleva acumulado');
  assert.equal(celdas.A8, '72.7');
});

// ── Los bloques de la derecha, a lo ancho como en la planilla real (T-916) ───

test('los rubros van en columnas, con una fila de encabezados y otra de valores', () => {
  // Es la forma de la planilla original: puestos así, los doce meses del año
  // quedan uno debajo del otro y se leen como una tabla. Puestos en filas, cada
  // mes es una lista que hay que recorrer.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '54,30'),
    mov('2026-03-05', 'comida hecha', '12,50'),
  ]));

  assert.equal(celdas.J4, 'GASTOS POR TIPO');
  assert.equal(celdas.J5, 'GASTOS FIJOS');
  assert.equal(celdas.K5, 'SUPERMERCADO');
  assert.equal(celdas.L5, 'COMIDA HECHA');
  assert.equal(celdas.J6, '0');
  assert.equal(celdas.K6, '54.3');
  assert.equal(celdas.L6, '12.5');
});

test('cada bloque termina con una columna TOTAL', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '54,30'),
    mov('2026-03-05', 'comida hecha', '12,50'),
  ]));

  // Ocho rubros de gasto: el TOTAL cae en la novena columna del bloque.
  assert.equal(celdas.R5, 'TOTAL');
  assert.equal(celdas.R6, '66.8');
});

test('el TOTAL del bloque coincide con el último acumulado de la izquierda', () => {
  // Si el total y el detalle se calcularan por caminos separados, tarde o
  // temprano dirían cosas distintas. Este test exige que no puedan.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'comida hecha', '12,50'),
    mov('2026-03-05', 'supermercado', '54,30'),
    mov('2026-03-08', 'viajes', '7,55'),
    mov('2026-03-09', 'comida hecha', '3,45'),
  ]));

  assert.equal(celdas.R6, celdas.A9);
});

test('aparecen TODOS los rubros, también los que no se usaron', () => {
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.deepEqual(
    ['J5', 'K5', 'L5', 'M5', 'N5', 'O5', 'P5', 'Q5'].map((c) => celdas[c]),
    ['GASTOS FIJOS', 'SUPERMERCADO', 'COMIDA HECHA', 'VIAJES',
     'ENTRETENIMIENTO', 'TRANSPORTE', 'SALUD', 'OTROS']
  );
  assert.equal(celdas.J6, '0', 'un rubro sin movimientos va en 0, no vacío');
});

test('los rubros de ingreso también aparecen todos, con su total', () => {
  const celdas = celdasDe(estadoCon([mov('2026-03-10', 'trabajo', '100', 'I')]));

  assert.equal(celdas.J8, 'INGRESOS POR TIPO');
  assert.deepEqual(
    ['J9', 'K9', 'L9', 'M9', 'N9'].map((c) => celdas[c]),
    ['TRABAJO', 'INVERSIONES', 'REGALOS', 'OTROS', 'TOTAL']
  );
  assert.equal(celdas.J10, '100');
  assert.equal(celdas.N10, '100');
});

test('cada rubro cae en la MISMA columna todos los meses', () => {
  // Es toda la razón de tenerlos todos: poder mirar dos meses uno debajo del
  // otro sin buscar dónde quedó cada uno.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-04-03', 'salud', '60'),
  ]));

  const encabezados = Object.entries(celdas).filter(([, v]) => v === 'SUPERMERCADO');
  assert.equal(encabezados.length, 2, 'tiene que haber un encabezado por mes');
  assert.deepEqual(
    encabezados.map(([ref]) => colDe(ref)),
    ['K', 'K'],
    'el mismo rubro cayó en columnas distintas en cada mes'
  );
});

test('el bloque de ingresos está siempre, aunque el mes no haya tenido ninguno', () => {
  // Un mes sin ingresos y un mes con el bloque faltante se ven distinto en una
  // planilla, y solo uno de los dos dice la verdad.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.equal(celdas.J8, 'INGRESOS POR TIPO');
  assert.equal(celdas.J9, 'TRABAJO');
  assert.equal(celdas.J10, '0');
});

test('el bloque de totales dice gastos, ingresos y SALDO MENSUAL', () => {
  // "SALDO MENSUAL", como en la planilla original, no "Saldo".
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '30'),
    mov('2026-03-10', 'trabajo', '100', 'I'),
  ]));

  assert.equal(celdas.J12, 'TOTALES');
  assert.deepEqual(['J13', 'K13', 'L13'].map((c) => celdas[c]), ['GASTOS', 'INGRESOS', 'SALDO MENSUAL']);
  assert.deepEqual(['J14', 'K14', 'L14'].map((c) => celdas[c]), ['30', '100', '70']);
});

test('el gasto por día lleva TODOS los días del mes, también los de cero', () => {
  // Es un calendario: a uno al que le faltan días no se lo puede leer, y peor,
  // hace creer que el mes tuvo menos días de los que tuvo.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '30')]));

  // Las columnas pasan de la Z: el día 18 cae en AA. Sacar la fila con
  // `ref.slice(1)` daba NaN ahí y el test contaba 17 días en vez de 31 — el
  // error estaba en el test, no en la planilla.
  const fila = filaDe(Object.entries(celdas).find(([, v]) => v === 'GASTO POR DÍA')[0]);
  const dias = Object.entries(celdas)
    .filter(([ref]) => filaDe(ref) === fila + 1)
    .map(([, v]) => Number(v));

  assert.equal(dias.length, 31, 'marzo tiene 31 días');
  assert.deepEqual(dias, Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(celdas[`K${fila + 2}`], '30', 'el día 2 tiene los 30 €');
  assert.equal(celdas[`J${fila + 2}`], '0', 'el día 1 va en cero, no vacío');
});

test('el bloque de la derecha no se come el bloque del mes siguiente', () => {
  // El resumen ocupa más filas que los movimientos cuando hay pocos: si el mes
  // siguiente empezara donde terminan los movimientos, se escribirían encima y
  // la rejilla lo haría en silencio.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-04-03', 'salud', '60'),
  ]));

  const titulos = Object.values(celdas).filter((v) => v === 'MARZO 2026' || v === 'ABRIL 2026');
  assert.equal(titulos.length, 2, 'se perdió un título de mes');

  const calendarios = Object.values(celdas).filter((v) => v === 'GASTO POR DÍA');
  assert.equal(calendarios.length, 2, 'se perdió un calendario');

  const totales = Object.values(celdas).filter((v) => v === 'SALDO MENSUAL');
  assert.equal(totales.length, 2, 'se perdió un bloque de totales');
});

// ── Lo que no se puede convertir ─────────────────────────────────────────────

test('un movimiento sin tipo de cambio entra igual, con el motivo escrito', () => {
  // No se descarta ni se pone en cero: una fila que desaparece en silencio es
  // exactamente la falla que la app viene a eliminar (L-001).
  const celdas = celdasDe(estadoCon([mov('2026-04-03', 'viajes', '5000', 'G', 'CRC')]));

  assert.equal(celdas.F6, 'Viajes');
  assert.equal(celdas.G6, undefined, 'el monto queda vacío, no en cero');
  assert.match(celdas.E6, /falta el tipo de cambio de CRC para 2026-04/);
});

test('el detalle del usuario no se pisa con el motivo', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-04-03', 'viajes', '5000', 'G', 'CRC', { detalle: 'entradas al volcán' }),
  ]));

  assert.match(celdas.E6, /entradas al volcán/);
  assert.match(celdas.E6, /falta el tipo de cambio/);
});

test('lo que no se pudo convertir no ensucia el acumulado ni los totales', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-04-03', 'viajes', '5000', 'G', 'CRC'),
    mov('2026-04-04', 'salud', '60'),
  ]));

  assert.equal(celdas.A6, undefined);
  assert.equal(celdas.A7, '60');
  assert.equal(celdas.M6, '0', 'Viajes queda en 0: lo que no se pudo convertir no suma');
  assert.equal(celdas.P6, '60', 'Salud sí');
  assert.equal(celdas.R6, '60', 'y el TOTAL también');
});

test('la planilla informa cuántos quedaron sin convertir', () => {
  // Un número que no se informa es un dato que se pierde: la pantalla tiene que
  // poder decirlo.
  const planilla = crearPlanilla(estadoCon([
    mov('2026-04-03', 'viajes', '5000', 'G', 'CRC'),
    mov('2026-04-04', 'salud', '60'),
  ]), { fecha: '2026-08-27' });

  assert.equal(planilla.sinConvertir, 1);
  assert.equal(planilla.cuantos, 2);
  assert.equal(planilla.meses, 1);
});

// ── El aspecto: colores, bandas y formatos (T-916) ───────────────────────────

test('el rubro de cada movimiento va con el color de ese rubro', () => {
  // El mismo color que tiene en la app (T-909): el usuario pidió que el color
  // esté ligado al rubro en todas las visualizaciones, y dos idiomas de color
  // para el mismo dato no se pueden aprender.
  const { xml } = hojaDeMovimientos(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  const celda = xml.match(/<c r="F6"[^>]*/)[0];
  const estilo = Number(celda.match(/s="(\d+)"/)[1]);

  // `supermercado` es el segundo rubro de la lista: franja 2.
  assert.equal(estilo, 17 + franjaDeRubro(TIPO_GASTO, 'supermercado'));
});

test('el encabezado del resumen lleva el MISMO color que el rubro', () => {
  const { xml } = hojaDeMovimientos(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  const encabezado = Number(xml.match(/<c r="K5"[^>]*s="(\d+)"/)[1]);
  const enLaLista = Number(xml.match(/<c r="F6"[^>]*s="(\d+)"/)[1]);

  // Distinto estilo —uno es encabezado y el otro no— pero la misma franja.
  assert.equal(encabezado - 9, enLaLista - 17);
});

test('el mes se escribe 08/26, como en la planilla original', async () => {
  // Comprobar que la celda usa el estilo 4 no alcanza: hay que mirar QUÉ dice
  // ese estilo. Con solo el número, cambiar el formato a "mmmm yyyy" no rompía
  // nada — el mes volvía a escribirse largo y ningún test se enteraba.
  const estado = estadoCon([mov('2026-03-02', 'supermercado', '10')]);
  const { xml } = hojaDeMovimientos(estado);
  assert.match(xml, /<c r="D6"[^>]*s="4"/);

  // Se lee el archivo de estilos de adentro del .xlsx, que es lo que Excel lee.
  const estilos = await leerDelZip(crearPlanilla(estado).bytes, 'xl/styles.xml');
  assert.match(estilos, /numFmtId="165" formatCode="mm\/yy"/);
});

test('los importes se ven como euros', async () => {
  const estado = estadoCon([mov('2026-03-02', 'supermercado', '10')]);
  const estilos = await leerDelZip(crearPlanilla(estado).bytes, 'xl/styles.xml');

  assert.match(estilos, /numFmtId="164"/);
  assert.ok(estilos.includes('€'), 'el formato de importe tiene que llevar el símbolo');
});

test('las bandas de título se combinan en una sola celda ancha', () => {
  // Si no se combinaran, el título quedaría en una celda angosta y el resto de
  // la banda de color se vería como celdas sueltas pintadas.
  const { xml } = hojaDeMovimientos(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.match(xml, /<mergeCells count="\d+">/);
  assert.match(xml, /<mergeCell ref="A2:R2"\/>/, 'la banda del mes cruza el ancho');
  assert.match(xml, /<mergeCell ref="A4:H4"\/>/, 'la banda de "INGRESOS Y GASTOS"');
  assert.match(xml, /<mergeCell ref="J4:R4"\/>/, 'la banda de "GASTOS POR TIPO"');
  assert.match(xml, /<mergeCell ref="J8:N8"\/>/, 'la banda de "INGRESOS POR TIPO"');
  assert.match(xml, /<mergeCell ref="J12:L12"\/>/, 'la banda de "TOTALES"');
});

test('hay una banda combinada por cada título de bloque', () => {
  // Contarlas evita el caso donde una sola sobrevive y las demás no: un título
  // sin combinar se ve como una celda angosta con el color desparramado al lado.
  const { xml } = hojaDeMovimientos(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  const cuantas = Number(xml.match(/<mergeCells count="(\d+)">/)[1]);

  // Por mes: el título, "INGRESOS Y GASTOS", y los cuatro bloques de la derecha.
  assert.equal(cuantas, 6);
  assert.equal((xml.match(/<mergeCell /g) ?? []).length, cuantas, 'el count no coincide con las que hay');
});

test('las celdas de una banda combinada existen todas', () => {
  // En Excel una celda combinada sigue siendo varias celdas: la de arriba a la
  // izquierda lleva el valor y las otras tienen que existir igual, o el archivo
  // queda inconsistente y Excel se queja al abrirlo.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  // Están escritas pero vacías: llevan el color, no el texto. El texto lo lleva
  // solo la primera, que es como Excel entiende una celda combinada.
  const { xml } = hojaDeMovimientos(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  for (const ref of ['B2', 'C2', 'R2']) {
    assert.match(xml, new RegExp(`<c r="${ref}" s="1"/>`), `falta la celda ${ref} de la banda`);
  }
  assert.equal(celdas.A2, 'MARZO 2026');
  assert.equal(celdas.B2, undefined, 'las celdas de relleno no llevan texto');
});

// ── El archivo ───────────────────────────────────────────────────────────────

test('la planilla sale como un archivo con su nombre y su tipo', () => {
  const planilla = crearPlanilla(estadoCon([mov('2026-03-02', 'supermercado', '10')]), { fecha: '2026-08-27' });

  assert.equal(planilla.nombre, 'viajecor-2026-08-27.xlsx');
  assert.equal(planilla.tipo, TIPO_XLSX);
  assert.ok(planilla.bytes.length > 0);
  // "PK": la firma de un ZIP, que es lo que un .xlsx es por dentro.
  assert.equal(planilla.bytes[0], 0x50);
  assert.equal(planilla.bytes[1], 0x4b);
});

test('sin movimientos, la planilla se genera igual y no rompe', () => {
  const planilla = crearPlanilla(estadoCon([]), { fecha: '2026-08-27' });

  assert.equal(planilla.meses, 0);
  assert.equal(planilla.cuantos, 0);
  assert.ok(planilla.bytes.length > 0);
});

test('el texto con caracteres de XML no rompe el archivo', () => {
  // Un comentario con "<" o "&" escrito tal cual haría un XML inválido y Excel
  // se negaría a abrir la planilla entera por una sola celda.
  const { xml } = hojaDeMovimientos(estadoCon([
    mov('2026-03-02', 'supermercado', '10', 'G', 'EUR', { comentario: 'Mercadona & <Lidl>' }),
  ]));

  assert.ok(xml.includes('Mercadona &amp; &lt;Lidl&gt;'));
  assert.equal(xml.includes('<Lidl>'), false);
});

test('no hay ningún límite de filas escrito a mano', () => {
  // L-001: el Excel original suma $G$8:$G$1027 y la fila 1028 no se suma. Acá
  // se recorre todo, y esto lo comprueba con más filas que ese tope.
  const muchos = Array.from({ length: 1500 }, (_, i) =>
    mov(`2026-03-${String((i % 28) + 1).padStart(2, '0')}`, 'supermercado', '1'));
  const planilla = crearPlanilla(estadoCon(muchos), { fecha: '2026-08-27' });
  const celdas = celdasDe(estadoCon(muchos));

  assert.equal(planilla.cuantos, 1500);
  // 1500 gastos de 1 € cada uno: el acumulado de la última fila tiene que ser 1500.
  assert.equal(celdas[`A${5 + 1500}`], '1500');
});

test('un importe que no es número se rechaza en vez de valer 0', () => {
  // `Math.round('' * 100)` da 0 sin decir nada, y un 0 inventado se lee igual
  // que un 0 de verdad. Lo destapó una mutación que parecía inofensiva porque
  // esta conversión la tapaba.
  const roto = estadoCon([mov('2026-03-02', 'supermercado', '10')]);
  roto.movimientos[0].monto = 'diez';

  assert.throws(() => hojaDeMovimientos(roto));
});


// ── La hoja de análisis: la matriz mes × rubro (T-910) ───────────────────────
//
// Es la hoja `Analisis1` de la planilla original. Lo que se prueba acá es que
// cuente **lo mismo que la pantalla** —las dos leen `matrizMesRubro()`, así que
// lo que puede separarse es cómo se escribe— y que la regla del promedio quede
// escrita en la propia hoja, que es lo único que `Analisis1` no hacía.

const TRES_MESES = () => estadoCon([
  mov('2026-01-10', 'viajes', '100'),
  mov('2026-01-11', 'salud', '40'),
  mov('2026-02-10', 'viajes', '200'),
  mov('2026-02-01', 'trabajo', '900', 'I'),
  mov('2026-03-10', 'viajes', '300'),
]);

test('la hoja de análisis tiene una fila por mes y una columna por rubro', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  // Fila 3: el mes, ocho rubros de gasto, gastos, cuatro rubros de ingreso,
  // ingresos y saldo. De B a Q.
  assert.equal(celdas.B3, 'MES');
  assert.equal(celdas.C3, 'GASTOS FIJOS');
  assert.equal(celdas.J3, 'OTROS');
  assert.equal(celdas.K3, 'GASTOS');
  assert.equal(celdas.L3, 'TRABAJO');
  assert.equal(celdas.O3, 'OTROS', 'el otro "OTROS", el de ingresos');
  assert.equal(celdas.P3, 'INGRESOS');
  assert.equal(celdas.Q3, 'SALDO');
});

test('una banda arriba dice cuál "OTROS" es cuál', () => {
  // `otros` está en las dos listas de rubros y son cosas distintas (RN-02). Sin
  // la banda, la hoja tiene dos columnas con el mismo nombre y nada que las
  // separe. La pantalla lleva la misma, por el mismo motivo.
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  assert.equal(celdas.C2, 'RUBROS DE GASTO');
  assert.equal(celdas.L2, 'RUBROS DE INGRESO');
});

test('cada ingreso cae en su columna de rubro, y la fila cierra', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  assert.equal(Number(celdas.L5), 900, 'los 900 € de febrero entraron por trabajo');
  assert.equal(Number(celdas.L4), 0, 'y en enero el cero está escrito');
  assert.equal(Number(celdas.P5), 900, 'la suma del bloque es el total de ingresos');
});

test('los meses van del más viejo al más nuevo, como en Analisis1', () => {
  // Al revés que en la pantalla, y a propósito: una planilla se lee de arriba
  // abajo como una línea de tiempo; en la app lo primero que se mira es el mes
  // pasado.
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  assert.equal(celdas.B4, 'ene 26');
  assert.equal(celdas.B5, 'feb 26');
  assert.equal(celdas.B6, 'mar 26');
});

test('cada gasto cae en su celda de mes y rubro', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  // Viajes es la columna F (cuarto rubro), salud la I (séptimo).
  assert.equal(Number(celdas.F4), 100);
  assert.equal(Number(celdas.I4), 40);
  assert.equal(Number(celdas.F5), 200);
  assert.equal(Number(celdas.I5), 0, 'el cero tiene que estar escrito');
});

test('los ocho rubros están aunque el mes no tenga ninguno', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(estadoCon([mov('2026-01-10', 'viajes', '100')]), '2026-09').xml);
  const fila = ['C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4'].map((r) => celdas[r]);

  assert.equal(fila.filter((v) => v !== undefined).length, 8);
});

test('los rubros de cada fila suman su columna de gastos', () => {
  // Es la comprobación que hace que la hoja no pueda esconder plata.
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  for (const fila of [4, 5, 6]) {
    const rubros = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
      .reduce((t, col) => t + Number(celdas[`${col}${fila}`] ?? 0), 0);
    assert.equal(Math.round(rubros * 100), Math.round(Number(celdas[`K${fila}`]) * 100),
      `la fila ${fila} no cierra`);
  }
});

test('están el total y el promedio, y son distintos', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-09').xml);

  assert.equal(celdas.B7, 'TOTAL');
  assert.equal(celdas.B8, 'PROMEDIO');
  assert.equal(Number(celdas.K7), 640);
  // 640 / 3 son 213,3333…: la hoja escribe dos decimales, como los euros.
  assert.equal(Number(celdas.K8), 213.33);
});

test('el promedio deja afuera el mes en curso, igual que la pantalla', () => {
  const celdas = celdasDelXml(hojaDeAnalisis(TRES_MESES(), '2026-03').xml);

  assert.equal(Number(celdas.K7), 640, 'el total sí incluye marzo');
  assert.equal(Number(celdas.K8), 170, 'el promedio son 340 sobre dos meses');
});

test('LA REGLA DEL PROMEDIO VA ESCRITA EN LA HOJA', () => {
  // Es toda la diferencia con `Analisis1`, donde el total sumaba once meses y el
  // promedio promediaba diez sin que en ningún lado dijera si era a propósito
  // (L-006). Una planilla que se abre dentro de un año tiene que explicarse sola.
  const xml = hojaDeAnalisis(TRES_MESES(), '2026-03').xml;

  assert.ok(xml.includes('2 meses terminados'));
  assert.ok(xml.includes('mar 26'));
  assert.ok(xml.includes('El total sí lo incluye'));
});

test('sin un mes en curso que dejar afuera, la nota no lo inventa', () => {
  const xml = hojaDeAnalisis(TRES_MESES(), '2026-09').xml;

  assert.ok(xml.includes('sobre 3 meses'));
  assert.equal(xml.includes('deja afuera'), false);
});

test('sin movimientos la hoja no se rompe ni miente', () => {
  const { xml, filas } = hojaDeAnalisis(estadoCon([]), '2026-03');

  assert.equal(filas, 0);
  assert.ok(xml.includes('EVOLUCIÓN MES A MES'), 'la hoja existe igual');
  assert.equal(xml.includes('PROMEDIO'), false, 'no dibuja un promedio de la nada');
});

test('los encabezados de rubro llevan el color de su rubro', () => {
  // El mismo que ese rubro tiene en la app y en los bloques de la otra hoja.
  const xml = hojaDeAnalisis(TRES_MESES(), '2026-09').xml;
  const estilos = [...xml.matchAll(/<c r="([C-J])3" s="(\d+)"/g)].map((m) => Number(m[2]));

  assert.equal(estilos.length, 8);
  assert.equal(new Set(estilos).size, 8, 'dos rubros comparten el mismo estilo');

  // Y los de ingreso llevan el suyo, el de la planilla del usuario: trabajo
  // verde, inversiones celeste, regalos rosa. `otros` comparte el gris con
  // `otros` de gasto, que es lo que hace falta la banda de arriba.
  const deIngreso = [...xml.matchAll(/<c r="([L-N])3" s="(\d+)"/g)].map((m) => Number(m[2]));
  assert.equal(new Set(deIngreso).size, 3);
});

test('el .xlsx trae las dos hojas, y Excel las encuentra', async () => {
  // Un ZIP con la hoja adentro pero sin declararla en el libro o en los tipos de
  // contenido abre igual… sin la hoja. No da error: falta y ya.
  const { bytes, filasDeAnalisis } = crearPlanilla(TRES_MESES(), { fecha: '2026-08-28' });

  const libro = await leerDelZip(bytes, 'xl/workbook.xml');
  const relaciones = await leerDelZip(bytes, 'xl/_rels/workbook.xml.rels');
  // `unzip` trata los corchetes como comodines: sin escaparlos no encuentra el
  // archivo y dice "filename not matched" en vez de fallar por lo que importa.
  const tipos = await leerDelZip(bytes, '[[]Content_Types].xml');
  const hoja2 = await leerDelZip(bytes, 'xl/worksheets/sheet2.xml');

  assert.ok(libro.includes('name="Evolución"'));
  assert.match(libro, /<sheet name="Evolución" sheetId="2" r:id="(rId\d+)"\/>/);
  const id = libro.match(/<sheet name="Evolución" sheetId="2" r:id="(rId\d+)"\/>/)[1];
  assert.ok(relaciones.includes(`Id="${id}"`), `el libro apunta a ${id} y las relaciones no lo tienen`);
  assert.ok(relaciones.includes('Target="worksheets/sheet2.xml"'));
  assert.ok(tipos.includes('/xl/worksheets/sheet2.xml'), 'la hoja no está en los tipos de contenido');
  assert.ok(hoja2.includes('EVOLUCIÓN MES A MES'));
  assert.equal(filasDeAnalisis, 3);
});

test('la hoja de análisis no cambia la de movimientos', () => {
  // Las dos escriben en su propia rejilla. Si compartieran una, la segunda
  // pisaría celdas de la primera y nadie se enteraría hasta abrir el archivo.
  const estado = TRES_MESES();
  const antes = hojaDeMovimientos(estado).xml;
  hojaDeAnalisis(estado, '2026-09');

  assert.equal(hojaDeMovimientos(estado).xml, antes);
});
