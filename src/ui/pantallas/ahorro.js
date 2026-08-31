// Cargar, corregir y borrar un movimiento de ahorro — T-045, CU-14.
//
// ── Por qué es un formulario aparte del de gastos ────────────────────────────
//
// Porque son otra cosa, y el usuario lo dijo antes que yo: "no son gastos e
// ingresos normales, son una cosa aparte". Un ahorro no tiene rubro y sí tiene
// persona; no entra en el saldo del mes ni en la evolución. Meter una tercera
// opción en el formulario que se usa todos los días haría más lento el 99 % de
// las cargas para servir al 1 %.
//
// ── Y por qué, aun así, funciona EXACTAMENTE igual ───────────────────────────
//
// Mismo borrador, misma función pura que intenta guardar y devuelve estado
// nuevo, mismos avisos, mismo "deshacer" al borrar. Lo que cambia son los
// campos; lo que no cambia es cómo se comporta. Que dos pantallas parecidas
// tengan mecánicas distintas es lo que obliga a aprender la app dos veces.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras: reciben
// estado y devuelven texto o estado nuevo. Quien guarda es `ui/app.js`.

import { escapar } from '../app.js';
import { crearAhorro, PERSONAS, AHORRO_ENTRA, AHORRO_SALE } from '../../core/ahorros.js';
import { decimalesDe, monedasVisibles } from '../../core/monedas.js';
import { formatearNumero } from '../../core/formato.js';
import { hoy } from '../../core/modelo.js';
import { opciones, fechaEnPalabras, dibujarError, dibujarSugerencias } from './movimiento.js';

/** El formulario vacío. */
export function borradorDeAhorro({ estado, fecha, persona } = {}) {
  return {
    fecha: fecha ?? hoy(),
    tipo: AHORRO_ENTRA,
    // La persona y la moneda se mantienen entre cargas: quien anota los
    // ahorros de un mes suele cargar varios seguidos del mismo lado.
    persona: persona ?? PERSONAS[0],
    monto: '',
    moneda: estado?.preferencias?.moneda_predeterminada ?? 'EUR',
    comentario: '',
    detalle: '',
  };
}

/**
 * El formulario cargado con un ahorro que ya existe, para corregirlo.
 *
 * El monto vuelve a texto con la coma decimal del español: si volviera como
 * `12.5`, el usuario vería su movimiento escrito de una forma en la que él
 * nunca lo escribiría.
 */
export function borradorDesdeAhorro(ahorro, decimales) {
  return {
    id: ahorro.id,
    fecha: ahorro.fecha,
    tipo: ahorro.tipo,
    persona: ahorro.persona,
    monto: formatearNumero(ahorro.monto, decimales),
    moneda: ahorro.moneda,
    comentario: ahorro.comentario,
    detalle: ahorro.detalle,
  };
}

/**
 * Intenta guardar. Devuelve `{ estado, borrador, aviso, error }` — nunca tira.
 *
 * **No pide tipo de cambio**, a diferencia de los gastos (RN-04): los ahorros no
 * se convierten a euros nunca, así que un ahorro en pesos no queda fuera de
 * ningún total por no tener cambio. Es la misma regla de siempre vista desde el
 * otro lado — pedir un dato que no se va a usar es pedirlo porque sí.
 */
export function intentarGuardarAhorro(estado, borrador) {
  let decimales;
  try {
    decimales = decimalesDe(estado.monedas, borrador.moneda);
  } catch (error) {
    return { estado, borrador, error: error.message };
  }

  const anteriores = estado.ahorros ?? [];
  const original = borrador.id ? anteriores.find((a) => a.id === borrador.id) : null;

  let ahorro;
  try {
    // Al corregir se conservan el identificador y el día de carga: es el mismo
    // movimiento con otros datos, no uno nuevo.
    ahorro = crearAhorro(borrador, { decimales, id: original?.id, creado: original?.creado });
  } catch (error) {
    // El mensaje viene del modelo, ya escrito para una persona.
    return { estado, borrador, error: error.message };
  }

  const posicion = borrador.id ? anteriores.findIndex((a) => a.id === borrador.id) : -1;
  const corrigiendo = posicion !== -1;

  const nuevoEstado = {
    ...estado,
    ahorros: corrigiendo
      ? anteriores.map((a, i) => (i === posicion ? ahorro : a))
      : [...anteriores, ahorro],
    preferencias: { ...estado.preferencias, moneda_predeterminada: ahorro.moneda },
  };

  return {
    estado: nuevoEstado,
    corrigiendo,
    // El formulario se vacía pero conserva la fecha y la persona: cargar los
    // ahorros de un mes es cargar varios seguidos parecidos.
    borrador: borradorDeAhorro({ estado: nuevoEstado, fecha: ahorro.fecha, persona: ahorro.persona }),
    aviso: { ahorro, decimales, corrigiendo },
  };
}

/** Saca un ahorro, y devuelve lo necesario para poder deshacerlo. */
export function borrarAhorro(estado, id) {
  const anteriores = estado.ahorros ?? [];
  const posicion = anteriores.findIndex((a) => a.id === id);
  if (posicion === -1) return { estado, borrado: null };

  return {
    estado: { ...estado, ahorros: anteriores.filter((a) => a.id !== id) },
    borrado: { ahorro: anteriores[posicion], posicion },
  };
}

/** Vuelve a poner un ahorro borrado en su lugar exacto. */
export function restaurarAhorro(estado, borrado) {
  if (!borrado) return estado;

  const ahorros = [...(estado.ahorros ?? [])];
  ahorros.splice(Math.min(borrado.posicion, ahorros.length), 0, borrado.ahorro);
  return { ...estado, ahorros };
}

/** Busca un ahorro por su identificador. */
export function buscarAhorro(estado, id) {
  return (estado.ahorros ?? []).find((a) => a.id === id) ?? null;
}

/** Las etiquetas de ahorro ya usadas, para ofrecerlas al escribir (RN-03). */
export function etiquetasDeAhorros(estado) {
  const vistas = new Map();
  for (const ahorro of estado.ahorros ?? []) {
    const texto = String(ahorro.comentario ?? '').trim();
    if (texto === '') continue;
    if (!vistas.has(texto.toLowerCase())) vistas.set(texto.toLowerCase(), texto);
  }
  return [...vistas.values()];
}

function dibujarAvisoDeAhorro(aviso) {
  if (!aviso?.ahorro) return '';

  const entra = aviso.ahorro.tipo === AHORRO_ENTRA;
  const que = aviso.corrigiendo
    ? 'Cambio guardado'
    : `Guardado: ${entra ? 'entró' : 'salió'} plata del ahorro`;

  return `<p class="confirmacion" role="status">${escapar(que)}.</p>`;
}

export function dibujarNuevoAhorro(vista) {
  const estado = vista.estado ?? {};
  const borrador = vista.borradorDeAhorro ?? borradorDeAhorro({ estado });
  const entra = borrador.tipo !== AHORRO_SALE;

  const monedas = monedasVisibles(estado.monedas ?? []).map((m) => ({ valor: m.codigo, texto: m.codigo }));

  return `
    <form class="tarjeta formulario" data-formulario="ahorro" novalidate>
      <h2>${borrador.id ? 'Corregir movimiento de ahorro' : 'Cargar en ahorros conjuntos'}</h2>

      ${dibujarError(vista.error)}
      ${dibujarAvisoDeAhorro(vista.aviso)}

      <!-- Entró / Salió en vez de Ingreso / Gasto: acá la plata no entra ni sale
           de la casa, entra o sale DEL AHORRO. Un ahorro que se usa para pagar
           un vuelo no es un ingreso de nada. -->
      <div class="tipo" role="group" aria-label="Qué pasó con la plata">
        <button type="button" class="opcion-tipo${entra ? ' activa' : ''}"
                data-accion="tipo-ahorro" data-tipo="${AHORRO_ENTRA}" aria-pressed="${entra}">Entró al ahorro</button>
        <button type="button" class="opcion-tipo${entra ? '' : ' activa'}"
                data-accion="tipo-ahorro" data-tipo="${AHORRO_SALE}" aria-pressed="${!entra}">Salió del ahorro</button>
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
        <span>¿De quién es?</span>
        <select name="persona">${opciones(PERSONAS, borrador.persona)}</select>
      </label>

      <label class="campo">
        <span>Fecha</span>
        <input name="fecha" type="date" value="${escapar(borrador.fecha)}">
        <span class="fecha-legible" data-fecha-legible>${escapar(fechaEnPalabras(borrador.fecha))}</span>
      </label>

      <label class="campo">
        <span>Detalle <em class="suave">— para acordarte</em></span>
        <!-- Texto libre y nada más: acá va "plazo fijo, vence el 28/08/26", que
             es información para leer y no una categoría (pedido del usuario). -->
        <input name="detalle" type="text" autocomplete="off"
               placeholder="plazo fijo, vence el 28/08/26" value="${escapar(borrador.detalle)}">
      </label>

      <label class="campo">
        <span>Etiqueta <em class="suave">(agrupar por)</em></span>
        <input name="comentario" type="text" autocomplete="off"
               placeholder="Para viajes, Regalos…" value="${escapar(borrador.comentario)}">
        <div class="sugerencias" data-sugerencias="comentario">${
          dibujarSugerencias('comentario', borrador.comentario, etiquetasDeAhorros(estado))
        }</div>
      </label>

      <button type="submit" class="principal" data-accion="guardar-ahorro">
        ${borrador.id ? 'Guardar los cambios' : 'Guardar en ahorros'}
      </button>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="ahorros">
        ${borrador.id ? 'Dejar como estaba' : 'Volver a los ahorros'}
      </button>
    </form>
  `;
}
