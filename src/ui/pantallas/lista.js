// La lista del mes, corregir y borrar — CU-06.
//
// Un monto mal tipeado no puede quedar para siempre, así que esta pantalla es
// necesaria. Pero también es la única de la app que **destruye datos**, y no hay
// papelera ni historial detrás (ARQUITECTURA §11): lo que se borra acá se fue.
//
// De ahí las dos redes de contención, que son lo que más código ocupa en este
// archivo:
//
//   1. **Confirmar antes.** Un toque no borra: pregunta, mostrando qué
//      movimiento es. En un celular, el borrar y el editar quedan a milímetros.
//   2. **Deshacer después.** Confirmar no alcanza: la gente confirma en
//      automático. El deshacer es la red que atrapa al que ya dijo que sí.
//
// La segunda es la que de verdad sirve. La primera frena los accidentes; la
// segunda frena los arrepentimientos, que son más frecuentes.

import { escapar } from '../app.js';
import { sumar } from '../../core/dinero.js';
import { claseDeRubro } from '../colores.js';
import { movimientosDelMes, movimientosFiltrados, hayFiltro,
  separarConvertibles } from '../../core/calculos.js';
import { buscar, palabrasDe } from '../../core/busqueda.js';
import { movimientoEnEuros, faltaCambioPara } from '../../core/cambio.js';
import { decimalesDe } from '../../core/monedas.js';
import { TIPO_GASTO, TIPO_INGRESO } from '../../core/modelo.js';
import {
  formatearMonto,
  formatearEuros,
  formatearFecha,
  formatearFechaLarga,
  formatearMes,
  formatearRubro,
} from '../../core/formato.js';

/**
 * Saca un movimiento del estado y devuelve lo necesario para volver a ponerlo
 * donde estaba.
 *
 * Se guarda **la posición**, no solo el movimiento: restaurarlo al final de la
 * lista lo dejaría en otro lugar del que estaba, y el usuario que deshizo un
 * borrado espera encontrar todo exactamente como lo tenía.
 */
export function borrarMovimiento(estado, id) {
  const posicion = estado.movimientos.findIndex((m) => m.id === id);
  if (posicion === -1) return { estado, borrado: null };

  return {
    estado: { ...estado, movimientos: estado.movimientos.filter((m) => m.id !== id) },
    borrado: { movimiento: estado.movimientos[posicion], posicion },
  };
}

/** Vuelve a poner un movimiento borrado en su lugar exacto. */
export function restaurarMovimiento(estado, borrado) {
  if (!borrado) return estado;

  const movimientos = [...estado.movimientos];
  movimientos.splice(Math.min(borrado.posicion, movimientos.length), 0, borrado.movimiento);
  return { ...estado, movimientos };
}

export function buscarMovimiento(estado, id) {
  return estado.movimientos.find((m) => m.id === id) ?? null;
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

function importeDe(estado, movimiento) {
  try {
    const decimales = decimalesDe(estado.monedas, movimiento.moneda);
    const propio = formatearMonto(movimiento.monto, decimales, movimiento.moneda);
    if (movimiento.moneda === 'EUR') return { propio, enEuros: null };

    if (faltaCambioPara(movimiento, estado.tipos_cambio)) {
      return { propio, enEuros: null, sinCambio: true };
    }
    return { propio, enEuros: formatearEuros(movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas)) };
  } catch {
    // Un dato que no se puede formatear se muestra crudo antes que no mostrarse:
    // el usuario tiene que poder verlo para poder corregirlo o borrarlo.
    return { propio: `${movimiento.monto} ${movimiento.moneda}`, enEuros: null };
  }
}

/**
 * El total de una lista de movimientos, en euros.
 *
 * **No cuenta como cero lo que no se puede convertir**: lo aparta, igual que
 * `totalesDelMes()`. Si contara los sin cambio como cero, el total de la lista
 * filtrada no cerraría con el número que el usuario acaba de tocar, y no habría
 * forma de saber cuál de los dos creer.
 */
function totalDe(estado, movimientos) {
  const { convertibles } = separarConvertibles(movimientos, estado.tipos_cambio);
  return sumar(convertibles.map((m) => movimientoEnEuros(m, estado.tipos_cambio, estado.monedas)));
}

function dibujarMovimiento(estado, movimiento, vista) {
  const importe = importeDe(estado, movimiento);
  const esGasto = movimiento.tipo === TIPO_GASTO;
  const confirmando = vista.borrando === movimiento.id;

  const detalle = [movimiento.comentario, movimiento.detalle].filter(Boolean).join(' · ');

  return `
    <li class="movimiento${confirmando ? ' confirmando' : ''}">
      <div class="movimiento-datos">
        <span class="nombre">
          <span class="punto-rubro ${claseDeRubro(movimiento.tipo, movimiento.rubro)}" aria-hidden="true"></span>
          ${escapar(formatearRubro(movimiento.rubro))}
        </span>
        <span class="importe ${esGasto ? 'gasto' : 'ingreso'}">${escapar(importe.propio)}</span>
      </div>

      ${detalle || importe.enEuros || importe.sinCambio ? `
      <div class="movimiento-pie suave">
        <span>${escapar(detalle)}</span>
        <span>${
          importe.sinCambio
            ? 'sin tipo de cambio'
            : importe.enEuros ? escapar(importe.enEuros) : ''
        }</span>
      </div>` : ''}

      ${confirmando ? `
      <div class="confirmar-borrado" role="alertdialog" aria-label="Confirmar borrado">
        <p>¿Borrar este movimiento?</p>
        <div class="botones">
          <button type="button" class="peligro" data-accion="borrar-si" data-id="${escapar(movimiento.id)}">Sí, borrar</button>
          <button type="button" class="secundario" data-accion="borrar-no">No</button>
        </div>
      </div>` : `
      <div class="movimiento-acciones">
        <button type="button" class="secundario chico" data-accion="editar" data-id="${escapar(movimiento.id)}">Corregir</button>
        <button type="button" class="secundario chico" data-accion="borrar" data-id="${escapar(movimiento.id)}">Borrar</button>
      </div>`}
    </li>
  `;
}

/**
 * El aviso de deshacer.
 *
 * No se cierra solo a los tres segundos, como suelen hacerse: en un celular, tres
 * segundos es el tiempo que tarda alguien en darse cuenta de lo que hizo. Se
 * queda hasta que se lo cierra o hasta que se cambia de pantalla.
 */
export function dibujarDeshacer(vista) {
  if (!vista.borrado) return '';

  const { movimiento } = vista.borrado;
  return `
    <section class="deshacer" role="status">
      <p>Borraste <strong>${escapar(formatearRubro(movimiento.rubro))}</strong>
      del ${escapar(formatearFecha(movimiento.fecha))}.</p>
      <button type="button" class="secundario" data-accion="deshacer">Deshacer</button>
    </section>
  `;
}

/**
 * La lista del mes, agrupada por día y del más nuevo al más viejo.
 *
 * Del más nuevo al más viejo porque lo que se corrige casi siempre es lo último
 * que se cargó: tenerlo arriba evita desplazarse por un mes entero para arreglar
 * un dedazo de hace dos minutos.
 */
/**
 * El cartel de que la lista está filtrada — T-026.
 *
 * **Es obligatorio y no decorativo.** Una lista que muestra siete movimientos de
 * doscientos, sin decir por qué, no se lee como "filtrada": se lee como datos
 * perdidos. Así que dice **en qué está filtrada** y trae la salida al lado.
 */
export function dibujarFiltro(vista) {
  const filtro = vista.filtro;
  if (!hayFiltro(filtro)) return '';

  const partes = [];
  if (filtro.rubro !== undefined) partes.push(formatearRubro(filtro.rubro));
  if (filtro.comentario !== undefined) partes.push(filtro.comentario);
  if (filtro.rubro === undefined && filtro.comentario === undefined && filtro.tipo !== undefined) {
    partes.push(filtro.tipo === TIPO_GASTO ? 'gastos' : 'ingresos');
  }
  const cuando = filtro.todosLosMeses ? 'en todos los meses' : `en ${formatearMes(vista.mes)}`;

  return `
    <section class="tarjeta filtro" role="status">
      <p>Mostrando solo <strong>${escapar(partes.join(' · '))}</strong> ${escapar(cuando)}.</p>
      <button type="button" class="secundario" data-accion="quitar-filtro">Ver todo</button>
    </section>
  `;
}

/**
 * La lupa — T-943.
 *
 * Va **arriba de todo** en la pestaña de movimientos, que es donde uno la busca
 * cuando no se acuerda en qué mes fue algo.
 *
 * El campo es `type="search"`: en un teléfono el teclado trae la tecla "buscar"
 * en vez de "enter", y el navegador agrega solo la crucecita para vaciarlo.
 */
export function dibujarBuscador(vista) {
  return `
    <section class="tarjeta buscador">
      <label class="campo con-lupa">
        <span class="lupa" aria-hidden="true">🔍</span>
        <input name="busqueda" type="search" autocomplete="off" enterkeyhint="search"
               data-accion-entrada="buscar" aria-label="Buscar en todos los movimientos"
               placeholder="Buscar en todos los movimientos"
               value="${escapar(vista.busqueda ?? '')}">
      </label>
    </section>
  `;
}

/**
 * Los resultados de la búsqueda.
 *
 * Se dibuja aparte del resto porque es lo único que se redibuja mientras se
 * escribe: tocar el formulario entero en cada tecla le sacaría el foco al campo
 * y movería el cursor (ADR-023).
 *
 * **Mira todo el historial**, así que cada resultado dice de qué día es: sin la
 * fecha, una lista de gastos de once meses distintos no se puede leer.
 */
export function dibujarResultados(vista) {
  const palabras = palabrasDe(vista.busqueda);
  if (palabras.length === 0) return '';

  const encontrados = buscar(vista.estado, vista.busqueda);
  if (encontrados.length === 0) {
    return `
      <section class="tarjeta">
        <p class="suave">Ningún movimiento dice
        <strong>${escapar(String(vista.busqueda).trim())}</strong>.</p>
        <p class="suave">Se busca en la etiqueta, el detalle, el rubro, el importe,
        la moneda y la fecha, sin distinguir mayúsculas ni tildes. Con varias
        palabras, tienen que estar todas.</p>
      </section>
    `;
  }

  const cuantos = encontrados.length === 1 ? '1 movimiento' : `${encontrados.length} movimientos`;
  const total = totalDe(vista.estado, encontrados);

  const cuerpo = encontrados.map((m) => `
    <li class="resultado">
      <span class="cuando-resultado suave">${escapar(formatearFechaLarga(m.fecha))}</span>
      <ul class="movimientos">${dibujarMovimiento(vista.estado, m, vista)}</ul>
    </li>`).join('');

  return `
    <p class="cuantos suave">${cuantos} · <strong>${escapar(formatearEuros(total))}</strong>
    en total, en todos los meses.</p>
    <ul class="resultados">${cuerpo}</ul>
  `;
}

export function dibujarLista(vista) {
  const { estado, mes } = vista;

  // Buscando, la lista del mes no se dibuja: serían dos listas de movimientos
  // una abajo de la otra, y la de abajo se leería como parte de los resultados.
  if (palabrasDe(vista.busqueda).length > 0) {
    return `
      ${dibujarDeshacer(vista)}
      ${dibujarBuscador(vista)}
      <div data-resultados>${dibujarResultados(vista)}</div>
    `;
  }

  const filtrada = hayFiltro(vista.filtro);
  const delMes = filtrada
    ? movimientosFiltrados(estado, mes, vista.filtro)
    : movimientosDelMes(estado.movimientos, mes);

  if (delMes.length === 0) {
    // Con un filtro puesto, "no hay movimientos en este mes" sería mentira: los
    // hay, pero ninguno entra en el filtro. Y el botón de cargar uno nuevo sería
    // el consejo equivocado: lo que hace falta es sacar el filtro.
    if (filtrada) {
      return `
        ${dibujarDeshacer(vista)}
        ${dibujarBuscador(vista)}
        <div data-resultados></div>
        ${dibujarFiltro(vista)}
        <section class="tarjeta">
          <p class="suave">Ningún movimiento entra en este filtro.</p>
        </section>
      `;
    }
    // La lupa se dibuja igual: que este mes esté vacío es justamente cuando más
    // falta hace buscar en los otros.
    return `
      ${dibujarDeshacer(vista)}
      ${dibujarBuscador(vista)}
      <div data-resultados></div>
      <section class="tarjeta">
        <h2>${escapar(formatearMes(mes))}</h2>
        <p class="suave">No hay movimientos en este mes.</p>
        <button type="button" class="principal" data-accion="ir" data-pantalla="nuevo">
          Cargar un movimiento
        </button>
      </section>
    `;
  }

  // Sin ningún tope de filas: se muestran todos los del mes (L-001).
  const porFecha = new Map();
  for (const movimiento of delMes) {
    if (!porFecha.has(movimiento.fecha)) porFecha.set(movimiento.fecha, []);
    porFecha.get(movimiento.fecha).push(movimiento);
  }

  const dias = [...porFecha.keys()].sort().reverse();
  const cuerpo = dias
    .map((fecha) => `
      <section class="tarjeta dia">
        <h2>${escapar(formatearFechaLarga(fecha))}</h2>
        <ul class="movimientos">
          ${porFecha.get(fecha).map((m) => dibujarMovimiento(estado, m, vista)).join('')}
        </ul>
      </section>`)
    .join('');

  const cuantos = delMes.length === 1 ? '1 movimiento' : `${delMes.length} movimientos`;
  const total = filtrada ? totalDe(estado, delMes) : null;

  // Con filtro se muestra el total de lo filtrado: es el número que se venía a
  // desarmar, y verlo repetido acá es la confirmación de que la lista de abajo
  // es de verdad lo que compone ese total.
  const encabezado = filtrada
    ? `<p class="cuantos suave">${cuantos} · <strong>${escapar(formatearEuros(total))}</strong></p>`
    : `<p class="cuantos suave">${cuantos} en ${escapar(formatearMes(mes))}.</p>`;

  return `
    ${dibujarDeshacer(vista)}
    ${dibujarBuscador(vista)}
    <div data-resultados></div>
    ${dibujarFiltro(vista)}
    ${encabezado}
    ${cuerpo}
  `;
}
