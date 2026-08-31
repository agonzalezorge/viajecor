// La pantalla de rubros — T-048, CU-19.
//
// ── Lo que esta pantalla tiene que dejar clarísimo ───────────────────────────
//
// Que **acá se mueve plata**. Renombrar un rubro reescribe el rubro de todos sus
// movimientos; unir dos los pasa de uno al otro. No es editar una lista: es
// tocar el historial. Por eso cada rubro muestra **cuántos movimientos usa** y
// cada acción dice qué va a pasar antes de hacerla.
//
// El tope de ocho tampoco es un capricho y se explica donde se choca con él: la
// paleta tiene ocho colores que pasaron el validador de daltonismo, y un noveno
// tono generado sería indistinguible de alguno (ADR-029).
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { catalogoDe, usoDeRubros, rubrosHuerfanos, TOPE_DE_RUBROS } from '../../core/rubros.js';
import { claseDeRubro } from '../colores.js';
import { formatearRubro } from '../../core/formato.js';
import { TIPO_GASTO, TIPO_INGRESO } from '../../core/modelo.js';

const NOMBRE_DEL_TIPO = { [TIPO_GASTO]: 'gasto', [TIPO_INGRESO]: 'ingreso' };

/** Cuántos movimientos usa un rubro, escrito para leer. */
export function dibujarUso(cuantos) {
  if (cuantos === 0) return 'sin movimientos';
  return cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`;
}

/** Una fila de rubro, con su color, su uso y sus acciones. */
export function dibujarRubro(rubro, cuantos, tipo, catalogo, vista = {}) {
  const editando = vista.rubroEditado?.tipo === tipo && vista.rubroEditado?.rubro === rubro;
  const uniendo = vista.rubroUnido?.tipo === tipo && vista.rubroUnido?.rubro === rubro;
  const otros = catalogo.filter((r) => r !== rubro);

  return `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">
          <span class="punto-rubro ${claseDeRubro(tipo, rubro, vista.estado?.rubros)}" aria-hidden="true"></span>
          ${escapar(formatearRubro(rubro))}
        </span>
        <span class="suave">${escapar(dibujarUso(cuantos))}</span>
      </span>

      ${editando ? `
      <form class="formulario-linea" data-formulario="rubro" novalidate>
        <input type="hidden" name="tipo" value="${escapar(tipo)}">
        <input type="hidden" name="viejo" value="${escapar(rubro)}">
        <input name="nombre" type="text" autocomplete="off" value="${escapar(formatearRubro(rubro))}"
               aria-label="Nombre del rubro">
        <p class="suave nota">Si le ponés el nombre de otro rubro que ya existe,
        los dos se unen en uno.</p>
        <div class="botones">
          <button type="submit" class="principal chico" data-accion="guardar-rubro">Guardar</button>
          <button type="button" class="secundario chico" data-accion="cancelar-rubro">Cancelar</button>
        </div>
      </form>` : ''}

      ${uniendo ? `
      <form class="formulario-linea" data-formulario="unir-rubro" novalidate>
        <input type="hidden" name="tipo" value="${escapar(tipo)}">
        <input type="hidden" name="desde" value="${escapar(rubro)}">
        <label class="campo">
          <span>Pasar sus ${escapar(dibujarUso(cuantos))} a…</span>
          <select name="hasta">${otros.map((r) => `
            <option value="${escapar(r)}">${escapar(formatearRubro(r))}</option>`).join('')}</select>
        </label>
        <p class="suave nota"><strong>${escapar(formatearRubro(rubro))}</strong> deja de
        existir y sus movimientos pasan al otro rubro. Los movimientos no se borran.</p>
        <div class="botones">
          <button type="submit" class="peligro chico" data-accion="unir-rubro">Unir</button>
          <button type="button" class="secundario chico" data-accion="cancelar-rubro">Cancelar</button>
        </div>
      </form>` : ''}

      ${editando || uniendo ? '' : `
      <div class="movimiento-acciones">
        <button type="button" class="secundario chico" data-accion="editar-rubro"
                data-tipo="${escapar(tipo)}" data-rubro="${escapar(rubro)}">Renombrar</button>
        ${otros.length > 0 ? `
        <button type="button" class="secundario chico" data-accion="unir-desde"
                data-tipo="${escapar(tipo)}" data-rubro="${escapar(rubro)}">Unir con otro</button>` : ''}
        ${cuantos === 0 && catalogo.length > 1 ? `
        <button type="button" class="secundario chico" data-accion="borrar-rubro"
                data-tipo="${escapar(tipo)}" data-rubro="${escapar(rubro)}">Sacar</button>` : ''}
      </div>`}
    </li>
  `;
}

/** El bloque de un tipo: sus rubros, y el formulario para agregar uno. */
export function dibujarRubrosDe(vista, tipo) {
  const estado = vista.estado ?? {};
  const catalogo = catalogoDe(estado)[tipo === TIPO_GASTO ? 'gasto' : 'ingreso'];
  const uso = usoDeRubros(estado, tipo);
  const lleno = catalogo.length >= TOPE_DE_RUBROS;
  const cual = NOMBRE_DEL_TIPO[tipo];

  return `
    <section class="tarjeta">
      <h2>Rubros de ${escapar(cual)}</h2>
      <p class="suave nota">Renombrar un rubro <strong>reescribe también sus
      movimientos</strong>, y unir dos los pasa de uno al otro. Nada se borra:
      los movimientos se mudan.</p>

      <ul class="rubros">${catalogo
        .map((r) => dibujarRubro(r, uso.get(r) ?? 0, tipo, catalogo, vista))
        .join('')}</ul>

      ${lleno ? `
      <p class="suave nota">Ya hay ${TOPE_DE_RUBROS}, que es el máximo: cada uno
      tiene su color, y un noveno sería indistinguible de otro para quien no
      distingue bien los colores. Para agregar uno nuevo, uní dos de estos.</p>`
      : `
      <form class="formulario-linea" data-formulario="nuevo-rubro" novalidate>
        <input type="hidden" name="tipo" value="${escapar(tipo)}">
        <label class="campo">
          <span>Agregar un rubro de ${escapar(cual)}</span>
          <input name="nombre" type="text" autocomplete="off" placeholder="mascotas">
        </label>
        <button type="submit" class="secundario" data-accion="crear-rubro">Agregar</button>
      </form>`}
    </section>
  `;
}

/**
 * Los rubros que están en los movimientos pero ya no en la lista.
 *
 * Puede pasar al importar un respaldo de otro dispositivo con más rubros que los
 * que entran (el tope de ocho). **No se puede callar**: esos movimientos existen
 * y no aparecen en ningún total por rubro.
 */
export function dibujarHuerfanos(vista, tipo) {
  const sueltos = rubrosHuerfanos(vista.estado ?? {}, tipo);
  if (sueltos.length === 0) return '';

  return `
    <div class="aviso importante" role="alert">
      <h2>${sueltos.length === 1 ? 'Un rubro quedó fuera de la lista' : `${sueltos.length} rubros quedaron fuera de la lista`}</h2>
      <p class="suave">Tienen movimientos pero ya no están entre los rubros, así
      que <strong>no aparecen en los totales por rubro</strong>. Uní cada uno con
      alguno de los de arriba para recuperarlos.</p>
      <ul class="filas-con-problema">${sueltos.map((h) => `<li>
        <strong>${escapar(formatearRubro(h.rubro))}</strong>: ${escapar(dibujarUso(h.cuantos))}.
      </li>`).join('')}</ul>
    </div>`;
}

export function dibujarRubros(vista) {
  return `
    ${vista.error ? `<p class="error-carga" role="alert">${escapar(vista.error)}</p>` : ''}
    ${vista.avisoRubro ? `<p class="confirmacion" role="status">${escapar(vista.avisoRubro)}</p>` : ''}
    ${dibujarHuerfanos(vista, TIPO_GASTO)}
    ${dibujarHuerfanos(vista, TIPO_INGRESO)}
    ${dibujarRubrosDe(vista, TIPO_GASTO)}
    ${dibujarRubrosDe(vista, TIPO_INGRESO)}
  `;
}
