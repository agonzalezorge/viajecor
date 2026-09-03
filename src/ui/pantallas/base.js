// Elegir la moneda base — T-050, CU-20.
//
// ── Por qué esta pantalla pregunta dos veces ─────────────────────────────────
//
// Cambiar la base **reexpresa todos los tipos de cambio guardados** y, en los
// meses donde no hay cotización de la moneda nueva, los pierde. No borra ningún
// movimiento —los montos siguen en su moneda— pero sí puede dejar meses sin
// forma de convertirse hasta que el usuario cargue las cotizaciones que faltan.
//
// Por eso el flujo es: elegir → **ver qué va a pasar, con números** → confirmar.
// Un desplegable que cambia todo al soltarlo sería la forma más rápida de que
// alguien pierda datos por curiosear.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { monedaBaseDe, monedasVisibles } from '../../core/monedas.js';
import { efectoDeCambiarBase } from '../../core/base.js';
import { formatearMes } from '../../core/formato.js';

/** Lo que va a pasar, con números, antes de tocar nada. */
export function dibujarEfectoDeBase(efecto) {
  if (!efecto || efecto.sinCambios) return '';

  const perdidos = efecto.perdidos ?? [];
  const meses = [...new Set(perdidos.map((p) => p.mes))].sort();
  const faltantes = efecto.faltantes ?? [];
  const monedasEnFalta = [...new Set(faltantes.flatMap((f) => f.monedas))].sort();

  return `
    <div class="aviso importante" role="alert">
      <h2>Pasar los totales a ${escapar(efecto.destino)}</h2>

      <p>Tus movimientos <strong>no se tocan</strong>: cada uno sigue guardado en
      su moneda y con su monto. Lo que cambia es en qué moneda se suman.</p>

      ${efecto.reexpresados > 0 ? `
      <p class="suave">Se van a recalcular
      <strong>${efecto.reexpresados}</strong> tipos de cambio para expresarlos en
      ${escapar(efecto.destino)}. ${escapar(efecto.actual)} pasa a ser una moneda
      más y va a tener su propia cotización.</p>` : ''}

      ${perdidos.length > 0 ? `
      <p class="suave">${perdidos.length === 1 ? 'Se pierde' : 'Se pierden'}
      <strong>${perdidos.length}</strong> ${perdidos.length === 1 ? 'tipo de cambio guardado' : 'tipos de cambio guardados'}
      (${escapar(meses.map(formatearMes).join(', '))}): en ${meses.length === 1 ? 'ese mes' : 'esos meses'}
      no hay cotización de ${escapar(efecto.destino)} para poder reexpresarlo${perdidos.length === 1 ? '' : 's'}.</p>` : ''}

      ${faltantes.length > 0 ? `
      <p><strong>Ojo:</strong> te va a faltar la cotización de
      ${escapar(monedasEnFalta.join(', '))} en
      ${faltantes.length === 1 ? 'un mes' : `${faltantes.length} meses`}
      —${escapar(faltantes.map((f) => formatearMes(f.mes)).join(', '))}—,
      así que <strong>${efecto.movimientosSinConvertir}</strong>
      ${efecto.movimientosSinConvertir === 1 ? 'movimiento no va' : 'movimientos no van'}
      a poder contarse en los totales hasta que la cargues.</p>

      <p class="suave">Los movimientos siguen ahí: lo que falta es el tipo de
      cambio. Tenés que cargarlo <strong>hacia atrás, mes por mes</strong>, en
      Tipos de cambio.
      ${efecto.movimientosSinConvertirAhora > 0
        ? `(${efecto.movimientosSinConvertirAhora} ya no se ${efecto.movimientosSinConvertirAhora === 1 ? 'puede' : 'pueden'} convertir hoy, antes de este cambio.)`
        : ''}</p>` : ''}

      <div class="botones">
        <button type="button" class="peligro" data-accion="confirmar-base" data-moneda="${escapar(efecto.destino)}">
          Sí, usar ${escapar(efecto.destino)}
        </button>
        <button type="button" class="secundario" data-accion="cancelar-base">Dejar como está</button>
      </div>
    </div>
  `;
}

export function dibujarMonedaBase(vista) {
  const estado = vista.estado ?? {};
  const actual = monedaBaseDe(estado);
  const efecto = vista.baseElegida ? efectoDeCambiarBase(estado, vista.baseElegida) : null;

  const opciones = monedasVisibles(estado.monedas ?? []).map((m) => `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">${escapar(m.codigo)} — ${escapar(m.nombre)}</span>
        ${m.codigo === actual
          ? '<span class="suave">es la base</span>'
          : `<button type="button" class="secundario chico" data-accion="elegir-base" data-moneda="${escapar(m.codigo)}">Usar esta</button>`}
      </span>
    </li>`).join('');

  return `
    ${vista.error ? `<p class="error-carga" role="alert">${escapar(vista.error)}</p>` : ''}
    ${vista.avisoBase ? `<p class="confirmacion" role="status">${escapar(vista.avisoBase)}</p>` : ''}
    ${dibujarEfectoDeBase(efecto)}

    <section class="tarjeta">
      <h2>Moneda base</h2>
      <p class="suave nota">Es la moneda en la que se muestran <strong>todos los
      totales</strong>: el resumen del mes, la evolución, los viajes. Es también
      la única que no lleva tipo de cambio, porque vale 1 contra sí misma.</p>
      <p class="suave">Ahora es <strong>${escapar(actual)}</strong>.</p>

      <ul class="rubros">${opciones}</ul>

      <p class="suave nota">Los ahorros conjuntos no usan la moneda base: ahí cada
      moneda se muestra por separado y nunca se convierte.</p>
    </section>
  `;
}
