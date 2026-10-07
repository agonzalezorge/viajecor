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
 * Las que no convierten pero **escriben un importe con su símbolo** — T-075.
 *
 * El agujero que dejó la lista de arriba: la lectura de los gráficos decía
 * "3.000,00 €" con la base en pesos, y ninguna guardia se quejaba porque ahí no
 * se convierte nada, solo se formatea. Para quien mira el número es exactamente
 * el mismo error — un importe con la moneda equivocada— y es la tercera vez que
 * esta forma de olvido llega hasta la pantalla (L-035, L-036).
 */
export const MUESTRAN_PLATA = new Map([
  ['dibujarLectura', 3],
  // Escribe "el total de ese mes sube de X a Y" — T-077. Entró a la lista el
  // día que se tocó esta pantalla, que es justamente cuando se vio que una de
  // sus dos llamadas no pasaba la base.
  ['dibujarAvisoCorreccion', 3],
  ['dibujarMesAMes', 2],
  ['dibujarAcumuladoHistorico', 2],
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
  // ¿Hay algo escrito en el argumento que se está contando AHORA? Sirve para
  // la coma final: en `f(a, b,)` el tercer argumento está vacío y no existe.
  //
  // Esto no es un detalle de estilo. Sin ello, toda llamada escrita con coma
  // final —que en este archivo y en medio proyecto es la forma normal de partir
  // una llamada en varias líneas— contaba **un argumento de más**, y pasaba la
  // guardia con uno de menos. O sea: la guardia de L-035 era ciega justo en las
  // llamadas largas, que son las que más fácil se escriben incompletas. Ver
  // L-043.
  let hayEnEste = false;

  for (let i = desde; i < texto.length; i += 1) {
    const c = texto[i];

    if (comilla) {
      if (c === '\\') { i += 1; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { comilla = c; hayAlgo = true; hayEnEste = true; continue; }
    if (c === '(' || c === '[' || c === '{') {
      nivel += 1;
      // El paréntesis que ABRE la llamada no es contenido: si contara, `f()`
      // daría un argumento en vez de cero.
      if (nivel > 1) { hayAlgo = true; hayEnEste = true; }
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      nivel -= 1;
      // Al cerrar: si el último argumento quedó vacío, era una coma final.
      if (nivel === 0) return hayAlgo ? argumentos - (hayEnEste ? 0 : 1) : 0;
      continue;
    }
    if (c === ',' && nivel === 1) { argumentos += 1; hayEnEste = false; continue; }
    if (!/\s/.test(c)) { hayAlgo = true; hayEnEste = true; }
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
/**
 * ¿Una barra en esta posición abre una expresión regular, o es una división?
 *
 * Se mira el último carácter que no es espacio de lo ya escaneado. Después de un
 * identificador, un número, o `)` `]`, una barra divide. Después de todo lo
 * demás —y al principio del archivo— empieza una regex. `return /x/` y
 * `typeof /x/` caen del lado bueno porque terminan en una letra… por eso se
 * comprueban aparte las palabras que pueden preceder a una regex.
 */
function empiezaRegex(salida) {
  let i = salida.length - 1;
  while (i >= 0 && /\s/.test(salida[i])) i -= 1;
  if (i < 0) return true;

  const anterior = salida[i];
  if (/[)\]]/.test(anterior)) return false;
  if (!/[\w$]/.test(anterior)) return true;

  // Termina en palabra: solo es regex si esa palabra es de las que la admiten.
  let fin = i + 1;
  while (i >= 0 && /[\w$]/.test(salida[i])) i -= 1;
  const palabra = salida.slice(i + 1, fin).join('');
  return ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'yield', 'await']
    .includes(palabra);
}

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

    // ── Una expresión regular no es código ni cadena — T-077 ────────────────
    //
    // `.replace(/"/g, '…')` tiene una comilla DENTRO de una regex. Sin esto, el
    // escáner la tomaba como el principio de una cadena y blanqueaba **todo lo
    // que venía después**: desde la línea 95 de `src/ui/app.js` —el archivo más
    // grande del proyecto, donde viven todos los manejadores— la guardia no veía
    // absolutamente nada. Ver L-043.
    //
    // Distinguir una regex de una división no se puede hacer sin un parser, pero
    // sí con el carácter significativo anterior: después de un identificador, un
    // número o un paréntesis que cierra, una barra es división; después de `(`,
    // `,`, `=`, `return` y compañía, es una regex.
    if (c === '/' && empiezaRegex(salida)) {
      salida.push(' ');
      i += 1;
      let enClase = false;
      for (; i < codigo.length; i += 1) {
        const d = codigo[i];
        // El escape salta el carácter siguiente — salvo que sea el fin de línea.
        // Sin esa salvedad, `/https?:\/\//` (al que `sinComentarios` ya le
        // comió la cola creyéndola un comentario) dejaba una barra invertida
        // pegada al salto, se tragaba el salto y seguía borrando la línea de
        // abajo. Tercer agujero del mismo escáner, y el único con un caso real
        // en el proyecto: `tools/privacidad.mjs` tiene esa regex.
        if (d === '\\') {
          if (codigo[i + 1] === '\n' || i + 1 >= codigo.length) { salida.push(' '); continue; }
          salida.push(' ', ' ');
          i += 1;
          continue;
        }
        if (d === '\n') { salida.push('\n'); break; }   // una regex no cruza líneas
        if (d === '[') enClase = true;
        else if (d === ']') enClase = false;
        else if (d === '/' && !enClase) { salida.push(' '); break; }
        salida.push(' ');
      }
      continue;
    }

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
 * Las llamadas que escriben un importe sin decir en qué moneda — T-075.
 */
export function llamadasSinMoneda(archivos) {
  return llamadasIncompletas(archivos, MUESTRAN_PLATA,
    'le falta la moneda base. Pasala con monedaBaseDe(estado); sin ella el importe sale '
    + 'escrito en euros aunque el usuario tenga otra base (T-075).');
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
