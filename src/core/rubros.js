// Editar los rubros — T-048, CU-19.
//
// ── Por qué esto es delicado y no una lista más ──────────────────────────────
//
// El rubro está escrito adentro de **cada movimiento**. Cambiar el catálogo sin
// tocar los movimientos deja gastos apuntando a un rubro que ya no existe: no
// dan error, simplemente **desaparecen de todos los totales** que recorren la
// lista de rubros. Es la peor forma de fallar de esta app —plata que se esfuma
// sin un mensaje— y es la razón de las tres reglas de abajo.
//
// ── Las tres reglas ──────────────────────────────────────────────────────────
//
// 1. **Todo lo que toca el catálogo mueve también los movimientos.** Renombrar
//    reescribe el rubro de los que lo usaban; unir los pasa al que queda.
//
// 2. **Un rubro con movimientos no se puede borrar a secas: hay que decir a
//    dónde van.** Borrarlo y dejar los gastos huérfanos sería perderlos; y
//    borrar los gastos con él sería borrar plata anotada, que no es lo que
//    nadie quiere decir con "sacar un rubro de la lista".
//
// 3. **Como mucho ocho por tipo.** No es una limitación técnica: la paleta
//    tiene ocho colores que pasaron el validador de daltonismo, y un noveno
//    tono generado sería indistinguible de alguno de esos (ADR-029). Para
//    agregar el noveno hay que unir dos primero.
//
// Este archivo no toca el navegador: es lógica pura y se testea con node --test.

import { TIPO_GASTO, TIPO_INGRESO, normalizarTipo, normalizarClave, rubrosDe } from './modelo.js';

/** Cuántos rubros admite cada tipo. Ver la regla 3. */
export const TOPE_DE_RUBROS = 8;

/** La clave del tipo dentro del catálogo. */
function ladoDe(tipo) {
  return normalizarTipo(tipo) === TIPO_GASTO ? 'gasto' : 'ingreso';
}

/** El catálogo de un estado, siempre completo aunque el estado no lo traiga. */
export function catalogoDe(estado) {
  return {
    gasto: rubrosDe(TIPO_GASTO, estado?.rubros),
    ingreso: rubrosDe(TIPO_INGRESO, estado?.rubros),
  };
}

/**
 * Cuántos movimientos usa cada rubro de ese tipo.
 *
 * Es lo que la pantalla necesita para poder decir "esto va a mover 43 gastos"
 * **antes** de tocar nada. Un cambio que mueve plata sin decir cuánta es un
 * cambio que se acepta sin entender.
 */
export function usoDeRubros(estado, tipo) {
  const buscado = normalizarTipo(tipo);
  const cuenta = new Map(catalogoDe(estado)[ladoDe(tipo)].map((r) => [r, 0]));

  for (const movimiento of estado?.movimientos ?? []) {
    if (normalizarTipo(movimiento.tipo) !== buscado) continue;
    const clave = normalizarClave(String(movimiento.rubro ?? ''));
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return cuenta;
}

/** Los rubros que están en los movimientos pero ya no en el catálogo. */
export function rubrosHuerfanos(estado, tipo) {
  const catalogo = catalogoDe(estado)[ladoDe(tipo)];
  return [...usoDeRubros(estado, tipo).entries()]
    .filter(([rubro, cuantos]) => cuantos > 0 && !catalogo.includes(rubro))
    .map(([rubro, cuantos]) => ({ rubro, cuantos }));
}

/** Reemplaza el catálogo de un tipo, dejando el otro como estaba. */
function conCatalogo(estado, tipo, lista) {
  const catalogo = catalogoDe(estado);
  return { ...estado, rubros: { ...catalogo, [ladoDe(tipo)]: lista } };
}

/** Cambia el rubro de los movimientos que usaban `desde`. */
function moverMovimientos(estado, tipo, desde, hasta) {
  const buscado = normalizarTipo(tipo);
  return (estado?.movimientos ?? []).map((m) => (
    normalizarTipo(m.tipo) === buscado && normalizarClave(String(m.rubro ?? '')) === desde
      ? { ...m, rubro: hasta }
      : m
  ));
}

/**
 * Agrega un rubro nuevo.
 *
 * Va **al final** y no ordenado alfabéticamente: la posición decide el color
 * (ADR-029), así que insertarlo en el medio repintaría media app y "el ámbar"
 * dejaría de ser supermercado.
 */
export function crearRubro(estado, tipo, nombre) {
  const clave = normalizarClave(String(nombre ?? ''));
  if (clave === '') throw new Error('El rubro necesita un nombre.');

  const lista = catalogoDe(estado)[ladoDe(tipo)];
  if (lista.includes(clave)) throw new Error(`"${clave}" ya está en la lista.`);

  if (lista.length >= TOPE_DE_RUBROS) {
    throw new Error(
      `Ya hay ${TOPE_DE_RUBROS} rubros y no entran más: cada uno tiene su color, y ` +
      `un noveno sería indistinguible de otro para quien no distingue bien los ` +
      `colores. Para agregar este, uní dos de los que ya están.`
    );
  }

  return conCatalogo(estado, tipo, [...lista, clave]);
}

/**
 * Le cambia el nombre a un rubro, **y se lo cambia también a sus movimientos**.
 *
 * Conserva la posición, o sea el color: renombrar "salidas" a "entretenimiento"
 * no tiene por qué cambiar de qué color es en la torta.
 *
 * Si el nombre nuevo es el de otro rubro que ya existe, **es una unión** y se
 * hace como tal: es lo mismo que pide el usuario cuando escribe encima, y
 * negarse le dejaría el trabajo a medio hacer.
 */
export function renombrarRubro(estado, tipo, viejo, nuevo) {
  const desde = normalizarClave(String(viejo ?? ''));
  const hasta = normalizarClave(String(nuevo ?? ''));
  if (hasta === '') throw new Error('El rubro necesita un nombre.');

  const lista = catalogoDe(estado)[ladoDe(tipo)];
  if (!lista.includes(desde)) throw new Error(`"${viejo}" no está en la lista.`);
  if (desde === hasta) return estado;

  if (lista.includes(hasta)) return unirRubros(estado, tipo, desde, hasta);

  return {
    ...conCatalogo(estado, tipo, lista.map((r) => (r === desde ? hasta : r))),
    movimientos: moverMovimientos(estado, tipo, desde, hasta),
  };
}

/**
 * Une dos rubros: los movimientos de `desde` pasan a `hasta`, y `desde` se va.
 *
 * Es la operación que hace posible todo lo demás. Sin ella, "sacar un rubro"
 * solo se podría hacer con los que nunca se usaron.
 */
export function unirRubros(estado, tipo, desde, hasta) {
  const origen = normalizarClave(String(desde ?? ''));
  const destino = normalizarClave(String(hasta ?? ''));

  const lista = catalogoDe(estado)[ladoDe(tipo)];
  if (!lista.includes(origen)) throw new Error(`"${desde}" no está en la lista.`);
  if (!lista.includes(destino)) throw new Error(`"${hasta}" no está en la lista.`);
  if (origen === destino) throw new Error('Hay que elegir dos rubros distintos.');

  return {
    ...conCatalogo(estado, tipo, lista.filter((r) => r !== origen)),
    movimientos: moverMovimientos(estado, tipo, origen, destino),
  };
}

/**
 * Saca un rubro de la lista. **Solo si no lo usa ningún movimiento.**
 *
 * Con movimientos adentro hay que unirlo a otro: es la regla 2. El mensaje dice
 * cuántos son y qué hacer, porque "no se puede" sin decir por qué es la forma
 * más rápida de que alguien busque la manera de forzarlo.
 */
export function borrarRubro(estado, tipo, nombre) {
  const clave = normalizarClave(String(nombre ?? ''));
  const lista = catalogoDe(estado)[ladoDe(tipo)];
  if (!lista.includes(clave)) throw new Error(`"${nombre}" no está en la lista.`);

  if (lista.length === 1) {
    throw new Error('Tiene que quedar al menos un rubro: sin ninguno no se podría cargar nada.');
  }

  const cuantos = usoDeRubros(estado, tipo).get(clave) ?? 0;
  if (cuantos > 0) {
    throw new Error(
      `"${clave}" lo usan ${cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`}. ` +
      `Sacarlo los dejaría fuera de todos los totales, así que primero hay que ` +
      `unirlo con otro rubro: sus movimientos se mudan y el rubro desaparece.`
    );
  }

  return conCatalogo(estado, tipo, lista.filter((r) => r !== clave));
}
