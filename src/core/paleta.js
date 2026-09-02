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

import { TIPO_GASTO, normalizarClave, rubrosDe } from './modelo.js';

/** Cuántos colores hay. Es un tope, no un valor por omisión. */
export const COLORES = 20;

// ── De dónde salen estos tonos — T-922 ──────────────────────────────────────
//
// El usuario pidió (2026-08-28) que los colores fueran los de su planilla de
// Excel, «o lo más parecidos posible». Los de su planilla son los pasteles
// clásicos de Excel: rosa para gastos fijos, naranja para supermercado, salmón
// para comida hecha, verde para viajes, violeta para entretenimiento, celeste
// para transporte, lila para salud, gris para otros.
//
// **Se midieron antes de decidir, y como marcas de gráfico fallan.** El
// validador de la guía de visualización devolvió cuatro fallos sobre esos ocho:
// quedan fuera de la banda de luminosidad, seis de ocho leen como gris por falta
// de croma, y —lo más grave— `#FFCCCC` (su salmón) y `#FFCC99` (su naranja)
// están a ΔE 6,6 en visión normal: **indistinguibles incluso con visión de color
// completa**. Su lila de salud y su violeta de entretenimiento tienen el mismo
// matiz con 1° de diferencia.
//
// En su planilla eso no molesta porque **cada celda tiene el nombre escrito
// adentro**: el color acompaña al texto. En una torta el color es lo único que
// identifica un pedazo.
//
// **Lo que se hizo:** conservar el MATIZ de cada uno —que es lo que hace que un
// color se reconozca como «el rosa de gastos fijos»— y mover solo la luminosidad
// y el croma hasta que el conjunto pase. Seis de los ocho se movieron 23° o
// menos, así que siguen siendo reconociblemente los suyos.
//
// **Los dos que cambiaron de familia, y por qué:**
//
//   · **salud** — su lila era el mismo matiz que su violeta de entretenimiento.
//     Uno de los dos tenía que irse; se movió el que menos aparece.
//   · **otros** — su gris no puede ser una marca de gráfico: sin croma, no se
//     distingue del fondo ni de una barra apagada. Sí se usa su gris **como
//     fondo de celda**, que es donde él lo ve.
//
// El orden de esta lista es el de los rubros, y **eso importa**: la torta dibuja
// los pedazos en ese orden, así que los pares vecinos son siempre los mismos y
// se pudieron validar. Ordenarla por tamaño haría que dos rubros parecidos
// cayeran juntos según el mes.

/** Los ocho tonos, tal como se usan en las barras, la torta y los puntos. */
export const COLORES_RUBRO = Object.freeze([
  '#e87ba4',  // 1 · rosa       — su rosa de gastos fijos       (se movió 8°)
  '#eda100',  // 2 · ámbar      — su naranja de supermercado    (se movió 9°)
  '#e34948',  // 3 · rojo       — su salmón de comida hecha     (se movió 7°)
  '#008300',  // 4 · verde      — su verde de viajes            (se movió 3°)
  '#a552b7',  // 5 · violeta    — su violeta de entretenimiento (se movió 34°)
  '#2a78d6',  // 6 · azul       — su celeste de transporte      (se movió 7°)
  '#1baf7a',  // 7 · aguamarina — CAMBIA: su lila era el mismo matiz que el violeta
  '#7a7a7a',  // 8 · gris       — su gris de otros, oscurecido para que contraste

  // ── Del 9 al 20: los que quedan libres — T-049, ADR-049 ──────────────────
  //
  // Elegidos uno por uno con el validador de la guía: en cada paso, el color
  // que MÁS LEJOS estaba de todos los anteriores, mirando también cómo se ven
  // con daltonismo. Por eso el orden importa y no es alfabético ni bonito:
  // **el 9 se distingue mucho mejor que el 20**, y el número al lado de cada
  // uno es esa distancia medida (ΔE en OKLab ×100, la peor de las tres
  // visiones). Bajar de 8 obliga a rótulo directo, que esta app siempre tiene:
  // el nombre del rubro va escrito al lado del color, en todas las pantallas.
  '#74396d',  // 9 · ciruela     — separación 14,6
  '#39b5ff',  // 10 · celeste     — separación 14,5
  '#720caf',  // 11 · violeta     — separación 11,7
  '#813934',  // 12 · ladrillo    — separación 9,6
  '#1d40e7',  // 13 · azul        — separación 8,9
  '#3295f6',  // 14 · azul claro  — separación 8,6
  '#27d271',  // 15 · verde menta — separación 8,2
  '#31b0c6',  // 16 · cian        — separación 7,8
  '#904c87',  // 17 · malva       — separación 7,6
  '#db8833',  // 18 · naranja     — separación 7,2
  '#1464fe',  // 19 · azul vivo   — separación 6,7
  '#96455a',  // 20 · bordó       — separación 6,7
]);

/**
 * Los mismos, para el fondo oscuro. **Cada uno conserva el TONO de su par claro**
 * y cambia la luz: elegirlos por separado daba la franja 10 morada en claro y
 * ámbar en oscuro, o sea el mismo rubro cambiando de color al cambiar de tema,
 * que es justo lo que esta paleta existe para evitar.
 */
export const COLORES_RUBRO_OSCURO = Object.freeze([
  '#d55181',  // 1 · rosa
  '#c08000',  // 2 · ámbar
  '#d33a3c',  // 3 · rojo
  '#008300',  // 4 · verde
  '#a552b7',  // 5 · violeta
  '#3987e5',  // 6 · azul
  '#199e70',  // 7 · aguamarina
  '#a8a8a8',  // 8 · gris

  '#91417d',  // 9 · ciruela
  '#56b2fd',  // 10 · celeste
  '#7e1cd8',  // 11 · violeta
  '#ff9b4e',  // 12 · ladrillo
  '#6c96c2',  // 13 · azul
  '#71c5df',  // 14 · azul claro
  '#9bc58d',  // 15 · verde menta
  '#008d89',  // 16 · cian
  '#8e32a7',  // 17 · malva
  '#cf6b58',  // 18 · naranja
  '#226cff',  // 19 · azul vivo
  '#b60356',  // 20 · bordó
]);

/**
 * Los fondos de celda de la planilla exportada.
 *
 * **Acá sí van los colores de su planilla tal cual**, incluido el gris de
 * `otros`: en una celda el color es el fondo de un texto negro que dice el
 * nombre del rubro, así que no tiene que identificar solo. Es exactamente la
 * situación de su Excel, y por eso funcionan ahí y no como barras.
 */
export const FONDOS_RUBRO = Object.freeze([
  '#FF99CC',  // 1 · su rosa de gastos fijos
  '#FFCC99',  // 2 · su naranja de supermercado
  '#FFCCCC',  // 3 · su salmón de comida hecha
  '#CCFFCC',  // 4 · su verde de viajes
  '#CC99FF',  // 5 · su violeta de entretenimiento
  '#99CCFF',  // 6 · su celeste de transporte
  '#E5CCFF',  // 7 · su lila de salud
  '#D9D9D9',  // 8 · su gris de otros

  // Del 9 al 20: el mismo tono de cada color, muy aclarado, igual que los ocho
  // de arriba —que salieron de la planilla del usuario—. En Excel el número va
  // escrito ENCIMA, así que el fondo tiene que dejar leer texto negro.
  '#D8C8D6',  // 9 · ciruela
  '#C8EAFF',  // 10 · celeste
  '#D8BBE9',  // 11 · violeta
  '#DCC8C6',  // 12 · ladrillo
  '#C0CAF8',  // 13 · azul
  '#C6E1FC',  // 14 · azul claro
  '#C3F2D7',  // 15 · verde menta
  '#C5E9EF',  // 16 · cian
  '#E0CDDD',  // 17 · malva
  '#F5DEC6',  // 18 · naranja
  '#BDD4FF',  // 19 · azul vivo
  '#E2CBD1',  // 20 · bordó
]);

/**
 * En qué franja de color cae un rubro: un número de 1 a 8, estable para
 * siempre.
 *
 * Los rubros de gasto la sacan de su posición en la lista. Los de ingreso, de
 * un mapa propio, para que también hereden los colores de la planilla.
 */
export function franjaDeRubro(tipo, rubro, catalogo) {
  const clave = normalizarClave(String(rubro ?? ''));

  if (tipo !== TIPO_GASTO) {
    // Los ingresos no siguen su posición en la lista sino un mapa propio, para
    // que también hereden los colores de la planilla: ahí el usuario tiene
    // trabajo en verde, inversiones en celeste, regalos en rosa y otros en gris.
    // Sin esto, `trabajo` sería rosa solo por ser el primero de su lista.
    const suyo = FRANJA_DE_INGRESO[clave];
    if (suyo !== undefined) return suyo;
    return COLORES;
  }

  // La posición en el catálogo **del usuario** (T-048), no en la lista de
  // fábrica: si él creó "mascotas", tiene que tener un color propio como
  // cualquier otro. El catálogo arranca igual al de fábrica, así que los
  // colores de siempre no se mueven.
  const posicion = rubrosDe(TIPO_GASTO, catalogo).indexOf(clave);

  // Un rubro que no está en la lista no debería existir (RN-02), pero si llega
  // de un dato viejo se le da la última franja en vez de romper la pantalla.
  return posicion === -1 ? COLORES : posicion + 1;
}

/**
 * Qué color le toca a cada rubro de ingreso.
 *
 * Sale de la planilla del usuario, no de la posición en la lista: ahí `trabajo`
 * es verde, `inversiones` celeste, `regalos` rosa y `otros` gris. Sigue
 * cumpliendo la regla de T-909 —el color depende del rubro y **nunca de su
 * tamaño**—, que es lo que importa: cargar un ingreso nuevo no repinta nada.
 *
 * Que `otros` de gasto y `otros` de ingreso caigan los dos en el gris es
 * correcto: en la planilla del usuario también es así. **Sí aparecen juntos en
 * la tabla mes a mes** desde T-947, y por eso esa tabla lleva un rótulo arriba
 * de cada bloque: el color no puede distinguirlos, y el nombre tampoco —los dos
 * se llaman "Otros"—, así que lo distingue el rótulo. Darles dos grises
 * distintos sería peor: rompería la correspondencia con el resto de la app, que
 * es para lo que existe esta paleta.
 */
const FRANJA_DE_INGRESO = Object.freeze({
  trabajo: 4,      // verde
  inversiones: 6,  // azul
  regalos: 1,      // rosa
  otros: 8,        // gris
});

/** La clase CSS que pinta un rubro. Los tonos viven en `src/estilos.css`. */
/** El fondo de una franja (1 a 8), en el formato que quiere Excel: sin `#`. */
export function fondoDeFranja(franja) {
  const color = FONDOS_RUBRO[franja - 1] ?? FONDOS_RUBRO[FONDOS_RUBRO.length - 1];
  return color.slice(1).toUpperCase();
}


/**
 * Con qué color se escribe ENCIMA de un color de rubro — T-049.
 *
 * Es el único texto de la app que no usa un color de texto: va sobre el color
 * del rubro, así que se elige contra **ese** fondo. Hasta la paleta de ocho
 * alcanzaba con el negro; entre los veinte hay tonos oscuros —la ciruela, el
 * violeta— donde el negro no se lee y el blanco sí.
 *
 * La cuenta es la luminancia relativa de WCAG, la misma que usa el test que lo
 * comprueba: se elige el que más contraste da, y el resultado nunca baja de
 * 4,5:1 en ninguna de las dos paletas.
 */
export function tintaSobreRubro(hex) {
  const canal = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const contraNegro = (luz + 0.05) / 0.05;
  const contraBlanco = 1.05 / (luz + 0.05);
  return contraBlanco > contraNegro ? '#ffffff' : '#000000';
}

/** Las franjas que necesitan tinta blanca, para poder escribirlo en el CSS. */
export function franjasConTintaClara(paleta = COLORES_RUBRO) {
  return paleta
    .map((hex, i) => (tintaSobreRubro(hex) === '#ffffff' ? i + 1 : null))
    .filter((n) => n !== null);
}
