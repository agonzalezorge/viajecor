// T-007 — La promesa central de la app es que ningún dato sale del dispositivo.
// Una promesa que depende de que nadie se olvide nunca no es una promesa: este
// test la vuelve verificable en cada cambio. Ver RN-06 y ADR-009.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const FORMAS_DE_SALIR = [
  ['una dirección de internet', /\bhttps?:\/\//i],
  ['una petición fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['un WebSocket', /\bWebSocket\b/],
  ['un EventSource', /\bEventSource\b/],
  ['sendBeacon', /navigator\s*\.\s*sendBeacon/],
  ['una carga dinámica de módulo', /\bimport\s*\(/],
  ['un formulario que se envía a algún lado', /<form[^>]*\baction\s*=/i],
];

test('el archivo construido no tiene ninguna forma de mandar datos afuera', async () => {
  const html = await readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8');

  for (const [descripcion, patron] of FORMAS_DE_SALIR) {
    const encontrado = html.match(patron);
    assert.equal(
      encontrado,
      null,
      `dist/viajecor.html contiene ${descripcion} ("${encontrado?.[0]}"). ` +
      `La app no hace ninguna petición de red.`
    );
  }
});

test('el archivo construido no depende de ningún archivo externo', async () => {
  const html = await readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8');

  assert.equal(/<script[^>]*\bsrc\s*=/i.test(html), false,
    'hay un <script src=...>: todo el JavaScript tiene que estar dentro del archivo');
  assert.equal(/<link[^>]*\brel\s*=\s*["']?stylesheet/i.test(html), false,
    'hay un <link rel="stylesheet">: todo el CSS tiene que estar dentro del archivo');
  assert.equal(/<img[^>]*\bsrc\s*=\s*["'](?!data:)/i.test(html), false,
    'hay una imagen externa: las imágenes tienen que ir incrustadas');
});

test('el archivo construido lleva la versión del archivo VERSION', async () => {
  const html = await readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8');
  const version = (await readFile(join(RAIZ, 'VERSION'), 'utf8')).trim();

  assert.ok(
    html.includes(JSON.stringify(version)),
    `el archivo construido no dice la versión ${version}: se construyó desde una versión distinta`
  );
});
