// Tests de las guardias del constructor.
//
// El constructor es el único paso entre `src/` y lo que el usuario abre en su
// teléfono, y sus fallas tienen una forma particular: **no dan error**. Un
// módulo olvidado en la lista (L-017) o un error de sintaxis (L-028) producen un
// `dist/viajecor.html` del tamaño esperado, con la construcción en verde, que
// abre **en blanco** en el celular.
//
// Se prueba la guardia, no el constructor entero: romper un módulo de verdad
// para probarla dejaría un archivo roto mientras los demás tests lo están
// leyendo, que es peor que el error que se buscaba (L-027).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buscarErrorDeSintaxis } from '../tools/sintaxis.mjs';
import { buscarFugas } from '../tools/privacidad.mjs';
import { iconoComoDataUri } from '../tools/icono.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('el código bueno pasa', () => {
  assert.equal(buscarErrorDeSintaxis('const a = 1; function f() { return a; }'), null);
  assert.equal(buscarErrorDeSintaxis(''), null);
});

test('un error de sintaxis se detecta y se explica', () => {
  // El caso real que lo trajo: un acento grave adentro de un comentario HTML,
  // dentro de una plantilla de JavaScript, cerró la plantilla.
  const roto = 'const x = `hola `mundo` chau`;';

  const error = buscarErrorDeSintaxis(roto);
  assert.notEqual(error, null, 'no detectó el error');
  assert.match(error, /no se puede leer/);
  assert.match(error, /error de sintaxis en algún módulo de src/,
    'el mensaje tiene que decir dónde buscar');
});

test('detecta las formas más comunes de romper un archivo', () => {
  for (const roto of [
    'const roto = ;',
    'function f( { }',
    'const a = {',
    'if (true) { console.log(1)',
    'const s = "sin cerrar;',
  ]) {
    assert.notEqual(buscarErrorDeSintaxis(roto), null, `no detectó: ${roto}`);
  }
});

test('la guardia NO ejecuta el código que revisa', () => {
  // `new Function` compila y no llama. Si ejecutara, revisar un módulo tendría
  // efectos, y la construcción dejaría de ser una operación segura.
  globalThis.__tocado = false;
  assert.equal(buscarErrorDeSintaxis('globalThis.__tocado = true;'), null);
  assert.equal(globalThis.__tocado, false, 'la guardia ejecutó el código');
  delete globalThis.__tocado;
});

test('el constructor USA las dos guardias', async () => {
  // Una guardia perfecta que nadie llama no protege de nada, y es la mutación
  // que sobrevivió a la primera vuelta: sacar la línea de `build.mjs` no ponía
  // ni un test en rojo.
  //
  // Esto es una comprobación de humo: lee el constructor y exige que las llame.
  // No prueba que las llame en el momento correcto —eso lo prueba el test de
  // abajo y el de privacidad—, pero sí que no se hayan ido. Probarlo de verdad
  // exigiría romper un módulo de `src/` mientras los otros tests lo leen, que es
  // peor que el error que se busca (L-027).
  const { readFile } = await import('node:fs/promises');
  const constructor = await readFile(join(RAIZ, 'tools/build.mjs'), 'utf8');

  for (const guardia of ['buscarErrorDeSintaxis', 'buscarFugas']) {
    assert.match(constructor, new RegExp(`import .*${guardia}`), `no importa ${guardia}`);
    assert.match(constructor, new RegExp(`${guardia}\\(`), `importa ${guardia} y no la llama`);
  }
});

test('el archivo construido pasa su propia guardia', async () => {
  // La comprobación de punta a punta, sin romper nada: se construye y se mira
  // que el guión del archivo generado sea legible.
  const { readFile } = await import('node:fs/promises');
  await promisify(execFile)('node', ['tools/build.mjs'], { cwd: RAIZ });
  const html = await readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8');

  const guion = html.slice(html.indexOf('(function () {'), html.lastIndexOf('})();') + 5);
  assert.ok(guion.length > 1000, 'no se encontró el guión adentro del HTML');
  assert.equal(buscarErrorDeSintaxis(guion), null);
});

test('el build deja la MISMA app en la raíz, byte a byte', async () => {
  // `index.html` es lo que GitHub Pages sirve como página del repositorio, y
  // por eso la dirección puede ser `…github.io/viajecor/` (T-948, ADR-043).
  // Si se editara a mano, serían dos apps con el mismo nombre y el usuario no
  // tendría cómo saber cuál está usando: por eso la escribe el build, y por eso
  // este test compara el contenido y no la fecha.
  const { readFile } = await import('node:fs/promises');
  await promisify(execFile)('node', ['tools/build.mjs'], { cwd: RAIZ });

  const [enDist, enRaiz] = await Promise.all([
    readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8'),
    readFile(join(RAIZ, 'index.html'), 'utf8'),
  ]);

  assert.equal(enRaiz, enDist);
});

test('la app de la raíz tampoco pide nada a internet', async () => {
  // La guardia de privacidad corre sobre lo que el build genera, pero este es
  // el archivo que va a estar PUBLICADO: es el que cualquiera abre.
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');

  assert.equal(buscarFugas(html), null);
});

test('el ícono es un PNG de verdad, cuadrado y del tamaño que pide iOS', () => {
  // Se arma a mano (no hay dependencias), así que lo que hay que comprobar es
  // que salga un PNG válido y no un montón de bytes con cara de PNG: la firma,
  // el alto y el ancho leídos de la propia cabecera del archivo.
  const uri = iconoComoDataUri();
  assert.ok(uri.startsWith('data:image/png;base64,'));

  const png = Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64');
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(png.readUInt32BE(16), 180, 'ancho');
  assert.equal(png.readUInt32BE(20), 180, 'alto');
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString('ascii'), 'IEND');
});

test('el archivo construido lleva el ícono adentro, también el de Apple', async () => {
  // El de Apple es el que usa "Añadir a pantalla de inicio" en un iPhone. Sin
  // él, iOS pone una captura de la pantalla como ícono.
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(join(RAIZ, 'index.html'), 'utf8');

  assert.match(html, /<link rel="icon" href="data:image\/png;base64,[A-Za-z0-9+/=]+">/);
  assert.match(html, /<link rel="apple-touch-icon" href="data:image\/png;base64,[A-Za-z0-9+/=]+">/);
  assert.doesNotMatch(html, /\/\*\{\{ICONO\}\}\*\//, 'quedó el hueco sin reemplazar');
});
