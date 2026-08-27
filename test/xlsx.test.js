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
  crearPlanilla, hojaDeMovimientos, fechaDeExcel, nombreDeLaPlanilla, TIPO_XLSX,
} from '../src/datos/xlsx.js';
import { crearMovimiento } from '../src/core/modelo.js';
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

/** La fila donde está una etiqueta de la columna J. */
function filaDe_(enJ, nombre) {
  const encontrado = enJ.find(([, v]) => v === nombre);
  assert.ok(encontrado, `no está la etiqueta ${nombre}`);
  return encontrado[0].slice(1);
}

/** Las celdas de la hoja, como `{ A6: '54.3' }`, para poder afirmar sobre ellas. */
function celdasDe(estado) {
  const { xml } = hojaDeMovimientos(estado);
  const celdas = {};
  for (const [, ref, cuerpo] of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*>(.*?)<\/c>/g)) {
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

test('el bloque de la derecha totaliza por rubro, en el orden fijo de la lista', () => {
  // El orden es el de la lista de rubros, no el del tamaño (T-915): así cada
  // rubro cae en la misma fila todos los meses y se pueden comparar de un
  // vistazo. Si fuera por tamaño, cada mes tendría las filas en otro lugar.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'comida hecha', '12,50'),
    mov('2026-03-05', 'supermercado', '54,30'),
    mov('2026-03-08', 'comida hecha', '7,50'),
  ]));

  assert.equal(celdas.J6, 'Gastos fijos');
  assert.equal(celdas.K6, '0');
  assert.equal(celdas.J7, 'Supermercado');
  assert.equal(celdas.K7, '54.3');
  assert.equal(celdas.J8, 'Comida hecha');
  assert.equal(celdas.K8, '20');
});

test('aparecen TODOS los rubros, también los que no se usaron', () => {
  // Pedido del usuario (2026-08-27). Es lo contrario de lo que hace la app en
  // pantalla, y está bien: en un celular ocho filas en cero tapan las tres que
  // importan; en una planilla son lo que permite comparar meses.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  const enJ = Object.entries(celdas).filter(([ref]) => /^J\d+$/.test(ref)).map(([, v]) => v);

  for (const rubro of ['Gastos fijos', 'Supermercado', 'Comida hecha', 'Viajes',
                       'Entretenimiento', 'Transporte', 'Salud', 'Otros']) {
    assert.ok(enJ.includes(rubro), `falta el rubro ${rubro}`);
  }
  assert.equal(celdas.K6, '0', 'un rubro sin movimientos va en 0, no vacío');
});

test('los rubros de ingreso también aparecen todos', () => {
  const celdas = celdasDe(estadoCon([mov('2026-03-10', 'trabajo', '100', 'I')]));
  const enJ = Object.entries(celdas).filter(([ref]) => /^J\d+$/.test(ref)).map(([, v]) => v);

  for (const rubro of ['Trabajo', 'Inversiones', 'Regalos', 'Otros']) {
    assert.ok(enJ.includes(rubro), `falta el rubro de ingreso ${rubro}`);
  }
});

test('cada rubro cae en la MISMA fila todos los meses', () => {
  // Es toda la razón de tenerlos todos: poder mirar dos meses uno al lado del
  // otro sin buscar dónde quedó cada uno.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-04-03', 'salud', '60'),
  ]));

  const filas = Object.entries(celdas).filter(([ref]) => /^J\d+$/.test(ref));
  const filaDeMarzo = Number(filas.find(([, v]) => v === 'GASTOS POR TIPO')[0].slice(1));
  const filaDeAbril = Number(
    filas.filter(([, v]) => v === 'GASTOS POR TIPO')[1][0].slice(1)
  );

  const rubrosDeMarzo = filas.filter(([ref]) => {
    const n = Number(ref.slice(1));
    return n > filaDeMarzo + 1 && n <= filaDeMarzo + 9;
  }).map(([, v]) => v);
  const rubrosDeAbril = filas.filter(([ref]) => {
    const n = Number(ref.slice(1));
    return n > filaDeAbril + 1 && n <= filaDeAbril + 9;
  }).map(([, v]) => v);

  assert.deepEqual(rubrosDeMarzo, rubrosDeAbril);
  assert.equal(rubrosDeMarzo.length, 8);
});

test('los totales de la derecha suman lo mismo que el último acumulado', () => {
  // Si el detalle y el total se calcularan por caminos separados, tarde o
  // temprano dirían cosas distintas. Este test exige que no puedan.
  const estado = estadoCon([
    mov('2026-03-02', 'comida hecha', '12,50'),
    mov('2026-03-05', 'supermercado', '54,30'),
    mov('2026-03-08', 'viajes', '7,55'),
    mov('2026-03-09', 'comida hecha', '3,45'),
  ]);
  const celdas = celdasDe(estado);

  // Se suman los ocho rubros de gasto, ceros incluidos.
  const porRubro = Array.from({ length: 8 }, (_, i) => Number(celdas[`K${6 + i}`] ?? 0));
  assert.equal(Math.round(porRubro.reduce((a, b) => a + b, 0) * 100) / 100, Number(celdas.A9));
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

  // "Viajes" aparece igual —ahora están todos los rubros— pero en cero: lo que
  // no se pudo convertir no puede sumar en ningún total.
  const enJ = Object.entries(celdas).filter(([ref]) => /^J\d+$/.test(ref));
  const filaDe = (nombre) => filaDe_(enJ, nombre);
  assert.equal(celdas[`K${filaDe('Viajes')}`], '0');
  assert.equal(celdas[`K${filaDe('Salud')}`], '60');
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

// ── Los bloques de la derecha ────────────────────────────────────────────────

test('el encabezado del resumen no se pisa con el primer rubro', () => {
  // Pasó de verdad al pasar a una rejilla: el primer rubro caía en la misma
  // fila que "RUBRO" y lo borraba **en silencio**, porque una rejilla guarda
  // una celda por posición y la última gana.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.equal(celdas.J4, 'GASTOS POR TIPO');
  assert.equal(celdas.J5, 'RUBRO');
  assert.equal(celdas.K5, 'MONTO');
  assert.equal(celdas.J6, 'Gastos fijos', 'el primer rubro de la lista, no el más grande');
});

test('los ingresos también se totalizan por rubro', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-03-10', 'trabajo', '2500', 'I'),
    mov('2026-03-15', 'regalos', '100', 'I'),
  ]));

  const etiquetas = Object.entries(celdas).filter(([ref]) => ref.startsWith('J')).map(([, v]) => v);
  assert.ok(etiquetas.includes('INGRESOS POR TIPO'));
  assert.ok(etiquetas.includes('Trabajo'));
  assert.ok(etiquetas.includes('Regalos'));
});

test('el bloque de ingresos está siempre, aunque el mes no haya tenido ninguno', () => {
  // Un mes sin ingresos y un mes con la fila faltante se ven distinto en una
  // planilla, y solo uno de los dos dice la verdad (T-915).
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '10')]));
  const etiquetas = Object.values(celdas);

  assert.ok(etiquetas.includes('INGRESOS POR TIPO'));
  assert.ok(etiquetas.includes('Trabajo'));
});

test('el bloque de totales dice gastos, ingresos y saldo', () => {
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '30'),
    mov('2026-03-10', 'trabajo', '100', 'I'),
  ]));

  const filas = Object.entries(celdas).filter(([ref]) => ref.startsWith('J'));
  const filaDe = (etiqueta) => filas.find(([, v]) => v === etiqueta)?.[0].slice(1);

  assert.ok(filaDe('TOTALES'));
  assert.equal(celdas[`K${filaDe('Gastos')}`], '30');
  assert.equal(celdas[`K${filaDe('Ingresos')}`], '100');
  assert.equal(celdas[`K${filaDe('Saldo')}`], '70');
});

test('el gasto por día lleva TODOS los días del mes, también los de cero', () => {
  // Es un calendario: uno al que le faltan días no se puede leer, y peor, hace
  // creer que el mes tuvo menos días de los que tuvo.
  const celdas = celdasDe(estadoCon([mov('2026-03-02', 'supermercado', '30')]));

  const filas = Object.entries(celdas).filter(([ref]) => ref.startsWith('J'));
  const inicio = Number(filas.find(([, v]) => v === 'GASTO POR DÍA')[0].slice(1)) + 1;

  // Marzo tiene 31 días.
  assert.equal(celdas[`J${inicio}`], '1');
  assert.equal(celdas[`J${inicio + 30}`], '31');
  assert.equal(celdas[`K${inicio + 1}`], '30', 'el día 2 tiene los 30 €');
  assert.equal(celdas[`K${inicio}`], '0', 'el día 1 va en cero, no vacío');
});

test('el bloque de la derecha no se come el bloque del mes siguiente', () => {
  // El resumen ocupa más filas que los movimientos cuando hay pocos: si el mes
  // siguiente empezara donde terminan los movimientos, se escribirían encima y
  // la rejilla lo haría en silencio.
  //
  // La primera versión de este test comparaba "abril empieza después de la
  // última fila de marzo", contando las filas de marzo como las que están antes
  // de abril. Era circular: si abril se metía en el medio, las filas pisadas
  // dejaban de contarse y el test pasaba igual. Este cuenta los bloques.
  const celdas = celdasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-04-03', 'salud', '60'),
  ]));

  const enJ = Object.entries(celdas)
    .filter(([ref]) => ref.startsWith('J'))
    .map(([ref, valor]) => [Number(ref.slice(1)), valor])
    .sort((a, b) => a[0] - b[0]);

  const calendarios = enJ.filter(([, v]) => v === 'GASTO POR DÍA');
  assert.equal(calendarios.length, 2, 'tiene que haber un calendario por mes');

  // Marzo tiene 31 días y abril 30: los dos calendarios tienen que estar
  // completos, cosa que no pasaría si el segundo mes se hubiera escrito encima.
  for (const [inicio, dias] of [[calendarios[0][0], 31], [calendarios[1][0], 30]]) {
    const numeros = enJ.filter(([n]) => n > inicio && n <= inicio + dias).map(([, v]) => Number(v));
    assert.deepEqual(numeros, Array.from({ length: dias }, (_, i) => i + 1));
  }

  // Y los títulos de los dos meses siguen existiendo: si uno hubiera caído
  // encima de una celda del otro bloque, habría desaparecido.
  const titulos = Object.values(celdas).filter((v) => v === 'MARZO 2026' || v === 'ABRIL 2026');
  assert.equal(titulos.length, 2);
});

test('un importe que no es número se rechaza en vez de valer 0', () => {
  // `Math.round('' * 100)` da 0 sin decir nada, y un 0 inventado se lee igual
  // que un 0 de verdad. Lo destapó una mutación que parecía inofensiva porque
  // esta conversión la tapaba.
  const roto = {
    ...estadoCon([mov('2026-03-02', 'supermercado', '10')]),
  };
  roto.movimientos[0].monto = 'diez';

  assert.throws(() => hojaDeMovimientos(roto));
});
