// La guardia de sintaxis — L-028.
//
// Un error de sintaxis en cualquier módulo de `src/` generaba un
// `dist/viajecor.html` perfecto a la vista: la construcción salía con éxito, el
// archivo pesaba lo esperado, y la app **abría en blanco** en el celular. El
// navegador no ejecuta nada de un guión que no puede leer, y no lo dice en
// ningún lado que el usuario mire. Es la forma de falla de L-017 por otro
// camino: construcción en verde, app rota en el teléfono.
//
// Vive en su propio archivo por el mismo motivo que `privacidad.mjs`: el
// constructor y el test usan **exactamente la misma función**. Y además porque
// el test de la otra forma tendría que romper un módulo de verdad para probarla,
// y un test que deja un archivo roto mientras los demás lo están leyendo es peor
// que el error que buscaba (L-027).

/**
 * Comprueba que un texto sea JavaScript legible. Devuelve el mensaje del error
 * si no lo es, o `null` si está bien.
 *
 * `new Function` **compila y no ejecuta**: no hay ningún efecto, solo la
 * comprobación. No prueba que el código haga lo correcto —para eso están los
 * tests y el recorrido por el navegador— pero sí que no esté roto de la forma
 * más tonta y más cara.
 */
export function buscarErrorDeSintaxis(guion) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(guion);
    return null;
  } catch (error) {
    return `El guión no se puede leer: ${error.message}\n  Hay un error de sintaxis en algún módulo de src/.`;
  }
}
