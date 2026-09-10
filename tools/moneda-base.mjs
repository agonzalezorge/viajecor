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
 * El texto con el CONTENIDO de las cadenas en blanco.
 *
 * Sin esto, el mensaje de error de `totalEnEuros()` —que nombra a la función
 * dentro de sus comillas— se contaba como una llamada mal hecha. Un guardián que
 * marca su propio mensaje de error no lo usa nadie dos veces.
 */
function sinCadenas(codigo) {
  return codigo.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g,
    (cadena) => cadena[0] + cadena.slice(1, -1).replace(/[^\n]/g, ' ') + cadena[0]);
}

/**
 * Las llamadas que se olvidaron de la base, con su archivo y su línea.
 *
 * `archivos` es un mapa de ruta a contenido. Se saltea la definición de las
 * funciones —en `core/cambio.js` viven las cinco— mirando solo las llamadas, no
 * los `export function`.
 */
export function llamadasSinBase(archivos) {
  const problemas = [];

  for (const [ruta, contenido] of archivos) {
    const codigo = sinCadenas(sinComentarios(contenido));

    for (const [nombre, esperados] of CONVIERTEN_PLATA) {
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
          mensaje: `${ruta}:${linea} — ${nombre}() se llamó con ${cuantos} argumento(s) y necesita ${esperados}: `
            + 'le falta la moneda base. Pasala con monedaBaseDe(estado); suponer el euro es lo que '
            + 'rompió la carga con el peso uruguayo (T-059).',
        });
      }
    }
  }

  return problemas;
}
