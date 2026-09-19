// T-060 — Varias etiquetas por movimiento, y grupos que no son solo de gastos.
//
// ── Lo que el usuario pidió, y por qué ──────────────────────────────────────
//
// Un viaje de trabajo lleva la etiqueta del viaje **y** la del trabajo. Hasta
// ahora había que elegir una y perder la otra pregunta. Y los grupos eran solo
// de gastos: una etiqueta que junta ingresos —un trabajo suelto, unos
// reintegros— no aparecía en ninguna pantalla.
//
// ── Lo que hay que sostener acá ─────────────────────────────────────────────
//
// Que el dato guardado **no cambió**: sigue siendo el mismo texto en el mismo
// campo, y un movimiento viejo tiene exactamente una etiqueta. Eso es lo que
// hace que los respaldos de antes se sigan leyendo y que el Excel siga sirviendo
// en los dos sentidos, sin migrar nada.
//
// Y que un movimiento con dos etiquetas **entra en los dos grupos**, con la
// consecuencia que eso trae: los totales de los grupos ya no suman el total del
// mes. Sumarían de más, y la pantalla lo dice.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { etiquetasDe, clavesDeEtiquetas, tieneEtiqueta, crearMovimiento, TIPO_GASTO, TIPO_INGRESO }
  from '../src/core/modelo.js';
import { otrosGrupos } from '../src/core/agrupamientos.js';
import { viajes } from '../src/core/viajes.js';
import { movimientosFiltrados, comentariosUsados, etiquetaEnCurso, conEtiquetaElegida, gastosFijos }
  from '../src/core/calculos.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

let n = 0;
const mov = (monto, rubro, comentario, tipo = TIPO_GASTO, fecha = '2026-09-10') => {
  n += 1;
  return crearMovimiento({ monto, moneda: 'EUR', fecha, tipo, rubro, comentario },
    { decimales: 2, id: `m${String(n).padStart(4, '0')}`, creado: fecha });
};
const estadoCon = (movimientos) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), tipos_cambio: [], movimientos });


// ── Cómo se leen ─────────────────────────────────────────────────────────────

test('una etiqueta sola sigue siendo una etiqueta sola', () => {
  // Es la mitad que no puede romperse: todos los datos que ya existen son así.
  assert.deepEqual(etiquetasDe('Roma'), ['Roma']);
  assert.deepEqual(etiquetasDe(''), []);
  assert.deepEqual(etiquetasDe('   '), []);
});

test('la coma separa, y los espacios de los bordes no cuentan', () => {
  assert.deepEqual(etiquetasDe('Roma, Trabajo'), ['Roma', 'Trabajo']);
  assert.deepEqual(etiquetasDe(' Roma ,  Trabajo '), ['Roma', 'Trabajo']);
  assert.deepEqual(etiquetasDe('Roma,,Trabajo,'), ['Roma', 'Trabajo'], 'comas de más y al final');
});

test('la misma etiqueta escrita dos veces cuenta una', () => {
  // Si contara dos, su total se duplicaría en su propio grupo — y el error sería
  // invisible: un número más grande, sin ningún aviso.
  assert.deepEqual(etiquetasDe('Roma, roma'), ['Roma']);
  assert.deepEqual(clavesDeEtiquetas('Roma, ROMA, Roma'), ['roma']);
});

test('tieneEtiqueta compara por clave, no por texto', () => {
  const m = mov('100', 'viajes', 'Roma, Trabajo');
  assert.equal(tieneEtiqueta(m, 'roma'), true);
  assert.equal(tieneEtiqueta(m, 'TRABAJO'), true);
  assert.equal(tieneEtiqueta(m, 'Roma, Trabajo'), false, 'el texto entero ya no es una etiqueta');
  assert.equal(tieneEtiqueta(m, 'Mudanza'), false);
});

test('el dato guardado no cambió: un respaldo viejo se lee igual', () => {
  // Es la razón por la que esto se hizo así y no con una lista en el modelo.
  const viejo = { esquema: 1, movimientos: [{ ...mov('100', 'viajes', 'Roma') }] };
  const leido = migrarEstado(JSON.parse(JSON.stringify(viejo)));

  assert.equal(leido.movimientos.length, 1);
  assert.equal(leido.movimientos[0].comentario, 'Roma');
  assert.deepEqual(etiquetasDe(leido.movimientos[0].comentario), ['Roma']);
});


// ── Un movimiento entra en todos sus grupos ─────────────────────────────────

const VIAJE_DE_TRABAJO = () => estadoCon([
  mov('800', 'viajes', 'Roma, Trabajo'),
  mov('200', 'comida hecha', 'Roma, Trabajo'),
  mov('600', 'trabajo', 'Roma, Trabajo', TIPO_INGRESO),
]);

test('un gasto con dos etiquetas suma en los dos viajes', () => {
  const lista = viajes(VIAJE_DE_TRABAJO());

  assert.deepEqual(lista.map((v) => v.comentario).sort(), ['Roma', 'Trabajo']);
  for (const v of lista) assert.equal(v.total, 100000, `${v.comentario}: 800 + 200`);
});

test('y tocar uno de esos grupos trae el movimiento', () => {
  // Sin esto, el total diría 1.000 € y la lista al tocarlo estaría vacía: el
  // peor final posible, porque el número queda sin nada que lo respalde.
  const estado = VIAJE_DE_TRABAJO();
  const deRoma = movimientosFiltrados(estado, '2026-09', { comentario: 'Roma' });
  const deTrabajo = movimientosFiltrados(estado, '2026-09', { comentario: 'Trabajo' });

  assert.equal(deRoma.length, 3);
  assert.equal(deTrabajo.length, 3);
});

test('los gastos fijos con dos etiquetas también cuentan en las dos', () => {
  const estado = estadoCon([mov('50', 'gastos fijos', 'Luz, Casa')]);
  const { grupos } = gastosFijos(estado);

  assert.deepEqual(grupos.map((g) => g.comentario).sort(), ['Casa', 'Luz']);
  for (const g of grupos) assert.equal(g.total, 5000);
});


// ── Los viajes y grupos mixtos ──────────────────────────────────────────────

test('un viaje con ingresos muestra los dos lados y su saldo', () => {
  // El caso que el usuario nombró: el viaje de trabajo, donde lo que importa es
  // si terminaste poniendo plata o no.
  const roma = viajes(VIAJE_DE_TRABAJO()).find((v) => v.clave === 'roma');

  assert.equal(roma.total, 100000, 'los gastos siguen siendo los gastos');
  assert.equal(roma.ingresos, 60000);
  assert.equal(roma.saldo, -40000, 'puso 400 € de su bolsillo');
  assert.equal(roma.mixto, true);
});

test('un viaje sin ingresos no inventa un saldo', () => {
  // Sería el total en negativo: un número repetido que no agrega nada.
  const soloGastos = viajes(estadoCon([mov('300', 'viajes', 'Colonia')]))[0];

  assert.equal(soloGastos.mixto, false);
  assert.equal(soloGastos.ingresos, 0);
});

test('un ingreso con la etiqueta de un viaje NO baja su gasto', () => {
  // La regla vieja, que sigue valiendo: el total de gastos es el total de
  // gastos. Lo que se agrega es el otro número al lado, no una resta.
  const roma = viajes(VIAJE_DE_TRABAJO()).find((v) => v.clave === 'roma');
  assert.equal(roma.total, 100000);
});


// ── Grupos de ingresos, con su media mensual ────────────────────────────────

test('una etiqueta que solo junta ingresos ahora tiene su grupo', () => {
  const estado = estadoCon([
    mov('3000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-07-05'),
    mov('2000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-05'),
    mov('1000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-20'),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'clases');

  assert.equal(grupo.clase, 'ingreso');
  assert.equal(grupo.ingresos, 600000);
  assert.equal(grupo.total, 0, 'no gastó nada');
});

test('la media de un grupo de ingresos es MENSUAL, no por movimiento', () => {
  // 6.000 € en dos meses son 3.000 por mes. Por movimiento darían 2.000, que no
  // contesta la pregunta: lo que se quiere saber es cuánto entra por mes.
  const estado = estadoCon([
    mov('3000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-07-05'),
    mov('2000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-05'),
    mov('1000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-20'),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'clases');

  assert.equal(grupo.meses, 2);
  assert.equal(grupo.mediaMensual, 300000, '6.000 en 2 meses');
});

test('un grupo con gastos e ingresos es mixto y trae su saldo', () => {
  const estado = estadoCon([
    mov('500', 'otros', 'Mudanza'),
    mov('200', 'regalos', 'Mudanza', TIPO_INGRESO),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'mudanza');

  assert.equal(grupo.clase, 'mixto');
  assert.equal(grupo.total, 50000);
  assert.equal(grupo.ingresos, 20000);
  assert.equal(grupo.saldo, -30000);
});

test('un grupo de solo gastos sigue siendo lo que era', () => {
  const grupo = otrosGrupos(estadoCon([mov('150', 'otros', 'Mudanza')]))[0];

  assert.equal(grupo.clase, 'gasto');
  assert.equal(grupo.total, 15000);
  assert.equal(grupo.ingresos, 0);
});

test('un viaje no aparece además en los otros grupos', () => {
  // La cascada de ADR-036 sigue mandando: cada etiqueta tiene UN grupo propio en
  // UNA pantalla. Si no, el viaje de trabajo saldría dos veces.
  const claves = otrosGrupos(VIAJE_DE_TRABAJO()).map((g) => g.clave);
  assert.equal(claves.includes('roma'), false);
  assert.equal(claves.includes('trabajo'), false);
});


// ── El autocompletado con comas ─────────────────────────────────────────────

test('las sugerencias son etiquetas sueltas, no comentarios enteros', () => {
  // Sugerir "Roma, Trabajo" pondría las dos etiquetas de golpe, que casi nunca
  // es lo que se quiere.
  const usados = comentariosUsados(VIAJE_DE_TRABAJO().movimientos);

  assert.deepEqual([...usados].sort(), ['Roma', 'Trabajo']);
});

test('lo que se autocompleta es lo que hay después de la última coma', () => {
  assert.equal(etiquetaEnCurso('Trab'), 'Trab');
  assert.equal(etiquetaEnCurso('Roma, Trab').trim(), 'Trab');
  assert.equal(etiquetaEnCurso('Roma,'), '');
});

test('elegir una sugerencia no borra las etiquetas ya escritas', () => {
  assert.equal(conEtiquetaElegida('Roma, Trab', 'Trabajo'), 'Roma, Trabajo');
  assert.equal(conEtiquetaElegida('Trab', 'Trabajo'), 'Trabajo');
  assert.equal(conEtiquetaElegida('Roma,', 'Trabajo'), 'Roma, Trabajo');
});
