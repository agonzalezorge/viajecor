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

import { TIPO_GASTO, normalizarClave, mesDe, etiquetasDe } from './modelo.js';
import { monedaBaseDe } from './monedas.js';
import { porEtiquetaDeGasto, porEtiqueta } from './calculos.js';
import { movimientoEnEuros } from './cambio.js';
import { redondear } from './dinero.js';
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

  // TODAS las etiquetas, no solo las de gastos (T-060). Un grupo puede ser de
  // ingresos —el usuario nombró los reintegros y los trabajos sueltos— y hasta
  // ahora no aparecía en ninguna pantalla: existía en los datos y no se podía
  // mirar, que es exactamente lo que CU-18 vino a arreglar para los gastos.
  for (const [clave, movimientos] of porEtiqueta(estado)) {
    const gastos = movimientos.filter((m) => m.tipo === TIPO_GASTO);
    const ingresos = movimientos.filter((m) => m.tipo !== TIPO_GASTO);

    // La cascada decide si la etiqueta es un gasto fijo o un viaje, y esas dos
    // preguntas son sobre gastos: `categoriaDeEtiqueta()` ya filtra por dentro y
    // ya contesta 'otro' cuando no hay ninguno. Por eso un grupo de solo
    // ingresos cae acá sin que haya que preguntarlo aparte.
    if (categoriaDeEtiqueta(movimientos) !== 'otro') continue;

    const enBase = (m) => movimientoEnEuros(m, estado.tipos_cambio, estado.monedas, monedaBaseDe(estado));
    const total = gastos.reduce((suma, m) => suma + enBase(m), 0);
    const entradas = ingresos.reduce((suma, m) => suma + enBase(m), 0);
    const fechas = movimientos.map((m) => m.fecha).sort();
    const meses = new Set(movimientos.map((m) => mesDe(m.fecha))).size;

    grupos.push({
      clave,
      etiqueta: movimientos[0].comentario ? etiquetaVisible(movimientos, clave) : clave,
      total,
      ingresos: entradas,
      // Qué clase de grupo es, para que la pantalla sepa qué número destacar:
      // el que gasta muestra lo que costó; el que solo cobra, lo que entró; y el
      // que hace las dos cosas, el saldo — que es el caso del viaje de trabajo.
      clase: gastos.length === 0 ? 'ingreso' : ingresos.length === 0 ? 'gasto' : 'mixto',
      saldo: entradas - total,
      cuantos: movimientos.length,
      cuantosGastos: gastos.length,
      cuantosIngresos: ingresos.length,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      meses,
      // La media MENSUAL, que es la que pidió el usuario para los ingresos: lo
      // que entró dividido los meses en que apareció, no los movimientos. Con
      // tres cobros en un mismo mes, "la media" por movimiento diría un tercio
      // de lo que de verdad entra por mes.
      mediaMensual: redondear((gastos.length === 0 ? entradas : total) / Math.max(1, meses)),
    });
  }

  return grupos.sort((a, b) => {
    const suyo = (g) => (g.clase === 'ingreso' ? g.ingresos : g.total);
    return suyo(b) - suyo(a) || a.clave.localeCompare(b.clave);
  });
}

/** Cómo se escribió esa etiqueta la primera vez, para mostrarla. */
function etiquetaVisible(movimientos, clave) {
  for (const m of movimientos) {
    for (const etiqueta of etiquetasDe(String(m.comentario ?? ''))) {
      if (normalizarClave(etiqueta) === clave) return etiqueta;
    }
  }
  return clave;
}

