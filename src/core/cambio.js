// Tipos de cambio y conversión a euros.
//
// Todo total de la app se expresa en euros (RN-04), pero cada gasto se carga en
// la moneda en que se gastó. Este módulo es el puente: guarda cuánto valía una
// moneda en un mes dado, y convierte.
//
// Dos reglas del producto gobiernan el archivo:
//
//   RN-04 — el tipo de cambio es por (moneda, MES), no por día ni por
//           movimiento. Un viaje de dos semanas usa el mismo para todo el mes.
//   RN-05 — el importe en euros NO se guarda: se deriva. Si más adelante se
//           descubre que el tipo de cambio estaba mal, corregirlo una vez
//           arregla el mes entero.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { convertirAEuros, invertirCambio, sumar } from './dinero.js';
import { normalizarMoneda, mesDe } from './modelo.js';
import { MONEDA_BASE, decimalesDe } from './monedas.js';

/**
 * El euro no necesita tipo de cambio: vale 1 euro por definición. Tenerlo como
 * un dato guardado sería una fuente de error —alguien podría cargarlo mal— y
 * obligaría a pedirlo al usuario la primera vez que registre un gasto en euros,
 * que es el 90% de los casos.
 */
export const CAMBIO_EURO = 1;

const PATRON_MES = /^\d{4}-\d{2}$/;

/**
 * ¿Dos códigos de moneda son el mismo? Sin tirar: un dato guardado puede traer
 * la moneda rota, y buscar un tipo de cambio no es el lugar donde eso tiene que
 * explotar — para eso está la validación al leer (T-004).
 */
function mismoCodigo(uno, otro) {
  try {
    return normalizarMoneda(uno) === normalizarMoneda(otro);
  } catch {
    return false;
  }
}

export function validarMes(mes) {
  if (typeof mes !== 'string' || !PATRON_MES.test(mes)) {
    throw new Error(`El mes se escribe como AAAA-MM (por ejemplo 2026-03), y llegó ${JSON.stringify(mes)}.`);
  }
  const numeroMes = Number(mes.slice(5));
  if (numeroMes < 1 || numeroMes > 12) {
    throw new Error(`No existe el mes ${mes}.`);
  }
  return mes;
}

/**
 * Arma un tipo de cambio para guardar.
 *
 * Se guarda **euros por una unidad de la moneda extranjera**, porque convertir
 * es entonces una multiplicación, que es la operación que menos se presta a
 * error. Al usuario se le puede preguntar en cualquiera de los dos sentidos
 * (CU-03) y la app invierte el número antes de guardarlo — ver `desdeUnidadesPorEuro`.
 */
export function crearCambio({ moneda, mes, euros_por_unidad } = {}, { ahora } = {}) {
  const codigo = normalizarMoneda(moneda);

  if (codigo === MONEDA_BASE) {
    throw new Error('El euro no lleva tipo de cambio: es la moneda en la que se expresan todos los totales.');
  }
  if (!Number.isFinite(euros_por_unidad) || euros_por_unidad <= 0) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }

  return {
    moneda: codigo,
    mes: validarMes(mes),
    euros_por_unidad,
    creado: ahora ?? new Date().toISOString(),
  };
}

/**
 * Toma el tipo de cambio como suele conocerlo el usuario —"un euro son 630
 * colones"— y lo da vuelta a la forma en que se guarda.
 *
 * Existe como función propia y no como una división suelta en la pantalla porque
 * es exactamente el punto donde un número se puede guardar del revés. Un tipo de
 * cambio invertido no da un error: da totales absurdos que alguien tiene que
 * notar mirando.
 */
export function desdeUnidadesPorEuro(unidadesPorEuro) {
  return invertirCambio(unidadesPorEuro);
}

/** El mismo valor visto al revés, para mostrarlo como el usuario lo conoce. */
export function aUnidadesPorEuro(eurosPorUnidad) {
  return invertirCambio(eurosPorUnidad);
}

/**
 * Busca el tipo de cambio de una moneda para un mes. Devuelve `null` si no está:
 * "no hay dato" es una respuesta legítima y frecuente —es lo que dispara que la
 * app lo pida (CU-03)—, no un error.
 *
 * Para el euro devuelve siempre 1 sin buscar nada.
 */
export function buscarCambio(cambios, moneda, mes) {
  const codigo = normalizarMoneda(moneda);
  if (codigo === MONEDA_BASE) return CAMBIO_EURO;

  validarMes(mes);
  if (!Array.isArray(cambios)) {
    throw new Error('La lista de tipos de cambio tiene que ser una lista.');
  }

  // Se recorre la lista entera, sin ningún tope escrito a mano (L-001).
  const encontrado = cambios.find((c) => c && mismoCodigo(c.moneda, codigo) && c.mes === mes);
  return encontrado ? encontrado.euros_por_unidad : null;
}

/**
 * Guarda un tipo de cambio, reemplazando el que hubiera para ese par
 * `(moneda, mes)`. La clave única es el par: no puede haber dos.
 *
 * Devuelve una lista nueva; no modifica la que recibe.
 */
export function guardarCambio(cambios, cambio) {
  const lista = Array.isArray(cambios) ? cambios : [];
  const nuevo = cambio.creado ? cambio : crearCambio(cambio);

  const sinElViejo = lista.filter((c) => !(c && mismoCodigo(c.moneda, nuevo.moneda) && c.mes === nuevo.mes));
  return [...sinElViejo, nuevo];
}

/**
 * ¿Se puede convertir este movimiento a euros?
 *
 * Es la pregunta que la pantalla de carga hace **antes de guardar** (RN-04): si
 * falta el tipo de cambio para la moneda de ese movimiento en su mes, hay que
 * pedirlo. Devuelve `null` si está todo bien, o un objeto que dice qué falta.
 */
export function faltaCambioPara(movimiento, cambios) {
  const moneda = normalizarMoneda(movimiento.moneda);
  if (moneda === MONEDA_BASE) return null;

  const mes = mesDe(movimiento.fecha);
  const cambio = buscarCambio(cambios, moneda, mes);
  return cambio === null ? { moneda, mes } : null;
}

/**
 * Convierte un movimiento a céntimos de euro.
 *
 * **Tira si falta el tipo de cambio**, en vez de devolver 0 o de saltear el
 * movimiento. Un movimiento que se cuenta como cero desaparece de un total sin
 * dejar rastro: el total baja, no hay error, y nadie se entera. Quien llame
 * tiene que haber preguntado antes con `faltaCambioPara()`.
 */
export function movimientoEnEuros(movimiento, cambios, monedas) {
  const moneda = normalizarMoneda(movimiento.moneda);
  const mes = mesDe(movimiento.fecha);
  const decimales = decimalesDe(monedas, moneda);

  if (moneda === MONEDA_BASE) {
    // Ya está en euros: no se convierte ni se redondea. Redondear algo que no
    // hace falta convertir solo puede empeorarlo.
    return movimiento.monto;
  }

  const cambio = buscarCambio(cambios, moneda, mes);
  if (cambio === null) {
    throw new Error(
      `Falta el tipo de cambio de ${moneda} para ${mes}: sin él este movimiento no se puede expresar en euros.`
    );
  }
  return convertirAEuros(movimiento.monto, decimales, cambio);
}

/**
 * Suma en euros una lista de movimientos.
 *
 * Cada movimiento se convierte y se redondea al céntimo **antes** de sumarse, no
 * después: es la unidad en que la app muestra y exporta los importes, así que el
 * total tiene que ser la suma de lo que el usuario ve. Un total que no coincide
 * con la suma de las filas de la pantalla es un total que nadie va a creer,
 * aunque sea "más exacto".
 *
 * No recibe ningún rango ni límite: recorre la lista entera (L-001).
 */
export function totalEnEuros(movimientos, cambios, monedas) {
  if (!Array.isArray(movimientos)) {
    throw new Error('totalEnEuros() espera una lista de movimientos.');
  }
  return sumar(movimientos.map((m) => movimientoEnEuros(m, cambios, monedas)));
}

/**
 * Los tipos de cambio que faltan para poder mostrar en euros una lista de
 * movimientos, sin repetir. Sirve para avisar de una vez —"faltan CRC de marzo y
 * USD de abril"— en vez de ir descubriéndolos de a uno.
 */
export function cambiosQueFaltan(movimientos, cambios) {
  const vistos = new Map();
  for (const movimiento of movimientos) {
    const falta = faltaCambioPara(movimiento, cambios);
    if (falta) vistos.set(`${falta.moneda}|${falta.mes}`, falta);
  }
  return [...vistos.values()];
}

/**
 * Cuántos movimientos se verían afectados por cambiar el tipo de cambio de
 * `(moneda, mes)`.
 *
 * Existe por RN-05: corregir un tipo de cambio **cambia totales de meses ya
 * cerrados**, y la app tiene que decir cuántos movimientos toca *antes* de
 * aplicarlo. Un número que cambia solo, sin aviso, es la forma más rápida de que
 * alguien deje de confiar en la app.
 */
export function movimientosAfectadosPor(movimientos, moneda, mes) {
  const codigo = normalizarMoneda(moneda);
  validarMes(mes);
  if (!Array.isArray(movimientos)) return 0;
  return movimientos.filter((m) => m && mismoCodigo(m.moneda, codigo) && mesDe(m.fecha) === mes).length;
}
