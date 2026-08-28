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
// significar "el más grande de este mes" — que ya lo dice el tamaño de su porción.
// Un color que cambia de significado no se puede aprender.
//
// ── La paleta ────────────────────────────────────────────────────────────────
//
// Los ocho tonos salen de la **planilla del usuario**, que es la que viene
// mirando desde octubre de 2025: se conservó el matiz de cada uno de sus colores
// y se corrigieron la luz y el croma hasta que el conjunto pasara el validador
// de la guía de visualización contra las dos superficies reales de la app. Seis
// de los ocho se movieron 23° o menos: son el mismo color con otro nombre
// técnico. Los otros dos son los que estaban rotos. El detalle está en ADR-029.
//
// Con fondo oscuro pasan las seis comprobaciones. Con fondo claro pasan las
// cuatro duras, con dos advertencias —un par a ΔE 7,2 bajo daltonismo y un tono
// corto de contraste— que la guía permite **cuando hay rótulo directo**. Lo hay:
// cada rubro lleva su nombre y su importe escritos al lado. Si alguna pantalla
// futura mostrara estos colores sin texto, esa advertencia volvería a contar y
// habría que resolverla ahí.
//
// **Ocho es el techo**, por dos motivos distintos. No se agregan más tonos: un
// noveno color generado sería indistinguible de alguno de estos bajo daltonismo,
// y si algún día hay más de ocho rubros de un tipo la salida es agrupar. Y
// además ninguna paleta de ocho pasa el validador comparando todos contra
// todos; sí pasan los pares que quedan **pegados**, si son siempre los mismos.
// Por eso la torta del resumen dibuja los rubros en el orden de esta lista y no
// por tamaño.

import { COLORES, franjaDeRubro } from '../core/paleta.js';

// Se reexportan para no obligar a media app a cambiar sus imports: lo que se
// movió es dónde vive el cálculo, no quién lo usa.
export { COLORES, franjaDeRubro };

export function claseDeRubro(tipo, rubro) {
  return `rubro-${franjaDeRubro(tipo, rubro)}`;
}
