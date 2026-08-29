// El gasto por viaje — CU-11, T-023. Reemplaza el bloque `GASTOS POR VIAJE`,
// que es el motivo por el que la planilla se llama "Viaje Coruña".
//
// ── Qué es un viaje, y por qué no es un registro ────────────────────────────
//
// **Un viaje no existe como cosa guardada.** Es un comentario repetido en varios
// movimientos, igual que un gasto fijo. El usuario decidió (2026-08-28) que se
// siga escribiendo a mano, con la condición de poder corregirlo en un solo lugar
// y que el cambio llegue a todos los registros — eso es T-025.
//
// **Cuál de todos los comentarios es un viaje:** el que tenga al menos un gasto
// del rubro `viajes`. Es una regla que sale de los datos y no de una lista
// aparte, así que no hay dos lugares que se puedan desincronizar. `Luz` nunca va
// a tener un gasto de rubro `viajes`, así que nunca va a aparecer acá.
//
// **Pero el total del viaje suma TODOS sus rubros**, no solo el de `viajes`: en
// un viaje se come, se toma transporte y se compra en el supermercado, y todo
// eso es plata del viaje. Es lo mismo que hace la planilla, que suma por
// comentario sin mirar el rubro.
//
// ── Los días se escriben ────────────────────────────────────────────────────
//
// Decidido por el usuario: la duración **no se deduce** de la primera y la
// última fecha con gastos. Un viaje puede empezar antes de que se registre el
// primer gasto o terminar después del último, y deducirlo daría un gasto por día
// más alto de lo real, sin avisar.
//
// Por eso son el único dato de un viaje que hay que guardar, y viven en
// `estado.dias_de_viaje`: una lista de `{ clave, dias }`. **Se llama así y no
// `viajes` a propósito**: no es un catálogo de viajes —la lista de viajes sigue
// saliendo de los comentarios— sino un dato suelto sobre uno de ellos.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { normalizarClave, TIPO_GASTO, mesDe } from './modelo.js';
import { redondear } from './dinero.js';
import { separarConvertibles } from './calculos.js';
import { movimientoEnEuros } from './cambio.js';

/** El rubro que marca a un comentario como viaje. */
export const RUBRO_VIAJE = 'viajes';

/** Los días guardados de un viaje, o `null` si no se escribieron. */
export function diasDeViaje(estado, clave) {
  const buscada = normalizarClave(String(clave ?? ''));
  const guardado = (estado?.dias_de_viaje ?? []).find(
    (v) => normalizarClave(String(v?.clave ?? '')) === buscada,
  );
  return guardado ? guardado.dias : null;
}

/**
 * Escribe los días de un viaje. Devuelve un estado nuevo.
 *
 * `null` o `0` los borra: es la forma de decir "no sé cuántos días fue", y es
 * distinta de decir "cero días", que no significa nada.
 */
export function fijarDiasDeViaje(estado, clave, dias) {
  const buscada = normalizarClave(String(clave ?? ''));
  if (buscada === '') throw new Error('Hace falta saber de qué viaje son los días.');

  const otros = (estado.dias_de_viaje ?? []).filter(
    (v) => normalizarClave(String(v?.clave ?? '')) !== buscada,
  );

  if (dias === null || dias === undefined || dias === '') {
    return { ...estado, dias_de_viaje: otros };
  }

  const numero = Number(dias);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error('Los días del viaje son un número entero de 1 para arriba.');
  }
  if (numero > 3650) {
    throw new Error('Diez años de viaje son muchos: revisá el número.');
  }

  return { ...estado, dias_de_viaje: [...otros, { clave: buscada, dias: numero }] };
}

/**
 * Los viajes, de más caro a más barato.
 *
 * Cada uno trae su total, cuántos movimientos, entre qué fechas se gastó, los
 * días escritos (o `null`) y el gasto por día **solo si los días están**. Sin
 * días no se inventa un promedio: sería el número que el usuario vino a buscar,
 * calculado sobre un supuesto que nadie confirmó.
 */
export function viajes(estado) {
  const todos = estado?.movimientos ?? [];
  const { convertibles, sinConvertir } = separarConvertibles(todos, estado?.tipos_cambio);

  // Primero, qué comentarios son viajes: los que tienen algún gasto de `viajes`.
  const esViaje = new Set();
  for (const m of todos) {
    if (m.tipo === TIPO_GASTO
      && normalizarClave(String(m.rubro ?? '')) === RUBRO_VIAJE
      && String(m.comentario ?? '') !== '') {
      esViaje.add(normalizarClave(m.comentario));
    }
  }
  if (esViaje.size === 0) return [];

  const acumulado = new Map();
  for (const m of convertibles) {
    if (m.tipo !== TIPO_GASTO) continue;
    const comentario = String(m.comentario ?? '');
    if (comentario === '') continue;
    const clave = normalizarClave(comentario);
    if (!esViaje.has(clave)) continue;

    const euros = movimientoEnEuros(m, estado.tipos_cambio, estado.monedas);
    const antes = acumulado.get(clave);
    if (!antes) {
      acumulado.set(clave, {
        clave, comentario, total: euros, cuantos: 1,
        desde: m.fecha, hasta: m.fecha,
      });
    } else {
      antes.total += euros;
      antes.cuantos += 1;
      if (m.fecha < antes.desde) antes.desde = m.fecha;
      if (m.fecha > antes.hasta) antes.hasta = m.fecha;
    }
  }

  // Los que no se pudieron convertir se cuentan aparte, por viaje: un total al
  // que le falta un gasto y que no lo dice es peor que no mostrar ningún total.
  const incompletos = new Set();
  for (const m of sinConvertir) {
    const clave = normalizarClave(String(m.comentario ?? ''));
    if (esViaje.has(clave)) incompletos.add(clave);
  }

  return [...acumulado.values()]
    .map((v) => {
      const dias = diasDeViaje(estado, v.clave);
      return {
        ...v,
        mes: mesDe(v.desde),
        dias,
        porDia: dias === null ? null : redondear(v.total / dias),
        incompleto: incompletos.has(v.clave),
      };
    })
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}
