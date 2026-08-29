// Gasto por viaje — CU-11, T-023. Reemplaza el bloque `GASTOS POR VIAJE` de la
// planilla, que es de donde salió el nombre "Viaje Coruña".
//
// ── Lo que esta pantalla no hace, y por qué ─────────────────────────────────
//
// **No deduce los días.** El usuario decidió (2026-08-28) que se escriben. Un
// viaje puede empezar antes del primer gasto registrado o terminar después del
// último, y deducirlo daría un gasto por día más bajo de lo real sin avisar.
// Por eso, mientras los días no estén escritos, **no hay gasto por día**: no se
// muestra un número aproximado, se muestra el pedido de escribirlos.
//
// **No tiene una lista de viajes propia.** Un viaje es un comentario con al
// menos un gasto del rubro `viajes` (ver `core/viajes.js`). Se escribe a mano al
// cargar, y se corrige en Datos → Comentarios y detalles, donde renombrar une
// dos escrituras del mismo viaje.
//
// Igual que el resto de la interfaz (ADR-022), las funciones de dibujo son puras.

import { escapar } from '../app.js';
import { dibujarError } from './movimiento.js';
import { viajes, fijarDiasDeViaje } from '../../core/viajes.js';
import { formatearEuros, formatearFecha } from '../../core/formato.js';

/** Entre qué fechas se gastó. Es contexto para escribir los días, no el dato. */
export function dibujarFechas(viaje) {
  if (viaje.desde === viaje.hasta) return formatearFecha(viaje.desde);
  return `${formatearFecha(viaje.desde)} → ${formatearFecha(viaje.hasta)}`;
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

  const porDia = viaje.dias === null
    ? `<button type="button" class="secundario chico" data-accion="dias-viaje"
               data-clave="${escapar(viaje.clave)}">¿Cuántos días fue?</button>`
    : `<span><strong>${escapar(formatearEuros(viaje.porDia))}</strong> por día
         en ${viaje.dias} ${viaje.dias === 1 ? 'día' : 'días'}
         <button type="button" class="enlace" data-accion="dias-viaje"
                 data-clave="${escapar(viaje.clave)}">cambiar</button></span>`;

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

/** El formulario para escribir los días. */
export function dibujarDiasDeViaje(vista) {
  const clave = vista.viajeEditado;
  const viaje = viajes(vista.estado).find((v) => v.clave === clave);
  if (viaje === undefined) return '';

  return `
    <form class="tarjeta" data-formulario="dias-viaje">
      <h2>¿Cuántos días fue ${escapar(viaje.comentario)}?</h2>
      <p class="suave">Se gastó entre el ${escapar(dibujarFechas(viaje))}. Los días
      del viaje pueden ser más: podés haber salido antes del primer gasto que
      anotaste, o vuelto después del último. Por eso se escriben y no se deducen.</p>

      <label class="campo">
        <span>Días</span>
        <input name="dias" type="text" inputmode="numeric" autocomplete="off"
               enterkeyhint="done" placeholder="7"
               value="${escapar(vista.borradorDias ?? (viaje.dias ?? ''))}">
      </label>

      ${dibujarError(vista.error)}

      <input type="hidden" name="clave" value="${escapar(clave)}">
      <button type="submit" class="principal" data-accion="guardar-dias-viaje">Guardar</button>
      <button type="button" class="secundario" data-accion="borrar-dias-viaje"
              data-clave="${escapar(clave)}">No sé cuántos días fue</button>
      <button type="button" class="secundario" data-accion="cancelar-dias-viaje">Ahora no</button>
    </form>
  `;
}

export function dibujarViajes(vista) {
  if (vista.viajeEditado) return dibujarDiasDeViaje(vista);

  const lista = viajes(vista.estado);
  if (lista.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Gasto por viaje</h2>
        <p class="suave">Todavía no hay ninguno. Un viaje es un comentario con al
        menos un gasto del rubro <strong>viajes</strong>: cargá el pasaje o el
        hotel con el rubro «viajes» y el nombre del viaje en el comentario, y
        todo lo que lleve ese comentario —comidas, transporte, supermercado— se
        suma acá.</p>
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
export function intentarFijarDias(estado, clave, dias) {
  try {
    return { estado: fijarDiasDeViaje(estado, clave, Number(String(dias ?? '').trim())) };
  } catch (error) {
    return { error: error.message };
  }
}

export function intentarBorrarDias(estado, clave) {
  try {
    return { estado: fijarDiasDeViaje(estado, clave, null) };
  } catch (error) {
    return { error: error.message };
  }
}
