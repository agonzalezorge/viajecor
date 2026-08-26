// T-012 — Tests de pedir y corregir tipos de cambio.
//
// Acá hay un error que no da error: escribir el tipo de cambio al revés. Si
// alguien pone 0,0016 donde va 630, la app no falla — guarda números absurdos
// que alguien tiene que notar mirando. La mitad de estos tests son sobre eso y
// sobre la otra consecuencia incómoda: corregir un tipo de cambio cambia totales
// que el usuario ya vio (RN-05).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  leerTipoDeCambio,
  intentarGuardarCambio,
  efectoDeCorregir,
  dibujarPedido,
  dibujarCambios,
  dibujarAvisoCorreccion,
  dibujarMovimientoEnEspera,
} from '../src/ui/pantallas/cambio.js';

import { intentarGuardar, borradorNuevo } from '../src/ui/pantallas/movimiento.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { buscarCambio, aUnidadesPorEuro } from '../src/core/cambio.js';

const DURO = ' ';
const MES = '2026-03';

function estadoLimpio(extra = {}) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), ...extra };
}

function borradorDe(campos = {}) {
  return {
    ...borradorNuevo({ estado: estadoLimpio() }),
    fecha: '2026-03-14',
    rubro: 'viajes',
    monto: '10000',
    moneda: 'CRC',
    ...campos,
  };
}

/** Un estado con N gastos en colones de marzo y su tipo de cambio cargado. */
function conColones(cuantos = 1, unidadesPorEuro = 630) {
  let estado = intentarGuardarCambio(estadoLimpio(), {
    moneda: 'CRC', mes: MES, unidadesPorEuro,
  }).estado;
  for (let i = 0; i < cuantos; i += 1) {
    estado = intentarGuardar(estado, borradorDe()).estado;
  }
  return estado;
}

// ── Interpretar lo que se escribe ────────────────────────────────────────────

test('el tipo de cambio se puede escribir con coma o con punto', () => {
  // El teclado del celular mete punto y la cabeza escribe coma.
  assert.equal(leerTipoDeCambio('630'), 630);
  assert.equal(leerTipoDeCambio('630,25'), 630.25);
  assert.equal(leerTipoDeCambio('630.25'), 630.25);
  assert.equal(leerTipoDeCambio(' 1,0870 '), 1.087);
  assert.equal(leerTipoDeCambio('0,0000062'), 0.0000062);
});

test('un tipo de cambio que no es un número se rechaza con un mensaje claro', () => {
  for (const malo of ['', 'seiscientos', '6-30', '1.2.3', 'abc', null, undefined, {}]) {
    assert.throws(() => leerTipoDeCambio(malo), /número/);
  }
});

test('cero y negativos se rechazan', () => {
  for (const malo of ['0', '0,00', '-630', -1, 0]) {
    assert.throws(() => leerTipoDeCambio(malo), /mayor que cero/);
  }
});

// ── Guardar el tipo de cambio ────────────────────────────────────────────────

test('se escribe como se conoce y se guarda al revés (CU-03)', () => {
  // El usuario escribe "un euro son 630 colones"; por dentro se guarda como
  // euros por colón, porque convertir es entonces una multiplicación.
  const { estado, error } = intentarGuardarCambio(estadoLimpio(), {
    moneda: 'CRC', mes: MES, unidadesPorEuro: '630',
  });

  assert.equal(error, undefined);
  const guardado = buscarCambio(estado.tipos_cambio, 'CRC', MES);
  assert.ok(Math.abs(guardado - 1 / 630) < 1e-12);
  // Y se puede mostrar de vuelta como se escribió.
  assert.ok(Math.abs(aUnidadesPorEuro(guardado) - 630) < 1e-9);
});

test('guardar no modifica el estado que recibe', () => {
  const antes = estadoLimpio();
  intentarGuardarCambio(antes, { moneda: 'CRC', mes: MES, unidadesPorEuro: '630' });
  assert.equal(antes.tipos_cambio.length, 0);
});

test('corregir reemplaza, no acumula', () => {
  let estado = intentarGuardarCambio(estadoLimpio(), { moneda: 'CRC', mes: MES, unidadesPorEuro: '630' }).estado;
  estado = intentarGuardarCambio(estado, { moneda: 'CRC', mes: MES, unidadesPorEuro: '640' }).estado;

  assert.equal(estado.tipos_cambio.length, 1);
  assert.ok(Math.abs(aUnidadesPorEuro(buscarCambio(estado.tipos_cambio, 'CRC', MES)) - 640) < 1e-9);
});

test('no se puede cargar un tipo de cambio para el euro', () => {
  const { error } = intentarGuardarCambio(estadoLimpio(), { moneda: 'EUR', mes: MES, unidadesPorEuro: '1' });
  assert.match(error, /El euro no lleva tipo de cambio/);
});

test('intentarGuardarCambio nunca tira', () => {
  for (const campos of [
    { moneda: 'XX', mes: MES, unidadesPorEuro: '630' },
    { moneda: 'CRC', mes: 'marzo', unidadesPorEuro: '630' },
    { moneda: 'CRC', mes: MES, unidadesPorEuro: 'nada' },
    { moneda: null, mes: null, unidadesPorEuro: null },
  ]) {
    const { error, estado } = intentarGuardarCambio(estadoLimpio(), campos);
    assert.equal(typeof error, 'string');
    assert.equal(estado.tipos_cambio.length, 0);
  }
});

// ── El recorrido completo: la interrupción y el reintento ────────────────────

test('el gasto que no se pudo guardar sigue esperando, y entra después', () => {
  // Es el recorrido de CU-03 completo: se interrumpe, se carga el dato, y el
  // gasto que motivó la interrupción queda guardado.
  const estado = estadoLimpio();
  const borrador = borradorDe();

  const primero = intentarGuardar(estado, borrador);
  assert.equal(primero.estado.movimientos.length, 0);
  assert.deepEqual(primero.faltaCambio, { moneda: 'CRC', mes: MES });
  // Y el borrador vuelve intacto, o el reintento cargaría otra cosa.
  assert.deepEqual(primero.borrador, borrador);

  const conCambio = intentarGuardarCambio(primero.estado, {
    moneda: primero.faltaCambio.moneda,
    mes: primero.faltaCambio.mes,
    unidadesPorEuro: '630',
  });
  const reintento = intentarGuardar(conCambio.estado, primero.borrador);

  assert.equal(reintento.error, undefined);
  assert.equal(reintento.estado.movimientos.length, 1);
  assert.equal(reintento.estado.movimientos[0].moneda, 'CRC');
  assert.equal(reintento.estado.movimientos[0].monto, 1000000);
});

// ── Corregir uno ya usado (RN-05) ────────────────────────────────────────────

test('antes de corregir se sabe a cuántos movimientos afecta', () => {
  const estado = conColones(3);
  const efecto = efectoDeCorregir(estado, 'CRC', MES, '640');
  assert.equal(efecto.afectados, 3);
});

test('y en cuánto cambia el total del mes, con números concretos', () => {
  // 10.000 colones a 630 por euro son 15,87 €. A 500 por euro son 20,00 €.
  const estado = conColones(1, 630);
  const efecto = efectoDeCorregir(estado, 'CRC', MES, '500');

  assert.equal(efecto.antes, 1587);
  assert.equal(efecto.despues, 2000);
  assert.equal(efecto.diferencia, 413);
});

test('un tipo de cambio sin movimientos no afecta a nadie', () => {
  const estado = intentarGuardarCambio(estadoLimpio(), { moneda: 'CRC', mes: MES, unidadesPorEuro: '630' }).estado;
  assert.deepEqual(efectoDeCorregir(estado, 'CRC', MES, '640'), { afectados: 0 });
});

test('con el valor nuevo a medio escribir se sabe cuántos, pero no cuánto', () => {
  // Mientras se escribe, el número está incompleto. Decir "afecta a 3
  // movimientos" ya es útil; inventar un total con un número a medias, no.
  const estado = conColones(3);
  const efecto = efectoDeCorregir(estado, 'CRC', MES, '');
  assert.equal(efecto.afectados, 3);
  assert.equal(efecto.diferencia, undefined);
});

test('el aviso dice cuántos movimientos y cómo queda el total', () => {
  const estado = conColones(2, 630);
  const html = dibujarAvisoCorreccion(efectoDeCorregir(estado, 'CRC', MES, '500'), 'CRC');

  assert.ok(html.includes('2 movimientos'));
  assert.ok(html.includes('sube'));
  assert.ok(html.includes(`31,74${DURO}€`));
  assert.ok(html.includes(`40,00${DURO}€`));
});

test('sin movimientos afectados no se dibuja ningún aviso', () => {
  assert.equal(dibujarAvisoCorreccion({ afectados: 0 }, 'CRC'), '');
  assert.equal(dibujarAvisoCorreccion(null, 'CRC'), '');
});

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

test('el pedido explica por qué interrumpió y en qué sentido escribir', () => {
  const vista = { estado: estadoLimpio(), faltaCambio: { moneda: 'CRC', mes: MES } };
  const html = dibujarPedido(vista);

  assert.ok(html.includes('Colón costarricense'.toLowerCase()));
  assert.ok(html.includes('marzo de 2026'));
  // El sentido escrito en la misma línea del campo: es lo que hace difícil
  // escribirlo al revés, que es el error más fácil de cometer acá.
  assert.ok(html.includes('1 EUR son'));
  assert.ok(html.includes('name="unidadesPorEuro"'));
  assert.ok(html.includes('inputmode="decimal"'));
  assert.ok(html.includes('data-accion="cancelar-cambio"'));
});

test('corregir uno existente se ve distinto de cargarlo por primera vez', () => {
  const estado = conColones(2, 630);
  const html = dibujarPedido({ estado, faltaCambio: { moneda: 'CRC', mes: MES }, borradorCambio: '500' });

  assert.ok(html.includes('Corregir el tipo de cambio'));
  assert.ok(html.includes('1 EUR = 630,00 CRC'), 'tiene que decir cómo está ahora');
  assert.ok(html.includes('Aplicar la corrección'));
  // Y el aviso de RN-05: cuántos movimientos cambian.
  assert.ok(html.includes('2 movimientos'));
});

test('sin nada que pedir, el pedido no se dibuja', () => {
  assert.equal(dibujarPedido({ estado: estadoLimpio() }), '');
});

test('el gasto que quedó esperando se muestra mientras se pide el dato', () => {
  // El usuario no pidió esta pantalla: lo interrumpimos nosotros, así que tiene
  // que entender de un vistazo por qué.
  const html = dibujarMovimientoEnEspera(estadoLimpio(), borradorDe());
  assert.ok(html.includes('Esperando para guardar'));
  assert.ok(html.includes(`10.000,00${DURO}CRC`));
  assert.ok(html.includes('Viajes'));
});

test('sin monto escrito no se muestra nada esperando', () => {
  assert.equal(dibujarMovimientoEnEspera(estadoLimpio(), borradorDe({ monto: '' })), '');
  assert.equal(dibujarMovimientoEnEspera(estadoLimpio(), null), '');
});

test('la lista de tipos de cambio dice cuántos movimientos usa cada uno', () => {
  // Es lo que convierte "corregir un número" en "cambiar el total de dos
  // gastos", que es lo que en realidad está pasando.
  const estado = conColones(2);
  const html = dibujarCambios({ estado });

  assert.ok(html.includes('marzo de 2026'));
  assert.ok(html.includes('1 EUR = 630,00 CRC'));
  assert.ok(html.includes('2 movimientos lo usan'));
  assert.ok(html.includes('data-accion="corregir-cambio"'));
});

test('el plural del conteo concuerda', () => {
  assert.ok(dibujarCambios({ estado: conColones(1) }).includes('1 movimiento lo usa'));
  assert.ok(dibujarCambios({ estado: conColones(0) }).includes('sin movimientos todavía'));
});

test('sin tipos de cambio, la pantalla explica que la app los va a pedir sola', () => {
  const html = dibujarCambios({ estado: estadoLimpio() });
  assert.ok(html.includes('Todavía no hay ninguno'));
  assert.ok(html.includes('te lo va a pedir sola'));
});

test('los tipos de cambio se listan del mes más nuevo al más viejo', () => {
  let estado = estadoLimpio();
  for (const mes of ['2026-01', '2026-03', '2026-02']) {
    estado = intentarGuardarCambio(estado, { moneda: 'CRC', mes, unidadesPorEuro: '630' }).estado;
  }
  const html = dibujarCambios({ estado });

  assert.ok(html.indexOf('marzo de 2026') < html.indexOf('febrero de 2026'));
  assert.ok(html.indexOf('febrero de 2026') < html.indexOf('enero de 2026'));
});
