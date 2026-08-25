// Pedir y corregir tipos de cambio — CU-03.
//
// Dos cosas que parecen la misma y no lo son:
//
//   1. **Pedirlo al vuelo.** Estás en Costa Rica, cargás el primer gasto en
//      colones de marzo, y la app no puede convertirlo a euros. Ahí interrumpe,
//      lo pide, y sigue. Es un momento de fricción inevitable y hay que hacerlo
//      lo más corto posible: un solo campo, con el gasto que estabas cargando a
//      la vista para que se entienda por qué se interrumpió.
//
//   2. **Corregir uno ya usado.** Volviste del viaje y el tipo de cambio estaba
//      mal. Corregirlo arregla el mes entero (RN-05), pero también **cambia
//      totales que ya viste**. Eso no puede pasar en silencio: la app dice
//      cuántos movimientos toca antes de aplicarlo.
//
// El campo se escribe en el sentido en que la gente conoce el dato —"un euro son
// 630 colones"— y la app lo invierte para guardarlo. Escribirlo al revés es el
// error más fácil de cometer acá, y no da ningún error: da totales absurdos.

import { escapar } from '../app.js';
import {
  crearCambio,
  guardarCambio,
  buscarCambio,
  desdeUnidadesPorEuro,
  movimientosAfectadosPor,
} from '../../core/cambio.js';
import { formatearMes, formatearMonto, formatearTipoDeCambio, formatearEuros } from '../../core/formato.js';
import { buscarMoneda, decimalesDe, MONEDA_BASE } from '../../core/monedas.js';
import { convertirAEuros, aMinimas } from '../../core/dinero.js';
import { normalizarMoneda } from '../../core/modelo.js';

/**
 * Interpreta lo que el usuario escribió como tipo de cambio.
 *
 * Acepta coma o punto decimal, porque el teclado del celular mete punto y la
 * cabeza escribe coma. No usa `dinero.js`: esto no es un monto en unidades
 * mínimas sino un factor, y puede tener muchos decimales (`0,0000062`).
 */
export function leerTipoDeCambio(entrada) {
  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada) || entrada <= 0) {
      throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
    }
    return entrada;
  }
  if (typeof entrada !== 'string') {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }

  const limpio = entrada.trim().replace(/\s/g, '').replace(',', '.');

  // Un negativo SÍ es un número, solo que no sirve acá. Decirle "no es un
  // número" a alguien que escribió -630 lo manda a buscar un error de tipeo que
  // no existe, en vez de explicarle la regla.
  if (/^-/.test(limpio)) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }
  if (limpio === '' || !/^\d*\.?\d+$/.test(limpio)) {
    throw new Error(`"${entrada}" no es un número. Escribí solo cifras, con coma o punto para los decimales.`);
  }

  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }
  return numero;
}

/**
 * Guarda un tipo de cambio escrito **en unidades por euro**, que es como la
 * gente lo conoce. La app lo invierte antes de guardarlo (ADR de `core/cambio.js`).
 *
 * Nunca tira: devuelve `{ estado, error }`, como el resto de las pantallas.
 */
export function intentarGuardarCambio(estado, { moneda, mes, unidadesPorEuro }) {
  let codigo;
  try {
    codigo = normalizarMoneda(moneda);
  } catch (error) {
    return { estado, error: error.message };
  }

  if (codigo === MONEDA_BASE) {
    return { estado, error: 'El euro no lleva tipo de cambio: es la moneda en la que se expresan todos los totales.' };
  }

  let valor;
  try {
    valor = leerTipoDeCambio(unidadesPorEuro);
  } catch (error) {
    return { estado, error: error.message };
  }

  let cambio;
  try {
    cambio = crearCambio({ moneda: codigo, mes, euros_por_unidad: desdeUnidadesPorEuro(valor) });
  } catch (error) {
    return { estado, error: error.message };
  }

  return { estado: { ...estado, tipos_cambio: guardarCambio(estado.tipos_cambio, cambio) } };
}

/**
 * Cuántos movimientos cambiarían de importe si se corrigiera este tipo de
 * cambio, y en cuánto cambiaría el total de ese mes.
 *
 * Existe por RN-05, que es una decisión incómoda a propósito: el importe en
 * euros se deriva, así que corregir una vez arregla el mes entero — y también
 * cambia números que el usuario ya dio por buenos. La app tiene que mostrar esa
 * consecuencia **antes**, no después.
 */
export function efectoDeCorregir(estado, moneda, mes, nuevasUnidadesPorEuro) {
  const codigo = normalizarMoneda(moneda);
  const afectados = movimientosAfectadosPor(estado.movimientos, codigo, mes);
  if (afectados === 0) return { afectados: 0 };

  let nuevoValor;
  try {
    nuevoValor = desdeUnidadesPorEuro(leerTipoDeCambio(nuevasUnidadesPorEuro));
  } catch {
    return { afectados };
  }

  const viejoValor = buscarCambio(estado.tipos_cambio, codigo, mes);
  if (viejoValor === null) return { afectados };

  const decimales = decimalesDe(estado.monedas, codigo);
  const delMes = estado.movimientos.filter(
    (m) => normalizarMoneda(m.moneda) === codigo && m.fecha.slice(0, 7) === mes
  );

  const antes = delMes.reduce((t, m) => t + convertirAEuros(m.monto, decimales, viejoValor), 0);
  const despues = delMes.reduce((t, m) => t + convertirAEuros(m.monto, decimales, nuevoValor), 0);

  return { afectados, antes, despues, diferencia: despues - antes };
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

/**
 * La interrupción: el gasto que se estaba cargando necesita un tipo de cambio.
 *
 * Muestra el movimiento a la vista, porque el usuario no pidió esta pantalla —
 * lo interrumpimos nosotros— y tiene que entender en un vistazo por qué.
 */
export function dibujarPedido(vista) {
  const falta = vista.faltaCambio;
  if (!falta) return '';

  const moneda = buscarMoneda(vista.estado.monedas, falta.moneda);
  const nombre = moneda ? moneda.nombre : falta.moneda;

  // ¿Es la primera vez, o se está corrigiendo uno que ya se usó? No es lo
  // mismo: lo segundo cambia totales que el usuario ya vio (RN-05).
  const actual = buscarCambio(vista.estado.tipos_cambio, falta.moneda, falta.mes);
  const corrigiendo = actual !== null;
  const efecto = corrigiendo
    ? efectoDeCorregir(vista.estado, falta.moneda, falta.mes, vista.borradorCambio)
    : null;

  const explicacion = corrigiendo
    ? `Ahora está cargado como <strong>${escapar(formatearTipoDeCambio(actual, falta.moneda))}</strong>.
       Corregirlo vuelve a calcular todos los movimientos de ${escapar(formatearMes(falta.mes))} en esa moneda.`
    : `Es el primer movimiento en ${escapar(falta.moneda)} de
       ${escapar(formatearMes(falta.mes))}, y sin el tipo de cambio no se puede
       expresar en euros. Vale para todos los movimientos de ese mes, y después
       se puede corregir.`;

  return `
    <form class="tarjeta formulario" data-formulario="cambio" novalidate>
      <h2>${corrigiendo ? 'Corregir el tipo de cambio' : `¿Cuánto vale el ${escapar(nombre.toLowerCase())}?`}</h2>

      <p class="suave">${explicacion}</p>

      ${vista.error ? `<p class="error-carga" role="alert">${escapar(vista.error)}</p>` : ''}
      <div data-aviso-correccion>${dibujarAvisoCorreccion(efecto, falta.moneda)}</div>

      <label class="campo">
        <span>1 EUR son…</span>
        <div class="monto-fila">
          <input name="unidadesPorEuro" class="importe" type="text" inputmode="decimal"
                 autocomplete="off" enterkeyhint="done" placeholder="630"
                 value="${escapar(vista.borradorCambio ?? '')}">
          <span class="sufijo">${escapar(falta.moneda)}</span>
        </div>
      </label>

      <input type="hidden" name="moneda" value="${escapar(falta.moneda)}">
      <input type="hidden" name="mes" value="${escapar(falta.mes)}">

      <button type="submit" class="principal" data-accion="guardar-cambio">
        ${corrigiendo ? 'Aplicar la corrección' : 'Guardar y seguir'}
      </button>
      <button type="button" class="secundario" data-accion="cancelar-cambio">
        Ahora no
      </button>
    </form>
  `;
}

/**
 * La pantalla de tipos de cambio: ver los que hay y corregirlos.
 *
 * Cada fila dice cuántos movimientos usan ese tipo de cambio. Es la información
 * que convierte "corregir un número" en "cambiar el total de once gastos", que
 * es lo que en realidad está pasando.
 */
export function dibujarCambios(vista) {
  const estado = vista.estado;
  const cambios = [...estado.tipos_cambio].sort(
    (a, b) => b.mes.localeCompare(a.mes) || a.moneda.localeCompare(b.moneda)
  );

  if (cambios.length === 0) {
    return `
      <section class="tarjeta">
        <h2>Tipos de cambio</h2>
        <p class="suave">Todavía no hay ninguno. La app te lo va a pedir sola la
        primera vez que cargues un gasto en otra moneda.</p>
      </section>
    `;
  }

  const filas = cambios
    .map((c) => {
      const usados = movimientosAfectadosPor(estado.movimientos, c.moneda, c.mes);
      const cuantos =
        usados === 0
          ? 'sin movimientos todavía'
          : usados === 1
            ? '1 movimiento lo usa'
            : `${usados} movimientos lo usan`;

      return `
        <li class="linea-cambio">
          <div>
            <span class="mes-cambio">${escapar(formatearMes(c.mes))}</span>
            <span class="suave">${escapar(cuantos)}</span>
          </div>
          <div class="valor-cambio">
            <span class="importe">${escapar(formatearTipoDeCambio(c.euros_por_unidad, c.moneda))}</span>
            <button type="button" class="secundario chico"
                    data-accion="corregir-cambio"
                    data-moneda="${escapar(c.moneda)}" data-mes="${escapar(c.mes)}">Corregir</button>
          </div>
        </li>`;
    })
    .join('');

  return `
    <section class="tarjeta">
      <h2>Tipos de cambio</h2>
      <p class="suave">Cada uno vale para todos los movimientos de su mes (RN-04).
      Corregir uno cambia los totales de ese mes.</p>
      <ul class="lineas">${filas}</ul>
    </section>
  `;
}

/**
 * El aviso antes de aplicar una corrección: cuántos movimientos cambian y en
 * cuánto queda el total del mes. Sin esto, un número cambiaría solo.
 */
export function dibujarAvisoCorreccion(efecto, moneda) {
  if (!efecto || efecto.afectados === 0) return '';
  if (efecto.diferencia === undefined) {
    return `<p class="confirmacion">Este tipo de cambio lo usan ${efecto.afectados} movimientos.</p>`;
  }

  const signo = efecto.diferencia > 0 ? 'sube' : efecto.diferencia < 0 ? 'baja' : 'no cambia';
  const cuantos = efecto.afectados === 1 ? '1 movimiento' : `${efecto.afectados} movimientos`;

  return `
    <p class="confirmacion" role="status">
      Afecta a ${cuantos} en ${escapar(normalizarMoneda(moneda))}.
      El total de ese mes ${signo} de <strong>${escapar(formatearEuros(efecto.antes))}</strong>
      a <strong>${escapar(formatearEuros(efecto.despues))}</strong>.
    </p>
  `;
}

/** El movimiento que quedó esperando, para mostrarlo mientras se pide el dato. */
export function dibujarMovimientoEnEspera(estado, borrador) {
  if (!borrador?.monto) return '';
  let importe = `${borrador.monto} ${borrador.moneda}`;
  try {
    const decimales = decimalesDe(estado.monedas, borrador.moneda);
    importe = formatearMonto(aMinimas(borrador.monto, decimales), decimales, borrador.moneda);
  } catch {
    // Si no se puede formatear, se muestra tal como lo escribió: es preferible
    // a no mostrar nada, que dejaría al usuario sin saber qué quedó pendiente.
  }

  return `
    <p class="en-espera">
      Esperando para guardar: <strong>${escapar(importe)}</strong>
      ${borrador.rubro ? `· ${escapar(borrador.rubro)}` : ''}
    </p>
  `;
}
