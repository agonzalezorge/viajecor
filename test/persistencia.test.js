// T-950 · Avisar cuando el navegador no puede guardar.
//
// Este archivo existe por un error real: el 2026-08-27 el usuario abrió la app
// en su Android desde la app Archivos, cargó cuatro movimientos, cerró Chrome y
// los perdió. La app no dijo nada — aceptó los datos, dijo "guardado", y los
// tiró.
//
// Lo que se prueba acá es que **el caso `content://` se detecte sin un teléfono
// Android**, que es justamente lo que no se podía probar cuando pasó.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  riesgoDeGuardado, SIN_ALMACENAMIENTO, SIN_IDENTIDAD, leerEstado, guardarEstado,
} from '../src/datos/almacenamiento.js';
import { dibujarRiesgoDeGuardado, dibujarApp, vistaInicial } from '../src/ui/app.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';

/** Un almacén que funciona, como el de un navegador normal. */
function almacenBueno() {
  const datos = new Map();
  return {
    getItem: (c) => (datos.has(c) ? datos.get(c) : null),
    setItem: (c, v) => datos.set(c, String(v)),
    removeItem: (c) => datos.delete(c),
  };
}

// ── El caso que pasó de verdad ───────────────────────────────────────────────

test('abrir desde el explorador de archivos de Android se detecta como peligro', () => {
  // `content://` es lo que Android le pasa al navegador cuando el archivo se
  // abre desde la app Archivos. No es un sitio: no hay dónde guardar.
  const riesgo = riesgoDeGuardado('content:', almacenBueno());

  assert.equal(riesgo.motivo, SIN_IDENTIDAD);
  assert.match(riesgo.explicacion, /desaparecen al cerrar/);
});

test('el aviso dice qué hacer, no solo qué está mal', () => {
  // "Tus datos corren peligro" sin una salida es angustia sin utilidad.
  const riesgo = riesgoDeGuardado('content:', almacenBueno());

  assert.match(riesgo.queHacer, /file:\/\/\//);
  assert.ok(riesgo.queHacer.length > 40, 'la instrucción tiene que ser concreta');
});

test('un almacén que acepta escrituras NO alcanza para estar tranquilo', () => {
  // Es el corazón del error: en `content://` escribir funciona, leer funciona,
  // todo parece bien, y se pierde al cerrar. Probar la escritura no sirve.
  const almacen = almacenBueno();
  almacen.setItem('prueba', 'anda');

  assert.equal(almacen.getItem('prueba'), 'anda');
  assert.notEqual(riesgoDeGuardado('content:', almacen), null);
});

// ── Los casos que sí están bien ──────────────────────────────────────────────

test('abrir por su dirección de archivo está bien', () => {
  assert.equal(riesgoDeGuardado('file:', almacenBueno()), null);
});

test('servida por web también está bien', () => {
  assert.equal(riesgoDeGuardado('http:', almacenBueno()), null);
  assert.equal(riesgoDeGuardado('https:', almacenBueno()), null);
});

// ── Sin almacenamiento en absoluto ───────────────────────────────────────────

test('un navegador sin almacenamiento se detecta, y es lo primero que se dice', () => {
  for (const almacen of [null, {}, { setItem: 'no soy una función' }]) {
    const riesgo = riesgoDeGuardado('file:', almacen);
    assert.equal(riesgo?.motivo, SIN_ALMACENAMIENTO, `con ${JSON.stringify(almacen)}`);
  }
});

test('un almacén que tira al escribir se detecta', () => {
  // Es lo que hace Safari en navegación privada, y algunos navegadores con el
  // almacenamiento bloqueado.
  const queTira = { setItem: () => { throw new Error('bloqueado'); }, getItem: () => null, removeItem: () => {} };

  assert.equal(riesgoDeGuardado('file:', queTira).motivo, SIN_ALMACENAMIENTO);
});

test('un almacén que acepta pero no devuelve lo escrito se detecta', () => {
  // Hay navegadores que fingen: `setItem` no tira y `getItem` devuelve null.
  const mentiroso = { setItem: () => {}, getItem: () => null, removeItem: () => {} };

  assert.equal(riesgoDeGuardado('file:', mentiroso).motivo, SIN_ALMACENAMIENTO);
});

test('la prueba de escritura no deja basura', () => {
  const almacen = almacenBueno();
  riesgoDeGuardado('file:', almacen);

  assert.equal(almacen.getItem('viajecor:rescate:prueba'), null);
});

// ── Lo que se ve ─────────────────────────────────────────────────────────────

test('sin riesgo no se dibuja nada', () => {
  assert.equal(dibujarRiesgoDeGuardado(null), '');
});

test('el aviso se ve en TODAS las pantallas y no se puede cerrar', () => {
  // No hay excepción: es el único aviso de la app que no se pospone, porque lo
  // que anuncia es que todo lo que se escriba se va a perder.
  const riesgo = riesgoDeGuardado('content:', almacenBueno());
  const vista = { ...vistaInicial({ estado: estadoInicial(), riesgoDeGuardado: riesgo }) };

  for (const pantalla of ['mes', 'movimientos', 'nuevo', 'datos']) {
    const html = dibujarApp({ ...vista, pantalla });
    assert.match(html, /peligro-datos/, `no aparece en ${pantalla}`);
    assert.equal(/data-accion="[^"]*cerrar[^"]*"/.test(html), false, 'no puede tener botón de cerrar');
  }
});

test('el aviso está enchufado a la app, no solo escrito', () => {
  // L-014: una función con tests puede estar muerta.
  const riesgo = riesgoDeGuardado('content:', almacenBueno());
  const conRiesgo = dibujarApp(vistaInicial({ estado: estadoInicial(), riesgoDeGuardado: riesgo }));
  const sinRiesgo = dibujarApp(vistaInicial({ estado: estadoInicial() }));

  assert.match(conRiesgo, /va a perder tus datos/);
  assert.equal(/va a perder tus datos/.test(sinRiesgo), false);
});

test('sin pasarle un almacén, lo busca en el navegador y no tira', () => {
  // `iniciar(document)` no pasa almacén. La primera versión recibía `undefined`
  // y le avisaba a TODO el mundo que no estaba guardando nada — un aviso que
  // grita en falso enseña a ignorarlo. Lo encontró el recorrido en el navegador.
  //
  // Acá no hay `localStorage` (esto corre en Node), así que la respuesta
  // correcta es "no hay dónde guardar" y, sobre todo, **no una excepción**: la
  // función que detecta que no se puede guardar no puede romper la app.
  let riesgo;
  assert.doesNotThrow(() => { riesgo = riesgoDeGuardado('file:'); });
  assert.equal(riesgo.motivo, SIN_ALMACENAMIENTO);
});

// ── Que la app abra aunque no haya dónde guardar ─────────────────────────────

test('buscar el almacenamiento nunca tira, ni cuando nombrarlo tira', () => {
  // Lo encontró el recorrido en el navegador: con `localStorage` bloqueado, la
  // app quedaba EN BLANCO. `typeof localStorage === 'undefined'` parece
  // defensivo y no lo es — si el navegador tira con solo nombrarlo, `typeof`
  // tira también, y el error subía hasta arriba.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    get() { throw new Error('bloqueado'); },
    configurable: true,
  });

  try {
    let riesgo;
    assert.doesNotThrow(() => { riesgo = riesgoDeGuardado('file:'); });
    assert.equal(riesgo.motivo, SIN_ALMACENAMIENTO);

    // Y lo que más importa: la app tiene que poder LEER y abrir igual.
    assert.doesNotThrow(() => leerEstado());
    assert.equal(leerEstado().estado.movimientos.length, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('sin almacenamiento, guardar falla con un motivo entendible', () => {
  // Leer tiene que ser silencioso; guardar tiene que fallar y decir por qué.
  // Un guardado que "funciona" sin guardar es lo que hizo perder los datos.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    get() { throw new Error('bloqueado'); },
    configurable: true,
  });

  try {
    assert.throws(() => guardarEstado(estadoInicial()), /No hay dónde guardar/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
