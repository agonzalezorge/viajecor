// Los ahorros conjuntos — CU-14, T-041. Reemplaza la hoja `Ahorros conjuntos`.
//
// ── Lo que esta pantalla NO muestra, y es su decisión más importante ─────────
//
// **No hay ningún número que junte las monedas.** Sumar euros con pesos
// uruguayos exige convertirlos, y esa conversión inventa un número que no existe
// hasta que la plata se cambie de verdad — y que cambiaría solo, todos los días,
// sin que nadie toque nada. Que ese total no esté es el resultado correcto, y la
// pantalla lo dice con todas las letras para que no se lea como algo que falta.
//
// ── Qué muestra, en el orden en que se pregunta ─────────────────────────────
//
//   1. Cuánto hay en cada moneda.
//   2. Dentro de cada moneda, cuánto puso cada uno. Es para lo que existe la
//      hoja: los ahorros son de dos.
//   3. El historial, del movimiento más nuevo al más viejo.
//
// El detalle se muestra tal como se escribió y **no agrupa nada**: el usuario
// fue explícito en que "plazo fijo" es información suya para leer, no una
// categoría (2026-08-31).
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { totalPorPersona, ahorrosOrdenados, aporteDe, AHORRO_SALE } from '../../core/ahorros.js';
import { formatearEnSuMoneda, formatearFecha } from '../../core/formato.js';

/**
 * Un importe en SU moneda. **Nunca en euros**: ver arriba.
 *
 * Es `formatearEnSuMoneda()` con otro nombre, para que las llamadas de esta
 * pantalla se lean diciendo qué es lo que no hacen: convertir.
 */
export function importeDeAhorro(minimas, moneda, monedas) {
  return formatearEnSuMoneda(minimas, moneda, monedas);
}

/** El bloque de una moneda: cuánto hay, y cuánto puso cada uno. */
export function dibujarMonedaDeAhorro(bloque, monedas) {
  const personas = bloque.personas.map((p) => `
    <div class="rubro-pie suave">
      <span>${escapar(p.persona)}</span>
      <span>${escapar(importeDeAhorro(p.total, bloque.moneda, monedas))}</span>
    </div>`).join('');

  return `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">${escapar(bloque.moneda)}</span>
        <span class="importe">${escapar(importeDeAhorro(bloque.total, bloque.moneda, monedas))}</span>
      </span>
      ${personas}
    </li>
  `;
}

/** Una línea del historial. */
export function dibujarMovimientoDeAhorro(movimiento, monedas) {
  const salida = movimiento.tipo === AHORRO_SALE;
  const signo = salida ? '−' : '+';
  const pie = [movimiento.persona, movimiento.detalle].filter((t) => t !== '').join(' · ');

  return `
    <li class="fila-rubro">
      <span class="rubro-cabeza">
        <span class="nombre">${escapar(movimiento.comentario || (salida ? 'Salida' : 'Entrada'))}</span>
        <span class="importe ${salida ? 'gasto' : 'ingreso'}">${escapar(signo)}${escapar(importeDeAhorro(movimiento.monto, movimiento.moneda, monedas))}</span>
      </span>
      <div class="rubro-pie suave">
        <span>${escapar(formatearFecha(movimiento.fecha))}</span>
        <span>${escapar(pie)}</span>
      </div>
    </li>
  `;
}

export function dibujarAhorros(vista) {
  const estado = vista.estado ?? {};
  const monedas = estado.monedas ?? [];
  const porMoneda = totalPorPersona(estado);

  if (porMoneda.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Ahorros conjuntos</h2>
        <p class="suave">Todavía no hay ninguno. Acá va la plata guardada de los
        dos, en cada moneda: lo que entra y lo que sale, sin mezclarse con los
        gastos del mes.</p>
      </section>
    `;
  }

  const historial = ahorrosOrdenados(estado);

  return `
    <section class="tarjeta">
      <h2>Ahorros conjuntos</h2>
      <p class="suave nota">Cuánto hay en cada moneda, y cuánto puso cada uno.
      <strong>No se suman entre sí</strong>: pasar pesos a euros al cambio de hoy
      daría un número que cambia solo todos los días y que no existe hasta que la
      plata se cambie de verdad.</p>
      <ul class="rubros">${porMoneda.map((b) => dibujarMonedaDeAhorro(b, monedas)).join('')}</ul>
    </section>

    <section class="tarjeta">
      <h2>Movimientos de los ahorros</h2>
      <p class="suave nota">${historial.length === 1 ? '1 movimiento' : `${historial.length} movimientos`},
      del más nuevo al más viejo. <strong>+</strong> es plata que entró al ahorro
      y <strong>−</strong> plata que salió.</p>
      <ul class="rubros">${historial.map((m) => dibujarMovimientoDeAhorro(m, monedas)).join('')}</ul>
    </section>
  `;
}
