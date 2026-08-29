// Las etiquetas que no son ni un gasto fijo ni un viaje — CU-18, T-946.
//
// Pedido del usuario (2026-08-29): la etiqueta sirve para agrupar cualquier
// cosa, no solo viajes y gastos fijos. Una mudanza, unos regalos, un arreglo del
// auto: agrupan igual y hasta ahora no aparecían en ningún lado.
//
// ── Cómo se decide en qué pantalla va cada etiqueta ─────────────────────────
//
// En cascada, mirando **los gastos que llevan esa etiqueta**:
//
//   1. Si **todos** son del rubro `gastos fijos` → es un gasto fijo.
//   2. Si **alguno** es del rubro `viajes` → es un viaje.
//   3. Si no → va acá, en los otros grupos.
//
// ── Por qué el paso 2 no usa el 75 % que propuso el usuario ─────────────────
//
// Su idea era "si más del 75 % es del rubro viajes, es un viaje". **Con esa
// regla sus propios viajes dejarían de serlo**, y el número lo dice solo: en un
// viaje se paga el pasaje y el hotel con rubro `viajes`, pero también se come,
// se toma transporte y se compra en el supermercado. El viaje de prueba de
// T-023 —300 € de `viajes` y 150 € de comida y transporte— es **66 %**, así que
// se caería de la pantalla de viajes justo el caso que esa pantalla existe para
// mostrar.
//
// Por eso el paso 2 sigue siendo la regla de ADR-036 —al menos un gasto del
// rubro `viajes`—, que además es lo que ya venía funcionando. El umbral está
// igual como una constante con nombre: cambiarlo es una línea, y la decisión es
// del usuario.
//
// ── Las tres pantallas no se reparten la plata, se reparten las PREGUNTAS ───
//
// Un gasto puede contarse en dos de ellas, y está bien: la de gastos fijos
// responde "¿cuánto me sale la luz?" mirando **el rubro** —y suma solo la parte
// de ese rubro—, y esta responde "¿cuánto me salió la mudanza?" mirando **la
// etiqueta**, con todos sus rubros adentro. Cada una lo dice en su pantalla.
//
// Lo que decide la cascada es **dónde tiene su grupo propio cada etiqueta**, no
// qué pantalla puede nombrarla. La primera versión hacía lo segundo: sacaba de
// la tarjeta de gastos fijos las etiquetas mixtas. El usuario lo objetó, con
// razón —"cómo yo etiquete algo no debería alterar en nada los totales de
// rubro, son cosas independientes"—, y tenía razón: esa tarjeta agrupa por
// etiqueta los gastos de un rubro, y el etiquetado no puede cambiar lo que se
// ve de ese rubro. Ver ADR-041.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { TIPO_GASTO, normalizarClave, mesDe } from './modelo.js';
import { porEtiquetaDeGasto } from './calculos.js';
import { movimientoEnEuros } from './cambio.js';
import { RUBRO_VIAJE } from './viajes.js';

/** El rubro cuyos gastos, solos, hacen que una etiqueta sea un gasto fijo. */
export const RUBRO_FIJO = 'gastos fijos';

/**
 * Cuánto del gasto de una etiqueta tiene que ser del rubro `viajes` para que
 * cuente como viaje.
 *
 * **Cero: alcanza con un gasto.** Es la regla de ADR-036. El usuario propuso
 * 0,75 y con ese número sus propios viajes dejarían de serlo (ver arriba). Queda
 * como constante para que cambiarlo sea una línea si él decide que sí.
 */
export const PARTE_DE_VIAJE = 0;

/**
 * En qué pantalla va una etiqueta: `'fijo'`, `'viaje'` u `'otro'`.
 *
 * Se decide con **los gastos**, no con los ingresos: una etiqueta que además
 * tiene un ingreso —una devolución, un regalo que ayudó a pagar el viaje— sigue
 * siendo el mismo grupo de gastos.
 */
export function categoriaDeEtiqueta(movimientos) {
  const gastos = movimientos.filter((m) => m.tipo === TIPO_GASTO);
  if (gastos.length === 0) return 'otro';

  if (gastos.every((m) => normalizarClave(m.rubro) === RUBRO_FIJO)) return 'fijo';

  const deViaje = gastos.filter((m) => normalizarClave(m.rubro) === RUBRO_VIAJE).length;
  if (deViaje > 0 && deViaje / gastos.length > PARTE_DE_VIAJE) return 'viaje';

  return 'otro';
}

/**
 * Los otros grupos de gastos, de más caro a más barato.
 *
 * Cada uno trae su total —**con todos sus rubros adentro**, igual que un
 * viaje—, cuántos gastos, entre qué fechas y en cuántos meses distintos
 * aparece. Lo último es lo que distingue una mudanza de algo que se repite
 * todos los meses sin ser un gasto fijo del rubro.
 */
export function otrosGrupos(estado) {
  const grupos = [];

  for (const [clave, movimientos] of porEtiquetaDeGasto(estado)) {
    if (categoriaDeEtiqueta(movimientos) !== 'otro') continue;
    const etiqueta = movimientos[0].comentario;

    const total = movimientos.reduce(
      (suma, m) => suma + movimientoEnEuros(m, estado.tipos_cambio, estado.monedas), 0,
    );
    const fechas = movimientos.map((m) => m.fecha).sort();

    grupos.push({
      clave,
      etiqueta,
      total,
      cuantos: movimientos.length,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      meses: new Set(movimientos.map((m) => mesDe(m.fecha))).size,
    });
  }

  return grupos.sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}
