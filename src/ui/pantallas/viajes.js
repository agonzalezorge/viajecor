// Gasto por viaje — CU-11, T-023. Reemplaza el bloque `GASTOS POR VIAJE` de la
// planilla, que es de donde salió el nombre "Viaje Coruña".
//
// ── Lo que esta pantalla no hace, y por qué ─────────────────────────────────
//
// **No deduce la duración de los movimientos.** Se escriben **la fecha de inicio
// y la de fin**, y los días salen de restarlas (T-941). Un viaje puede empezar
// antes del primer gasto registrado o terminar después del último, y deducirlo
// daría un gasto por día más alto de lo real sin avisar. Mientras las fechas no
// estén, **no hay gasto por día**: no se muestra un número aproximado, se
// muestra el pedido de escribirlas.
//
// **No tiene una lista de viajes propia.** Un viaje es una etiqueta con al menos
// un gasto del rubro `viajes` (ver `core/viajes.js`). Se escribe a mano al
// cargar, y se corrige en Datos → Etiquetas y detalles, donde renombrar une dos
// escrituras del mismo viaje.
//
// Igual que el resto de la interfaz (ADR-022), las funciones de dibujo son puras.

import { escapar } from '../app.js';
import { dibujarError } from './movimiento.js';
import { viajes, fijarFechasDeViaje, duracionEnDias } from '../../core/viajes.js';
import { formatearEuros, formatearFecha } from '../../core/formato.js';

/** Un rango de fechas, o una sola si son la misma. */
export function dibujarRango(desde, hasta) {
  if (desde === hasta) return formatearFecha(desde);
  return `${formatearFecha(desde)} → ${formatearFecha(hasta)}`;
}

/** Entre qué fechas se GASTÓ. Es contexto para escribir las del viaje, no el dato. */
export function dibujarFechas(viaje) {
  return dibujarRango(viaje.desde, viaje.hasta);
}

/**
 * Un viaje.
 *
 * **El número grande es el total**, que es lo que la planilla contestaba. El
 * gasto por día va debajo y **solo si los días están escritos**: sin ellos, en
 * su lugar va el botón para escribirlos, que es la acción que falta.
 */
export function dibujarViaje(viaje) {
  const cuantos = viaje.cuantos === 1 ? '1 gasto' : `${viaje.cuantos} gastos`;

  const porDia = viaje.fechas === null
    ? `<button type="button" class="secundario chico" data-accion="fechas-viaje"
               data-clave="${escapar(viaje.clave)}">¿Cuándo fue?</button>`
    : `<span><strong>${escapar(formatearEuros(viaje.porDia))}</strong> por día
         en ${viaje.dias} ${viaje.dias === 1 ? 'día' : 'días'}
         <button type="button" class="enlace" data-accion="fechas-viaje"
                 data-clave="${escapar(viaje.clave)}">${escapar(dibujarRango(viaje.fechas.desde, viaje.fechas.hasta))}</button></span>`;

  const aviso = viaje.incompleto
    ? `<p class="suave">A este viaje le falta un tipo de cambio: el total está incompleto.</p>`
    : '';

  return `
    <li class="fila-rubro">
      <button type="button" class="fila-toque" data-accion="ver-comentario"
              data-comentario="${escapar(viaje.comentario)}">
        <span class="rubro-cabeza">
          <span class="nombre">${escapar(viaje.comentario)}</span>
          <span class="importe">${escapar(formatearEuros(viaje.total))}</span>
        </span>
      </button>
      <div class="rubro-pie suave">
        <span>${escapar(cuantos)} · ${escapar(dibujarFechas(viaje))}</span>
      </div>
      <div class="rubro-pie suave">${porDia}</div>
      ${aviso}
    </li>
  `;
}

/**
 * El formulario para escribir cuándo fue el viaje.
 *
 * **Los días no se piden: se calculan y se muestran mientras se escribe.** Es la
 * diferencia con la versión anterior, que pedía el número de días: una fecha es
 * algo que uno recuerda —"salí el 3 y volví el 12"— y un número de días es una
 * cuenta que hay que hacer, y hacerla mal es fácil.
 */
export function dibujarFechasDeViaje(vista) {
  const clave = vista.viajeEditado;
  const viaje = viajes(vista.estado).find((v) => v.clave === clave);
  if (viaje === undefined) return '';

  const borrador = vista.borradorFechas ?? {};
  const desde = borrador.desde ?? viaje.fechas?.desde ?? '';
  const hasta = borrador.hasta ?? viaje.fechas?.hasta ?? '';

  return `
    <form class="tarjeta" data-formulario="fechas-viaje">
      <h2>¿Cuándo fue ${escapar(viaje.comentario)}?</h2>
      <p class="suave">Se gastó entre el ${escapar(dibujarFechas(viaje))}, pero el
      viaje puede haber sido más largo: podés haber salido antes del primer gasto
      que anotaste, o vuelto después del último. Por eso se escriben las fechas y
      no se deducen de los gastos.</p>

      <label class="campo">
        <span>Salí el</span>
        <input name="desde" type="date" data-accion-entrada="fechas-viaje"
               value="${escapar(desde)}">
      </label>

      <label class="campo">
        <span>Volví el</span>
        <input name="hasta" type="date" data-accion-entrada="fechas-viaje"
               value="${escapar(hasta)}">
      </label>

      <p class="confirmacion" data-duracion role="status">${dibujarDuracion(desde, hasta)}</p>

      ${dibujarError(vista.error)}

      <input type="hidden" name="clave" value="${escapar(clave)}">
      <button type="submit" class="principal" data-accion="guardar-fechas-viaje">Guardar</button>
      <button type="button" class="secundario" data-accion="borrar-fechas-viaje"
              data-clave="${escapar(clave)}">No me acuerdo cuándo fue</button>
      <button type="button" class="secundario" data-accion="cancelar-fechas-viaje">Ahora no</button>
    </form>
  `;
}

/**
 * Cuántos días dan las dos fechas escritas, para mostrarlo mientras se escribe.
 *
 * Es lo que convierte dos fechas en el dato que interesa sin que el usuario
 * tenga que confiar: ve la cuenta hecha antes de guardar.
 */
export function dibujarDuracion(desde, hasta) {
  if (!desde || !hasta) return 'Escribí las dos fechas y te digo cuántos días son.';
  if (hasta < desde) return 'El viaje no puede terminar antes de empezar.';

  const dias = duracionEnDias(desde, hasta);
  return `Son ${dias} ${dias === 1 ? 'día' : 'días'}, contando el primero y el último.`;
}

export function dibujarViajes(vista) {
  if (vista.viajeEditado) return dibujarFechasDeViaje(vista);

  const lista = viajes(vista.estado);
  if (lista.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Gasto por viaje</h2>
        <p class="suave">Todavía no hay ninguno. Un viaje es una etiqueta con al
        menos un gasto del rubro <strong>viajes</strong>: cargá el pasaje o el
        hotel con el rubro «viajes» y el nombre del viaje en la etiqueta, y todo
        lo que lleve esa etiqueta —comidas, transporte, supermercado— se suma
        acá.</p>
      </section>
    `;
  }

  return `
    ${dibujarError(vista.error)}
    <section class="tarjeta">
      <h2>Gasto por viaje</h2>
      <p class="suave nota">El total incluye <strong>todos</strong> los rubros de
      ese viaje, no solo los del rubro «viajes». Tocá uno para ver sus gastos.</p>
      <ul class="rubros">${lista.map(dibujarViaje).join('')}</ul>
    </section>
  `;
}


// ── Los cambios de estado ────────────────────────────────────────────────────

/**
 * Toma lo escrito y lo guarda, o devuelve el error para mostrarlo.
 *
 * **La regla de qué es un número de días válido está en `core/viajes.js` y no
 * acá.** La primera versión la repetía —una expresión regular de dígitos— y una
 * mutación la delató: sacarla no ponía ni un test en rojo, porque el núcleo ya
 * rechazaba todo lo que ella rechazaba. Dos copias de la misma regla son dos
 * reglas que tarde o temprano dicen cosas distintas, y la que se queda atrás es
 * siempre la de más afuera.
 *
 * `Number('')` da 0 y `Number('7 días')` da NaN: los dos caen en el "entero de 1
 * para arriba" del núcleo.
 */
export function intentarFijarFechas(estado, clave, desde, hasta) {
  try {
    return { estado: fijarFechasDeViaje(estado, clave, desde, hasta) };
  } catch (error) {
    return { error: error.message };
  }
}

export function intentarBorrarFechas(estado, clave) {
  try {
    return { estado: fijarFechasDeViaje(estado, clave, null, null) };
  } catch (error) {
    return { error: error.message };
  }
}
