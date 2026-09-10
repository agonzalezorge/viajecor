// T-059 — Que la app entera funcione con una base que no es el euro.
//
// ── Por qué este archivo existe ──────────────────────────────────────────────
//
// La madre del usuario puso el peso uruguayo como base y **no pudo cargar un
// solo gasto**: la app le pedía "la cotización del peso contra el peso", y al
// darle 1 le contestaba que el peso no lleva cotización porque es la base.
//
// La causa: `faltaCambioPara(movimiento, cambios, base)` tenía `base = 'EUR'` por
// defecto, y la pantalla de carga no se la pasaba. Había **nueve** lugares así.
// Ninguno fallaba: convertían contra el euro en silencio.
//
// Los tests de T-050 probaban la conversión con base en pesos —y pasaban—, pero
// ninguno recorría **lo que hace el usuario**: cargar, buscar, exportar, mirar un
// viaje. Este archivo prueba eso, con la base en pesos, para cada camino que
// tocaba una de esas nueve llamadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { intentarGuardar, borradorNuevo } from '../src/ui/pantallas/movimiento.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { crearCambio } from '../src/core/cambio.js';
import { cambiarMonedaBase } from '../src/core/base.js';
import { totalesDelMes } from '../src/core/calculos.js';
import { textoDeMovimiento } from '../src/core/busqueda.js';
import { viajes as gastosPorViaje } from '../src/core/viajes.js';
import { otrosGrupos } from '../src/core/agrupamientos.js';
import { filasDelCsv } from '../src/datos/csv.js';
import { dibujarLista } from '../src/ui/pantallas/lista.js';
import { hojaDeMovimientos } from '../src/datos/xlsx.js';

/** Un estado con la base en pesos, como el de la madre del usuario. */
function enPesos(extra = {}) {
  return {
    ...estadoInicial({ monedas: monedasIniciales() }),
    tipos_cambio: [],
    movimientos: [],
    ...extra,
    preferencias: { ...extra.preferencias, moneda_base: 'UYU' },
  };
}

let n = 0;
const gasto = (monto, moneda = 'UYU', comentario = '', tipo = TIPO_GASTO) => {
  n += 1;
  return crearMovimiento(
    { monto, moneda, fecha: '2026-09-10', tipo, rubro: tipo === TIPO_GASTO ? 'supermercado' : 'trabajo', comentario },
    { decimales: 2, id: `mov_${n}`, creado: '2026-09-10' },
  );
};


// ── Lo que le pasó a ella ────────────────────────────────────────────────────

test('con la base en pesos, un gasto en pesos se guarda sin pedir ninguna cotización', () => {
  const estado = enPesos();
  const borrador = { ...borradorNuevo({ estado }), monto: '1500', moneda: 'UYU', rubro: 'supermercado' };

  const resultado = intentarGuardar(estado, borrador);

  assert.equal(resultado.error, undefined, 'no puede pedir la cotización del peso contra el peso');
  assert.equal(resultado.faltaCambio, undefined);
  assert.equal(resultado.estado.movimientos.length, 1);
  assert.equal(resultado.estado.movimientos[0].monto, 150000);
});

test('y un gasto en EUROS sí la pide, porque con base en pesos el euro es una moneda más', () => {
  // El espejo del anterior: lo que no puede pasar es que deje de pedir lo que
  // hace falta. Sin tipo de cambio, ese gasto no entraría en ningún total.
  const estado = enPesos();
  const borrador = { ...borradorNuevo({ estado }), monto: '50', moneda: 'EUR', rubro: 'viajes' };

  const resultado = intentarGuardar(estado, borrador);

  assert.deepEqual(resultado.faltaCambio, { moneda: 'EUR', mes: '2026-09' });
  assert.equal(resultado.estado.movimientos.length, 0, 'y no se guarda hasta tenerla');
});

test('con base en euros, todo sigue exactamente igual que siempre', () => {
  // La otra mitad: el arreglo no puede cambiarle nada a quien usa euros.
  const estado = { ...estadoInicial({ monedas: monedasIniciales() }), tipos_cambio: [], movimientos: [] };

  assert.equal(intentarGuardar(estado, {
    ...borradorNuevo({ estado }), monto: '50', moneda: 'EUR', rubro: 'viajes',
  }).error, undefined);

  assert.deepEqual(intentarGuardar(estado, {
    ...borradorNuevo({ estado }), monto: '50', moneda: 'UYU', rubro: 'viajes',
  }).faltaCambio, { moneda: 'UYU', mes: new Date().toISOString().slice(0, 7) });
});

test('al cambiar la base, la moneda que viene puesta al cargar pasa a ser esa', () => {
  // Si no, el formulario sigue ofreciendo euros y hay que corregirlo en cada
  // carga hasta el primer gasto guardado.
  const enEuros = { ...estadoInicial({ monedas: monedasIniciales() }), tipos_cambio: [], movimientos: [] };
  assert.equal(borradorNuevo({ estado: enEuros }).moneda, 'EUR');

  const cambiado = cambiarMonedaBase(enEuros, 'UYU');
  assert.equal(borradorNuevo({ estado: cambiado }).moneda, 'UYU');
});


// ── Los otros ocho lugares, que hacían daño más callado ──────────────────────

test('los totales del mes cuentan los gastos en pesos', () => {
  const estado = enPesos({ movimientos: [gasto('1500'), gasto('40000', 'UYU', '', TIPO_INGRESO)] });
  const totales = totalesDelMes(estado, '2026-09');

  assert.equal(totales.gastos, 150000);
  assert.equal(totales.ingresos, 4000000);
  assert.deepEqual(totales.sinConvertir, [], 'ninguno queda sin convertir');
});

test('el buscador encuentra un gasto en pesos', () => {
  // Antes preguntaba `moneda !== 'EUR'` y daba el gasto por no convertible, así
  // que su importe no entraba en el texto por el que se busca.
  const estado = enPesos();
  const texto = textoDeMovimiento(estado, gasto('1500', 'UYU', 'Feria'));

  assert.match(texto, /1500/);
  assert.match(texto, /feria/);
});

test('el costo de un viaje se calcula en la base elegida', () => {
  // Un viaje se reconoce por el rubro `viajes` en su etiqueta.
  const deViaje = (monto, i) => crearMovimiento(
    { monto, moneda: 'UYU', fecha: '2026-09-10', tipo: TIPO_GASTO, rubro: 'viajes', comentario: 'Colonia' },
    { decimales: 2, id: `viaje_${i}`, creado: '2026-09-10' },
  );
  const estado = enPesos({ movimientos: [deViaje('1500', 1), deViaje('2500', 2)] });
  const lista = gastosPorViaje(estado);

  assert.equal(lista.length, 1, 'el viaje tiene que aparecer');
  assert.equal(lista[0].total, 400000, '1500 + 2500 pesos');
  assert.deepEqual(lista[0].sinConvertir ?? [], [], 'ninguno queda afuera por falta de cotización');
});

test('los otros grupos de gastos suman en la base elegida', () => {
  const estado = enPesos({ movimientos: [gasto('1500', 'UYU', 'Mudanza'), gasto('2500', 'UYU', 'Mudanza')] });
  const grupos = otrosGrupos(estado);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].total, 400000);
});

test('el CSV exporta el importe de los gastos en pesos, no una celda vacía', () => {
  const estado = enPesos({ movimientos: [gasto('1500')] });
  const [fila] = filasDelCsv(estado);

  assert.equal(fila.moneda, 'UYU');
  assert.equal(fila.euros, '1500,00', 'convertido a la base, que es la misma moneda');
  assert.equal(fila.unidades_por_euro, '', 'la base no lleva cotización que decir');
});

test('la planilla no marca los gastos en pesos como "sin tipo de cambio"', () => {
  const estado = enPesos({ movimientos: [gasto('1500'), gasto('2500')] });
  const hoja = hojaDeMovimientos(estado);

  assert.equal(hoja.sinConvertir, 0, 'los dos se pueden convertir: ya están en la base');
});

test('un movimiento que de verdad no se puede convertir se sigue marcando', () => {
  // Con base en pesos y un gasto en euros sin cotización, la planilla tiene que
  // seguir diciendo que ese no entró. El arreglo no puede tapar lo que falta.
  const estado = enPesos({ movimientos: [gasto('1500'), gasto('50', 'EUR')] });

  assert.equal(hojaDeMovimientos(estado).sinConvertir, 1);
  assert.deepEqual(totalesDelMes(estado, '2026-09').sinConvertir.map((m) => m.moneda), ['EUR']);
});

test('con la cotización cargada, el gasto en euros entra en el total en pesos', () => {
  const estado = enPesos({
    movimientos: [gasto('1500'), gasto('50', 'EUR')],
    tipos_cambio: [crearCambio({ moneda: 'EUR', mes: '2026-09', euros_por_unidad: 45 }, { base: 'UYU' })],
  });

  // 50 EUR × 45 pesos = 2.250, más los 1.500 de antes.
  assert.equal(totalesDelMes(estado, '2026-09').gastos, 375000);
});


// ── Los tres que una ronda de mutaciones encontró sin cubrir ─────────────────

test('sin ninguna moneda usada, el formulario ofrece la BASE y no el euro', () => {
  // La prueba de arriba pasa por `cambiarMonedaBase`, que además deja puesta la
  // moneda predeterminada. Este mira el otro camino: un estado que ya viene con
  // la base en pesos y sin ninguna moneda usada todavía —un respaldo importado,
  // por ejemplo—. Ahí el `??` es lo único que decide.
  const estado = enPesos();
  delete estado.preferencias.moneda_predeterminada;

  assert.equal(borradorNuevo({ estado }).moneda, 'UYU');
});

test('el buscador mete en el texto el importe CONVERTIDO a la base', () => {
  // Buscar "2250" tiene que encontrar un gasto de 50 euros cuando el euro vale
  // 45 pesos. Antes ese importe no entraba en el texto: la línea preguntaba
  // `moneda !== 'EUR'` y daba el gasto por no convertible.
  const estado = enPesos({
    tipos_cambio: [crearCambio({ moneda: 'EUR', mes: '2026-09', euros_por_unidad: 45 }, { base: 'UYU' })],
  });
  const texto = textoDeMovimiento(estado, gasto('50', 'EUR', 'Libro'));

  assert.match(texto, /2250/, `el importe en pesos tiene que estar: ${texto}`);
});

test('el total de una lista filtrada suma en la base elegida', () => {
  // Es el número que se repite arriba de la lista para que el usuario vea que
  // cierra con el que acaba de tocar. Contra el euro, ese total daba cualquier
  // cosa o dejaba los movimientos afuera por "falta de cotización".
  const estado = enPesos({ movimientos: [gasto('1500'), gasto('2500')] });
  const html = dibujarLista({ estado, mes: '2026-09', filtro: { tipo: TIPO_GASTO, rubro: 'supermercado' } });

  assert.match(html.replace(/\s+/g, ' '), /2 movimientos · <strong>4000,00 UYU<\/strong>/);
});
