// T-054 — Tests del período de la evolución (CU-10).
//
// ── Lo que hay que sostener acá ──────────────────────────────────────────────
//
// La pantalla muestra seis cosas que salen de la misma lista de movimientos. Si
// el período se aplicara cuenta por cuenta, alcanzaría con que una se quedara
// atrás para tener una tabla de tres meses al lado de una torta de once — dos
// números correctos que no hablan del mismo tiempo, y nada que lo delate.
//
// Por eso se recorta el historial una sola vez, y por eso los tests de abajo
// comprueban que TODAS las partes se movieron juntas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mesesElegibles,
  normalizarPeriodo,
  mesEnPeriodo,
  estadoDelPeriodo,
  movimientosFuera,
} from '../src/core/periodo.js';
import { dibujarEvolucion, dibujarPeriodo } from '../src/ui/pantallas/evolucion.js';
import { matrizMesRubro } from '../src/core/calculos.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

let contador = 0;
const mov = ({ monto, rubro = 'viajes', fecha, tipo = TIPO_GASTO }) => {
  contador += 1;
  return crearMovimiento({ monto, rubro, fecha, tipo, moneda: 'EUR', comentario: '' },
    { decimales: 2, id: `mov_${String(contador).padStart(6, '0')}`, creado: fecha });
};

const CUATRO_MESES = {
  ...estadoInicial({ monedas: monedasIniciales() }),
  tipos_cambio: [],
  movimientos: [
    mov({ monto: '100', fecha: '2026-01-10' }),
    mov({ monto: '200', fecha: '2026-02-10' }),
    mov({ monto: '400', fecha: '2026-03-10' }),
    mov({ monto: '800', fecha: '2026-04-10' }),
    mov({ monto: '900', fecha: '2026-03-01', rubro: 'trabajo', tipo: TIPO_INGRESO }),
  ],
};


// ── El recorte ───────────────────────────────────────────────────────────────

test('sin período elegido no se recorta nada, y es el mismo objeto', () => {
  // Que sea el MISMO objeto importa: el camino de siempre —que es el de todos
  // los días— no paga ni una copia por una función que no está usando.
  assert.equal(estadoDelPeriodo(CUATRO_MESES, null), CUATRO_MESES);
  assert.equal(estadoDelPeriodo(CUATRO_MESES, {}), CUATRO_MESES);
  assert.equal(estadoDelPeriodo(CUATRO_MESES, { desde: 'marzo', hasta: '' }), CUATRO_MESES);
});

test('el recorte deja los movimientos del rango, incluidas las dos puntas', () => {
  const recortado = estadoDelPeriodo(CUATRO_MESES, { desde: '2026-02', hasta: '2026-03' });
  assert.deepEqual(recortado.movimientos.map((m) => m.fecha).sort(),
    ['2026-02-10', '2026-03-01', '2026-03-10']);
});

test('una punta sola deja el rango abierto del otro lado', () => {
  // "Desde marzo" es una pregunta razonable y no hay por qué obligar a contestar
  // las dos puntas para hacerla.
  assert.equal(estadoDelPeriodo(CUATRO_MESES, { desde: '2026-03' }).movimientos.length, 3);
  assert.equal(estadoDelPeriodo(CUATRO_MESES, { hasta: '2026-02' }).movimientos.length, 2);
});

test('un período al revés se da vuelta en vez de rechazarse', () => {
  // Es evidente qué quiso decir quien lo eligió. Una tabla vacía con un cartel
  // de error no le sirve a nadie.
  assert.deepEqual(normalizarPeriodo({ desde: '2026-04', hasta: '2026-01' }),
    { desde: '2026-01', hasta: '2026-04' });
  assert.equal(estadoDelPeriodo(CUATRO_MESES, { desde: '2026-04', hasta: '2026-01' }).movimientos.length, 5);
});

test('un mes escrito de cualquier otra forma se ignora, no rompe', () => {
  for (const malo of ['2026-13', '26-01', '2026-1', 'enero', '', null, 42, {}]) {
    assert.equal(normalizarPeriodo({ desde: malo, hasta: malo }), null, String(malo));
  }
});

test('el recorte NO toca el catálogo', () => {
  // Los tipos de cambio, las monedas y los rubros son con lo que se leen los
  // movimientos, no movimientos: sacarlos dejaría gastos sin poder convertirse.
  const conCambios = { ...CUATRO_MESES, tipos_cambio: [{ moneda: 'USD', mes: '2026-01', euros_por_unidad: 0.92 }] };
  const recortado = estadoDelPeriodo(conCambios, { desde: '2026-04', hasta: '2026-04' });

  assert.deepEqual(recortado.tipos_cambio, conCambios.tipos_cambio);
  assert.deepEqual(recortado.monedas, conCambios.monedas);
  assert.deepEqual(recortado.rubros, conCambios.rubros);
});

test('mesEnPeriodo contesta por las dos puntas', () => {
  const p = { desde: '2026-02', hasta: '2026-03' };
  assert.equal(mesEnPeriodo('2026-01', p), false);
  assert.equal(mesEnPeriodo('2026-02', p), true);
  assert.equal(mesEnPeriodo('2026-03', p), true);
  assert.equal(mesEnPeriodo('2026-04', p), false);
  assert.equal(mesEnPeriodo('2026-04', null), true);
});

test('se dice cuántos movimientos quedaron afuera', () => {
  assert.equal(movimientosFuera(CUATRO_MESES, { desde: '2026-03', hasta: '2026-03' }), 3);
  assert.equal(movimientosFuera(CUATRO_MESES, null), 0);
});

test('los meses elegibles son los que tienen movimientos, del más viejo al más nuevo', () => {
  assert.deepEqual(mesesElegibles(CUATRO_MESES), ['2026-01', '2026-02', '2026-03', '2026-04']);
  assert.deepEqual(mesesElegibles({}), []);
});


// ── Que TODA la pantalla se mueva junta ──────────────────────────────────────

test('la tabla, el total y el promedio se recalculan sobre el período', () => {
  const recortado = estadoDelPeriodo(CUATRO_MESES, { desde: '2026-02', hasta: '2026-03' });
  const matriz = matrizMesRubro(recortado, '2026-05');

  assert.deepEqual(matriz.filas.map((f) => f.mes), ['2026-02', '2026-03']);
  assert.equal(matriz.total.gastos, 60000, '200 + 400, no los 1.500 de todo');
  assert.equal(matriz.promedio.gastos, 30000, 'sobre dos meses, no sobre cuatro');
});

test('el reparto por rubro también se recorta', () => {
  const conPeriodo = dibujarEvolucion(
    { estado: CUATRO_MESES, periodo: { desde: '2026-01', hasta: '2026-02' } }, '2026-05',
  ).replace(/\s+/g, ' ');

  assert.match(conPeriodo, /Los 2 meses de la tabla, sumados: 300,00 €/);
  // Y el ingreso de marzo quedó afuera, así que no hay torta de ingresos.
  assert.equal(conPeriodo.includes('De dónde vino'), false);
});

test('los gráficos se dibujan con los meses del período', () => {
  const html = dibujarEvolucion(
    { estado: CUATRO_MESES, periodo: { desde: '2026-03', hasta: '2026-04' } }, '2026-05',
  );

  assert.equal(html.includes('ene 26'), false, 'enero quedó afuera de todo');
  assert.equal(html.includes('feb 26'), false);
  assert.ok(html.includes('mar 26'));
  assert.ok(html.includes('abr 26'));
});

test('sin período, la pantalla es exactamente la de siempre', () => {
  // La otra mitad del pedido: lo predeterminado no cambia. Lo único que se
  // agrega es el selector.
  const sinNada = dibujarEvolucion({ estado: CUATRO_MESES }, '2026-05');
  const conNull = dibujarEvolucion({ estado: CUATRO_MESES, periodo: null }, '2026-05');

  assert.equal(sinNada, conNull);
  for (const mes of ['ene 26', 'feb 26', 'mar 26', 'abr 26']) assert.ok(sinNada.includes(mes), mes);
});


// ── El selector ──────────────────────────────────────────────────────────────

test('el selector ofrece solo los meses que tienen movimientos', () => {
  // Dejar elegir agosto de 2019 solo sirve para conseguir una pantalla vacía
  // que no explica por qué está vacía.
  const html = dibujarPeriodo({ estado: CUATRO_MESES });

  assert.equal((html.match(/<option /g) ?? []).length, 8, 'los cuatro meses, en las dos listas');
  assert.ok(html.includes('>enero de 2026<'));
  assert.ok(html.includes('>abril de 2026<'));
  assert.equal(html.includes('2025'), false);
});

test('sin período, el selector dice que estás viendo todo', () => {
  const html = dibujarPeriodo({ estado: CUATRO_MESES }).replace(/\s+/g, ' ');

  assert.match(html, /Estás viendo <strong>todo tu historial<\/strong>: los 4 meses/);
  assert.equal(html.includes('periodo-todo'), false, 'no hay nada que deshacer');
});

test('con período, el selector lo dice y ofrece volver a todo', () => {
  const html = dibujarPeriodo({ estado: CUATRO_MESES, periodo: { desde: '2026-02', hasta: '2026-03' } })
    .replace(/\s+/g, ' ');

  assert.match(html, /<strong>solo sobre febrero de 2026 a marzo de 2026<\/strong>/);
  assert.match(html, /Quedan 2 movimientos afuera/, 'enero y abril; el ingreso del 1 de marzo está adentro');
  assert.match(html, /data-accion="periodo-todo"/);
});

test('las dos puntas quedan puestas en los extremos cuando no hay período', () => {
  // Los selectores tienen que mostrar el rango que se está viendo, que sin
  // recorte es el historial entero. Vacíos no dirían nada.
  const html = dibujarPeriodo({ estado: CUATRO_MESES });
  const desde = html.slice(html.indexOf('periodo-desde'), html.indexOf('periodo-hasta'));

  assert.match(desde, /value="2026-01" selected/);
  assert.match(html.slice(html.indexOf('periodo-hasta')), /value="2026-04" selected/);
});

test('con un solo mes de historial no hay selector: no hay nada que recortar', () => {
  const unMes = { ...CUATRO_MESES, movimientos: [mov({ monto: '10', fecha: '2026-01-05' })] };
  assert.equal(dibujarPeriodo({ estado: unMes }), '');
  assert.equal(dibujarPeriodo({ estado: { movimientos: [] } }), '');
});

test('los gastos fijos también se recortan', () => {
  // Es la tarjeta más fácil de olvidar: se dibuja desde el estado y no desde la
  // matriz, así que una versión anterior de este cambio la habría dejado
  // promediando doce meses debajo de una tabla de dos.
  const conLuz = {
    ...CUATRO_MESES,
    movimientos: [
      { ...mov({ monto: '50', fecha: '2026-01-05', rubro: 'gastos fijos' }), comentario: 'Luz' },
      { ...mov({ monto: '50', fecha: '2026-02-05', rubro: 'gastos fijos' }), comentario: 'Luz' },
      { ...mov({ monto: '90', fecha: '2026-03-05', rubro: 'gastos fijos' }), comentario: 'Luz' },
      { ...mov({ monto: '90', fecha: '2026-04-05', rubro: 'gastos fijos' }), comentario: 'Luz' },
    ],
  };

  const todo = dibujarEvolucion({ estado: conLuz }, '2026-05').replace(/\s+/g, ' ');
  const soloElPrimerTrimestre = dibujarEvolucion(
    { estado: conLuz, periodo: { desde: '2026-01', hasta: '2026-02' } }, '2026-05',
  ).replace(/\s+/g, ' ');

  assert.match(todo, /280,00 € en total/, 'los cuatro pagos');
  assert.match(soloElPrimerTrimestre, /100,00 € en total/, 'solo los dos del período');
});
