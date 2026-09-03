// T-050 — Tests de la moneda base (CU-20).
//
// ── Lo que hay que sostener acá ──────────────────────────────────────────────
//
// Cambiar la base **no toca ningún movimiento**: cada uno sigue guardado en su
// moneda y con su monto. Lo que cambia es en qué se suman. Si algún día un
// cambio de base reescribiera un monto, sería la peor pérdida posible: no hay
// forma de saber cuál era el número original.
//
// Y los tipos de cambio guardados están expresados en la base vieja, así que
// hay que reexpresarlos. Donde no se pueda, se pierden — y eso se dice **antes**.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cambiarMonedaBase, efectoDeCambiarBase } from '../src/core/base.js';
import { dibujarEfectoDeBase, dibujarMonedaBase } from '../src/ui/pantallas/base.js';
import { crearCambio, movimientoEnEuros, faltaCambioPara, buscarCambio } from '../src/core/cambio.js';
import { monedaBaseDe, monedasIniciales, MONEDA_BASE } from '../src/core/monedas.js';
import { crearMovimiento } from '../src/core/modelo.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { totalesDelMes } from '../src/core/calculos.js';

let contador = 0;
const gasto = (monto, moneda, fecha = '2026-03-10') => {
  contador += 1;
  return crearMovimiento({ monto, moneda, fecha, tipo: 'G', rubro: 'viajes', comentario: '' },
    { decimales: 2, id: `mov_${contador}`, creado: fecha });
};

// 1 EUR = 45 UYU, 1 USD = 0,92 EUR.
const CAMBIOS = [
  crearCambio({ moneda: 'UYU', mes: '2026-03', euros_por_unidad: 1 / 45 }),
  crearCambio({ moneda: 'USD', mes: '2026-03', euros_por_unidad: 0.92 }),
];

const estadoCon = (movimientos = [], cambios = CAMBIOS, base) => ({
  ...estadoInicial({ monedas: monedasIniciales() }),
  movimientos,
  tipos_cambio: cambios,
  ...(base ? { preferencias: { moneda_base: base } } : {}),
});


// ── Cuál es la base ──────────────────────────────────────────────────────────

test('de fábrica la base es el euro, como siempre', () => {
  assert.equal(monedaBaseDe(estadoCon()), 'EUR');
  assert.equal(monedaBaseDe({}), MONEDA_BASE);
  assert.equal(monedaBaseDe(undefined), 'EUR');
});

test('un estado con otra base la usa', () => {
  assert.equal(monedaBaseDe(estadoCon([], CAMBIOS, 'UYU')), 'UYU');
});

test('una base guardada que no es un código de moneda se ignora', () => {
  // Un respaldo editado a mano puede traer cualquier cosa. Volver al euro es
  // mejor que trabajar con una base inventada.
  for (const mala of ['pesos', '', 'EUROS', 42, null]) {
    assert.equal(monedaBaseDe({ preferencias: { moneda_base: mala } }), 'EUR');
  }
});

test('la base sobrevive a guardar y volver a leer', () => {
  // Sin esto, los totales volverían a euros en cada recarga y el usuario vería
  // sus números multiplicados por cuarenta y cinco (L-015).
  const leido = migrarEstado(JSON.parse(JSON.stringify(estadoCon([], CAMBIOS, 'UYU'))));
  assert.equal(monedaBaseDe(leido), 'UYU');
});


// ── La conversión ────────────────────────────────────────────────────────────

test('con base en euros, 100 USD son 92 EUR', () => {
  assert.equal(movimientoEnEuros(gasto('100', 'USD'), CAMBIOS, monedasIniciales(), 'EUR'), 9200);
});

test('con base en pesos, los mismos 100 USD son 4.140 UYU', () => {
  // 100 USD × 0,92 EUR × 45 UYU/EUR. La cuenta se hace con los tipos ya
  // reexpresados, que es lo que hace `cambiarMonedaBase`.
  const enPesos = cambiarMonedaBase(estadoCon(), 'UYU');
  assert.equal(
    movimientoEnEuros(gasto('100', 'USD'), enPesos.tipos_cambio, enPesos.monedas, 'UYU'),
    414000
  );
});

test('la base no lleva tipo de cambio, sea cual sea', () => {
  assert.equal(buscarCambio([], 'UYU', '2026-03', 'UYU'), 1);
  assert.equal(faltaCambioPara(gasto('100', 'UYU'), [], 'UYU'), null);
});

test('con base en pesos, el EURO sí necesita cotización', () => {
  // Es la vuelta de tuerca: para quien lleva sus cuentas en pesos, el euro es
  // una moneda más.
  assert.deepEqual(faltaCambioPara(gasto('10', 'EUR'), [], 'UYU'), { moneda: 'EUR', mes: '2026-03' });

  const enPesos = cambiarMonedaBase(estadoCon(), 'UYU');
  assert.equal(faltaCambioPara(gasto('10', 'EUR'), enPesos.tipos_cambio, 'UYU'), null);
  assert.equal(movimientoEnEuros(gasto('10', 'EUR'), enPesos.tipos_cambio, enPesos.monedas, 'UYU'), 45000);
});

test('los totales del mes salen en la base elegida', () => {
  const enEuros = estadoCon([gasto('100', 'USD')]);
  const enPesos = cambiarMonedaBase(enEuros, 'UYU');

  assert.equal(totalesDelMes(enEuros, '2026-03').gastos, 9200);
  assert.equal(totalesDelMes({ ...enPesos, movimientos: enEuros.movimientos }, '2026-03').gastos, 414000);
});


// ── Reexpresar los tipos de cambio ───────────────────────────────────────────

test('los movimientos NO se tocan al cambiar la base', () => {
  // Es lo más importante de esta tarea: si un cambio de base reescribiera un
  // monto, no habría forma de saber cuál era el número original.
  const antes = estadoCon([gasto('100', 'USD'), gasto('500', 'UYU')]);
  const despues = cambiarMonedaBase(antes, 'UYU');

  assert.deepEqual(despues.movimientos, antes.movimientos);
});

test('la base vieja pasa a ser una moneda más, con su cotización', () => {
  const enPesos = cambiarMonedaBase(estadoCon(), 'UYU');
  const euro = enPesos.tipos_cambio.find((c) => c.moneda === 'EUR');

  assert.equal(euro.mes, '2026-03');
  assert.equal(Math.round(euro.euros_por_unidad), 45, 'un euro son 45 pesos');
});

test('la moneda que pasa a ser base deja de tener tipo de cambio', () => {
  const enPesos = cambiarMonedaBase(estadoCon(), 'UYU');
  assert.equal(enPesos.tipos_cambio.some((c) => c.moneda === 'UYU'), false);
});

test('los demás tipos se reexpresan en la base nueva', () => {
  const enPesos = cambiarMonedaBase(estadoCon(), 'UYU');
  const dolar = enPesos.tipos_cambio.find((c) => c.moneda === 'USD');

  // 0,92 EUR/USD ÷ (1/45) EUR/UYU = 41,4 UYU por dólar.
  assert.ok(Math.abs(dolar.euros_por_unidad - 41.4) < 0.0001, `dio ${dolar.euros_por_unidad}`);
});

test('ida y vuelta deja los mismos números', () => {
  // La cuenta tiene que ser reversible: si no, cada cambio de base iría
  // corriendo los tipos de cambio un poquito.
  const original = estadoCon();
  const vuelta = cambiarMonedaBase(cambiarMonedaBase(original, 'UYU'), 'EUR');

  const dolar = (estado) => estado.tipos_cambio.find((c) => c.moneda === 'USD').euros_por_unidad;
  assert.ok(Math.abs(dolar(vuelta) - dolar(original)) < 1e-12);
  assert.equal(monedaBaseDe(vuelta), 'EUR');
});

test('un mes sin cotización de la base nueva pierde sus tipos, y se avisa ANTES', () => {
  // Inventar una cotización que el usuario no dio es exactamente lo que esta app
  // no hace. Lo que sí hace es decirlo antes de que apriete el botón.
  const conAbril = [...CAMBIOS, crearCambio({ moneda: 'CRC', mes: '2026-04', euros_por_unidad: 0.0016 })];
  const efecto = efectoDeCambiarBase(estadoCon([], conAbril), 'UYU');

  assert.deepEqual(efecto.perdidos, [{ moneda: 'CRC', mes: '2026-04' }]);
  assert.deepEqual(efecto.meses, ['2026-03']);

  const enPesos = cambiarMonedaBase(estadoCon([], conAbril), 'UYU');
  assert.equal(enPesos.tipos_cambio.some((c) => c.mes === '2026-04'), false);
});

test('cambiar a la base que ya está no hace nada', () => {
  const estado = estadoCon();
  assert.equal(cambiarMonedaBase(estado, 'EUR'), estado);
  assert.equal(efectoDeCambiarBase(estado, 'EUR').sinCambios, true);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('antes de cambiar, la pantalla dice qué va a pasar', () => {
  const conAbril = [...CAMBIOS, crearCambio({ moneda: 'CRC', mes: '2026-04', euros_por_unidad: 0.0016 })];
  const html = dibujarEfectoDeBase(efectoDeCambiarBase(estadoCon([], conAbril), 'UYU'))
    .replace(/\s+/g, ' ');

  assert.match(html, /Tus movimientos <strong>no se tocan<\/strong>/);
  assert.match(html, /Se pierde <strong>1<\/strong> tipo de cambio guardado/);
  assert.match(html, /abril de 2026/);
  assert.match(html, /data-accion="confirmar-base" data-moneda="UYU"/);
});

test('sin nada elegido, la pantalla no muestra ninguna advertencia', () => {
  assert.equal(dibujarEfectoDeBase(null), '');
  assert.equal(dibujarEfectoDeBase({ sinCambios: true }), '');
});

test('la pantalla dice cuál es la base y ofrece las otras monedas', () => {
  const html = dibujarMonedaBase({ estado: estadoCon() });

  assert.match(html, /Ahora es <strong>EUR<\/strong>/);
  assert.match(html, /data-accion="elegir-base" data-moneda="UYU"/);
  assert.doesNotMatch(html, /data-accion="elegir-base" data-moneda="EUR"/, 'la que ya es base no se ofrece');
});

test('la pantalla aclara que los ahorros no usan la base', () => {
  // Los ahorros conjuntos nunca se convierten (CU-14): sin decirlo, alguien
  // podría cambiar la base esperando ver sus ahorros en otra moneda.
  assert.match(dibujarMonedaBase({ estado: estadoCon() }).replace(/\s+/g, ' '),
    /Los ahorros conjuntos no usan la moneda base/);
});


// ── El caso que el usuario señaló: un historial en euros que se pasa a pesos ──
//
// "si vos ya ingresaste datos en euros y de repente pedís que el peso uruguayo
// pase a ser tu base, tendrías que meter retroactivamente el tipo de cambio en
// todos los meses en que hay datos".
//
// Contar los tipos de cambio guardados no alcanza para verlo: un historial
// entero en euros con base en euros no tiene **ningún** tipo cargado, así que
// mirando solo esa lista el cambio parece gratis. Hay que mirar los movimientos.

const HISTORIAL_EN_EUROS = [
  gasto('100', 'EUR', '2026-01-15'),
  gasto('200', 'EUR', '2026-02-10'),
  gasto('300', 'EUR', '2026-03-05'),
];

test('pasar a pesos un historial en euros avisa que faltan los tipos de todos los meses', () => {
  const efecto = efectoDeCambiarBase(estadoCon(HISTORIAL_EN_EUROS, []), 'UYU');

  assert.equal(efecto.movimientosSinConvertirAhora, 0, 'hoy, en euros, no falta nada');
  assert.equal(efecto.movimientosSinConvertir, 3, 'después, todos quedan sin convertir');
  assert.deepEqual(efecto.faltantes.map((f) => f.mes), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(efecto.faltantes[0].monedas, ['EUR']);
  assert.ok(efecto.faltantes.every((f) => f.nuevo), 'los tres meses se rompen por este cambio');
});

test('el aviso nombra los meses y cuántos movimientos quedan colgados', () => {
  const html = dibujarEfectoDeBase(efectoDeCambiarBase(estadoCon(HISTORIAL_EN_EUROS, []), 'UYU'))
    .replace(/\s+/g, ' ');

  assert.match(html, /te va a faltar la cotización de EUR/);
  assert.match(html, /enero de 2026, febrero de 2026, marzo de 2026/);
  assert.match(html, /<strong>3<\/strong> movimientos no van a poder contarse en los totales hasta que la cargues/);
  assert.match(html, /hacia atrás, mes por mes/);
});

test('el mes que sí tiene cotización de la moneda nueva no aparece como faltante', () => {
  // Marzo tiene el tipo del peso: ese mes se reexpresa y sigue andando.
  const efecto = efectoDeCambiarBase(estadoCon(HISTORIAL_EN_EUROS, CAMBIOS), 'UYU');

  assert.deepEqual(efecto.faltantes.map((f) => f.mes), ['2026-01', '2026-02']);
  assert.equal(efecto.movimientosSinConvertir, 2);
});

test('un faltante que ya existía hoy no se le cuelga al cambio de base', () => {
  // Un gasto en dólares de un mes sin tipo: ya hoy no se puede convertir. El
  // aviso lo dice aparte, para no acusar al cambio de base de un agujero viejo.
  const viejo = gasto('50', 'USD', '2026-01-20');
  const efecto = efectoDeCambiarBase(estadoCon([viejo], CAMBIOS), 'UYU');

  assert.equal(efecto.movimientosSinConvertirAhora, 1);
  assert.deepEqual(efecto.faltantes.map((f) => f.nuevo), [false]);

  const html = dibujarEfectoDeBase(efecto).replace(/\s+/g, ' ');
  assert.match(html, /1 ya no se puede convertir hoy, antes de este cambio/);
});

test('lo que ya se podía convertir sigue pudiéndose después del cambio', () => {
  // Marzo tiene los dos tipos: pasar a pesos no rompe nada de ese mes.
  const efecto = efectoDeCambiarBase(estadoCon([gasto('100', 'USD'), gasto('10', 'EUR')], CAMBIOS), 'UYU');

  assert.deepEqual(efecto.faltantes, []);
  assert.equal(efecto.movimientosSinConvertir, 0);
  assert.equal(dibujarEfectoDeBase(efecto).includes('te va a faltar'), false);
});


// ── Los textos que decían "euros" a mano ─────────────────────────────────────
//
// Con la base fija en euros, escribir "1 EUR son…" en el formulario del tipo de
// cambio era correcto. Desde que la base se elige, cada uno de esos literales es
// una mentira en potencia — y en una pantalla de plata, lo que está escrito se
// cree más que el número.

test('el formulario del tipo de cambio pide la cotización contra la base elegida', async () => {
  const { dibujarPedido } = await import('../src/ui/pantallas/cambio.js');
  const vista = (base) => ({
    estado: estadoCon([], [], base),
    faltaCambio: { moneda: 'USD', mes: '2026-03' },
  });

  assert.match(dibujarPedido(vista()).replace(/\s+/g, ' '), /1 EUR son…/);
  const enPesos = dibujarPedido(vista('UYU')).replace(/\s+/g, ' ');
  assert.match(enPesos, /1 UYU son…/);
  assert.match(enPesos, /no se puede expresar en UYU/);
});

test('ajustes describe los tipos de cambio contra la base elegida', async () => {
  const { dibujarAjustes } = await import('../src/ui/pantallas/ajustes.js');

  assert.match(dibujarAjustes({ estado: estadoCon() }).replace(/\s+/g, ' '),
    /Lo que vale cada moneda en EUR/);
  assert.match(dibujarAjustes({ estado: estadoCon([], CAMBIOS, 'UYU') }).replace(/\s+/g, ' '),
    /Lo que vale cada moneda en UYU/);
});

test('un tipo de cambio se lee contra la base, no contra el euro', async () => {
  const { formatearTipoDeCambio } = await import('../src/core/formato.js');

  assert.equal(formatearTipoDeCambio(0.92, 'USD'), '1 EUR = 1,0870 USD');
  assert.equal(formatearTipoDeCambio(0.92, 'USD', 'UYU'), '1 UYU = 1,0870 USD');
});


// ── La puerta para cargar los tipos hacia atrás ──────────────────────────────
//
// La app pide el tipo de cambio sola cuando el movimiento es nuevo. Después de
// cambiar la base, los movimientos ya están guardados: nadie los va a volver a
// cargar, así que ese pedido nunca llega. Sin una lista de lo que falta, con su
// botón, el usuario queda mirando un total incompleto y sin ninguna salida.

test('la pantalla de tipos de cambio ofrece cargar los que faltan', async () => {
  const { dibujarCambios } = await import('../src/ui/pantallas/cambio.js');
  const estado = estadoCon(HISTORIAL_EN_EUROS, [], 'UYU');
  const html = dibujarCambios({ estado }).replace(/\s+/g, ' ');

  assert.match(html, /Faltan 3 tipos de cambio/);
  assert.match(html, /data-accion="corregir-cambio" data-moneda="EUR" data-mes="2026-03"/);
  assert.match(html, /data-accion="corregir-cambio" data-moneda="EUR" data-mes="2026-01"/);
});

test('sin faltantes, esa alarma no aparece', async () => {
  const { dibujarCambios } = await import('../src/ui/pantallas/cambio.js');
  const html = dibujarCambios({ estado: estadoCon(HISTORIAL_EN_EUROS, []) });

  assert.equal(html.includes('Tipos de cambio'), true, 'la pantalla sigue estando');
  assert.equal(/Falta[n]? \d* ?tipos? de cambio/.test(html), false);
});

test('la lista de tipos dice contra qué base están', async () => {
  const { dibujarCambios } = await import('../src/ui/pantallas/cambio.js');
  const html = dibujarCambios({ estado: estadoCon([], CAMBIOS, 'UYU') }).replace(/\s+/g, ' ');

  assert.match(html, /cuánto vale esa moneda en UYU/);
  assert.match(html, /1 UYU = /);
});
