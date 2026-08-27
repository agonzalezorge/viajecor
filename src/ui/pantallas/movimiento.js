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
import { formatearMonto, formatearFecha, formatearFechaLarga, formatearDiaSemana, formatearMes, formatearRubro, formatearNumero } from '../../core/formato.js';
import { claseDeRubro } from '../colores.js';
import { escapar } from '../app.js';
import { dibujarPedido, dibujarMovimientoEnEspera } from './cambio.js';
import { comentariosUsados } from '../../core/calculos.js';

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
 * El formulario cargado con un movimiento que ya existe, para corregirlo.
 *
 * El monto vuelve a texto con la coma decimal del español: si volviera como
 * `12.5`, el usuario vería su gasto escrito de una forma en la que él nunca lo
 * escribiría.
 */
export function borradorDesde(movimiento, decimales) {
  return {
    id: movimiento.id,
    fecha: movimiento.fecha,
    tipo: movimiento.tipo,
    monto: formatearNumero(movimiento.monto, decimales),
    moneda: movimiento.moneda,
    rubro: movimiento.rubro,
    comentario: movimiento.comentario,
    detalle: movimiento.detalle,
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

  const original = borrador.id ? estado.movimientos.find((m) => m.id === borrador.id) : null;

  let movimiento;
  try {
    // Al corregir se conservan el identificador y el día de carga: es el mismo
    // movimiento con otros datos, no uno nuevo. Cambiarle el id rompería
    // cualquier cosa que lo señale, y cambiarle `creado` borraría cuándo entró.
    movimiento = crearMovimiento(borrador, {
      decimales,
      id: original?.id,
      creado: original?.creado,
    });
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

  // Corregir un movimiento pasa por acá y no por otro camino: si hubiera dos
  // puertas, tarde o temprano una tendría una validación que la otra no.
  const posicion = borrador.id ? estado.movimientos.findIndex((m) => m.id === borrador.id) : -1;
  const corrigiendo = posicion !== -1;

  const movimientos = corrigiendo
    ? estado.movimientos.map((m, i) => (i === posicion ? movimiento : m))
    : [...estado.movimientos, movimiento];

  const nuevoEstado = {
    ...estado,
    movimientos,
    // La moneda elegida queda como predeterminada para la próxima carga (RN-04).
    preferencias: { ...estado.preferencias, moneda_predeterminada: movimiento.moneda },
  };

  return {
    estado: nuevoEstado,
    corrigiendo,
    // El formulario se vacía pero conserva la fecha: cuando alguien carga tres
    // gastos del sábado, volver a poner la fecha en cada uno es exactamente el
    // trabajo repetido que esta app viene a sacar.
    borrador: borradorNuevo({ estado: nuevoEstado, fecha: movimiento.fecha }),
    aviso: { movimiento, decimales, corrigiendo },
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
  const accion = aviso.corrigiendo ? 'corregido' : 'guardado';

  return `
    <p class="confirmacion" role="status">
      ${que} ${accion}: <strong>${escapar(importe)}</strong> ·
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

/**
 * Los comentarios ya usados, para que el navegador los ofrezca al escribir.
 *
 * Se limita a los 50 más recientes: no por rendimiento —la app recorre listas
 * enteras sin topes (L-001)— sino porque una lista de sugerencias con
 * doscientas entradas no se puede usar en un celular, y las viejas nunca se
 * eligen. **El límite es de lo que se muestra, no de lo que se calcula**, que es
 * la diferencia que importa: ningún total depende de este número.
 */
export function dibujarComentariosUsados(estado) {
  const usados = comentariosUsados(estado?.movimientos ?? []).slice(0, 50);
  if (usados.length === 0) return '';

  return `<datalist id="comentarios-usados">${
    usados.map((texto) => `<option value="${escapar(texto)}"></option>`).join('')
  }</datalist>`;
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
      <h2>${borrador.id ? (esGasto ? 'Corregir gasto' : 'Corregir ingreso') : (esGasto ? 'Nuevo gasto' : 'Nuevo ingreso')}</h2>

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
        <span>Detalle <em class="suave">— para acordarte</em></span>
        <input name="detalle" type="text" autocomplete="off"
               placeholder="cena" value="${escapar(borrador.detalle)}">
      </label>

      <!-- El comentario va último y ofrece los que ya usaste (T-912). No es
           comodidad: el comentario es lo que agrupa los gastos de un viaje
           (RN-03), y "Barcelona26" y "barcelona 26" son dos viajes distintos en
           los totales. Ofrecer lo que ya existe es la forma más barata de que
           elijas la escritura que ya tenés en vez de inventar una nueva.

           Se usa <datalist>, que lo dibuja el navegador: no hay ninguna lista
           flotante propia que mantener, ni teclado que se pelee con ella en un
           celular. La contra es que cada navegador lo muestra a su manera —es la
           misma cesión que el calendario de la fecha, L-013—, pero acá el campo
           sigue siendo un campo de texto común: si el navegador no dibuja nada,
           se escribe igual y no se pierde nada. -->
      <label class="campo">
        <span>Comentario <em class="suave">— viaje o gasto fijo, para agrupar</em></span>
        <input name="comentario" type="text" autocomplete="off" list="comentarios-usados"
               placeholder="Roma, Luz…" value="${escapar(borrador.comentario)}">
        ${dibujarComentariosUsados(estado)}
      </label>

      <button type="submit" class="principal" data-accion="guardar">
        ${borrador.id ? 'Guardar los cambios' : `Guardar ${esGasto ? 'gasto' : 'ingreso'}`}
      </button>
      ${borrador.id ? `
      <button type="button" class="secundario" data-accion="cancelar-edicion">
        Dejar como estaba
      </button>` : ''}
    </form>

    ${dibujarUltimos(estado)}
  `;
}
