// Mirar la evolución en un período recortado — T-054, CU-10.
//
// ── Por qué recortando el historial y no filtrando cada cuenta ──────────────
//
// La pantalla de evolución muestra seis cosas —la tabla mes × rubro, el total,
// el promedio, las dos tortas del reparto, los dos gráficos y los gastos
// fijos— y **todas se derivan de la misma lista de movimientos**. Agregarle un
// parámetro "desde/hasta" a cada una de esas cuentas sería seis oportunidades de
// que una se quede atrás y muestre el período entero al lado de las otras cinco
// recortadas: el peor resultado posible, porque los números se ven bien y no
// hablan del mismo tiempo.
//
// En vez de eso, acá se recorta **el historial** una sola vez y todo lo demás se
// calcula igual que siempre. Lo que la pantalla recibe es un estado que tiene
// esos movimientos y no otros; ninguna cuenta sabe que hay un período.
//
// ── Lo que el recorte NO toca ───────────────────────────────────────────────
//
// Los tipos de cambio, las monedas y los rubros quedan enteros: son el catálogo
// con el que se leen los movimientos, no movimientos. Sacar el tipo de cambio de
// un mes que quedó fuera del período no cambiaría ningún total, pero dejaría a
// los movimientos de ese mes sin poder convertirse si alguna cuenta los mirara.
//
// Este archivo no toca el navegador: es lógica pura.

import { mesDe } from './modelo.js';

/** Un texto `AAAA-MM` válido, o `null`. */
function mesValido(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : null;
}

/**
 * Los meses que tienen movimientos, del más viejo al más nuevo.
 *
 * Es la lista que la pantalla ofrece para elegir: dejar elegir un mes en el que
 * no hay nada solo sirve para que la tabla salga vacía sin explicar por qué.
 */
export function mesesElegibles(estado) {
  const movimientos = estado?.movimientos ?? [];
  return [...new Set(movimientos.map((m) => mesDe(m.fecha)))].sort();
}

/**
 * El período que hay que usar, a partir de lo que el usuario eligió.
 *
 * Devuelve `null` cuando hay que mostrar **todo**, que es el estado
 * predeterminado: sin nada elegido, la pantalla sigue siendo la de siempre.
 *
 * Un período al revés —desde marzo hasta enero— se da vuelta en vez de
 * rechazarse: es evidente qué quiso decir quien lo eligió, y una tabla vacía con
 * un cartel de error no le sirve a nadie.
 */
export function normalizarPeriodo(periodo) {
  const desde = mesValido(periodo?.desde);
  const hasta = mesValido(periodo?.hasta);
  if (desde === null && hasta === null) return null;

  // Con una sola punta elegida, la otra queda abierta: "desde marzo" es una
  // pregunta razonable y no hay por qué obligar a contestar las dos.
  if (desde !== null && hasta !== null && desde > hasta) return { desde: hasta, hasta: desde };
  return { desde, hasta };
}

/** ¿Este mes cae dentro del período? */
export function mesEnPeriodo(mes, periodo) {
  if (periodo === null) return true;
  if (periodo.desde !== null && mes < periodo.desde) return false;
  if (periodo.hasta !== null && mes > periodo.hasta) return false;
  return true;
}

/**
 * El mismo estado con **solo los movimientos del período**.
 *
 * Sin período devuelve el estado tal cual —el mismo objeto—, para que el camino
 * de siempre no pague nada por esta función.
 */
export function estadoDelPeriodo(estado, periodo) {
  const rango = normalizarPeriodo(periodo);
  if (rango === null) return estado;

  return {
    ...estado,
    movimientos: (estado?.movimientos ?? []).filter((m) => m && m.fecha && mesEnPeriodo(mesDe(m.fecha), rango)),
  };
}

/**
 * Cuántos movimientos quedaron afuera. La pantalla lo dice: un total recortado
 * que no avisa que está recortado es la misma mentira que un total incompleto.
 */
export function movimientosFuera(estado, periodo) {
  const rango = normalizarPeriodo(periodo);
  if (rango === null) return 0;
  return (estado?.movimientos ?? []).length - estadoDelPeriodo(estado, rango).movimientos.length;
}
