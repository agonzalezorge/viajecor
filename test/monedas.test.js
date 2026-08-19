// T-008 — Tests del catálogo de monedas.
//
// De los decimales de una moneda depende cómo se guarda cada monto en ella
// (ADR-005): equivocarlos desplaza todos los importes por un factor de cien. Y
// borrar una moneda mal deja movimientos que ningún total puede sumar. Los tests
// de acá son casi todos sobre esas dos formas de romper cosas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MONEDA_BASE,
  monedasIniciales,
  crearMoneda,
  buscarMoneda,
  decimalesDe,
  monedasVisibles,
  agregarMoneda,
  cambiarDecimalesDe,
  contarMovimientosDe,
  ocultarMoneda,
  mostrarMoneda,
  borrarMoneda,
} from '../src/core/monedas.js';

import { crearMovimiento } from '../src/core/modelo.js';

const OPCIONES = { decimales: 2, ahora: '2026-03-14T20:11:03.000Z' };

function movimientoEn(moneda, id = 'mov_0000000000000001') {
  return crearMovimiento(
    { fecha: '2026-03-14', tipo: 'G', rubro: 'viajes', monto: '10,00', moneda },
    { ...OPCIONES, id }
  );
}

// ── Las cuatro precargadas (RN-04b) ──────────────────────────────────────────

test('arranca con euro, peso uruguayo, dólar y colón', () => {
  const monedas = monedasIniciales();
  assert.deepEqual(monedas.map((m) => m.codigo), ['EUR', 'UYU', 'USD', 'CRC']);
  for (const moneda of monedas) {
    assert.equal(moneda.decimales, 2);
    assert.equal(moneda.oculta, false);
    assert.ok(moneda.nombre.length > 0);
  }
});

test('cada llamada devuelve copias nuevas, no los mismos objetos', () => {
  // Si devolviera siempre los mismos, ocultar una moneda en un juego de datos la
  // ocultaría también en el siguiente.
  const unas = monedasIniciales();
  const otras = monedasIniciales();
  assert.notEqual(unas[0], otras[0]);
  assert.deepEqual(unas[0], otras[0]);

  ocultarMoneda(unas, 'UYU');
  assert.equal(monedasIniciales()[1].oculta, false);
});

// ── Agregar (CU-15) ──────────────────────────────────────────────────────────

test('se agrega una moneda nueva desde la app', () => {
  const monedas = agregarMoneda(monedasIniciales(), {
    codigo: 'jpy',
    nombre: '  Yen   japonés ',
    decimales: 0,
  });

  assert.equal(monedas.length, 5);
  const yen = buscarMoneda(monedas, 'JPY');
  assert.equal(yen.codigo, 'JPY');
  assert.equal(yen.nombre, 'Yen japonés');
  assert.equal(yen.decimales, 0);
  assert.equal(yen.oculta, false);
});

test('una moneda de 0 decimales guarda el monto tal cual', () => {
  // El yen no usa decimales: 1500 yenes son 1500, no 15,00.
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 0 });
  const decimales = decimalesDe(monedas, 'JPY');
  const mov = crearMovimiento(
    { fecha: '2026-03-14', tipo: 'G', rubro: 'comida hecha', monto: '1500', moneda: 'JPY' },
    { decimales, id: 'mov_0000000000000009', ahora: OPCIONES.ahora }
  );
  assert.equal(mov.monto, 1500);
});

test('un código repetido se rechaza, aunque venga en otra caja', () => {
  // Admitir "crc" y "CRC" a la vez partiría los totales de Costa Rica en dos
  // mitades que nunca se suman (L-002).
  const monedas = monedasIniciales();
  for (const repetido of ['CRC', 'crc', ' Crc ']) {
    assert.throws(() => agregarMoneda(monedas, { codigo: repetido, nombre: 'Otro colón' }), /Ya tenés una moneda/);
  }
});

test('agregar no modifica la lista que recibe', () => {
  const monedas = monedasIniciales();
  agregarMoneda(monedas, { codigo: 'JPY', nombre: 'Yen', decimales: 0 });
  assert.equal(monedas.length, 4);
});

test('una moneda sin nombre o con código mal escrito se rechaza', () => {
  const monedas = monedasIniciales();
  assert.throws(() => agregarMoneda(monedas, { codigo: 'JPY', nombre: '' }), /Falta el nombre/);
  assert.throws(() => agregarMoneda(monedas, { codigo: 'JPY', nombre: '   ' }), /Falta el nombre/);
  assert.throws(() => agregarMoneda(monedas, { codigo: 'YENES', nombre: 'Yen' }), /tres letras/);
  assert.throws(() => agregarMoneda(monedas, { codigo: 'JP1', nombre: 'Yen' }), /tres letras/);
});

test('unos decimales imposibles se rechazan', () => {
  const monedas = monedasIniciales();
  for (const malos of [-1, 2.5, 9, '2', null]) {
    assert.throws(() => agregarMoneda(monedas, { codigo: 'JPY', nombre: 'Yen', decimales: malos }), /decimales/);
  }
});

test('los decimales por omisión son 2, como propone la app', () => {
  assert.equal(crearMoneda({ codigo: 'ARS', nombre: 'Peso argentino' }).decimales, 2);
});

// ── El euro es distinto (RN-04) ──────────────────────────────────────────────

test('el euro no se puede borrar', () => {
  assert.throws(() => borrarMoneda(monedasIniciales(), MONEDA_BASE, []), /no se puede borrar/);
});

test('al euro no se le pueden cambiar los decimales', () => {
  // Todos los totales de la app se expresan en euros: cambiarle los decimales
  // reinterpretaría cada número de cada pantalla.
  assert.throws(() => cambiarDecimalesDe(monedasIniciales(), 'EUR', 0), /moneda base/);
  assert.throws(() => cambiarDecimalesDe(monedasIniciales(), 'eur', 3), /moneda base/);
});

test('el euro tampoco se puede ocultar', () => {
  assert.throws(() => ocultarMoneda(monedasIniciales(), 'EUR'), /no se puede ocultar/);
});

// ── Borrar vs. ocultar ───────────────────────────────────────────────────────

test('una moneda con movimientos NO se borra, y el mensaje ofrece la salida', () => {
  const movimientos = [movimientoEn('CRC', 'mov_0000000000000001'), movimientoEn('CRC', 'mov_0000000000000002')];

  assert.throws(() => borrarMoneda(monedasIniciales(), 'CRC', movimientos), (error) => {
    // Dice cuántos son, para que se entienda qué está en juego...
    assert.match(error.message, /2 movimientos cargados/);
    // ...y dice qué hacer en su lugar, que es lo que el usuario necesita.
    assert.match(error.message, /Ocultala en vez de borrarla/);
    return true;
  });
});

test('una moneda sin movimientos sí se borra', () => {
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 0 });
  const despues = borrarMoneda(monedas, 'JPY', [movimientoEn('EUR')]);

  assert.equal(buscarMoneda(despues, 'JPY'), null);
  assert.equal(despues.length, 4);
  assert.equal(monedas.length, 5, 'no se modificó la lista original');
});

test('el conteo de movimientos no distingue mayúsculas', () => {
  const movimientos = [movimientoEn('crc', 'mov_0000000000000001'), movimientoEn('CRC', 'mov_0000000000000002')];
  assert.equal(contarMovimientosDe(movimientos, 'CRC'), 2);
  assert.equal(contarMovimientosDe(movimientos, ' crc '), 2);
  assert.equal(contarMovimientosDe(movimientos, 'USD'), 0);
});

test('ocultar deja la moneda afuera del formulario pero no borra nada', () => {
  const movimientos = [movimientoEn('CRC')];
  const monedas = ocultarMoneda(monedasIniciales(), 'CRC');

  assert.equal(buscarMoneda(monedas, 'CRC').oculta, true);
  assert.equal(monedas.length, 4, 'sigue en la lista');
  assert.deepEqual(monedasVisibles(monedas).map((m) => m.codigo), ['EUR', 'UYU', 'USD']);
  // Y lo importante: sus movimientos siguen sabiendo cuántos decimales usan.
  assert.equal(decimalesDe(monedas, 'CRC'), 2);
  assert.equal(contarMovimientosDe(movimientos, 'CRC'), 1);
});

test('una moneda oculta se puede volver a mostrar', () => {
  const monedas = mostrarMoneda(ocultarMoneda(monedasIniciales(), 'USD'), 'usd');
  assert.equal(buscarMoneda(monedas, 'USD').oculta, false);
  assert.equal(monedasVisibles(monedas).length, 4);
});

// ── Decimales: el número del que depende todo ────────────────────────────────

test('preguntar los decimales de una moneda que no está TIRA, no supone 2', () => {
  // Suponer sería cómodo y costaría un factor de cien en todos los importes de
  // esa moneda. Un error se ve enseguida; una suposición aparece meses después.
  assert.throws(() => decimalesDe(monedasIniciales(), 'JPY'), (error) => {
    assert.match(error.message, /no está en tu lista/);
    assert.match(error.message, /Agregala/);
    return true;
  });
});

test('cambiar los decimales reinterpreta los montos, no los reescribe', () => {
  // Es lo que dice PRODUCTO (CU-15): un monto guardado como 1500 son 15,00 con
  // dos decimales y 1500 con cero. La app tiene que avisar cuántos movimientos
  // cambian de significado ANTES de aplicarlo, y para eso está contarMovimientosDe.
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 2 });
  const movimientos = [movimientoEn('JPY')];

  assert.equal(contarMovimientosDe(movimientos, 'JPY'), 1);

  const despues = cambiarDecimalesDe(monedas, 'JPY', 0);
  assert.equal(decimalesDe(despues, 'JPY'), 0);
  // El movimiento no se tocó: el mismo entero, leído de otra forma.
  assert.equal(movimientos[0].monto, 1000);
});

test('cambiar decimales no modifica la lista que recibe', () => {
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 2 });
  cambiarDecimalesDe(monedas, 'JPY', 0);
  assert.equal(decimalesDe(monedas, 'JPY'), 2);
});

// ── Buscar ───────────────────────────────────────────────────────────────────

test('buscar no distingue mayúsculas ni espacios (RN-03)', () => {
  const monedas = monedasIniciales();
  for (const escritura of ['UYU', 'uyu', ' Uyu ']) {
    assert.equal(buscarMoneda(monedas, escritura).codigo, 'UYU');
  }
  assert.equal(buscarMoneda(monedas, 'JPY'), null);
  assert.equal(buscarMoneda(monedas, ''), null);
  assert.equal(buscarMoneda(monedas, null), null);
});

test('operar sobre una moneda que no está da un mensaje claro', () => {
  const monedas = monedasIniciales();
  for (const operacion of [ocultarMoneda, mostrarMoneda]) {
    assert.throws(() => operacion(monedas, 'JPY'), /No hay ninguna moneda/);
  }
  assert.throws(() => borrarMoneda(monedas, 'JPY', []), /No hay ninguna moneda/);
  assert.throws(() => cambiarDecimalesDe(monedas, 'JPY', 0), /No hay ninguna moneda/);
});

test('un catálogo que no es una lista se rechaza', () => {
  for (const malo of [null, undefined, 'EUR', 42, { EUR: 2 }]) {
    assert.throws(() => monedasVisibles(malo), /tiene que ser una lista/);
  }
});

// ── Cómo se enchufa con el resto ─────────────────────────────────────────────

test('el catálogo es lo que le dice al modelo cuántos decimales usar', () => {
  // Este es el recorrido real de la app al cargar un gasto en el exterior.
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen japonés', decimales: 0 });

  const enEuros = crearMovimiento(
    { fecha: '2026-03-14', tipo: 'G', rubro: 'supermercado', monto: '12,50', moneda: 'EUR' },
    { decimales: decimalesDe(monedas, 'EUR'), id: 'mov_0000000000000001', ahora: OPCIONES.ahora }
  );
  const enYenes = crearMovimiento(
    { fecha: '2026-03-14', tipo: 'G', rubro: 'supermercado', monto: '1250', moneda: 'JPY' },
    { decimales: decimalesDe(monedas, 'JPY'), id: 'mov_0000000000000002', ahora: OPCIONES.ahora }
  );

  // El mismo entero guardado, dos significados: 12,50 € y 1250 ¥.
  assert.equal(enEuros.monto, 1250);
  assert.equal(enYenes.monto, 1250);
});
