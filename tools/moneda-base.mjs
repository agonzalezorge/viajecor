// La guardia de la moneda base — T-059.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
//
// Cuando la base dejó de ser siempre el euro (T-050), las funciones que
// convierten plata recibieron un parámetro nuevo: `base`. Con un valor por
// defecto, para que las llamadas viejas siguieran andando.
//
// Ese default fue el peor error que tuvo esta app. Nueve lugares se quedaron sin
// pasar la base y **ninguno falló**: siguieron convirtiendo contra el euro, en
// silencio. Con la base en pesos, la pantalla de carga le pedía al usuario "la
// cotización del peso contra el peso" y no lo dejaba guardar **nada**. Los otros
// ocho hacían daño más callado: el buscador no encontraba gastos en pesos, la
// planilla los exportaba con el importe vacío, el costo de un viaje se calculaba
// mal.
//
// Un `base = MONEDA_BASE` convierte "me olvidé de pasar la base" en "la base es
// el euro", que es exactamente lo que T-050 vino a dejar de suponer. Y no se
// puede quitar el default sin tocar trescientos sesenta y cuatro tests que
// legítimamente prueban el caso del euro.
//
// Así que la regla se comprueba donde importa: **en `src/`, nadie llama a estas
// funciones sin decir contra qué moneda convierte**. Si alguien se olvida, la
// construcción falla y no se genera el archivo — igual que con la guardia de
// privacidad.

/**
 * Las que pintan un rubro — T-067.
 *
 * Mismo cuento, segunda vez. Sin el catálogo del usuario pintan con la lista de
 * fábrica: ignoran los rubros que él creó (T-048) **y** los colores que eligió
 * (T-061). Ocho llamadas estaban así, y el síntoma era de los peores — el mismo
 * rubro de un color en Ajustes y de otro en el resto de la app.
 *
 * Que haya pasado dos veces con dos parámetros distintos es el argumento para
 * que esto sea una guardia y no una nota en un ADR: yo escribí en ADR-053 que lo
 * había evitado, y no lo había evitado.
 */
export const PINTAN_RUBROS = new Map([
  ['claseDeRubro', 3],
  ['franjaDeRubro', 3],
]);

/** Cuántos argumentos lleva cada función cuando se la llama bien. */
export const CONVIERTEN_PLATA = new Map([
  ['buscarCambio', 4],
  ['faltaCambioPara', 3],
  ['movimientoEnEuros', 4],
  ['totalEnEuros', 4],
  ['cambiosQueFaltan', 3],
  // No convierte, pero decide QUIÉN se puede convertir llamando a
  // `faltaCambioPara`: sin base, le pasa `undefined` y el default vuelve a
  // colarse un piso más abajo. Dos de las once llamadas rotas eran por acá.
  ['separarConvertibles', 3],
]);

/**
 * Los argumentos de nivel superior de una llamada que empieza en `desde` (el
 * paréntesis de apertura). Devuelve `null` si el paréntesis no cierra.
 *
 * Cuenta paréntesis, corchetes, llaves, comillas y plantillas, porque
 * `f(g(a, b), c)` tiene **dos** argumentos y no tres, y `f('a, b')` tiene uno.
 */
export function argumentosDe(texto, desde) {
  let nivel = 0;
  let comilla = null;
  let argumentos = 1;
  let hayAlgo = false;

  for (let i = desde; i < texto.length; i += 1) {
    const c = texto[i];

    if (comilla) {
      if (c === '\\') { i += 1; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { comilla = c; hayAlgo = true; continue; }
    if (c === '(' || c === '[' || c === '{') {
      nivel += 1;
      // El paréntesis que ABRE la llamada no es contenido: si contara, `f()`
      // daría un argumento en vez de cero.
      if (nivel > 1) hayAlgo = true;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      nivel -= 1;
      if (nivel === 0) return hayAlgo ? argumentos : 0;
      continue;
    }
    if (c === ',' && nivel === 1) { argumentos += 1; continue; }
    if (!/\s/.test(c)) hayAlgo = true;
  }
  return null;
}

/**
 * El texto sin comentarios, para no marcar un ejemplo escrito en una nota.
 *
 * Los bloques se reemplazan por **sus mismos saltos de línea** y no por un
 * espacio: si no, todo lo que viene después queda corrido y el error señala una
 * línea que no tiene nada que ver. (Pasó en la primera corrida.)
 */
function sinComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((linea) => linea.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/**
 * El texto con el CONTENIDO de las cadenas en blanco, respetando las plantillas.
 *
 * ── Por qué esto no puede ser una expresión regular ─────────────────────────
 *
 * Hicieron falta dos intentos y los dos fallaron en silencio, que es lo peor que
 * puede hacer un guardián:
 *
 *  1. Blanquear también las plantillas dejó la guardia mirando un archivo casi
 *     vacío: **toda la interfaz de esta app es HTML dentro de plantillas**, así
 *     que ahí adentro vive casi todo lo que hay que vigilar.
 *  2. Blanquear solo `'` y `"` tampoco alcanzó, porque el HTML de adentro de las
 *     plantillas usa comillas dobles —`class="..."`— y esas comillas se comían
 *     la interpolación que estaba en el medio.
 *
 * Lo que hace falta es entender el anidamiento: dentro de una plantilla, el
 * texto se blanquea pero lo que está en un `${...}` es código otra vez, y ahí
 * adentro puede haber otra plantilla. Se recorre carácter por carácter con una
 * pila, que es la forma corta de decir "un analizador de verdad".
 *
 * Se probó rompiendo una llamada a propósito: la construcción falla y la nombra.
 */
function sinCadenas(codigo) {
  const salida = [];
  const pila = [];                       // 'plantilla' por cada `…` abierta
  let comilla = null;                    // ' o " mientras dure una cadena
  let enTexto = false;                   // dentro del texto de una plantilla

  for (let i = 0; i < codigo.length; i += 1) {
    const c = codigo[i];
    const blanco = c === '\n' ? '\n' : ' ';

    if (comilla) {
      if (c === '\\') { salida.push(' ', ' '); i += 1; continue; }
      if (c === comilla) { comilla = null; salida.push(c); continue; }
      salida.push(blanco);
      continue;
    }

    if (enTexto) {
      if (c === '\\') { salida.push(' ', ' '); i += 1; continue; }
      if (c === '`') { enTexto = false; pila.pop(); salida.push(c); continue; }
      if (c === '$' && codigo[i + 1] === '{') {
        // Se abre una interpolación: de acá adentro vuelve a ser código.
        enTexto = false;
        pila.push('interpolacion');
        salida.push('$', '{');
        i += 1;
        continue;
      }
      salida.push(blanco);
      continue;
    }

    if (c === '`') { pila.push('plantilla'); enTexto = true; salida.push(c); continue; }
    if (c === "'" || c === '"') { comilla = c; salida.push(c); continue; }
    if (c === '}' && pila.at(-1) === 'interpolacion') {
      pila.pop();
      enTexto = pila.at(-1) === 'plantilla';
      salida.push(c);
      continue;
    }
    if (c === '{' && pila.at(-1) === 'interpolacion') {
      // Una llave de objeto adentro de la interpolación: se apila para que su
      // cierre no se confunda con el fin de la interpolación.
      pila.push('llave');
      salida.push(c);
      continue;
    }
    if (c === '}' && pila.at(-1) === 'llave') { pila.pop(); salida.push(c); continue; }

    salida.push(c);
  }

  return salida.join('');
}

/**
 * Las llamadas que se olvidaron de la base, con su archivo y su línea.
 *
 * `archivos` es un mapa de ruta a contenido. Se saltea la definición de las
 * funciones —en `core/cambio.js` viven las cinco— mirando solo las llamadas, no
 * los `export function`.
 */
export function llamadasSinBase(archivos) {
  return llamadasIncompletas(archivos, CONVIERTEN_PLATA,
    'le falta la moneda base. Pasala con monedaBaseDe(estado); suponer el euro es lo que '
    + 'rompió la carga con el peso uruguayo (T-059).');
}

/**
 * Las llamadas que pintan un rubro sin decir con qué catálogo — T-067.
 *
 * Sin él se usa la lista de fábrica, así que los rubros propios y los colores
 * elegidos no llegan: el mismo rubro sale de un color en una pantalla y de otro
 * en la de al lado.
 */
export function llamadasSinCatalogo(archivos) {
  return llamadasIncompletas(archivos, PINTAN_RUBROS,
    'le falta el catálogo de rubros. Pasá estado.rubros (o el catálogo que ya tengas a mano); '
    + 'sin él se pinta con los rubros de fábrica y se ignoran los colores elegidos (T-067).');
}

function llamadasIncompletas(archivos, funciones, comoArreglar) {
  const problemas = [];

  for (const [ruta, contenido] of archivos) {
    const codigo = sinCadenas(sinComentarios(contenido));

    for (const [nombre, esperados] of funciones) {
      const patron = new RegExp(`(^|[^.\\w])${nombre}\\s*\\(`, 'g');
      let encontrado;

      while ((encontrado = patron.exec(codigo)) !== null) {
        const abre = codigo.indexOf('(', encontrado.index + encontrado[0].length - 1);
        // La definición no es una llamada.
        const antes = codigo.slice(Math.max(0, encontrado.index - 20), encontrado.index + encontrado[0].length);
        if (/function\s*$/.test(antes.slice(0, antes.lastIndexOf(nombre)))) continue;

        const cuantos = argumentosDe(codigo, abre);
        if (cuantos === null || cuantos >= esperados) continue;

        // Desde el nombre y no desde el match: el patrón abarca el carácter
        // anterior, que muchas veces es el salto de línea de la línea de arriba
        // — y entonces el error señalaba la línea equivocada.
        const linea = codigo.slice(0, encontrado.index + encontrado[1].length).split('\n').length;
        problemas.push({
          ruta,
          linea,
          nombre,
          cuantos,
          esperados,
          mensaje: `${ruta}:${linea} — ${nombre}() se llamó con ${cuantos} argumento(s) `
            + `y necesita ${esperados}: ${comoArreglar}`,
        });
      }
    }
  }

  return problemas;
}
