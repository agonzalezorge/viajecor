// Un color propio para cada rubro, el mismo en todas las pantallas.
//
// Para qué sirve: cuando `supermercado` es siempre del mismo color, la barra más
// larga del mes se reconoce sin leer su nombre, y el formulario confirma de un
// vistazo qué rubro quedó elegido. El color deja de ser decoración y pasa a ser
// una segunda forma de leer el mismo dato.
//
// ── La regla que no se rompe ─────────────────────────────────────────────────
//
// **El color se asigna por la POSICIÓN del rubro en su lista, nunca por su
// tamaño.** Si dependiera del tamaño, cargar un gasto nuevo repintaría media
// pantalla, y el color dejaría de significar "supermercado" para pasar a
// significar "el más grande de este mes" — que ya lo dice el largo de la barra.
// Un color que cambia de significado no se puede aprender.
//
// ── La paleta ────────────────────────────────────────────────────────────────
//
// Los ocho tonos NO se eligieron a ojo. Salen de la paleta categórica de la guía
// de visualización del proyecto y se comprobaron con su validador contra las dos
// superficies reales de la app. Pasan las seis comprobaciones en claro y en
// oscuro: banda de luminosidad, croma mínimo, separación para daltonismo
// (peor par ΔE 9,1 en claro y 8,4 en oscuro), separación en visión normal
// (ΔE 19,6 y 19,3) y contraste.
//
// La única advertencia es que tres tonos quedan por debajo de 3:1 sobre el fondo
// claro. Está cubierta: **cada barra lleva su nombre y su importe escritos al
// lado**, así que el color nunca es la única manera de saber qué es. Si alguna
// pantalla futura mostrara estos colores sin texto, esa advertencia volvería a
// contar y habría que resolverla ahí.
//
// **Ocho es el techo.** No se agregan más tonos: un noveno color generado es
// indistinguible de alguno de estos bajo daltonismo. Si algún día hay más de
// ocho rubros de un tipo, la salida es agrupar, no inventar un color.

import { COLORES, franjaDeRubro } from '../core/paleta.js';

// Se reexportan para no obligar a media app a cambiar sus imports: lo que se
// movió es dónde vive el cálculo, no quién lo usa.
export { COLORES, franjaDeRubro };

export function claseDeRubro(tipo, rubro) {
  return `rubro-${franjaDeRubro(tipo, rubro)}`;
}
