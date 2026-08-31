// Importar la hoja `Ahorros conjuntos` de la planilla del usuario — T-042, CU-14.
//
// ── Cómo es la hoja, mirada de verdad ────────────────────────────────────────
//
// El usuario la pasó el 2026-08-31 y se abrió con `openpyxl` antes de escribir
// una línea de esto. Encabezados en la **fila 3**, datos desde la **4**:
//
//   A Comentarios · B DÍA · C DETALLES · D MONEDA · E MONTO · F ALE/IRE · G I/G
//
// A la derecha, en I..K, tres cuadros de totales que la app **no lee**: son
// resultados, no datos, y se recalculan solos. Sí se usan para comprobar, igual
// que el acumulado de la hoja de gastos.
//
// ── Lo que la hoja hace mal, y por qué conviene saberlo ──────────────────────
//
// Sus tres cuadros suman **tres rangos distintos** de la misma tabla:
// `$E4:$E89` el total por moneda, `$E4:$E93` el de ALE, `$E4:$E97` el de IRE.
// Hoy hay once filas y no muerde; pasadas las 89, el total general va a dejar de
// contar filas que los de cada persona sí cuentan y **los cuadros van a dejar de
// cerrar entre sí sin decir nada**. Es L-001 otra vez, en la hoja que estamos
// reemplazando, y es la razón por la que este importador no tiene ningún límite
// de filas escrito a mano.
//
// ── La regla de siempre: nada entra ni se pierde en silencio ─────────────────
//
// Cada fila que no entra sale en el informe con **su número de fila**, lo que
// decía y por qué. Se importa una sola vez, sobre datos que no están en ningún
// otro lado (RN-05).

import { crearAhorro, monedaDeLaPlanilla, personaDeLaPlanilla, tipoDeLaPlanilla,
  AHORRO_SALE } from '../core/ahorros.js';
import { normalizarTextoVisible } from '../core/modelo.js';
import { fechaDeSerie } from './planilla.js';
import { decimalesDe } from '../core/monedas.js';

/** El nombre de la pestaña, tal como está en la planilla del usuario. */
export const HOJA_DE_AHORROS = 'Ahorros conjuntos';

const AHO_COMENTARIO = 'A';
const AHO_DIA = 'B';
const AHO_DETALLE = 'C';
const AHO_MONEDA = 'D';
const AHO_MONTO = 'E';
const AHO_PERSONA = 'F';
const AHO_TIPO = 'G';

const textoDe = (celda) => normalizarTextoVisible(String(celda?.valor ?? ''));

/**
 * ¿Esta fila es un movimiento de ahorro?
 *
 * Se decide por el **contenido**, no por el número de fila: el encabezado, las
 * filas en blanco que separan bloques y los cuadros de totales de la derecha
 * quedan afuera solos. Hace falta al menos una fecha y una persona; sin eso no
 * hay nada que interpretar.
 */
export function esFilaDeAhorro(celdas) {
  if (!celdas) return false;

  // **La fecha tiene que ser una fecha**, no cualquier texto. Es lo que deja
  // afuera al encabezado, que en esa misma columna dice "DÍA" — la primera
  // versión lo dejaba pasar y lo reportaba como una fila con la moneda mal.
  const dia = celdas.get(AHO_DIA)?.valor;
  const esFecha = typeof dia === 'number'
    ? Number.isFinite(dia) && dia > 0
    : typeof dia === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dia.trim());
  if (!esFecha) return false;

  return textoDe(celdas.get(AHO_PERSONA)) !== '' || textoDe(celdas.get(AHO_MONEDA)) !== '';
}

/**
 * Traduce una fila. Devuelve `{ ahorro }` o `{ problema }`.
 *
 * **Nunca tira**: una fila rota tiene que producir una línea del informe, no
 * interrumpir la importación de las otras.
 */
export function interpretarFilaDeAhorro(numero, celdas, monedas) {
  const crudo = {
    comentario: textoDe(celdas.get(AHO_COMENTARIO)),
    detalle: textoDe(celdas.get(AHO_DETALLE)),
    moneda: textoDe(celdas.get(AHO_MONEDA)),
    persona: textoDe(celdas.get(AHO_PERSONA)),
    tipo: textoDe(celdas.get(AHO_TIPO)),
  };
  const decir = (motivo) => ({ problema: { fila: numero, motivo, crudo } });

  const dia = celdas.get(AHO_DIA)?.valor;
  let fecha;
  try {
    fecha = typeof dia === 'number' ? fechaDeSerie(dia) : String(dia ?? '').slice(0, 10);
  } catch {
    return decir('la fecha no se pudo leer');
  }

  const moneda = monedaDeLaPlanilla(crudo.moneda);
  if (moneda === null) {
    return decir(`no se reconoce la moneda "${crudo.moneda}"`);
  }
  if (personaDeLaPlanilla(crudo.persona) === null) {
    return decir(`no dice de quién es: "${crudo.persona}"`);
  }
  if (tipoDeLaPlanilla(crudo.tipo) === null) {
    return decir(`la columna I/G dice "${crudo.tipo}", que no es ni I ni G`);
  }

  const monto = celdas.get(AHO_MONTO)?.valor;
  if (monto === undefined || monto === null || String(monto).trim() === '') {
    // Le pasó a la copia que mandó el usuario: la hoja tenía las filas y la
    // columna de montos vacía. Decirlo con el número de fila es la diferencia
    // entre "no importó nada" y "no importó ESTAS, mirá la planilla".
    return decir('la fila no tiene monto');
  }

  try {
    const ahorro = crearAhorro(
      { ...crudo, moneda, monto, fecha },
      { decimales: decimalesDe(monedas, moneda), id: idDeFilaDeAhorro(numero, crudo, monto, fecha) }
    );
    return { ahorro };
  } catch (error) {
    return decir(error.message);
  }
}

/**
 * Un identificador estable, sacado de la fila.
 *
 * Deducido del contenido y **del número de fila**: dos filas iguales —el mismo
 * día, la misma persona, el mismo importe— son dos movimientos reales
 * distintos, y sin el número la segunda se descartaría como repetida. Así,
 * además, importar dos veces la misma planilla no puede duplicar la plata.
 */
export function idDeFilaDeAhorro(numero, crudo, monto, fecha) {
  const semilla = `${numero}|${fecha}|${crudo.persona}|${crudo.moneda}|${monto}|${crudo.comentario}`;
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < semilla.length; i += 1) {
    hash ^= semilla.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `aho_${hash.toString(16).padStart(8, '0')}${semilla.length.toString(16)}`;
}

/**
 * Interpreta la hoja entera.
 *
 * Devuelve los ahorros, los problemas fila por fila y **una comprobación por
 * moneda**: lo que suma la app contra lo que decía el cuadro de la planilla.
 * Es la única oportunidad de contrastar el resultado con un número calculado
 * por otra herramienta — después la planilla se archiva.
 */
export function interpretarAhorros(filas, monedas) {
  const ahorros = [];
  const problemas = [];

  for (const numero of [...filas.keys()].sort((a, b) => a - b)) {
    const celdas = filas.get(numero);
    if (!esFilaDeAhorro(celdas)) continue;

    const resultado = interpretarFilaDeAhorro(numero, celdas, monedas);
    if (resultado.problema) problemas.push(resultado.problema);
    else ahorros.push(resultado.ahorro);
  }

  return { ahorros, problemas, comprobaciones: compararConLaPlanilla(ahorros, filas) };
}

/**
 * Compara el total de cada moneda contra el cuadro de la planilla (I3:K4).
 *
 * Una diferencia no significa necesariamente que la app se equivocó: puede ser
 * el rango corto de la propia hoja (`$E4:$E89`). Pero significa que **alguno de
 * los dos está mal**, y eso hay que mirarlo antes de archivar la planilla.
 */
export function compararConLaPlanilla(ahorros, filas) {
  const encabezado = filas.get(3);
  const valores = filas.get(4);
  if (!encabezado || !valores) return [];

  const comprobaciones = [];
  for (const columna of ['I', 'J', 'K']) {
    const moneda = monedaDeLaPlanilla(textoDe(encabezado.get(columna)));
    const esperado = valores.get(columna)?.valor;
    if (moneda === null || typeof esperado !== 'number') continue;

    const nuestro = ahorros
      .filter((a) => a.moneda === moneda)
      .reduce((total, a) => total + (a.tipo === AHORRO_SALE ? -a.monto : a.monto), 0);

    comprobaciones.push({
      moneda,
      nuestro,
      planilla: Math.round(esperado * 100),
      cuadra: nuestro === Math.round(esperado * 100),
    });
  }
  return comprobaciones;
}
