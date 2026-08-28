// La pantalla de monedas — CU-15, T-024.
//
// Para qué existe: poder anotar los gastos de un país nuevo sin esperar a que
// alguien publique una versión de la app. Es la diferencia entre registrar el
// viaje y perderlo.
//
// ── Lo delicado de esta pantalla son los DECIMALES ──────────────────────────
//
// Un monto se guarda en unidades mínimas: `1500` son 15,00 con dos decimales y
// 1.500 con cero. Cambiarle los decimales a una moneda **no reescribe ningún
// monto: los lee distinto**. Todos los gastos ya cargados en esa moneda pasan a
// valer cien veces más o cien veces menos, y nada en la pantalla parpadea.
//
// Por eso el cambio de decimales no es un `<select>` que se aplica al tocarlo,
// sino un paso aparte que **antes de aplicarse dice cuántos movimientos
// reinterpreta y muestra uno de ejemplo, con el antes y el después**. Es la
// misma regla que la corrección de un tipo de cambio (ADR-019): cuando un número
// puede cambiar el significado de datos que ya existen, el aviso es parte de la
// funcionalidad, no un adorno.
//
// Igual que el resto de la interfaz (ADR-022), casi todo son funciones puras que
// devuelven texto HTML; las que cambian el estado devuelven uno nuevo y no
// guardan nada.

import { escapar } from '../app.js';
import { dibujarError } from './movimiento.js';
import {
  MONEDA_BASE, agregarMoneda, borrarMoneda, cambiarDecimalesDe,
  contarMovimientosDe, buscarMoneda, ocultarMoneda, mostrarMoneda,
} from '../../core/monedas.js';
import { formatearMonto } from '../../core/formato.js';

/** Un ejemplo con el que se entiende qué son los decimales sin explicarlos. */
const MONTO_DE_EJEMPLO = 1500;

/** Cuántos movimientos hay en una moneda, en palabras. */
export function cuantosMovimientos(cuantos) {
  if (cuantos === 0) return 'sin movimientos';
  return cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`;
}

/**
 * Qué pasaría si a una moneda le cambiaran los decimales.
 *
 * Devuelve cuántos movimientos se reinterpretan y **un ejemplo real**: el mismo
 * número guardado, leído con los decimales de antes y con los de después. Un
 * "cambiará el significado de 47 movimientos" es abstracto; ver que `15,00 €`
 * pasa a ser `1.500`, no.
 */
export function efectoDeCambiarDecimales(estado, codigo, decimales) {
  const moneda = buscarMoneda(estado.monedas, codigo);
  if (moneda === null) return null;

  const afectados = contarMovimientosDe(estado.movimientos, moneda.codigo);
  const ejemplo = estado.movimientos.find(
    (m) => String(m.moneda).toUpperCase() === moneda.codigo,
  );
  const monto = ejemplo?.monto ?? MONTO_DE_EJEMPLO;

  return {
    afectados,
    cambia: decimales !== moneda.decimales,
    antes: formatearMonto(monto, moneda.decimales, moneda.codigo),
    despues: formatearMonto(monto, decimales, moneda.codigo),
  };
}

/** El aviso previo. Sin movimientos cargados no hay nada que reinterpretar. */
export function dibujarAvisoDecimales(efecto) {
  if (efecto === null || !efecto.cambia) return '';
  if (efecto.afectados === 0) {
    return `<p class="confirmacion" role="status">Todavía no hay movimientos en esta
      moneda, así que el cambio no reinterpreta nada.</p>`;
  }

  const cuantos = cuantosMovimientos(efecto.afectados);
  return `
    <p class="confirmacion importante" role="status">
      Esto cambia el significado de ${escapar(cuantos)} ya cargado${efecto.afectados === 1 ? '' : 's'}.
      Uno que hoy se lee <strong>${escapar(efecto.antes)}</strong> pasaría a leerse
      <strong>${escapar(efecto.despues)}</strong>. No se reescribe ningún monto:
      se leen distinto.
    </p>
  `;
}

/** Una fila del catálogo. */
export function dibujarFilaMoneda(moneda, cuantos) {
  const esBase = moneda.codigo === MONEDA_BASE;
  const ejemplo = formatearMonto(MONTO_DE_EJEMPLO, moneda.decimales, moneda.codigo);

  // Borrar solo se ofrece cuando de verdad se puede. Un botón que siempre
  // contesta "no" enseña a no tocarlo, y de paso esconde que existe "ocultar".
  const sePuedeBorrar = !esBase && cuantos === 0;

  const acciones = esBase ? '<span class="suave">Moneda base</span>' : `
    <button type="button" class="secundario chico" data-accion="decimales-moneda"
            data-moneda="${escapar(moneda.codigo)}">Decimales</button>
    <button type="button" class="secundario chico"
            data-accion="${moneda.oculta ? 'mostrar-moneda' : 'ocultar-moneda'}"
            data-moneda="${escapar(moneda.codigo)}">${moneda.oculta ? 'Mostrar' : 'Ocultar'}</button>
    ${sePuedeBorrar ? `
    <button type="button" class="secundario chico" data-accion="borrar-moneda"
            data-moneda="${escapar(moneda.codigo)}">Borrar</button>` : ''}`;

  // Los datos van en UNA sola línea separada por puntos medios. Estaban en tres
  // trozos pegados y se leían corridos: "Euro sin movimientos" parecía el nombre
  // de la moneda. Lo encontró la captura del recorrido, no un test: los tests
  // buscaban cada trozo por separado y los encontraban a los tres.
  const partes = [
    moneda.nombre,
    moneda.oculta ? 'oculta' : null,
    cuantosMovimientos(cuantos),
    `se escribe ${ejemplo}`,
  ].filter((p) => p !== null);

  return `
    <li class="linea-cambio${moneda.oculta ? ' apagada' : ''}">
      <div>
        <span class="mes-cambio">${escapar(moneda.codigo)}</span>
        <span class="suave">${escapar(partes.join(' · '))}</span>
      </div>
      <div class="valor-cambio">${acciones}</div>
    </li>
  `;
}

/** El formulario para agregar una moneda. */
export function dibujarFormularioMoneda(borrador = {}) {
  return `
    <form class="tarjeta" data-formulario="moneda">
      <h2>Agregar una moneda</h2>

      <label class="campo">
        <span>Código <em class="suave">— tres letras</em></span>
        <input name="codigo" type="text" autocomplete="off" maxlength="3"
               placeholder="JPY" value="${escapar(borrador.codigo ?? '')}">
      </label>

      <label class="campo">
        <span>Nombre</span>
        <input name="nombre" type="text" autocomplete="off"
               placeholder="Yen japonés" value="${escapar(borrador.nombre ?? '')}">
      </label>

      <label class="campo">
        <span>Decimales</span>
        <!-- Se explica con un ejemplo y no con una definición: "cuántos dígitos
             van después de la coma" obliga a traducirlo mentalmente; "1.500,00 o
             1.500" se entiende sin traducir. -->
        <select name="decimales">
          ${[0, 1, 2, 3, 4].map((d) => `
            <option value="${d}"${Number(borrador.decimales ?? 2) === d ? ' selected' : ''}>
              ${d} — se escribe ${escapar(formatearMonto(MONTO_DE_EJEMPLO, d, MONEDA_BASE).replace('€', '').trim())}
            </option>`).join('')}
        </select>
      </label>

      <button type="submit" class="principal" data-accion="agregar-moneda">
        Agregar moneda
      </button>
    </form>
  `;
}

/** El paso aparte para cambiar los decimales de una moneda que ya existe. */
export function dibujarCambioDeDecimales(vista) {
  const codigo = vista.monedaEditada;
  const moneda = buscarMoneda(vista.estado.monedas, codigo);
  if (moneda === null) return '';

  const elegidos = Number(vista.borradorDecimales ?? moneda.decimales);
  const efecto = efectoDeCambiarDecimales(vista.estado, moneda.codigo, elegidos);

  return `
    <form class="tarjeta" data-formulario="decimales">
      <h2>Decimales de ${escapar(moneda.nombre)}</h2>
      <p class="suave">Hoy usa ${moneda.decimales}.</p>

      <label class="campo">
        <span>Decimales</span>
        <select name="decimales" data-accion-cambio="decimales-elegidos">
          ${[0, 1, 2, 3, 4].map((d) => `
            <option value="${d}"${elegidos === d ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
      </label>

      <div data-aviso-decimales>${dibujarAvisoDecimales(efecto)}</div>

      <input type="hidden" name="moneda" value="${escapar(moneda.codigo)}">
      <button type="submit" class="principal" data-accion="guardar-decimales">
        Aplicar
      </button>
      <button type="button" class="secundario" data-accion="cancelar-decimales">
        Ahora no
      </button>
    </form>
  `;
}

export function dibujarMonedas(vista) {
  const estado = vista.estado;
  const filas = estado.monedas
    .map((m) => dibujarFilaMoneda(m, contarMovimientosDe(estado.movimientos, m.codigo)))
    .join('');

  const editando = vista.monedaEditada
    ? dibujarCambioDeDecimales(vista)
    : dibujarFormularioMoneda(vista.borradorMoneda);

  // El error va ARRIBA de la lista y no adentro del formulario: lo puede provocar
  // cualquiera de los botones de las filas —ocultar, borrar—, no solo el
  // formulario. Un error dibujado solo dentro del formulario dejaba a "borrar el
  // colón" fallando en silencio; lo encontró el recorrido en el navegador.
  const confirmacion = vista.avisoMoneda
    ? `<p class="confirmacion" role="status">${escapar(vista.avisoMoneda)}</p>`
    : '';

  return `
    <section class="tarjeta">
      <h2>Monedas</h2>
      <p class="suave">Las que están acá se pueden elegir al cargar un gasto.
      Ocultar una la saca de esa lista sin tocar sus movimientos.</p>
      ${dibujarError(vista.error)}
      ${confirmacion}
      <ul class="lineas">${filas}</ul>
    </section>
    ${editando}
  `;
}


// ── Los cambios de estado ────────────────────────────────────────────────────
//
// Todas devuelven `{ estado }` o `{ error }`. No guardan: guardar es de `app.js`,
// que es el único que sabe si el navegador puede.

/** Envuelve una operación del catálogo y convierte su error en texto. */
function intentar(hacer) {
  try {
    return { estado: hacer() };
  } catch (error) {
    return { error: error.message };
  }
}

export function intentarAgregarMoneda(estado, entrada) {
  return intentar(() => ({ ...estado, monedas: agregarMoneda(estado.monedas, entrada) }));
}

export function intentarOcultarMoneda(estado, codigo) {
  return intentar(() => ({ ...estado, monedas: ocultarMoneda(estado.monedas, codigo) }));
}

export function intentarMostrarMoneda(estado, codigo) {
  return intentar(() => ({ ...estado, monedas: mostrarMoneda(estado.monedas, codigo) }));
}

export function intentarBorrarMoneda(estado, codigo) {
  return intentar(() => ({
    ...estado,
    monedas: borrarMoneda(estado.monedas, codigo, estado.movimientos),
  }));
}

export function intentarCambiarDecimales(estado, codigo, decimales) {
  return intentar(() => ({
    ...estado,
    monedas: cambiarDecimalesDe(estado.monedas, codigo, decimales),
  }));
}
