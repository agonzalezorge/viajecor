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
// 3. **Como mucho veinte por tipo**, que es hasta donde llega la paleta. No es
//    una limitación técnica sino de colores: hay veinte tonos definidos a mano
//    —elegidos con el validador de la guía, el más distinto primero— y el
//    veintiuno tendría que repetir alguno. Ver ADR-049.
//
//    **Los primeros se distinguen mejor que los últimos**, y eso está medido:
//    el rubro 9 está a ΔE 14,6 de todos los anteriores y el 20 a 6,7. De ahí que
//    la app escriba SIEMPRE el nombre al lado del color, que es la compensación
//    que la guía pide cuando la separación baja de 8.
//
// Este archivo no toca el navegador: es lógica pura y se testea con node --test.

import { TIPO_GASTO, TIPO_INGRESO, normalizarTipo, normalizarClave, rubrosDe } from './modelo.js';
import { franjaDeRubro, elegirColor } from './paleta.js';

/** Cuántos rubros admite cada tipo. Ver la regla 3. */
export const TOPE_DE_RUBROS = 20;

/** La clave del tipo dentro del catálogo. */
function ladoDe(tipo) {
  return normalizarTipo(tipo) === TIPO_GASTO ? 'gasto' : 'ingreso';
}

/** El catálogo de un estado, siempre completo aunque el estado no lo traiga. */
export function catalogoDe(estado) {
  return {
    gasto: rubrosDe(TIPO_GASTO, estado?.rubros),
    ingreso: rubrosDe(TIPO_INGRESO, estado?.rubros),
    // Los colores elegidos viajan con el catálogo (T-061): quien lo recibe para
    // saber qué rubros hay, recibe también de qué color son.
    colores: estado?.rubros?.colores ?? {},
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

/**
 * Mueve un rubro un lugar arriba o abajo en su lista — T-067.
 *
 * ── Por qué esto tiene que fijar los colores ────────────────────────────────
 *
 * El color de un rubro sale de **su posición** mientras el usuario no elija uno
 * a mano (ADR-049). Así que reordenar, sin más, le cambiaría el color a todos
 * los rubros que se corran — y el color de un rubro es lo que ata la torta con
 * la tabla y con la lista en toda la app. Nadie que sube "Salud" un lugar espera
 * que otros cuatro rubros cambien de color.
 *
 * Por eso, antes de mover, se **congela el color que cada uno tiene ahora**: los
 * que ya tenían uno elegido siguen igual, y a los demás se les guarda el que les
 * tocaba. Después del movimiento, el orden es solo orden.
 *
 * Es una decisión con un costo, y conviene tenerlo escrito: a partir del primer
 * reordenamiento, **los colores de ese tipo dejan de seguir a la lista**. Crear
 * un rubro nuevo le dará el color de su posición, que puede estar ocupado — la
 * pantalla ya avisa cuáles están usados, y cambiarlo es un toque.
 */
export function moverRubro(estado, tipo, rubro, direccion) {
  const clave = normalizarClave(String(rubro ?? ''));
  const lista = catalogoDe(estado)[ladoDe(tipo)];
  const desde = lista.indexOf(clave);

  if (desde === -1) throw new Error(`"${clave}" no está en la lista de rubros.`);

  const hasta = direccion === 'arriba' ? desde - 1 : desde + 1;
  // Contra los bordes no pasa nada, y no es un error: la pantalla no dibuja el
  // botón que sobra, pero un respaldo o un toque doble pueden llegar igual.
  if (hasta < 0 || hasta >= lista.length) return estado;

  const movida = [...lista];
  movida[desde] = movida[hasta];
  movida[hasta] = clave;

  return conCatalogo(conColoresFijados(estado, tipo), tipo, movida);
}

/**
 * El estado con el color que cada rubro de ese tipo tiene **ahora** guardado
 * como elegido.
 *
 * No hace falta preguntar cuáles ya tenían uno propio: `franjaDeRubro()` empieza
 * justamente por el color elegido, así que a esos se les vuelve a guardar el
 * mismo número. Preguntarlo antes parecía más prudente y solo era una línea de
 * más — una ronda de mutaciones lo dejó en evidencia.
 */
function conColoresFijados(estado, tipo) {
  const catalogo = catalogoDe(estado);
  let conColores = catalogo;

  for (const rubro of catalogo[ladoDe(tipo)]) {
    conColores = elegirColor(conColores, tipo, rubro, franjaDeRubro(tipo, rubro, catalogo));
  }

  return { ...estado, rubros: conColores };
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
      `Ya hay ${TOPE_DE_RUBROS} rubros de ese tipo, que es hasta donde llegan los ` +
      `colores: el siguiente tendría que repetir uno y dos rubros del mismo color ` +
      `no se pueden leer en una torta. Para agregar este, uní dos de los que ya están.`
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
