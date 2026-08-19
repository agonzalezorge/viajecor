// T-005 — Tests de los tipos de cambio y la conversión a euros.
//
// Es el módulo donde un número se puede guardar del revés sin que nada falle:
// un tipo de cambio invertido no da error, da totales absurdos que alguien tiene
// que notar mirando. Y es donde un movimiento sin tipo de cambio podría
// desaparecer de un total en silencio.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMBIO_EURO,
  validarMes,
  crearCambio,
  desdeUnidadesPorEuro,
  aUnidadesPorEuro,
  buscarCambio,
  guardarCambio,
  faltaCambioPara,
  movimientoEnEuros,
  totalEnEuros,
  cambiosQueFaltan,
  movimientosAfectadosPor,
} from '../src/core/cambio.js';

import { crearMovimiento } from '../src/core/modelo.js';
import { monedasIniciales, agregarMoneda } from '../src/core/monedas.js';

const MONEDAS = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen japonés', decimales: 0 });
const AHORA = '2026-03-14T20:11:03.000Z';

let contador = 0;
function gasto(monto, moneda, fecha = '2026-03-14', decimales = 2) {
  contador += 1;
  return crearMovimiento(
    { fecha, tipo: 'G', rubro: 'viajes', monto, moneda },
    { decimales, id: `mov_${String(contador).padStart(16, '0')}`, ahora: AHORA }
  );
}

const CAMBIO_CRC_MARZO = crearCambio(
  { moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00164 },
  { ahora: AHORA }
);

// ── El euro no se convierte ──────────────────────────────────────────────────

test('el euro vale 1 y no hace falta guardarlo', () => {
  // Tenerlo como dato guardado sería una fuente de error —alguien podría
  // cargarlo mal— y obligaría a pedírselo al usuario en el 90% de los casos.
  assert.equal(buscarCambio([], 'EUR', '2026-03'), CAMBIO_EURO);
  assert.equal(buscarCambio([], 'eur', '2026-03'), 1);
  assert.equal(faltaCambioPara(gasto('12,50', 'EUR'), []), null);
});

test('un movimiento en euros pasa entero, sin redondear de nuevo', () => {
  // Redondear algo que no hace falta convertir solo puede empeorarlo.
  const mov = gasto('12,50', 'EUR');
  assert.equal(movimientoEnEuros(mov, [], MONEDAS), 1250);
});

test('no se puede cargar un tipo de cambio para el euro', () => {
  assert.throws(
    () => crearCambio({ moneda: 'EUR', mes: '2026-03', euros_por_unidad: 1.1 }),
    /El euro no lleva tipo de cambio/
  );
});

// ── El cálculo inverso (CU-03) ───────────────────────────────────────────────

test('"un euro son 630 colones" se guarda como euros por colón', () => {
  // Es como suele venir la información, y es el punto exacto donde un número se
  // puede guardar del revés.
  const eurosPorColon = desdeUnidadesPorEuro(630);
  assert.ok(Math.abs(eurosPorColon - 0.001587) < 0.000001);

  // Y se puede mostrar de vuelta como el usuario lo conoce.
  assert.ok(Math.abs(aUnidadesPorEuro(eurosPorColon) - 630) < 0.0001);
});

test('dar vuelta dos veces devuelve el mismo número', () => {
  for (const valor of [630, 0.00164, 1.08, 155.5]) {
    assert.ok(Math.abs(aUnidadesPorEuro(desdeUnidadesPorEuro(valor)) - valor) < 1e-9);
  }
});

test('un tipo de cambio cero o negativo no se acepta', () => {
  for (const malo of [0, -1, -0.5]) {
    assert.throws(() => crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: malo }), /mayor que cero/);
    assert.throws(() => desdeUnidadesPorEuro(malo), /mayor que cero/);
  }
  assert.throws(() => crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: 'mucho' }), /mayor que cero/);
});

// ── Una moneda, dos meses con tipos distintos ────────────────────────────────

test('cada mes usa su propio tipo de cambio', () => {
  const cambios = [
    crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00164 }, { ahora: AHORA }),
    crearCambio({ moneda: 'CRC', mes: '2026-04', euros_por_unidad: 0.00180 }, { ahora: AHORA }),
  ];

  const enMarzo = gasto('10000', 'CRC', '2026-03-14');
  const enAbril = gasto('10000', 'CRC', '2026-04-14');

  // El mismo monto en la misma moneda, distinto mes, distinto importe en euros.
  assert.equal(movimientoEnEuros(enMarzo, cambios, MONEDAS), 1640);
  assert.equal(movimientoEnEuros(enAbril, cambios, MONEDAS), 1800);
});

test('el mes sale de la fecha del movimiento, no de un campo aparte', () => {
  const cambios = [crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00164 }, { ahora: AHORA })];
  // Último día de marzo: usa marzo. Primero de abril: ya no hay tipo de cambio.
  assert.equal(movimientoEnEuros(gasto('10000', 'CRC', '2026-03-31'), cambios, MONEDAS), 1640);
  assert.throws(() => movimientoEnEuros(gasto('10000', 'CRC', '2026-04-01'), cambios, MONEDAS), /Falta el tipo de cambio/);
});

test('un mes mal escrito se rechaza', () => {
  for (const malo of ['marzo', '2026-3', '2026/03', '', null, '2026-13', '2026-00']) {
    assert.throws(() => validarMes(malo), /mes/i);
  }
  assert.equal(validarMes('2026-03'), '2026-03');
  assert.equal(validarMes('2026-12'), '2026-12');
});

// ── Cuando falta el tipo de cambio ───────────────────────────────────────────

test('falta el tipo de cambio: se avisa antes de guardar (CU-03)', () => {
  const mov = gasto('10000', 'CRC');
  assert.deepEqual(faltaCambioPara(mov, []), { moneda: 'CRC', mes: '2026-03' });
  assert.equal(faltaCambioPara(mov, [CAMBIO_CRC_MARZO]), null);
});

test('convertir sin tipo de cambio TIRA, no devuelve cero', () => {
  // Un movimiento que se cuenta como cero desaparece de un total sin dejar
  // rastro: el total baja, no hay error, y nadie se entera.
  assert.throws(() => movimientoEnEuros(gasto('10000', 'CRC'), [], MONEDAS), (error) => {
    assert.match(error.message, /Falta el tipo de cambio de CRC para 2026-03/);
    return true;
  });
});

test('un total con un movimiento sin tipo de cambio no se calcula a medias', () => {
  // Mostrar "1.234,00 €" cuando en realidad faltó sumar un gasto es peor que no
  // mostrar nada: el número parece completo.
  const movimientos = [gasto('12,50', 'EUR'), gasto('10000', 'CRC')];
  assert.throws(() => totalEnEuros(movimientos, [], MONEDAS), /Falta el tipo de cambio/);
});

test('se avisa de todos los que faltan de una vez, sin repetir', () => {
  const movimientos = [
    gasto('12,50', 'EUR'),
    gasto('10000', 'CRC', '2026-03-14'),
    gasto('20000', 'CRC', '2026-03-20'),
    gasto('30000', 'CRC', '2026-04-02'),
    gasto('50', 'USD', '2026-03-05'),
  ];

  const faltan = cambiosQueFaltan(movimientos, []);
  assert.deepEqual(faltan, [
    { moneda: 'CRC', mes: '2026-03' },
    { moneda: 'CRC', mes: '2026-04' },
    { moneda: 'USD', mes: '2026-03' },
  ]);
});

// ── Guardar y buscar ─────────────────────────────────────────────────────────

test('la clave es el par (moneda, mes): corregir reemplaza, no duplica', () => {
  let cambios = guardarCambio([], CAMBIO_CRC_MARZO);
  assert.equal(cambios.length, 1);

  cambios = guardarCambio(cambios, crearCambio(
    { moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00170 }, { ahora: AHORA }
  ));

  assert.equal(cambios.length, 1, 'no quedan dos tipos de cambio para el mismo par');
  assert.equal(buscarCambio(cambios, 'CRC', '2026-03'), 0.00170);
});

test('guardar no modifica la lista que recibe', () => {
  const cambios = [CAMBIO_CRC_MARZO];
  guardarCambio(cambios, crearCambio({ moneda: 'USD', mes: '2026-03', euros_por_unidad: 0.92 }, { ahora: AHORA }));
  assert.equal(cambios.length, 1);
});

test('buscar no distingue mayúsculas ni espacios', () => {
  const cambios = [CAMBIO_CRC_MARZO];
  for (const escritura of ['CRC', 'crc', ' Crc ']) {
    assert.equal(buscarCambio(cambios, escritura, '2026-03'), 0.00164);
  }
});

test('un tipo de cambio guardado con la moneda rota no rompe la búsqueda', () => {
  // Un dato corrupto se descarta al leer (T-004); buscar no es el lugar donde
  // eso tiene que explotar.
  const cambios = [{ moneda: 'COLONES', mes: '2026-03', euros_por_unidad: 1 }, CAMBIO_CRC_MARZO];
  assert.equal(buscarCambio(cambios, 'CRC', '2026-03'), 0.00164);
});

test('sin tipo de cambio para ese mes, buscar devuelve null, no un error', () => {
  // "No hay dato" es una respuesta legítima y frecuente: es lo que dispara que
  // la app lo pida.
  assert.equal(buscarCambio([CAMBIO_CRC_MARZO], 'CRC', '2026-04'), null);
  assert.equal(buscarCambio([], 'USD', '2026-03'), null);
});

// ── Totales ──────────────────────────────────────────────────────────────────

test('un total mezcla monedas y da en euros', () => {
  const cambios = [
    CAMBIO_CRC_MARZO,
    crearCambio({ moneda: 'USD', mes: '2026-03', euros_por_unidad: 0.92 }, { ahora: AHORA }),
  ];
  const movimientos = [
    gasto('12,50', 'EUR'),            //   12,50 €
    gasto('10000', 'CRC'),            //   16,40 €
    gasto('50,00', 'USD'),            //   46,00 €
  ];

  assert.equal(totalEnEuros(movimientos, cambios, MONEDAS), 1250 + 1640 + 4600);
});

test('el total es la suma de lo que se ve, no un número más exacto', () => {
  // Decisión deliberada: cada movimiento se redondea al céntimo ANTES de sumarse,
  // porque es lo que la app muestra en cada fila. Sumar sin redondear daría un
  // total que no coincide con la suma de la pantalla — más exacto y menos creíble.
  const cambios = [crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00164 }, { ahora: AHORA })];
  const movimientos = Array.from({ length: 3 }, () => gasto('1000', 'CRC'));

  // 1000 colones = 1,64 €, que se redondea a 164 céntimos por movimiento.
  for (const m of movimientos) {
    assert.equal(movimientoEnEuros(m, cambios, MONEDAS), 164);
  }
  assert.equal(totalEnEuros(movimientos, cambios, MONEDAS), 492);
});

test('una moneda sin decimales se convierte bien', () => {
  const cambios = [crearCambio({ moneda: 'JPY', mes: '2026-03', euros_por_unidad: 0.0062 }, { ahora: AHORA })];
  const mov = gasto('1500', 'JPY', '2026-03-14', 0);

  assert.equal(mov.monto, 1500);
  assert.equal(movimientoEnEuros(mov, cambios, MONEDAS), 930); // 9,30 €
});

test('convertir una moneda que no está en el catálogo TIRA (ADR-018)', () => {
  const cambios = [crearCambio({ moneda: 'ARS', mes: '2026-03', euros_por_unidad: 0.001 }, { ahora: AHORA })];
  assert.throws(
    () => movimientoEnEuros(gasto('1000', 'ARS'), cambios, MONEDAS),
    /no está en tu lista/
  );
});

test('un total sin movimientos da cero', () => {
  assert.equal(totalEnEuros([], [], MONEDAS), 0);
});

test('mil movimientos se suman sin ningún tope de filas (L-001)', () => {
  const cambios = [CAMBIO_CRC_MARZO];
  const movimientos = Array.from({ length: 1000 }, () => gasto('1000', 'CRC'));
  assert.equal(totalEnEuros(movimientos, cambios, MONEDAS), 164 * 1000);
});

// ── Corregir un tipo de cambio ya usado (RN-05) ──────────────────────────────

test('se puede saber cuántos movimientos afecta una corrección', () => {
  // RN-05: corregir un tipo de cambio cambia totales de meses ya cerrados. La app
  // tiene que decir cuántos movimientos toca ANTES de aplicarlo. Un número que
  // cambia solo, sin aviso, es la forma más rápida de que alguien deje de confiar.
  const movimientos = [
    gasto('10000', 'CRC', '2026-03-14'),
    gasto('20000', 'CRC', '2026-03-20'),
    gasto('30000', 'CRC', '2026-04-02'),
    gasto('50,00', 'USD', '2026-03-05'),
    gasto('12,50', 'EUR', '2026-03-05'),
  ];

  assert.equal(movimientosAfectadosPor(movimientos, 'CRC', '2026-03'), 2);
  assert.equal(movimientosAfectadosPor(movimientos, 'CRC', '2026-04'), 1);
  assert.equal(movimientosAfectadosPor(movimientos, 'USD', '2026-03'), 1);
  assert.equal(movimientosAfectadosPor(movimientos, 'UYU', '2026-03'), 0);
});

test('corregir el tipo de cambio cambia el total, que es el punto (RN-05)', () => {
  // El importe en euros se deriva, no se congela: por eso corregir una vez
  // arregla el mes entero, en vez de tener que editar movimiento por movimiento.
  const movimientos = [gasto('10000', 'CRC'), gasto('20000', 'CRC')];

  let cambios = guardarCambio([], CAMBIO_CRC_MARZO);
  assert.equal(totalEnEuros(movimientos, cambios, MONEDAS), 1640 + 3280);

  cambios = guardarCambio(cambios, crearCambio(
    { moneda: 'CRC', mes: '2026-03', euros_por_unidad: 0.00180 }, { ahora: AHORA }
  ));
  assert.equal(totalEnEuros(movimientos, cambios, MONEDAS), 1800 + 3600);

  // Y los movimientos no se tocaron: siguen guardando su monto original.
  assert.equal(movimientos[0].monto, 1000000);
});
