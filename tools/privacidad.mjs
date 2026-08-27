// La guardia de privacidad — RN-06, ADR-009.
//
// Toda la app se apoya en una promesa: no le habla a nadie. Una promesa que
// depende de que nadie se olvide nunca no es una promesa. Esto la vuelve
// comprobable: si en el archivo construido aparece cualquier forma de sacar un
// dato, **la construcción falla** y no se genera el archivo.
//
// Vive en su propio archivo, y no dentro de `build.mjs`, porque el constructor y
// el test de `test/privacidad.test.js` tienen que usar exactamente la misma
// lista. Dos copias de la misma regla son dos reglas que tarde o temprano dicen
// cosas distintas — y la que se quedaría atrás es siempre la del test, que es la
// que se mira.

/**
 * Formas de que un dato salga del dispositivo. Cada una tiene un nombre en
 * castellano porque el mensaje de error lo lee una persona, no una máquina.
 */
export const FORMAS_DE_SALIR = [
  ['una dirección de internet', /\bhttps?:\/\//i],
  ['una petición fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['un WebSocket', /\bWebSocket\b/],
  ['un EventSource', /\bEventSource\b/],
  ['sendBeacon', /navigator\s*\.\s*sendBeacon/],
  ['una carga dinámica de módulo', /\bimport\s*\(/],
  ['un formulario que se envía a algún lado', /<form[^>]*\baction\s*=/i],
  ['un script traído de afuera', /<script[^>]*\bsrc\s*=/i],
  ['una hoja de estilos externa', /<link[^>]*\brel\s*=\s*["']?stylesheet/i],
  ['una imagen externa', /<img[^>]*\bsrc\s*=\s*["'](?!data:)/i],
];

// ── La excepción, y por qué existe ───────────────────────────────────────────
//
// Un `.xlsx` es un ZIP con XML adentro, y el XML identifica sus vocabularios con
// **espacios de nombres**: una etiqueta única que, por convención de los años
// 90, se escribe con forma de URL. Nadie se conecta ahí nunca. Excel abre un
// .xlsx sin conexión, y estas cadenas cumplen el mismo papel que el número de
// serie de un electrodoméstico: identifican, no direccionan.
//
// Para poder ESCRIBIR un .xlsx (T-906), esas cadenas tienen que estar en el
// código. La guardia las vería como direcciones y frenaría la construcción.
//
// **Lo que NO se hizo:** apagar la guardia, ni partir las cadenas en pedazos
// para esconderlas. Lo segundo es peor: dejaría la guardia en pie pero ciega, y
// la próxima URL —una de verdad, armada igual— pasaría sin que nadie la viera.
//
// **Lo que se hizo:** una lista **cerrada y explícita**, acotada por dominio, y
// tres condiciones que se comprueban en cada construcción:
//
//   1. Cada excepción tiene que estar bajo un dominio de esquemas conocido.
//      Agregar `http://loquesea.com` a esta lista rompe la construcción.
//   2. Cada excepción tiene que aparecer en el archivo **como una cadena de
//      texto literal**, entre comillas. Una URL suelta en el código, o pegada a
//      una llamada, no pasa.
//   3. Sacando las excepciones, no puede quedar NINGUNA otra dirección.
//
// Y sigue en pie lo más importante: aunque estas cadenas estén, no hay en todo
// el archivo una sola función capaz de usarlas —ni `fetch`, ni
// `XMLHttpRequest`, ni nada—, porque los otros patrones lo prohíben.

/** Los únicos dominios bajo los cuales se puede permitir una excepción. */
export const DOMINIOS_DE_ESQUEMA = [
  'http://schemas.openxmlformats.org/',
  'http://schemas.microsoft.com/',
];

/**
 * Espacios de nombres que el formato `.xlsx` exige escribir tal cual.
 *
 * Son etiquetas de formato, no direcciones. Si esta lista crece, que crezca a la
 * vista y con un motivo escrito al lado.
 */
export const ESQUEMAS_PERMITIDOS = [
  // El vocabulario de las hojas de cálculo: worksheet, row, c, v.
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  // Las relaciones entre las partes del ZIP (qué archivo es la hoja 1).
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/relationships',
  // El índice de tipos de contenido, la primera parte que Excel lee.
  'http://schemas.openxmlformats.org/package/2006/content-types',
];

/** Escapa un texto para poder buscarlo dentro de una expresión regular. */
function comoPatron(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Comprueba que la lista de excepciones siga siendo defendible.
 *
 * Se corre **antes** de mirar el archivo: una lista blanca sin límites no es una
 * excepción, es una puerta. Devuelve el motivo, o `null` si está bien.
 */
export function revisarExcepciones(
  esquemas = ESQUEMAS_PERMITIDOS,
  dominios = DOMINIOS_DE_ESQUEMA
) {
  // Las listas se reciben como parámetro para poder probar la guardia con una
  // lista MALA. Sin eso, un test solo puede comprobar que la lista buena de hoy
  // pasa, que es exactamente lo que una guardia rota también haría.
  for (const dominio of dominios) {
    if (dominio.length < 'http://x.y/'.length || !dominio.endsWith('/')) {
      return `"${dominio}" no sirve como dominio de esquemas: tiene que ser un dominio ` +
        `completo terminado en "/". Un dominio a medias permitiría cualquier dirección.`;
    }
  }

  for (const esquema of esquemas) {
    if (!dominios.some((dominio) => esquema.startsWith(dominio))) {
      return `"${esquema}" está en la lista de espacios de nombres permitidos, pero no ` +
        `pertenece a ningún dominio de esquemas conocido (${dominios.join(', ')}). ` +
        `La lista de excepciones no puede crecer hacia cualquier lado.`;
    }
  }
  return null;
}

/**
 * Busca formas de sacar datos en el archivo construido.
 *
 * Devuelve el motivo en castellano, o `null` si el archivo está limpio.
 */
export function buscarFugas(
  html,
  { esquemas = ESQUEMAS_PERMITIDOS, dominios = DOMINIOS_DE_ESQUEMA } = {}
) {
  const problemaDeLaLista = revisarExcepciones(esquemas, dominios);
  if (problemaDeLaLista) return problemaDeLaLista;

  // Cada espacio de nombres permitido tiene que aparecer entre comillas: es una
  // cadena de texto, no una dirección puesta en medio del código.
  let limpio = html;
  for (const esquema of esquemas) {
    const patron = comoPatron(esquema);
    const sueltas = new RegExp(`(?<!['"\`])${patron}`);
    if (sueltas.test(limpio.replace(new RegExp(`(['"\`])${patron}`, 'g'), '$1'))) {
      return `"${esquema}" aparece fuera de una cadena de texto. Un espacio de nombres de ` +
        `XML solo puede estar entre comillas: si está suelto, es una dirección.`;
    }
    limpio = limpio.split(esquema).join('«espacio-de-nombres-permitido»');
  }

  for (const [descripcion, patron] of FORMAS_DE_SALIR) {
    const encontrado = limpio.match(patron);
    if (encontrado) {
      return `El archivo construido contiene ${descripcion} ("${encontrado[0]}"), que ` +
        `permitiría que un dato salga del dispositivo. La app no hace ninguna petición ` +
        `de red (RN-06).`;
    }
  }

  return null;
}
