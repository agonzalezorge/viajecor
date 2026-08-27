// Los ocho colores de los rubros, en un solo lugar — T-909, T-916.
//
// Vivían solo en `src/estilos.css`. Cuando la planilla de Excel pasó a pintar
// cada rubro (T-916) hicieron falta también fuera del navegador, y la salida
// fácil era copiarlos. Dos copias de una paleta son dos paletas: alguien cambia
// un tono en la pantalla, la planilla se queda con el viejo, y el mismo gasto
// pasa a ser de dos colores según dónde se lo mire.
//
// Acá viven una vez. El CSS los repite —no hay forma de que lea este archivo sin
// una petición de red, y eso está prohibido (RN-06)— pero **un test comprueba
// que sigan siendo los mismos**, así que la copia no se puede separar en
// silencio. Es la misma solución que L-015 y L-017: cuando algo tiene que estar
// sincronizado y no se puede compartir, se comprueba.
//
// ── Por qué hay dos versiones de cada color ──────────────────────────────────
//
// En la app el color es una **barra**: una forma pintada, sin texto encima, que
// necesita ser saturada para leerse de lejos. En la planilla el color es el
// **fondo de una celda con texto negro adentro**. El mismo tono que funciona en
// una barra deja el texto ilegible en una celda.
//
// Los tonos claros son los mismos colores mezclados con blanco: se reconoce que
// es el mismo rubro, y el texto negro encima se lee. No son otra paleta: son la
// misma vista de otra manera.

import { RUBROS_GASTO, RUBROS_INGRESO, TIPO_GASTO, normalizarClave } from './modelo.js';

/** Cuántos colores hay. Es un tope, no un valor por omisión. */
export const COLORES = 8;

/** Los ocho tonos, tal como se usan en las barras y los puntos de la app. */
export const COLORES_RUBRO = Object.freeze([
  '#2a78d6',  // 1 · azul
  '#eb6834',  // 2 · naranja
  '#1baf7a',  // 3 · aguamarina
  '#eda100',  // 4 · amarillo
  '#e87ba4',  // 5 · magenta
  '#008300',  // 6 · verde
  '#4a3aa7',  // 7 · violeta
  '#e34948',  // 8 · rojo
]);

/** Los mismos ocho, aclarados para servir de fondo a un texto negro. */
export const FONDOS_RUBRO = Object.freeze([
  '#D0E1F6',  // 1 · azul
  '#FBDED2',  // 2 · naranja
  '#CDEDE2',  // 3 · aguamarina
  '#FBEAC7',  // 4 · amarillo
  '#FAE2EB',  // 5 · magenta
  '#C7E4C7',  // 6 · verde
  '#D7D4EC',  // 7 · violeta
  '#F9D7D7',  // 8 · rojo
]);

/**
 * En qué franja de color cae un rubro: un número de 1 a 8, estable para
 * siempre. Los rubros de gasto usan las ocho; los de ingreso, las primeras
 * cuatro.
 *
 * Que `otros` de gasto y `otros` de ingreso caigan en franjas distintas es
 * correcto y buscado: son cosas distintas (PRODUCTO §4).
 *
 * Que `gastos fijos` (gasto, franja 1) y `trabajo` (ingreso, franja 1) compartan
 * tono también es correcto: no aparecen nunca en la misma tabla, y cada tabla
 * asigna los tonos desde el principio de la lista.
 */
export function franjaDeRubro(tipo, rubro) {
  const lista = tipo === TIPO_GASTO ? RUBROS_GASTO : RUBROS_INGRESO;
  const clave = normalizarClave(String(rubro ?? ''));
  const posicion = lista.indexOf(clave);

  // Un rubro que no está en la lista no debería existir (RN-02), pero si llega
  // de un dato viejo se le da la última franja en vez de romper la pantalla.
  return posicion === -1 ? COLORES : posicion + 1;
}

/** La clase CSS que pinta un rubro. Los tonos viven en `src/estilos.css`. */
/** El fondo de una franja (1 a 8), en el formato que quiere Excel: sin `#`. */
export function fondoDeFranja(franja) {
  const color = FONDOS_RUBRO[franja - 1] ?? FONDOS_RUBRO[FONDOS_RUBRO.length - 1];
  return color.slice(1).toUpperCase();
}
