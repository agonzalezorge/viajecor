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
import { claseDeRubro } from '../colores.js';
import { movimientosDelMes } from '../../core/calculos.js';
import { movimientoEnEuros, faltaCambioPara } from '../../core/cambio.js';
import { decimalesDe } from '../../core/monedas.js';
import { TIPO_GASTO } from '../../core/modelo.js';
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
export function dibujarLista(vista) {
  const { estado, mes } = vista;
  const delMes = movimientosDelMes(estado.movimientos, mes);

  if (delMes.length === 0) {
    return `
      ${dibujarDeshacer(vista)}
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

  return `
    ${dibujarDeshacer(vista)}
    <p class="cuantos suave">${cuantos} en ${escapar(formatearMes(mes))}.</p>
    ${cuerpo}
  `;
}
