// T-007 — La promesa central de la app es que ningún dato sale del dispositivo.
// Una promesa que depende de que nadie se olvide nunca no es una promesa: este
// test la vuelve verificable en cada cambio. Ver RN-06 y ADR-009.
//
// La lista de lo que está prohibido **no vive acá**: vive en tools/privacidad.mjs
// y la usa también el constructor. Antes había una copia en cada lado, que es la
// forma más común de que una regla y su comprobación se separen sin que nadie lo
// note — y la que se queda atrás es siempre la del test, que es la que se mira.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buscarFugas, revisarExcepciones, ESQUEMAS_PERMITIDOS, DOMINIOS_DE_ESQUEMA,
} from '../tools/privacidad.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leerConstruido = () => readFile(join(RAIZ, 'dist/viajecor.html'), 'utf8');

test('el archivo construido no tiene ninguna forma de mandar datos afuera', async () => {
  assert.equal(buscarFugas(await leerConstruido()), null);
});

test('el archivo construido lleva la versión del archivo VERSION', async () => {
  const html = await leerConstruido();
  const version = (await readFile(join(RAIZ, 'VERSION'), 'utf8')).trim();

  assert.ok(
    html.includes(JSON.stringify(version)),
    `el archivo construido no dice la versión ${version}: se construyó desde una versión distinta`
  );
});

// ── Que la guardia realmente muerda ──────────────────────────────────────────
//
// Un test que solo comprueba que el archivo está limpio no distingue entre una
// guardia que funciona y una guardia rota que aprueba todo. Estos le dan de
// comer archivos sucios y exigen que los rechace.

test('la guardia rechaza cada forma de sacar datos', () => {
  const sucios = [
    ['una dirección', '<p>ver https://ejemplo.com</p>'],
    ['un fetch', 'const datos = fetch("/api");'],
    ['XMLHttpRequest', 'new XMLHttpRequest();'],
    ['un WebSocket', 'new WebSocket(ws);'],
    ['un EventSource', 'new EventSource(x);'],
    ['sendBeacon', 'navigator.sendBeacon(x, y);'],
    ['una carga dinámica', 'await import(ruta);'],
    ['un formulario que se envía', '<form action="/guardar">'],
    ['un script externo', '<script src="app.js"></script>'],
    ['una hoja de estilos externa', '<link rel="stylesheet" href="x.css">'],
    ['una imagen externa', '<img src="foto.png">'],
  ];

  for (const [que, html] of sucios) {
    assert.notEqual(buscarFugas(html), null, `la guardia dejó pasar ${que}`);
  }
});

test('una imagen incrustada sí se acepta', () => {
  // Las imágenes en `data:` viajan dentro del archivo: no son una petición.
  assert.equal(buscarFugas('<img src="data:image/png;base64,iVBORw0KGgo=">'), null);
});

// ── La excepción de los espacios de nombres XML (T-906) ──────────────────────

test('un espacio de nombres de XML entre comillas se acepta', () => {
  // Un .xlsx exige escribirlo tal cual. Es una etiqueta de formato, no una
  // dirección: nadie se conecta ahí, y Excel abre archivos sin conexión.
  const codigo = `const NS = "${ESQUEMAS_PERMITIDOS[0]}";`;

  assert.equal(buscarFugas(codigo), null);
});

test('el mismo texto suelto, fuera de una cadena, se rechaza', () => {
  const suelto = `const NS = ${ESQUEMAS_PERMITIDOS[0]};`;

  assert.notEqual(buscarFugas(suelto), null);
});

test('cualquier OTRA dirección se sigue rechazando aunque haya un esquema permitido', () => {
  // Es la comprobación que hace que la excepción no sea una puerta: sacar lo
  // permitido no puede tapar lo que quedó.
  const mezcla = `const NS = "${ESQUEMAS_PERMITIDOS[0]}"; const malo = "http://ejemplo.com/subir";`;

  assert.notEqual(buscarFugas(mezcla), null);
});

test('la lista de excepciones no puede crecer hacia cualquier lado', () => {
  // La lista blanca está acotada por dominio, y eso se comprueba en cada
  // construcción. Sin este límite, "excepción" es otra palabra para "puerta".
  assert.equal(revisarExcepciones(), null);

  for (const esquema of ESQUEMAS_PERMITIDOS) {
    assert.ok(
      DOMINIOS_DE_ESQUEMA.some((dominio) => esquema.startsWith(dominio)),
      `${esquema} no está bajo ningún dominio de esquemas conocido`
    );
  }
});

test('las excepciones son pocas y se pueden leer de un vistazo', () => {
  // No es una regla técnica: es la que impide que la lista se vuelva un cajón.
  // Si hace falta pasarla, que sea con una decisión escrita, no por goteo.
  assert.ok(ESQUEMAS_PERMITIDOS.length <= 8, 'la lista de excepciones se está volviendo un cajón');
});

test('una excepción fuera de los dominios conocidos frena todo', () => {
  // La guardia se prueba con una lista MALA. Comprobar solo que la lista buena
  // de hoy pasa no distingue una guardia que funciona de una que aprueba todo.
  const conIntruso = [...ESQUEMAS_PERMITIDOS, 'http://ejemplo.com/mi-esquema'];

  assert.notEqual(revisarExcepciones(conIntruso), null);
  assert.notEqual(buscarFugas('<p>hola</p>', { esquemas: conIntruso }), null);
});

test('un dominio de esquemas a medias frena todo', () => {
  // "http://" como dominio permitido convertiría la excepción en una puerta
  // abierta: cualquier dirección empezaría con él.
  for (const aMedias of [['http://'], ['https://'], ['http://x.y']]) {
    assert.notEqual(
      revisarExcepciones(ESQUEMAS_PERMITIDOS, aMedias), null,
      `se aceptó "${aMedias[0]}" como dominio de esquemas`
    );
  }
});

test('con un dominio a medias, una dirección de verdad pasaría — y por eso se rechaza antes', () => {
  const problema = buscarFugas(
    'const subir = "http://ejemplo.com/subir";',
    { esquemas: ['http://ejemplo.com/subir'], dominios: ['http://'] }
  );

  assert.notEqual(problema, null);
});

test('un ícono traído de un servidor no pasa', () => {
  // Es la puerta que abrió T-948 al meter el ícono como `data:`. Un ícono
  // externo le cuenta a ese servidor cada vez que abrís la app.
  assert.match(String(buscarFugas('<link rel="icon" href="https://x.com/f.png">')), /ícono|dirección/i);
  assert.match(String(buscarFugas('<link rel="apple-touch-icon" href="/icono.png">')), /ícono/i);
  assert.equal(buscarFugas('<link rel="icon" href="data:image/png;base64,AAA">'), null);
  assert.equal(buscarFugas('<link rel="apple-touch-icon" href="data:image/png;base64,AAA">'), null);
});

test('la CSP publicada prohíbe salir a internet y permite lo que la app necesita', async () => {
  // `vercel.json` es la única parte del proyecto que el navegador HACE CUMPLIR:
  // la guardia de la construcción mira el código, la CSP le prohíbe al navegador
  // conectarse aunque el código lo pidiera. Por eso se testea: si alguien la
  // aflojara para arreglar algo, esto tiene que ponerse en rojo.
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

  assert.match(csp, /default-src 'none'/, 'lo que no está permitido, no se permite');
  assert.match(csp, /connect-src 'none'/, 'ni fetch, ni XHR, ni WebSocket');
  assert.match(csp, /form-action 'none'/, 'ningún formulario se envía a ningún lado');

  // Y lo que sí hace falta, porque la app es un archivo solo: el guión y los
  // estilos van escritos adentro, y el ícono es un `data:`.
  assert.match(csp, /script-src 'unsafe-inline'/);
  assert.match(csp, /style-src 'unsafe-inline'/);
  assert.match(csp, /img-src data:/);

  // Ninguna fuente externa colada por la puerta de atrás.
  assert.doesNotMatch(csp, /https?:/);
  assert.doesNotMatch(csp, /\*/);
});

test('la configuración de publicación apunta a lo que el build genera', () => {
  // El primer despliegue falló por esto: Vercel corrió el build —bien— y
  // después buscó una carpeta `public` que no existía. Un error de una línea
  // que no rompe ningún test a menos que exista este.
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.buildCommand, 'node tools/build.mjs');
  assert.match(readFileSync(new URL('../tools/build.mjs', import.meta.url), 'utf8'),
    /'public\/index\.html'/, 'el build tiene que escribir ahí adentro');
});
