// Otros grupos — CU-18, T-946, y grupos de ingresos y mixtos en T-060.
//
// La etiqueta sirve para agrupar cualquier cosa, no solo viajes y gastos fijos:
// una mudanza, unos regalos, el arreglo del auto. Hasta ahora esos grupos no
// aparecían en ninguna pantalla — existían en los datos y no se podían ver.
//
// ── Ya no son "de gastos" ───────────────────────────────────────────────────
//
// Lo pidió el usuario (2026-09-18). Una etiqueta puede juntar **ingresos** —un
// trabajo suelto, unos reintegros— y eso quedaba fuera de la app por el mismo
// motivo por el que estaban fuera los grupos de gastos antes de T-946: nadie
// había escrito la pantalla. Cada grupo dice ahora de qué clase es:
//
//   · **gasto**   — lo de siempre: cuánto costó.
//   · **ingreso** — cuánto entró, y **la media por mes**, que es lo que se
//                   quiere saber de algo que cobra: tres cobros en un mes no son
//                   tres meses de ingreso.
//   · **mixto**   — tiene de los dos, así que lo que importa es el **saldo**.
//                   Es el viaje de trabajo: lo que gastaste y lo que te
//                   reintegraron, y si terminaste poniendo plata o no.
//
// **Qué llega acá lo decide `core/agrupamientos.js`**, en cascada: si todos sus
// gastos son del rubro `gastos fijos` su grupo vive en la pantalla de gastos
// fijos; si alguno es del rubro `viajes`, en la de viajes; si no, acá. Así cada
// etiqueta tiene **un** grupo propio, en **una** pantalla.
//
// Que una etiqueta de acá se nombre también en la tarjeta de gastos fijos no es
// una contradicción: allá se suma solo la parte del rubro `gastos fijos` y acá
// la etiqueta entera, y las dos pantallas lo dicen. Ver ADR-041.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { otrosGrupos } from '../../core/agrupamientos.js';
import { formatearEuros, formatearFecha } from '../../core/formato.js';
import { monedaBaseDe } from '../../core/monedas.js';

/** Cuántos movimientos, en cuántos meses y entre qué fechas. */
export function dibujarAlcance(grupo) {
  // "gastos" solo cuando son todos gastos: en un grupo mixto o de ingresos,
  // llamarle gasto a un cobro es decir lo contrario de lo que pasó.
  const nombre = grupo.clase === 'gasto' ? 'gasto' : 'movimiento';
  const cuantos = grupo.cuantos === 1 ? `1 ${nombre}` : `${grupo.cuantos} ${nombre}s`;
  const cuando = grupo.desde === grupo.hasta
    ? formatearFecha(grupo.desde)
    : `${formatearFecha(grupo.desde)} → ${formatearFecha(grupo.hasta)}`;

  // En cuántos meses distintos aparece: es lo que separa una mudanza —una vez,
  // muchos gastos— de algo que se repite todos los meses sin ser del rubro
  // `gastos fijos`, como el gimnasio.
  const meses = grupo.meses === 1 ? 'en un mes' : `en ${grupo.meses} meses`;

  return `${cuantos} · ${cuando} · ${meses}`;
}

export function dibujarGrupo(grupo, base) {
  // Qué número va grande, a la derecha del nombre: el que contesta la pregunta
  // de ese grupo. En el mixto es el saldo, y lleva su signo y su color — que
  // terminaras poniendo plata o cobrándola es justo lo que se viene a mirar.
  const destacado = grupo.clase === 'ingreso' ? grupo.ingresos
    : grupo.clase === 'gasto' ? grupo.total
      : grupo.saldo;
  const color = grupo.clase === 'ingreso' || (grupo.clase === 'mixto' && grupo.saldo >= 0)
    ? 'ingreso' : 'gasto';

  // El desglose del mixto: los dos lados, porque el saldo solo no dice de qué
  // tamaño fue el movimiento de plata. Y la media mensual del de ingresos.
  const detalle = grupo.clase === 'mixto'
    ? `<span>${escapar(formatearEuros(grupo.ingresos, base))} entraron ·
       ${escapar(formatearEuros(grupo.total, base))} salieron</span>`
    : grupo.clase === 'ingreso' && grupo.meses > 1
      ? `<span>${escapar(formatearEuros(grupo.mediaMensual, base))} por mes</span>`
      : '';

  return `
    <li class="fila-rubro">
      <button type="button" class="fila-toque" data-accion="ver-comentario"
              data-comentario="${escapar(grupo.etiqueta)}">
        <span class="rubro-cabeza">
          <span class="nombre">${escapar(grupo.etiqueta)}</span>
          <span class="importe ${grupo.clase === 'gasto' ? '' : color}">
            ${escapar(formatearEuros(destacado, base))}
          </span>
        </span>
      </button>
      <div class="rubro-pie suave">
        <span>${escapar(dibujarAlcance(grupo))}</span>
        ${detalle}
      </div>
    </li>
  `;
}

export function dibujarGrupos(vista) {
  const base = monedaBaseDe(vista.estado);
  const grupos = otrosGrupos(vista.estado);

  if (grupos.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Otros grupos</h2>
        <p class="suave">Todavía no hay ninguno. Acá aparecen las etiquetas que
        no son ni un gasto fijo ni un viaje: una mudanza, unos regalos, el
        arreglo del auto, un trabajo suelto. Poniéndole la misma etiqueta a
        varios movimientos, se juntan solos.</p>
      </section>
    `;
  }

  return `
    <section class="tarjeta">
      <h2>Otros grupos</h2>
      <p class="suave nota">Las etiquetas que no son ni un gasto fijo ni un viaje
      — de gastos, de ingresos, o de los dos. El total incluye <strong>todos</strong>
      los rubros de esa etiqueta, así que puede ser mayor que lo que la misma
      etiqueta suma en la tarjeta de gastos fijos, que mira un rubro solo. Tocá
      uno para ver sus movimientos.</p>
      <p class="suave nota">Un movimiento con <strong>varias etiquetas suma en
      todos sus grupos</strong>, así que estos totales no se pueden sumar entre
      sí: darían de más.</p>
      <ul class="rubros">${grupos.map((g) => dibujarGrupo(g, base)).join('')}</ul>
    </section>
  `;
}
