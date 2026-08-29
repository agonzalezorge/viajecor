// El promedio de los gastos fijos — CU-12, T-022. Reemplaza el bloque
// `GASTOS FIJOS PROMEDIO` del Excel: responde "¿cuánto me sale la luz por mes?".
//
// ── Por qué mira todo el historial y no un mes ──────────────────────────────
//
// Un promedio sobre un mes es el gasto de ese mes con otro nombre. La pregunta
// que esto contesta solo existe con varios meses adentro, así que la pantalla no
// tiene selector de mes: dice entre qué meses miró.
//
// ── Por qué muestra cuántos pagos y entre qué meses ─────────────────────────
//
// El Excel muestra el promedio por pago. Solo, se lee como si fuera mensual, y
// no siempre lo es: ocho pagos en once meses no es una factura mensual. Con
// "8 pagos · oct 25 → ago 26" al lado, el número dice lo que de verdad dice.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras que devuelven
// texto HTML.

import { escapar } from '../app.js';
import { gastosFijos } from '../../core/calculos.js';
import { formatearEuros, formatearMesCorto } from '../../core/formato.js';

/** Cuántas veces se pagó y entre qué meses. */
export function dibujarCadencia(grupo) {
  const pagos = grupo.cuantos === 1 ? '1 pago' : `${grupo.cuantos} pagos`;
  const meses = grupo.desde === grupo.hasta
    ? formatearMesCorto(grupo.desde)
    : `${formatearMesCorto(grupo.desde)} → ${formatearMesCorto(grupo.hasta)}`;

  return `${pagos} · ${meses}`;
}

/**
 * Un gasto fijo: el nombre y el promedio grandes, el total y la cadencia chicos.
 *
 * **El promedio es el número destacado, no el total.** La pregunta es "¿cuánto
 * me sale?", no "¿cuánto llevo gastado?". El total está al lado porque es lo que
 * permite comprobar el promedio a mano, pero no es lo que se viene a buscar.
 */
export function dibujarGastoFijo(grupo) {
  return `
    <li class="fila-rubro">
      <!-- Lleva a los pagos que componen ese promedio, en TODOS los meses: esta
           tarjeta habla de todo el historial, así que mostrar solo el mes en
           curso sería una parte del número que se acaba de tocar (T-026). -->
      <button type="button" class="fila-toque" data-accion="ver-comentario"
              data-comentario="${escapar(grupo.comentario)}">
        <span class="rubro-cabeza">
          <span class="nombre">${escapar(grupo.comentario)}</span>
          <span class="importe">${escapar(formatearEuros(grupo.promedio))}</span>
        </span>
      </button>
      <div class="rubro-pie suave">
        <span>${escapar(dibujarCadencia(grupo))}</span>
        <span>${escapar(formatearEuros(grupo.total))} en total</span>
      </div>
    </li>
  `;
}

/**
 * Los pagos de gastos fijos que no tienen comentario.
 *
 * Sin comentario no hay nada que promediar: no se sabe si son tres facturas de
 * luz o tres cosas distintas. Pero **callarlos haría que la lista no cerrara con
 * el total del rubro** y el usuario no tendría cómo darse cuenta. Se dicen, y se
 * dice qué hacer para que entren.
 */
export function dibujarSinComentario(sinComentario) {
  if (sinComentario.cuantos === 0) return '';

  const cuantos = sinComentario.cuantos === 1
    ? 'Un pago de gastos fijos no está'
    : `${sinComentario.cuantos} pagos de gastos fijos no están`;

  return `
    <p class="suave nota">
      ${cuantos} en esta lista, por ${escapar(formatearEuros(sinComentario.total))}:
      no tienen etiqueta, y la etiqueta es lo que dice cuál gasto fijo son.
      Poniéndoles una —"Luz", "Gas"— entran solos.
    </p>
  `;
}

export function dibujarGastosFijos(estado) {
  const { grupos, sinComentario, total } = gastosFijos(estado);
  if (grupos.length === 0 && sinComentario.cuantos === 0) return '';

  const cuerpo = grupos.map(dibujarGastoFijo).join('');

  const vacio = grupos.length > 0 ? '' : `
    <p class="suave">Ninguno de tus gastos fijos tiene etiqueta todavía, así que
    no hay nada que agrupar.</p>`;

  return `
    <section class="tarjeta">
      <h2>Cuánto sale cada gasto fijo</h2>
      <p class="suave nota">El promedio por pago de cada uno. En total llevás
      ${escapar(formatearEuros(total))} en gastos fijos.</p>
      ${vacio}
      <ul class="rubros">${cuerpo}</ul>
      ${dibujarSinComentario(sinComentario)}
    </section>
  `;
}
