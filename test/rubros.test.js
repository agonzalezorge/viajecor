// T-048 — Tests de los rubros editables (CU-19).
//
// ── Por qué estos tests son de los más importantes del proyecto ──────────────
//
// El rubro está escrito adentro de **cada movimiento**. Cambiar el catálogo sin
// mover los movimientos deja gastos apuntando a un rubro que ya no existe: no
// dan error, **desaparecen de todos los totales por rubro**. Plata que se
// esfuma sin un mensaje, que es la peor forma de fallar de esta app.
//
// Casi todo lo de acá abajo prueba lo mismo desde ángulos distintos: que ningún
// camino deje un movimiento huérfano.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogoDe, usoDeRubros, rubrosHuerfanos, crearRubro, renombrarRubro,
  unirRubros, borrarRubro, TOPE_DE_RUBROS,
} from '../src/core/rubros.js';
import { dibujarRubros, dibujarRubro, dibujarUso, dibujarHuerfanos } from '../src/ui/pantallas/rubros.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO, rubrosDe, rubrosIniciales } from '../src/core/modelo.js';
import { franjaDeRubro } from '../src/core/paleta.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { porRubro } from '../src/core/calculos.js';
import { contenidoDelRespaldo } from '../src/datos/exportar.js';
import { unirCatalogos } from '../src/datos/importar.js';

let contador = 0;
const mov = (rubro, { tipo = TIPO_GASTO, monto = '10', fecha = '2026-08-10', catalogo } = {}) => {
  contador += 1;
  return crearMovimiento({ monto, rubro, fecha, tipo, moneda: 'EUR', comentario: '' },
    { decimales: 2, id: `mov_${contador}`, creado: fecha, catalogo });
};

const estadoCon = (movimientos = [], rubros) => ({
  ...estadoInicial({ monedas: monedasIniciales() }),
  movimientos,
  ...(rubros ? { rubros } : {}),
});


// ── El catálogo ──────────────────────────────────────────────────────────────

test('un estado nuevo arranca con los rubros de siempre', () => {
  assert.deepEqual(catalogoDe(estadoCon()), rubrosIniciales());
});

test('un estado sin catálogo tampoco se queda sin rubros', () => {
  // Es lo que hace que todo el código anterior a T-048 siga funcionando.
  assert.deepEqual(catalogoDe({}).gasto, rubrosIniciales().gasto);
  assert.deepEqual(catalogoDe(undefined).ingreso, rubrosIniciales().ingreso);
});

test('se cuenta cuántos movimientos usa cada rubro', () => {
  // Es lo que deja decir "esto va a mover 43 gastos" ANTES de tocar nada.
  const estado = estadoCon([mov('salud'), mov('salud'), mov('viajes')]);
  const uso = usoDeRubros(estado, TIPO_GASTO);

  assert.equal(uso.get('salud'), 2);
  assert.equal(uso.get('viajes'), 1);
  assert.equal(uso.get('supermercado'), 0);
});

test('los movimientos de ingreso no cuentan para los rubros de gasto', () => {
  // `otros` está en las dos listas y son cosas distintas (RN-02).
  const estado = estadoCon([
    mov('otros'),
    mov('otros', { tipo: TIPO_INGRESO }),
    mov('otros', { tipo: TIPO_INGRESO }),
  ]);

  assert.equal(usoDeRubros(estado, TIPO_GASTO).get('otros'), 1);
  assert.equal(usoDeRubros(estado, TIPO_INGRESO).get('otros'), 2);
});


// ── Crear ────────────────────────────────────────────────────────────────────

test('un rubro nuevo se agrega AL FINAL, para no repintar media app', () => {
  // La posición decide el color (ADR-029): insertarlo en el medio haría que el
  // ámbar dejara de ser supermercado.
  const chico = estadoCon([], { gasto: ['salud', 'viajes'], ingreso: ['trabajo'] });
  const conNuevo = crearRubro(chico, TIPO_GASTO, 'Mascotas');

  assert.deepEqual(conNuevo.rubros.gasto, ['salud', 'viajes', 'mascotas']);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', conNuevo.rubros),
    franjaDeRubro(TIPO_GASTO, 'salud', chico.rubros), 'los colores de los otros no se mueven');
});

test('el rubro se guarda normalizado', () => {
  // RN-03: "Mascotas" y "mascotas" tienen que ser el mismo rubro, o los totales
  // se parten en dos.
  const estado = crearRubro(estadoCon([], { gasto: ['salud'], ingreso: ['trabajo'] }), TIPO_GASTO, '  MASCOTAS ');
  assert.deepEqual(estado.rubros.gasto, ['salud', 'mascotas']);
});

test('no se puede repetir un rubro ni crear uno sin nombre', () => {
  const estado = estadoCon();
  assert.throws(() => crearRubro(estado, TIPO_GASTO, 'Salud'), /ya está en la lista/);
  assert.throws(() => crearRubro(estado, TIPO_GASTO, '   '), /necesita un nombre/);
});

test('con ocho ya no entran más, y se explica por qué', () => {
  // No es una limitación técnica: es que la paleta tiene ocho colores que
  // pasaron el validador de daltonismo (ADR-029). El mensaje lo dice, porque
  // "no se puede" sin motivo es lo que empuja a buscar cómo forzarlo.
  const estado = estadoCon();
  assert.equal(catalogoDe(estado).gasto.length, TOPE_DE_RUBROS);
  assert.throws(() => crearRubro(estado, TIPO_GASTO, 'mascotas'), /colores/);
});

test('los rubros de ingreso tienen su propio cupo', () => {
  const estado = crearRubro(estadoCon(), TIPO_INGRESO, 'alquileres');
  assert.deepEqual(estado.rubros.ingreso, ['trabajo', 'inversiones', 'regalos', 'otros', 'alquileres']);
  assert.equal(estado.rubros.gasto.length, 8, 'el otro lado no se toca');
});


// ── Renombrar ────────────────────────────────────────────────────────────────

test('renombrar cambia el rubro DE SUS MOVIMIENTOS', () => {
  // Sin esto, los gastos quedan apuntando a un rubro que ya no existe y
  // desaparecen de todos los totales por rubro, sin un solo mensaje.
  const estado = estadoCon([mov('salud'), mov('viajes')]);
  const nuevo = renombrarRubro(estado, TIPO_GASTO, 'salud', 'Médicos');

  assert.ok(nuevo.rubros.gasto.includes('médicos'));
  assert.equal(nuevo.rubros.gasto.includes('salud'), false);
  assert.deepEqual(nuevo.movimientos.map((m) => m.rubro), ['médicos', 'viajes']);
});

test('renombrar conserva la posición, o sea el color', () => {
  const estado = estadoCon([mov('salud')]);
  const antes = franjaDeRubro(TIPO_GASTO, 'salud', estado.rubros);
  const nuevo = renombrarRubro(estado, TIPO_GASTO, 'salud', 'médicos');

  assert.equal(franjaDeRubro(TIPO_GASTO, 'médicos', nuevo.rubros), antes);
});

test('renombrar con el nombre de otro rubro los UNE', () => {
  // Es lo que el usuario está pidiendo cuando escribe encima: negarse le
  // dejaría el trabajo a medio hacer.
  const estado = estadoCon([mov('salud'), mov('otros')]);
  const nuevo = renombrarRubro(estado, TIPO_GASTO, 'salud', 'otros');

  assert.equal(nuevo.rubros.gasto.includes('salud'), false);
  assert.deepEqual(nuevo.movimientos.map((m) => m.rubro), ['otros', 'otros']);

  // Y queda UNO, no dos: sin esto la lista tendría "otros" dos veces, con dos
  // colores y dos filas para el mismo rubro.
  assert.equal(nuevo.rubros.gasto.filter((r) => r === 'otros').length, 1);
  assert.equal(new Set(nuevo.rubros.gasto).size, nuevo.rubros.gasto.length);
});

test('el catálogo entra al respaldo, o el otro dispositivo pierde movimientos', () => {
  // Restaurar en otro teléfono con el catálogo de fábrica descartaría todos los
  // movimientos de los rubros creados por el usuario. Es L-031 otra vez: lo que
  // no se puede recalcular entra al respaldo el día que nace.
  const conRubro = crearRubro(estadoCon([], { gasto: ['salud'], ingreso: ['trabajo'] }), TIPO_GASTO, 'mascotas');
  const leido = JSON.parse(contenidoDelRespaldo(conRubro, { fecha: '2026-08-31' }));

  assert.deepEqual(leido.rubros.gasto, ['salud', 'mascotas']);
});

test('al importar, los rubros del respaldo se suman a los de acá', () => {
  const propio = estadoCon([], { gasto: ['salud'], ingreso: ['trabajo'] });
  const unido = unirCatalogos(propio.rubros, { gasto: ['salud', 'mascotas'], ingreso: ['trabajo'] });

  assert.deepEqual(unido.gasto, ['salud', 'mascotas'], 'lo de acá primero, conserva los colores');
});

test('unir catálogos respeta el tope: no entran nueve', () => {
  const unido = unirCatalogos(rubrosIniciales(), { gasto: ['mascotas', 'viajes'], ingreso: [] });
  assert.equal(unido.gasto.length, TOPE_DE_RUBROS);
  assert.equal(unido.gasto.includes('mascotas'), false, 'lo que no entra queda huérfano, y la pantalla lo dice');
});

test('renombrar no toca los movimientos del otro tipo', () => {
  const estado = estadoCon([mov('otros'), mov('otros', { tipo: TIPO_INGRESO })]);
  const nuevo = renombrarRubro(estado, TIPO_GASTO, 'otros', 'varios');

  assert.deepEqual(nuevo.movimientos.map((m) => m.rubro), ['varios', 'otros']);
});

test('renombrar algo que no está, o a nada, se explica', () => {
  const estado = estadoCon();
  assert.throws(() => renombrarRubro(estado, TIPO_GASTO, 'inventado', 'x'), /no está en la lista/);
  assert.throws(() => renombrarRubro(estado, TIPO_GASTO, 'salud', ''), /necesita un nombre/);
});


// ── Unir ─────────────────────────────────────────────────────────────────────

test('unir mueve los movimientos y saca el rubro de origen', () => {
  const estado = estadoCon([mov('salud'), mov('salud'), mov('viajes')]);
  const nuevo = unirRubros(estado, TIPO_GASTO, 'salud', 'otros');

  assert.equal(nuevo.rubros.gasto.includes('salud'), false);
  assert.deepEqual(nuevo.movimientos.map((m) => m.rubro), ['otros', 'otros', 'viajes']);
});

test('unir no pierde ni un movimiento, y los totales lo confirman', () => {
  // La comprobación que importa: la plata que estaba en los dos rubros tiene
  // que estar entera en el que queda.
  const estado = estadoCon([
    mov('salud', { monto: '40' }), mov('otros', { monto: '10' }), mov('viajes', { monto: '5' }),
  ]);

  const nuevo = unirRubros(estado, TIPO_GASTO, 'salud', 'otros');
  const totales = new Map(porRubro(nuevo, '2026-08', TIPO_GASTO).map((r) => [r.rubro, r.total]));

  assert.equal(nuevo.movimientos.length, 3);
  assert.equal(totales.get('otros'), 5000);
  assert.equal(totales.get('viajes'), 500);
});

test('no se puede unir un rubro consigo mismo ni con uno que no está', () => {
  const estado = estadoCon();
  assert.throws(() => unirRubros(estado, TIPO_GASTO, 'salud', 'salud'), /dos rubros distintos/);
  assert.throws(() => unirRubros(estado, TIPO_GASTO, 'salud', 'inventado'), /no está en la lista/);
});


// ── Sacar ────────────────────────────────────────────────────────────────────

test('un rubro sin movimientos se saca sin más', () => {
  const estado = borrarRubro(estadoCon(), TIPO_GASTO, 'salud');
  assert.equal(estado.rubros.gasto.includes('salud'), false);
});

test('un rubro CON movimientos no se saca: hay que unirlo', () => {
  // Sacarlo dejaría los gastos fuera de todos los totales; borrar los gastos
  // con él sería borrar plata anotada. El mensaje dice cuántos son y qué hacer.
  const estado = estadoCon([mov('salud'), mov('salud')]);
  assert.throws(() => borrarRubro(estado, TIPO_GASTO, 'salud'), /2 movimientos/);
  assert.throws(() => borrarRubro(estado, TIPO_GASTO, 'salud'), /unirlo con otro rubro/);
});

test('siempre tiene que quedar al menos uno', () => {
  const estado = estadoCon([], { gasto: ['salud'], ingreso: ['trabajo'] });
  assert.throws(() => borrarRubro(estado, TIPO_GASTO, 'salud'), /al menos un rubro/);
});


// ── Que nada quede huérfano ──────────────────────────────────────────────────

test('un rubro con movimientos que ya no está en la lista se detecta', () => {
  // Puede pasar importando un respaldo de otro dispositivo con más rubros de
  // los que entran. No se puede callar: esos movimientos no salen en ningún
  // total por rubro.
  const estado = estadoCon([mov('salud')], { gasto: ['viajes', 'otros'], ingreso: ['trabajo'] });

  assert.deepEqual(rubrosHuerfanos(estado, TIPO_GASTO), [{ rubro: 'salud', cuantos: 1 }]);
  assert.match(dibujarHuerfanos({ estado }, TIPO_GASTO), /quedó fuera de la lista/);
});

test('sin huérfanos no se dibuja ninguna alarma', () => {
  assert.equal(dibujarHuerfanos({ estado: estadoCon([mov('salud')]) }, TIPO_GASTO), '');
});

test('un movimiento de un rubro creado por el usuario SOBREVIVE a recargar', () => {
  // El defecto más caro posible de esta tarea: `validarMovimiento` comprueba
  // que el rubro exista, así que leyendo con el catálogo de fábrica todos los
  // movimientos de "mascotas" se descartarían **en silencio** al recargar.
  const conRubro = crearRubro(estadoCon([], { gasto: ['salud'], ingreso: ['trabajo'] }), TIPO_GASTO, 'mascotas');
  const estado = { ...conRubro, movimientos: [mov('mascotas', { catalogo: conRubro.rubros })] };

  const leido = migrarEstado(JSON.parse(JSON.stringify(estado)));

  assert.equal(leido.movimientos.length, 1);
  assert.equal(leido.movimientos[0].rubro, 'mascotas');
  assert.ok(leido.rubros.gasto.includes('mascotas'));
});

test('un catálogo roto no deja al usuario sin rubros', () => {
  // Sin rubros no se puede cargar ni leer un solo movimiento: "no hay" no puede
  // ser una respuesta.
  const incidencias = [];
  const leido = migrarEstado({ esquema: 1, rubros: { gasto: [], ingreso: 'no es una lista' } }, incidencias);

  assert.deepEqual(leido.rubros, rubrosIniciales());
  assert.equal(incidencias.length, 1);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('cada rubro dice cuántos movimientos usa', () => {
  assert.equal(dibujarUso(0), 'sin movimientos');
  assert.equal(dibujarUso(1), '1 movimiento');
  assert.equal(dibujarUso(43), '43 movimientos');
});

test('el botón de sacar solo aparece si el rubro no tiene movimientos', () => {
  const catalogo = rubrosIniciales().gasto;
  const conUso = dibujarRubro('salud', 3, TIPO_GASTO, catalogo);
  const sinUso = dibujarRubro('salud', 0, TIPO_GASTO, catalogo);

  assert.doesNotMatch(conUso, /data-accion="borrar-rubro"/);
  assert.match(sinUso, /data-accion="borrar-rubro"/);
  assert.match(conUso, /data-accion="unir-desde"/, 'para sacarlo hay que unirlo');
});

test('la pantalla avisa que renombrar mueve los movimientos', () => {
  const html = dibujarRubros({ estado: estadoCon([mov('salud')]) });

  assert.match(html.replace(/\s+/g, ' '), /reescribe también sus movimientos/);
  assert.match(html, /Rubros de gasto/);
  assert.match(html, /Rubros de ingreso/);
});

test('cuando está lleno, la pantalla no ofrece agregar y explica por qué', () => {
  const html = dibujarRubros({ estado: estadoCon() }).replace(/\s+/g, ' ');
  const gastos = html.slice(html.indexOf('Rubros de gasto'), html.indexOf('Rubros de ingreso'));

  assert.doesNotMatch(gastos, /Agregar un rubro/);
  assert.match(gastos, /Ya hay 8, que es el máximo/);
});

test('al unir, la pantalla dice qué va a pasar antes de hacerlo', () => {
  const estado = estadoCon([mov('salud'), mov('salud')]);
  const html = dibujarRubro('salud', 2, TIPO_GASTO, catalogoDe(estado).gasto,
    { rubroUnido: { tipo: TIPO_GASTO, rubro: 'salud' }, estado });

  assert.match(html.replace(/\s+/g, ' '), /Pasar sus 2 movimientos a…/);
  assert.match(html.replace(/\s+/g, ' '), /deja de existir y sus movimientos pasan al otro rubro/);
  assert.match(html, /Los movimientos no se borran/);
});
