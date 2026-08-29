// Ver, renombrar y borrar las etiquetas ya escritas — CU-16, T-025.
//
// Pedida por el usuario (2026-08-28): quería poder editar y borrar "las
// categorías" que ya usó. La respuesta honesta es que **no son categorías**: son
// texto libre escrito en cada movimiento (ver `core/etiquetas.js`). Así que esta
// pantalla no edita un catálogo, edita **todos los movimientos que comparten un
// texto**, y eso obliga a dos cosas:
//
//   1. **Decir cuántos toca antes de tocarlos.** Es la misma regla del cambio de
//      decimales (ADR-033) y de la corrección de un tipo de cambio (ADR-019).
//   2. **Decir que borrar la etiqueta NO borra los movimientos.** "Borrar Luz" y
//      "borrar los gastos de luz" se confunden con una lectura rápida, y uno de
//      los dos no se puede deshacer.
//
// Igual que el resto de la interfaz (ADR-022), las funciones de dibujo son puras
// y las de cambio devuelven un estado nuevo sin guardarlo.

import { escapar } from '../app.js';
import { dibujarError } from './movimiento.js';
import {
  etiquetasUsadas, efectoDeRenombrar, renombrarEtiqueta, borrarEtiqueta,
} from '../../core/etiquetas.js';

const TITULOS = {
  comentario: 'Comentarios',
  detalle: 'Detalles',
};

const EXPLICACIONES = {
  comentario: `El comentario es lo que <strong>agrupa</strong>: de él salen los
    totales por viaje y por gasto fijo. Dos escrituras distintas son dos totales
    distintos, así que renombrar una con el nombre de la otra las une.`,
  detalle: `El detalle es una nota para acordarte: <strong>no agrupa nada</strong>.
    Limpiarlo es orden, no arreglar un número.`,
};

/** Cuántos movimientos usan una etiqueta, en palabras. */
export function enCuantos(cuantos) {
  return cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`;
}

/**
 * Una etiqueta de la lista.
 *
 * Si tiene **más de una escritura**, se dice: es exactamente el dato que delata
 * un typo, y es lo que hay que ir a arreglar. Sin eso, `Barcelona26` y
 * `barcelona 26` se ven como dos filas cualesquiera.
 */
export function dibujarEtiqueta(campo, etiqueta) {
  const aviso = etiqueta.escrituras > 1
    ? `<span class="suave">· ${etiqueta.escrituras} formas de escribirlo</span>`
    : '';

  return `
    <li class="fila-rubro">
      <div class="rubro-cabeza">
        <span class="nombre">${escapar(etiqueta.texto)}</span>
        <span class="importe">${escapar(enCuantos(etiqueta.cuantos))}</span>
      </div>
      <div class="rubro-pie suave">
        <span>${aviso}</span>
        <span class="acciones-etiqueta">
          ${campo === 'comentario' ? `
          <!-- Solo el comentario ofrece "Ver": la lista se puede filtrar por
               comentario, no por detalle. Un botón escondido con el atributo
               hidden sigue estando en la página; el que no hace falta
               directamente no se dibuja. -->
          <button type="button" class="secundario chico" data-accion="ver-comentario"
                  data-comentario="${escapar(etiqueta.texto)}">Ver</button>` : ''}
          <button type="button" class="secundario chico" data-accion="renombrar-etiqueta"
                  data-campo="${escapar(campo)}" data-clave="${escapar(etiqueta.clave)}">Renombrar</button>
          <button type="button" class="secundario chico" data-accion="borrar-etiqueta"
                  data-campo="${escapar(campo)}" data-clave="${escapar(etiqueta.clave)}">Borrar</button>
        </span>
      </div>
    </li>
  `;
}

/** El aviso de qué va a pasar al renombrar. */
export function dibujarAvisoRenombrar(efecto) {
  if (efecto === null) return '';

  const cuantos = enCuantos(efecto.afectados);
  if (efecto.seUneCon === null) {
    return `<p class="confirmacion" role="status">Se reescribe en ${escapar(cuantos)}.</p>`;
  }

  return `
    <p class="confirmacion importante" role="status">
      <strong>Se van a unir.</strong> Ya existe
      <strong>${escapar(efecto.seUneCon.texto)}</strong> con
      ${escapar(enCuantos(efecto.seUneCon.cuantos))}: al renombrar,
      los ${escapar(String(efecto.quedan))} quedan en un solo grupo y sus totales
      pasan a sumar juntos.
    </p>
  `;
}

/** El paso aparte para renombrar. */
export function dibujarRenombrar(vista) {
  const { campo, clave } = vista.etiquetaEditada;
  const etiqueta = etiquetasUsadas(vista.estado.movimientos, campo).find((e) => e.clave === clave);
  if (etiqueta === undefined) return '';

  const escrito = vista.borradorEtiqueta ?? etiqueta.texto;
  const efecto = efectoDeRenombrar(vista.estado.movimientos, campo, clave, escrito);

  return `
    <form class="tarjeta" data-formulario="etiqueta">
      <h2>Renombrar «${escapar(etiqueta.texto)}»</h2>
      <p class="suave">Está en ${escapar(enCuantos(etiqueta.cuantos))}.</p>

      <label class="campo">
        <span>Nuevo nombre</span>
        <input name="texto" type="text" autocomplete="off"
               data-accion-entrada="renombrar" value="${escapar(escrito)}">
      </label>

      <div data-aviso-etiqueta>${dibujarAvisoRenombrar(efecto)}</div>

      <input type="hidden" name="campo" value="${escapar(campo)}">
      <input type="hidden" name="clave" value="${escapar(clave)}">
      <button type="submit" class="principal" data-accion="guardar-etiqueta">Renombrar</button>
      <button type="button" class="secundario" data-accion="cancelar-etiqueta">Ahora no</button>
    </form>
  `;
}

/**
 * La confirmación antes de borrar.
 *
 * Dice **con todas las letras** que los movimientos no se tocan. Es la frase más
 * importante de la pantalla: sin ella, "borrar Luz" se lee como "borrar los
 * gastos de luz", y esa confusión no se puede deshacer.
 */
export function dibujarBorrarEtiqueta(vista) {
  const { campo, clave } = vista.etiquetaBorrando;
  const etiqueta = etiquetasUsadas(vista.estado.movimientos, campo).find((e) => e.clave === clave);
  if (etiqueta === undefined) return '';

  return `
    <section class="tarjeta aviso importante" role="alert">
      <h2>¿Sacar «${escapar(etiqueta.texto)}»?</h2>
      <p>Se le saca el ${escapar(campo)} a ${escapar(enCuantos(etiqueta.cuantos))}.</p>
      <p><strong>Los movimientos no se borran</strong>: siguen ahí, con su fecha,
      su rubro y su importe. Lo único que se va es la etiqueta.</p>
      ${campo === 'comentario' ? `<p class="suave">Van a dejar de contarse en
        cualquier total agrupado por ese comentario.</p>` : ''}
      <button type="button" class="principal" data-accion="confirmar-borrar-etiqueta"
              data-campo="${escapar(campo)}" data-clave="${escapar(clave)}">
        Sí, sacarla
      </button>
      <button type="button" class="secundario" data-accion="cancelar-borrar-etiqueta">No</button>
    </section>
  `;
}

function dibujarSeccion(estado, campo) {
  const etiquetas = etiquetasUsadas(estado.movimientos, campo);
  if (etiquetas.length === 0) {
    return `
      <section class="tarjeta">
        <h2>${TITULOS[campo]}</h2>
        <p class="suave">Todavía no escribiste ninguno.</p>
      </section>
    `;
  }

  return `
    <section class="tarjeta">
      <h2>${TITULOS[campo]}</h2>
      <p class="suave nota">${EXPLICACIONES[campo]}</p>
      <ul class="rubros">${etiquetas.map((e) => dibujarEtiqueta(campo, e)).join('')}</ul>
    </section>
  `;
}

export function dibujarEtiquetas(vista) {
  const estado = vista.estado;

  // Un paso a la vez: renombrar y borrar no se muestran juntos, y ninguno de los
  // dos convive con la lista de acciones. Dos cosas delicadas a la vez son dos
  // decisiones simultáneas.
  if (vista.etiquetaBorrando) return dibujarBorrarEtiqueta(vista);
  if (vista.etiquetaEditada) return dibujarRenombrar(vista);

  const confirmacion = vista.avisoEtiqueta
    ? `<p class="confirmacion" role="status">${escapar(vista.avisoEtiqueta)}</p>`
    : '';

  return `
    ${dibujarError(vista.error)}
    ${confirmacion}
    ${dibujarSeccion(estado, 'comentario')}
    ${dibujarSeccion(estado, 'detalle')}
  `;
}


// ── Los cambios de estado ────────────────────────────────────────────────────

function intentarEtiqueta(hacer) {
  try {
    return { estado: hacer() };
  } catch (error) {
    return { error: error.message };
  }
}

export function intentarRenombrar(estado, campo, clave, texto) {
  return intentarEtiqueta(() => ({
    ...estado,
    movimientos: renombrarEtiqueta(estado.movimientos, campo, clave, texto),
  }));
}

export function intentarBorrarEtiqueta(estado, campo, clave) {
  return intentarEtiqueta(() => ({
    ...estado,
    movimientos: borrarEtiqueta(estado.movimientos, campo, clave),
  }));
}
