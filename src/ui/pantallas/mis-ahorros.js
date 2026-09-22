// Mis ahorros: la pantalla — T-072, CU-22.
//
// ── Por qué se parece tanto a la de ahorros conjuntos ───────────────────────
//
// Porque contesta la misma pregunta sobre otra plata: cuánto hay, en qué
// moneda, y dónde está. Que dos pantallas parecidas tengan mecánicas distintas
// es lo que obliga a aprender la app dos veces, así que acá el historial se
// ordena igual, el borrado pregunta igual y el deshacer aparece igual.
//
// ── Lo único distinto, y por qué ────────────────────────────────────────────
//
// **La cuenta se escribe, no se elige de una lista.** Los ahorros conjuntos son
// de dos personas con nombre propio; las cuentas de alguien —su banco, su
// plataforma— no las puede saber la app, y pedirle que las dé de alta en una
// pantalla aparte antes de poder anotar nada es una pantalla de mantenimiento
// para algo que se escribe una vez cada seis meses. Lo eligió el usuario
// (2026-09-22) sabiendo el costo: un error de tipeo crea una cuenta nueva.
//
// Lo que ese costo no incluye es que la app dé por distintas dos cosas que el
// usuario escribió igual: "Santander" y "santander " se agrupan (RN-03), y las
// sugerencias están para que la segunda vez no haya que escribirla entera.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import {
  crearMiAhorro, misAhorrosDe, misAhorrosOrdenados, totalPorCuenta, cuentasUsadas,
} from '../../core/mis-ahorros.js';
import { AHORRO_ENTRA, AHORRO_SALE } from '../../core/ahorros.js';
import { decimalesDe, monedasVisibles } from '../../core/monedas.js';
import { formatearNumero, formatearFecha, formatearEnSuMoneda } from '../../core/formato.js';
import { hoy } from '../../core/modelo.js';
import { opciones, fechaEnPalabras, dibujarError, dibujarSugerencias } from './movimiento.js';

/** El formulario vacío. */
export function borradorDeMiAhorro({ estado, fecha, cuenta } = {}) {
  return {
    fecha: fecha ?? hoy(),
    tipo: AHORRO_ENTRA,
    // La cuenta y la moneda se mantienen entre cargas, igual que la persona en
    // los ahorros conjuntos: quien pone al día una cuenta carga varios seguidos.
    cuenta: cuenta ?? '',
    monto: '',
    moneda: estado?.preferencias?.moneda_predeterminada ?? 'EUR',
    detalle: '',
  };
}

/** El formulario cargado con un movimiento que ya existe, para corregirlo. */
export function borradorDesdeMiAhorro(movimiento, decimales) {
  return {
    id: movimiento.id,
    fecha: movimiento.fecha,
    tipo: movimiento.tipo,
    cuenta: movimiento.cuenta,
    monto: formatearNumero(movimiento.monto, decimales),
    moneda: movimiento.moneda,
    detalle: movimiento.detalle,
  };
}

/**
 * Intenta guardar. Devuelve `{ estado, borrador, aviso, error }` — nunca tira.
 *
 * **No pide tipo de cambio**, igual que los ahorros conjuntos: acá no se
 * convierte nada, así que un movimiento en dólares no queda fuera de ningún
 * total por no tener cotización.
 */
export function intentarGuardarMiAhorro(estado, borrador) {
  let decimales;
  try {
    decimales = decimalesDe(estado.monedas, borrador.moneda);
  } catch (error) {
    return { estado, borrador, error: error.message };
  }

  const anteriores = misAhorrosDe(estado);
  const original = borrador.id ? anteriores.find((m) => m.id === borrador.id) : null;

  let movimiento;
  try {
    movimiento = crearMiAhorro(borrador, { decimales, id: original?.id, creado: original?.creado });
  } catch (error) {
    return { estado, borrador, error: error.message };
  }

  const posicion = borrador.id ? anteriores.findIndex((m) => m.id === borrador.id) : -1;
  const corrigiendo = posicion !== -1;

  const nuevoEstado = {
    ...estado,
    mis_ahorros: corrigiendo
      ? anteriores.map((m, i) => (i === posicion ? movimiento : m))
      : [...anteriores, movimiento],
    preferencias: { ...estado.preferencias, moneda_predeterminada: movimiento.moneda },
  };

  return {
    estado: nuevoEstado,
    corrigiendo,
    borrador: borradorDeMiAhorro({
      estado: nuevoEstado, fecha: movimiento.fecha, cuenta: movimiento.cuenta,
    }),
    aviso: { movimiento, decimales, corrigiendo },
  };
}

/** Saca un movimiento, y devuelve lo necesario para poder deshacerlo. */
export function borrarMiAhorro(estado, id) {
  const anteriores = misAhorrosDe(estado);
  const posicion = anteriores.findIndex((m) => m.id === id);
  if (posicion === -1) return { estado, borrado: null };

  return {
    estado: { ...estado, mis_ahorros: anteriores.filter((m) => m.id !== id) },
    borrado: { movimiento: anteriores[posicion], posicion },
  };
}

/** Vuelve a poner un movimiento borrado en su lugar exacto. */
export function restaurarMiAhorro(estado, borrado) {
  if (!borrado) return estado;

  const lista = [...misAhorrosDe(estado)];
  lista.splice(Math.min(borrado.posicion, lista.length), 0, borrado.movimiento);
  return { ...estado, mis_ahorros: lista };
}

/** El bloque de una moneda: cuánto hay, y en qué cuentas está. */
export function dibujarMonedaDeMisAhorros(bloque, monedas) {
  const cuentas = bloque.cuentas.map((c) => `
    <div class="rubro-pie suave">
      <span>${escapar(c.cuenta)}</span>
      <span>${escapar(formatearEnSuMoneda(c.total, bloque.moneda, monedas))}</span>
    </div>`).join('');

  return `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">${escapar(bloque.moneda)}</span>
        <span class="importe">${escapar(formatearEnSuMoneda(bloque.total, bloque.moneda, monedas))}</span>
      </span>
      ${cuentas}
    </li>
  `;
}

/** Una línea del historial, con sus botones. */
export function dibujarMovimientoMio(movimiento, monedas, { confirmando = false } = {}) {
  const salida = movimiento.tipo === AHORRO_SALE;
  const signo = salida ? '−' : '+';
  const pie = [formatearFecha(movimiento.fecha), movimiento.detalle].filter((t) => t !== '').join(' · ');

  return `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">${escapar(movimiento.cuenta)}</span>
        <span class="importe ${salida ? 'gasto' : 'ingreso'}">${escapar(signo)}${escapar(formatearEnSuMoneda(movimiento.monto, movimiento.moneda, monedas))}</span>
      </span>
      <div class="rubro-pie suave"><span>${escapar(pie)}</span></div>

      ${confirmando ? `
      <div class="confirmar-borrado" role="alertdialog" aria-label="Confirmar borrado">
        <p>¿Borrar este movimiento?</p>
        <div class="botones">
          <button type="button" class="peligro" data-accion="borrar-mi-ahorro-si" data-id="${escapar(movimiento.id)}">Sí, borrar</button>
          <button type="button" class="secundario" data-accion="borrar-mi-ahorro-no">No</button>
        </div>
      </div>` : `
      <div class="movimiento-acciones">
        <button type="button" class="secundario chico" data-accion="editar-mi-ahorro" data-id="${escapar(movimiento.id)}">Corregir</button>
        <button type="button" class="secundario chico" data-accion="borrar-mi-ahorro" data-id="${escapar(movimiento.id)}">Borrar</button>
      </div>`}
    </li>
  `;
}

/** El cartel de deshacer, después de borrar. */
export function dibujarDeshacerMiAhorro(vista) {
  if (!vista.miAhorroBorrado) return '';

  const { movimiento } = vista.miAhorroBorrado;
  return `
    <section class="deshacer" role="status">
      <p>Borraste <strong>${escapar(movimiento.cuenta)}</strong>
      del ${escapar(formatearFecha(movimiento.fecha))}.</p>
      <button type="button" class="secundario" data-accion="deshacer-mi-ahorro">Deshacer</button>
    </section>
  `;
}

export function dibujarMisAhorros(vista) {
  const estado = vista.estado ?? {};
  const monedas = estado.monedas ?? [];
  const porMoneda = totalPorCuenta(estado);

  const cargar = `
    <button type="button" class="principal" data-accion="ir" data-pantalla="nuevo-mi-ahorro">
      Anotar un movimiento
    </button>`;

  if (porMoneda.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Mis ahorros</h2>
        <p class="suave">Todavía no hay nada. Acá va la plata que tenés guardada
        y no usás en el mes: en qué banco, en qué plataforma, en qué moneda. Se
        anota lo que entra y lo que sale, como en un extracto, y la app va
        sumando.</p>
        ${cargar}
      </section>
    `;
  }

  const historial = misAhorrosOrdenados(estado);

  return `
    <section class="tarjeta">
      <h2>Mis ahorros</h2>
      <p class="suave nota">Cuánto tenés en cada moneda, y en qué cuenta está.
      <strong>No se suman entre sí</strong>: pasar dólares a euros al cambio de
      hoy daría un número que cambia solo todos los días y que no existe hasta
      que la plata se cambie de verdad.</p>
      <ul class="rubros">${porMoneda.map((b) => dibujarMonedaDeMisAhorros(b, monedas)).join('')}</ul>
      ${cargar}
    </section>

    ${dibujarDeshacerMiAhorro(vista)}

    <section class="tarjeta">
      <h2>Movimientos</h2>
      <p class="suave nota">${historial.length === 1 ? '1 movimiento' : `${historial.length} movimientos`},
      del más nuevo al más viejo. <strong>+</strong> es plata que entró a la
      cuenta y <strong>−</strong> plata que salió.</p>
      <ul class="rubros">${historial.map((m) => dibujarMovimientoMio(m, monedas,
        { confirmando: vista.confirmandoMiAhorro === m.id })).join('')}</ul>
    </section>
  `;
}

function dibujarAvisoMio(aviso) {
  if (!aviso?.movimiento) return '';

  const entra = aviso.movimiento.tipo === AHORRO_ENTRA;
  const que = aviso.corrigiendo
    ? 'Cambio guardado'
    : `Guardado: ${entra ? 'entró' : 'salió'} plata de ${aviso.movimiento.cuenta}`;

  return `<p class="confirmacion" role="status">${escapar(que)}.</p>`;
}

export function dibujarNuevoMiAhorro(vista) {
  const estado = vista.estado ?? {};
  const borrador = vista.borradorDeMiAhorro ?? borradorDeMiAhorro({ estado });
  const entra = borrador.tipo !== AHORRO_SALE;

  const monedas = monedasVisibles(estado.monedas ?? []).map((m) => ({ valor: m.codigo, texto: m.codigo }));

  return `
    <form class="tarjeta formulario" data-formulario="mi-ahorro" novalidate>
      <h2>${borrador.id ? 'Corregir movimiento' : 'Anotar en mis ahorros'}</h2>

      ${dibujarError(vista.error)}
      ${dibujarAvisoMio(vista.aviso)}

      <!-- Entró / Salió y no Ingreso / Gasto: pasar plata de la cuenta corriente
           al plazo fijo no es un gasto de nada. -->
      <div class="tipo" role="group" aria-label="Qué pasó con la plata">
        <button type="button" class="opcion-tipo${entra ? ' activa' : ''}"
                data-accion="tipo-mi-ahorro" data-tipo="${AHORRO_ENTRA}" aria-pressed="${entra}">Entró a la cuenta</button>
        <button type="button" class="opcion-tipo${entra ? '' : ' activa'}"
                data-accion="tipo-mi-ahorro" data-tipo="${AHORRO_SALE}" aria-pressed="${!entra}">Salió de la cuenta</button>
      </div>

      <label class="campo">
        <span>Monto</span>
        <div class="monto-fila">
          <input name="monto" class="importe" type="text" inputmode="decimal"
                 autocomplete="off" enterkeyhint="done" placeholder="0,00"
                 value="${escapar(borrador.monto)}">
          <select name="moneda" aria-label="Moneda">${opciones(monedas, borrador.moneda)}</select>
        </div>
        <button type="button" class="enlace" data-accion="ir" data-pantalla="monedas">
          ¿Falta una moneda?
        </button>
      </label>

      <label class="campo">
        <span>¿Dónde está?</span>
        <!-- Se escribe, y la app sugiere las que ya usaste. Ver la cabecera. -->
        <input name="cuenta" type="text" autocomplete="off"
               placeholder="Santander, Revolut, plazo fijo…" value="${escapar(borrador.cuenta)}">
        <div class="sugerencias" data-sugerencias="cuenta">${
          dibujarSugerencias('cuenta', borrador.cuenta, cuentasUsadas(estado))
        }</div>
      </label>

      <label class="campo">
        <span>Fecha</span>
        <input name="fecha" type="date" value="${escapar(borrador.fecha)}">
        <span class="fecha-legible" data-fecha-legible>${escapar(fechaEnPalabras(borrador.fecha))}</span>
      </label>

      <label class="campo">
        <span>Detalle <em class="suave">— para acordarte</em></span>
        <input name="detalle" type="text" autocomplete="off"
               placeholder="plazo fijo, vence el 28/08/26" value="${escapar(borrador.detalle)}">
      </label>

      <button type="submit" class="principal" data-accion="guardar-mi-ahorro">
        ${borrador.id ? 'Guardar los cambios' : 'Guardar'}
      </button>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="mis-ahorros">
        ${borrador.id ? 'Dejar como estaba' : 'Volver a mis ahorros'}
      </button>
    </form>
  `;
}
