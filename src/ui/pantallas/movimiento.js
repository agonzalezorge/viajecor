// La pantalla de carga: CU-01 (registrar un gasto) y CU-02 (registrar un
// ingreso). Es la razón de ser de la app — todo lo demás mira datos que entran
// por acá.
//
// El objetivo declarado en PRODUCTO es "anotar un gasto en menos de quince
// segundos, sin conexión". De ahí salen casi todas las decisiones de abajo:
// la fecha viene puesta en hoy, la moneda en la última usada, el tipo en gasto,
// y el monto es el primer campo, porque es el único que la app no puede adivinar.
//
// Igual que el armazón (ADR-022), esto son funciones puras que devuelven texto
// HTML. Quien las mete en el documento es `ui/app.js`.

import { crearMovimiento, rubrosDe, TIPO_GASTO, TIPO_INGRESO, hoy } from '../../core/modelo.js';
import { monedasVisibles, decimalesDe } from '../../core/monedas.js';
import { faltaCambioPara } from '../../core/cambio.js';
import { formatearMonto, formatearFecha, formatearFechaLarga, formatearDiaSemana, formatearMes, formatearRubro } from '../../core/formato.js';
import { claseDeRubro } from '../colores.js';
import { escapar } from '../app.js';
import { dibujarPedido, dibujarMovimientoEnEspera } from './cambio.js';

/**
 * Los campos vacíos de un formulario nuevo.
 *
 * Tres vienen puestos y los tres tienen el mismo motivo: son los que casi
 * siempre valen lo mismo, y tocarlos sería trabajo repetido. La moneda se
 * hereda de la última usada (RN-04), que es lo que evita elegir "colón" treinta
 * veces seguidas en un viaje a Costa Rica.
 */
export function borradorNuevo({ estado, fecha } = {}) {
  return {
    fecha: fecha ?? hoy(),
    tipo: TIPO_GASTO,
    monto: '',
    moneda: estado?.preferencias?.moneda_predeterminada ?? 'EUR',
    rubro: '',
    comentario: '',
    detalle: '',
  };
}

/**
 * Intenta guardar. Devuelve `{ estado, borrador, aviso, error }` — nunca tira.
 *
 * Es una función pura: recibe el estado y devuelve uno nuevo. Quien lo persiste
 * es `ui/app.js` llamando a `guardarEstado()`. Separarlo así permite testear
 * todo lo que puede salir mal —que es casi todo lo interesante— sin navegador y
 * sin almacenamiento.
 */
export function intentarGuardar(estado, borrador) {
  let decimales;
  try {
    decimales = decimalesDe(estado.monedas, borrador.moneda);
  } catch (error) {
    return { estado, borrador, error: error.message };
  }

  let movimiento;
  try {
    movimiento = crearMovimiento(borrador, { decimales });
  } catch (error) {
    // El mensaje viene del modelo, ya escrito para una persona. Repetirlo acá
    // con otras palabras sería tener dos versiones de la misma regla.
    return { estado, borrador, error: error.message };
  }

  // RN-04: no se guarda un movimiento en moneda extranjera sin tipo de cambio,
  // porque no habría forma de expresarlo en euros y quedaría fuera de todos los
  // totales sin que nada lo delate.
  const falta = faltaCambioPara(movimiento, estado.tipos_cambio);
  if (falta) {
    return {
      estado,
      borrador,
      error:
        `Falta el tipo de cambio de ${falta.moneda} para ${formatearMes(falta.mes)}. ` +
        `Sin él este gasto no podría contarse en ningún total, así que todavía no se guarda. ` +
        `Cargalo desde la pantalla de tipos de cambio.`,
      faltaCambio: falta,
    };
  }

  const nuevoEstado = {
    ...estado,
    movimientos: [...estado.movimientos, movimiento],
    // La moneda elegida queda como predeterminada para la próxima carga (RN-04).
    preferencias: { ...estado.preferencias, moneda_predeterminada: movimiento.moneda },
  };

  return {
    estado: nuevoEstado,
    // El formulario se vacía pero conserva la fecha: cuando alguien carga tres
    // gastos del sábado, volver a poner la fecha en cada uno es exactamente el
    // trabajo repetido que esta app viene a sacar.
    borrador: borradorNuevo({ estado: nuevoEstado, fecha: movimiento.fecha }),
    aviso: { movimiento, decimales },
  };
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

/**
 * La fecha escrita en palabras, para poner debajo del calendario del sistema.
 *
 * Si la fecha no se puede leer todavía —el campo a medio escribir— devuelve
 * vacío en vez de tirar: un formulario a medio llenar no es un error.
 */
export function fechaEnPalabras(iso) {
  try {
    return `${formatearDiaSemana(iso)}, ${formatearFechaLarga(iso)}`;
  } catch {
    return '';
  }
}

function opciones(valores, elegido) {
  return valores
    .map((v) => {
      const valor = typeof v === 'string' ? v : v.valor;
      const texto = typeof v === 'string' ? v : v.texto;
      return `<option value="${escapar(valor)}"${valor === elegido ? ' selected' : ''}>${escapar(texto)}</option>`;
    })
    .join('');
}

function dibujarAviso(aviso) {
  if (!aviso) return '';
  const { movimiento, decimales } = aviso;
  const importe = formatearMonto(movimiento.monto, decimales, movimiento.moneda);
  const que = movimiento.tipo === TIPO_GASTO ? 'Gasto' : 'Ingreso';

  return `
    <p class="confirmacion" role="status">
      ${que} guardado: <strong>${escapar(importe)}</strong> ·
      ${escapar(formatearRubro(movimiento.rubro))} · ${escapar(formatearFecha(movimiento.fecha))}
    </p>
  `;
}

function dibujarError(error) {
  if (!error) return '';
  return `<p class="error-carga" role="alert">${escapar(error)}</p>`;
}

/**
 * Los últimos movimientos cargados, para responder "¿se guardó?" sin cambiar de
 * pantalla. No es la lista de verdad —esa es T-015, con editar y borrar—: son
 * cinco líneas de confirmación.
 */
function dibujarUltimos(estado) {
  const ultimos = estado.movimientos.slice(-5).reverse();
  if (ultimos.length === 0) return '';

  const filas = ultimos
    .map((m) => {
      let importe;
      try {
        importe = formatearMonto(m.monto, decimalesDe(estado.monedas, m.moneda), m.moneda);
      } catch {
        importe = `${m.monto} ${m.moneda}`;
      }
      const signo = m.tipo === TIPO_GASTO ? 'gasto' : 'ingreso';
      return `
        <li class="linea ${signo}">
          <span class="fecha">${escapar(formatearFecha(m.fecha))}</span>
          <span class="rubro">
            <span class="punto-rubro ${claseDeRubro(m.tipo, m.rubro)}" aria-hidden="true"></span>
            ${escapar(formatearRubro(m.rubro))}${m.comentario ? ` · ${escapar(m.comentario)}` : ''}</span>
          <span class="importe">${escapar(importe)}</span>
        </li>`;
    })
    .join('');

  return `
    <section class="tarjeta">
      <h2>Últimos cargados</h2>
      <ul class="lineas">${filas}</ul>
      <p class="suave">Corregir y borrar llega con T-015.</p>
    </section>
  `;
}

export function dibujarNuevo(vista) {
  const estado = vista.estado;
  const borrador = vista.borrador ?? borradorNuevo({ estado });

  // Si el gasto que se está cargando necesita un tipo de cambio, la app
  // interrumpe y lo pide (CU-03). Se reemplaza el formulario en vez de agregar
  // el pedido debajo: dos formularios a la vez son dos cosas para decidir, y
  // este es un momento en que el usuario ya fue interrumpido una vez.
  if (vista.faltaCambio) {
    return dibujarMovimientoEnEspera(estado, borrador) + dibujarPedido(vista);
  }
  const esGasto = borrador.tipo !== TIPO_INGRESO;

  // Solo el código, no "EUR — Euro": el nombre completo no entra al lado del
  // monto en una pantalla de celular y se corta a la mitad, que es peor que no
  // ponerlo. La lista con nombres vive en la pantalla de monedas (T-024).
  const monedas = monedasVisibles(estado.monedas).map((m) => ({
    valor: m.codigo,
    texto: m.codigo,
  }));

  return `
    <form class="tarjeta formulario" data-formulario="movimiento" novalidate>
      <h2>${esGasto ? 'Nuevo gasto' : 'Nuevo ingreso'}</h2>

      ${dibujarError(vista.error)}
      ${dibujarAviso(vista.aviso)}

      <div class="tipo" role="group" aria-label="Tipo de movimiento">
        <button type="button" class="opcion-tipo${esGasto ? ' activa' : ''}"
                data-accion="tipo" data-tipo="${TIPO_GASTO}" aria-pressed="${esGasto}">Gasto</button>
        <button type="button" class="opcion-tipo${esGasto ? '' : ' activa'}"
                data-accion="tipo" data-tipo="${TIPO_INGRESO}" aria-pressed="${!esGasto}">Ingreso</button>
      </div>

      <label class="campo">
        <span>Monto</span>
        <div class="monto-fila">
          <!-- inputmode="decimal" abre el teclado numérico del celular con coma.
               Con el teclado de texto, escribir un importe es tres toques más. -->
          <input name="monto" class="importe" type="text" inputmode="decimal"
                 autocomplete="off" enterkeyhint="done" placeholder="0,00"
                 value="${escapar(borrador.monto)}">
          <select name="moneda" aria-label="Moneda">${opciones(monedas, borrador.moneda)}</select>
        </div>
      </label>

      <label class="campo">
        <span>Rubro</span>
        <!-- El campo se pinta del color del rubro elegido: es la confirmación
             de que quedó puesto el que se quería, sin volver a leerlo. El mismo
             color que va a tener después en el resumen del mes. -->
        <div class="campo-rubro ${borrador.rubro ? claseDeRubro(borrador.tipo, borrador.rubro) : 'sin-elegir'}"
             data-campo-rubro>
          <select name="rubro">
            <option value=""${borrador.rubro ? '' : ' selected'} disabled>Elegí un rubro</option>
            ${opciones(
              rubrosDe(borrador.tipo).map((r) => ({ valor: r, texto: formatearRubro(r) })),
              borrador.rubro
            )}
          </select>
        </div>
      </label>

      <label class="campo">
        <span>Fecha</span>
        <input name="fecha" type="date" value="${escapar(borrador.fecha)}">
        <!-- El calendario de "type=date" lo dibuja el SISTEMA, no la app, y cada
             navegador elige el formato según su propio idioma: puede mostrar
             25/08/2026 o 08/25/2026 y no hay forma de decidirlo desde acá.
             En vez de confiar en que salga bien, la app escribe debajo la fecha
             en español, sin ambigüedad posible. Ver L-013. -->
        <span class="fecha-legible" data-fecha-legible>${escapar(fechaEnPalabras(borrador.fecha))}</span>
      </label>

      <label class="campo">
        <span>Comentario <em class="suave">— viaje o gasto fijo, para agrupar</em></span>
        <input name="comentario" type="text" autocomplete="off"
               placeholder="Roma, Luz…" value="${escapar(borrador.comentario)}">
      </label>

      <label class="campo">
        <span>Detalle <em class="suave">— para acordarte</em></span>
        <input name="detalle" type="text" autocomplete="off"
               placeholder="cena" value="${escapar(borrador.detalle)}">
      </label>

      <button type="submit" class="principal" data-accion="guardar">
        Guardar ${esGasto ? 'gasto' : 'ingreso'}
      </button>
    </form>

    ${dibujarUltimos(estado)}
  `;
}
