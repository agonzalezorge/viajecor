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
// ── Se escriben las FECHAS, y los días se calculan ──────────────────────────
//
// La duración **no se deduce de los movimientos**: un viaje puede empezar antes
// de que se registre el primer gasto o terminar después del último, y deducirlo
// daría un gasto por día más alto de lo real, sin avisar.
//
// Pero tampoco se escribe a mano. **Se escriben la fecha de inicio y la de fin,
// y los días salen de restarlas** (pedido del usuario, 2026-08-28). Es mejor por
// dos motivos: una fecha es un dato que uno recuerda —"salí el 3 y volví el
// 12"— y un número de días es una cuenta que hay que hacer; y con las fechas
// guardadas, los viajes se pueden **ordenar por cuándo terminaron**, que es como
// uno los piensa.
//
// Viven en `estado.fechas_de_viaje`: una lista de `{ clave, desde, hasta }`.
// **Se llama así y no `viajes` a propósito**: no es un catálogo de viajes —la
// lista de viajes sigue saliendo de las etiquetas— sino un dato suelto sobre
// uno de ellos.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { normalizarClave, TIPO_GASTO, mesDe, validarFecha, clavesDeEtiquetas, etiquetasDe } from './modelo.js';
import { monedaBaseDe } from './monedas.js';
import { redondear } from './dinero.js';
import { separarConvertibles } from './calculos.js';
import { movimientoEnEuros } from './cambio.js';

/** El rubro que marca a un comentario como viaje. */
export const RUBRO_VIAJE = 'viajes';

/** Las fechas guardadas de un viaje, o `null` si no se escribieron. */
export function fechasDeViaje(estado, clave) {
  const buscada = normalizarClave(String(clave ?? ''));
  const guardado = (estado?.fechas_de_viaje ?? []).find(
    (v) => normalizarClave(String(v?.clave ?? '')) === buscada,
  );
  return guardado ? { desde: guardado.desde, hasta: guardado.hasta } : null;
}

/**
 * Cuántos días dura un viaje entre dos fechas, **contando las dos puntas**.
 *
 * Del 3 al 12 son diez días, no nueve: el 3 se viajó y el 12 también. Es la
 * cuenta que hace una persona, y la que no hace una resta de fechas a secas.
 */
export function duracionEnDias(desde, hasta) {
  const dias = (Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000;
  return Math.round(dias) + 1;
}

/**
 * Escribe las fechas de un viaje. Devuelve un estado nuevo.
 *
 * `null` las borra: es la forma de decir "no me acuerdo cuándo fue".
 */
export function fijarFechasDeViaje(estado, clave, desde, hasta) {
  const buscada = normalizarClave(String(clave ?? ''));
  if (buscada === '') throw new Error('Hace falta saber de qué viaje son las fechas.');

  const otros = (estado.fechas_de_viaje ?? []).filter(
    (v) => normalizarClave(String(v?.clave ?? '')) !== buscada,
  );

  const vacia = (f) => f === null || f === undefined || String(f).trim() === '';
  if (vacia(desde) && vacia(hasta)) return { ...estado, fechas_de_viaje: otros };

  if (vacia(desde) || vacia(hasta)) {
    throw new Error('Hacen falta las dos fechas: la de inicio y la de fin.');
  }

  // `validarFecha` comprueba que la fecha EXISTA, no solo que tenga la forma:
  // un 31 de abril tiene la forma correcta y no existe (L-005).
  const inicio = validarFecha(desde);
  const fin = validarFecha(hasta);

  if (fin < inicio) {
    throw new Error('El viaje no puede terminar antes de empezar: revisá las fechas.');
  }
  if (duracionEnDias(inicio, fin) > 3650) {
    throw new Error('Diez años de viaje son muchos: revisá las fechas.');
  }

  return { ...estado, fechas_de_viaje: [...otros, { clave: buscada, desde: inicio, hasta: fin }] };
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
  const { convertibles, sinConvertir } = separarConvertibles(todos, estado?.tipos_cambio, monedaBaseDe(estado));

  // Primero, qué comentarios son viajes: los que tienen algún gasto de `viajes`.
  const esViaje = new Set();
  for (const m of todos) {
    if (m.tipo !== TIPO_GASTO) continue;
    if (normalizarClave(String(m.rubro ?? '')) !== RUBRO_VIAJE) continue;
    // Cada etiqueta del gasto por separado (T-060): un pasaje etiquetado
    // "Roma, Trabajo" hace que Roma sea un viaje, y también Trabajo si alguna
    // vez lleva un gasto de ese rubro.
    for (const clave of clavesDeEtiquetas(String(m.comentario ?? ''))) esViaje.add(clave);
  }
  if (esViaje.size === 0) return [];

  const acumulado = new Map();
  for (const m of convertibles) {
    const euros = movimientoEnEuros(m, estado.tipos_cambio, estado.monedas, monedaBaseDe(estado));
    const esGasto = m.tipo === TIPO_GASTO;

    for (const etiqueta of etiquetasDe(String(m.comentario ?? ''))) {
      const clave = normalizarClave(etiqueta);
      if (!esViaje.has(clave)) continue;

      // Los INGRESOS del viaje también entran (T-060). Un viaje de trabajo tiene
      // los dos lados —lo que costó y lo que te reintegraron— y mostrar solo uno
      // contesta media pregunta. Se guardan separados para no mezclarlos nunca
      // en un mismo número: el total de gastos sigue siendo el total de gastos.
      const antes = acumulado.get(clave);
      if (!antes) {
        acumulado.set(clave, {
          clave,
          comentario: etiqueta,
          total: esGasto ? euros : 0,
          ingresos: esGasto ? 0 : euros,
          cuantos: 1,
          desde: m.fecha,
          hasta: m.fecha,
        });
      } else {
        if (esGasto) antes.total += euros; else antes.ingresos += euros;
        antes.cuantos += 1;
        if (m.fecha < antes.desde) antes.desde = m.fecha;
        if (m.fecha > antes.hasta) antes.hasta = m.fecha;
      }
    }
  }

  // Los que no se pudieron convertir se cuentan aparte, por viaje: un total al
  // que le falta un gasto y que no lo dice es peor que no mostrar ningún total.
  const incompletos = new Set();
  for (const m of sinConvertir) {
    for (const clave of clavesDeEtiquetas(String(m.comentario ?? ''))) {
      if (esViaje.has(clave)) incompletos.add(clave);
    }
  }

  return [...acumulado.values()]
    .map((v) => {
      const fechas = fechasDeViaje(estado, v.clave);
      const dias = fechas === null ? null : duracionEnDias(fechas.desde, fechas.hasta);
      return {
        ...v,
        mes: mesDe(v.desde),
        fechas,
        dias,
        // ── Lo que costó el viaje es lo que salió DE TU BOLSILLO — T-062 ─────
        //
        // Con reintegros, "el costo del viaje" no son los mil que pasaron por tu
        // tarjeta: son los cuatrocientos que quedaste poniendo. Así el viaje de
        // trabajo se lee igual que cualquier otro —un número positivo, del mismo
        // color, comparable con los demás— que es lo que pidió el usuario
        // (2026-09-19) después de ver la primera versión, que mostraba el saldo
        // en negativo y lo hacía parecer otra cosa.
        //
        // `gastos` e `ingresos` quedan aparte para poder desglosarlo al abrirlo.
        gastos: v.total,
        costo: v.total - v.ingresos,
        total: v.total - v.ingresos,
        porDia: dias === null ? null : redondear((v.total - v.ingresos) / dias),
        // Si los reintegros superan a los gastos, el viaje **te dejó plata**. Ahí
        // mostrarlo "en positivo" sería mentir: va con su signo y su color.
        aFavor: v.ingresos > v.total,
        mixto: v.ingresos > 0 && v.total > 0,
        saldo: v.ingresos - v.total,
        // Por cuándo terminó, que es el orden que pidió el usuario. Un viaje sin
        // fechas escritas se ordena por su último gasto: es lo más parecido que
        // se sabe, y sin eso todos los viajes sin fechas se amontonarían juntos
        // en una punta de la lista, lejos de cuando de verdad pasaron.
        termino: fechas === null ? v.hasta : fechas.hasta,
        incompleto: incompletos.has(v.clave),
      };
    })
    // Del más reciente arriba al más viejo abajo.
    .sort((a, b) => b.termino.localeCompare(a.termino) || a.clave.localeCompare(b.clave));
}
