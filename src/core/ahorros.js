// Los ahorros conjuntos — CU-14, T-040. Reemplaza la hoja `Ahorros conjuntos`.
//
// ── Por qué es un registro APARTE y no un rubro más ──────────────────────────
//
// Un ahorro no es un gasto ni un ingreso del mes: no entra en el saldo, no va en
// la evolución, no se reparte por rubro. Meterlo en la lista de movimientos
// ensuciaría todos los totales que ya funcionan, y para separarlo después
// habría que acordarse de excluirlo en cada cuenta — o sea, no separarlo nunca.
//
// ── La regla que hace distinto a este módulo: NO SE CONVIERTE A EUROS ────────
//
// Un plazo fijo en pesos uruguayos es un plazo fijo en pesos uruguayos. Pasarlo
// a euros al cambio de hoy inventa un número que no existe hasta que la plata
// se cambie de verdad, y ese número cambiaría solo, todos los días, sin que el
// usuario haya tocado nada.
//
// Por eso **no hay ningún total general**. Hay un total por moneda, y ninguno
// que los junte. Que ese número no exista es el resultado correcto, no algo que
// falte por hacer.
//
// ── Cómo está armada la hoja del usuario ─────────────────────────────────────
//
// `Comentarios | DÍA | DETALLES | MONEDA | MONTO | ALE / IRE | I/G`, con los
// encabezados en la fila 3 y los datos desde la 4. La columna `I/G` es lo que
// hace que esto sea un historial y no una foto: `I` es plata que entró al
// ahorro y `G` plata que salió — "Vuelos Roma / G" es haber sacado del ahorro
// para pagar los vuelos.
//
// ── Lo que la planilla hace mal, y acá no se copia ───────────────────────────
//
// Sus tres cuadros de totales usan **tres rangos distintos** sobre la misma
// tabla: `$E4:$E89` el total por moneda, `$E4:$E93` el de ALE y `$E4:$E97` el de
// IRE. Hoy hay once filas y no muerde; el día que pase de 89, el total general
// va a dejar de contar filas que los de cada persona sí cuentan, y los cuadros
// van a dejar de cerrar entre sí **sin decir nada**. Es exactamente L-001, y es
// la razón por la que acá no hay ningún límite de filas escrito a mano.
//
// Este archivo no toca el navegador: es lógica pura y se testea con node --test.

import {
  validarFecha, nuevoId, normalizarClave, normalizarTextoVisible, normalizarMoneda,
} from './modelo.js';
import { aMinimas, sumar } from './dinero.js';
import { normalizarBusqueda } from './busqueda.js';

/** Plata que entra al ahorro. */
export const AHORRO_ENTRA = 'I';
/** Plata que sale del ahorro. */
export const AHORRO_SALE = 'G';

/**
 * Las dos personas, tal como están escritas en la planilla.
 *
 * Es una lista cerrada a pedido del usuario (2026-08-31): son dos, con nombre
 * propio, y no van a cambiar. Una lista editable sería una pantalla más para
 * mantener algo que nadie va a querer tocar.
 */
export const PERSONAS = Object.freeze(['ALE', 'IRE']);

/**
 * Las monedas escritas como las escribe la planilla.
 *
 * La hoja dice `DÓLARES`, `EUROS`, `PESOS UY`; la app trabaja con códigos ISO
 * porque es lo que ya usa para todo lo demás y lo que permite compartir el
 * catálogo de decimales (ADR-011). La traducción vive acá, en un solo lugar.
 */
export const MONEDAS_DE_LA_PLANILLA = Object.freeze({
  'dolares': 'USD',
  'dolares estadounidenses': 'USD',
  'usd': 'USD',
  'euros': 'EUR',
  'eur': 'EUR',
  'pesos uy': 'UYU',
  'pesos uruguayos': 'UYU',
  'uyu': 'UYU',
});

/**
 * De cómo lo escribe la planilla al código de moneda. Devuelve `null` si no se
 * reconoce, para que quien llame decida: el importador lo cuenta como fila que
 * no entró (RN-05), en vez de meter plata en la moneda equivocada.
 */
export function monedaDeLaPlanilla(texto) {
  // **Sin tildes**: la hoja dice `DÓLARES` y el mapa de arriba `dolares`, y son
  // la misma palabra. Se reutiliza la normalización de la búsqueda (T-943), que
  // además cuida la ñ. Escribir las dos formas en el mapa sería llevar dos
  // listas que un día dejan de estar de acuerdo.
  const clave = normalizarBusqueda(String(texto ?? ''));
  return MONEDAS_DE_LA_PLANILLA[clave] ?? null;
}

/**
 * De cómo la escribe la planilla al nombre de la persona.
 *
 * Compara normalizado —`ale`, `ALE`, `Ale` son la misma— por la misma razón que
 * todo lo demás que agrupa (RN-03, L-002): una escritura distinta partiría los
 * totales de una persona en dos sin avisar.
 */
export function personaDeLaPlanilla(texto) {
  const clave = normalizarClave(String(texto ?? ''));
  return PERSONAS.find((p) => normalizarClave(p) === clave) ?? null;
}

/** Lo mismo para la columna `I/G`. Cualquier otra cosa no es un movimiento. */
export function tipoDeLaPlanilla(texto) {
  const clave = normalizarClave(String(texto ?? ''));
  if (clave === 'i') return AHORRO_ENTRA;
  if (clave === 'g') return AHORRO_SALE;
  return null;
}

/**
 * Arma un movimiento de ahorro válido, o tira explicando qué falta.
 *
 * `decimales` viene del catálogo de monedas del usuario, igual que en los
 * gastos: **el monto se guarda en unidades mínimas** (ADR-005) y sin saber
 * cuántos decimales tiene la moneda, el número quedaría cien veces más grande o
 * más chico.
 */
export function crearAhorro(entrada, { decimales, id, creado } = {}) {
  if (!Number.isInteger(decimales)) {
    throw new Error(
      'Falta saber cuántos decimales usa la moneda: sin ese dato el monto se guardaría cien veces más grande o más chico (RN-04b).'
    );
  }

  const persona = personaDeLaPlanilla(entrada.persona);
  if (persona === null) {
    throw new Error(`"${entrada.persona}" no es una de las dos personas (${PERSONAS.join(', ')}).`);
  }

  const tipo = tipoDeLaPlanilla(entrada.tipo);
  if (tipo === null) {
    throw new Error(`"${entrada.tipo}" no dice si la plata entró (I) o salió (G) del ahorro.`);
  }

  const monto = aMinimas(entrada.monto, decimales);
  if (monto === 0) {
    throw new Error('Un movimiento de cero no se guarda: si no hubo dinero de por medio, no hay nada que registrar.');
  }

  return {
    id: id ?? nuevoId('aho'),
    fecha: validarFecha(entrada.fecha),
    persona,
    tipo,
    monto,
    moneda: normalizarMoneda(entrada.moneda),
    // El comentario y el detalle se guardan TAL COMO SE ESCRIBIERON, igual que
    // en los gastos (ADR-013). El detalle es texto libre y nada más: el usuario
    // fue explícito en que "plazo fijo" es información suya para leer, no una
    // categoría que la app tenga que agrupar (2026-08-31).
    comentario: normalizarTextoVisible(entrada.comentario ?? ''),
    detalle: normalizarTextoVisible(entrada.detalle ?? ''),
    creado: creado ?? validarFecha(entrada.fecha),
  };
}

/** Lo que suma un movimiento: lo que entra suma, lo que sale resta. */
export function aporteDe(movimiento) {
  return movimiento.tipo === AHORRO_SALE ? -movimiento.monto : movimiento.monto;
}

/**
 * Cuánto hay en cada moneda, de la que más tiene a la que menos.
 *
 * **No hay ningún total general y no es un olvido**: sumar monedas distintas
 * exigiría convertirlas, y este módulo existe justamente para no hacer eso.
 *
 * Se listan **todas las monedas que aparecen**, incluso las que quedaron en
 * cero: que un ahorro se haya gastado entero es información, y una moneda que
 * desaparece de la lista se lee como que nunca existió.
 */
export function totalPorMoneda(estado) {
  const porMoneda = new Map();

  for (const movimiento of estado?.ahorros ?? []) {
    const anterior = porMoneda.get(movimiento.moneda) ?? { moneda: movimiento.moneda, total: 0, cuantos: 0 };
    porMoneda.set(movimiento.moneda, {
      ...anterior,
      total: anterior.total + aporteDe(movimiento),
      cuantos: anterior.cuantos + 1,
    });
  }

  return [...porMoneda.values()]
    .sort((a, b) => b.total - a.total || a.moneda.localeCompare(b.moneda));
}

/**
 * Cuánto tiene cada persona en cada moneda.
 *
 * Es para lo que existe la hoja: los ahorros son de dos, y saber cuánto puso
 * cada uno es la mitad del asunto. Van **las dos personas siempre**, aunque una
 * no tenga nada en esa moneda: un cero dice "no tiene", y una fila que falta no
 * dice nada.
 */
export function totalPorPersona(estado) {
  return totalPorMoneda(estado).map(({ moneda, total }) => ({
    moneda,
    total,
    personas: PERSONAS.map((persona) => ({
      persona,
      total: sumar((estado?.ahorros ?? [])
        .filter((m) => m.moneda === moneda && m.persona === persona)
        .map(aporteDe)),
    })),
  }));
}

/**
 * Los movimientos de ahorro, del más nuevo al más viejo.
 *
 * Se ordena por fecha y, entre las de un mismo día, por el orden de carga dado
 * vuelta — la misma regla que la lista de gastos (T-945), por el mismo motivo:
 * lo último que anotaste es lo que vas a querer corregir.
 */
export function ahorrosOrdenados(estado) {
  return [...(estado?.ahorros ?? [])].reverse()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
