// Otros grupos de gastos — CU-18, T-946.
//
// La etiqueta sirve para agrupar cualquier cosa, no solo viajes y gastos fijos:
// una mudanza, unos regalos, el arreglo del auto. Hasta ahora esos grupos no
// aparecían en ninguna pantalla — existían en los datos y no se podían ver.
//
// **Qué llega acá lo decide `core/agrupamientos.js`**, en cascada: si todos sus
// gastos son del rubro `gastos fijos` va a la pantalla de gastos fijos; si
// alguno es del rubro `viajes` va a la de viajes; si no, viene acá. Así ninguna
// etiqueta aparece en dos listas con dos totales distintos.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { otrosGrupos } from '../../core/agrupamientos.js';
import { formatearEuros, formatearFecha } from '../../core/formato.js';

/** Cuántos gastos, en cuántos meses y entre qué fechas. */
export function dibujarAlcance(grupo) {
  const cuantos = grupo.cuantos === 1 ? '1 gasto' : `${grupo.cuantos} gastos`;
  const cuando = grupo.desde === grupo.hasta
    ? formatearFecha(grupo.desde)
    : `${formatearFecha(grupo.desde)} → ${formatearFecha(grupo.hasta)}`;

  // En cuántos meses distintos aparece: es lo que separa una mudanza —una vez,
  // muchos gastos— de algo que se repite todos los meses sin ser del rubro
  // `gastos fijos`, como el gimnasio.
  const meses = grupo.meses === 1 ? 'en un mes' : `en ${grupo.meses} meses`;

  return `${cuantos} · ${cuando} · ${meses}`;
}

export function dibujarGrupo(grupo) {
  return `
    <li class="fila-rubro">
      <button type="button" class="fila-toque" data-accion="ver-comentario"
              data-comentario="${escapar(grupo.etiqueta)}">
        <span class="rubro-cabeza">
          <span class="nombre">${escapar(grupo.etiqueta)}</span>
          <span class="importe">${escapar(formatearEuros(grupo.total))}</span>
        </span>
      </button>
      <div class="rubro-pie suave">
        <span>${escapar(dibujarAlcance(grupo))}</span>
      </div>
    </li>
  `;
}

export function dibujarGrupos(vista) {
  const grupos = otrosGrupos(vista.estado);

  if (grupos.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Otros grupos de gastos</h2>
        <p class="suave">Todavía no hay ninguno. Acá aparecen las etiquetas que
        no son ni un gasto fijo ni un viaje: una mudanza, unos regalos, el
        arreglo del auto. Poniéndole la misma etiqueta a varios gastos, se juntan
        solos.</p>
      </section>
    `;
  }

  return `
    <section class="tarjeta">
      <h2>Otros grupos de gastos</h2>
      <p class="suave nota">Las etiquetas que no son ni un gasto fijo ni un viaje.
      El total incluye <strong>todos</strong> los rubros de esa etiqueta. Tocá uno
      para ver sus gastos.</p>
      <ul class="rubros">${grupos.map(dibujarGrupo).join('')}</ul>
    </section>
  `;
}
