// T-950 — Tests del trabajador de servicio, EJECUTÁNDOLO.
//
// ── Por qué así y no mirándolo en el navegador ───────────────────────────────
//
// El recorrido en el navegador comprueba lo que importa —que la app abra sin
// red— pero solo prueba el camino feliz y el camino sin red. Los casos que
// hacen daño son otros: una respuesta 500 guardada como si fuera la app, una
// copia vieja que nunca se tira, un pedido ajeno interceptado. Esos son
// difíciles de provocar a mano y fáciles de escribir acá.
//
// El truco es que el trabajador es JavaScript común: recibe su mundo (`self`,
// `caches`, `fetch`) del entorno. Dándole un mundo de mentira se lo puede
// ejecutar en `node --test` y mirar qué hace, en vez de suponerlo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const codigo = (await readFile(new URL('../src/servicio.js', import.meta.url), 'utf8'))
  .replaceAll('{{VERSION}}', '9.9.9');

/** Enciende el trabajador en un mundo de mentira y devuelve con qué se quedó. */
function encender({ respuestaDeRed = null, cachesIniciales = ['viajecor-vieja'] } = {}) {
  const escuchas = new Map();
  const guardado = new Map();
  const borradas = [];
  const pedidosALaRed = [];
  let tomoElControl = false;
  let seAdelanto = false;

  const cacheFalso = {
    add: async (r) => { guardado.set(r, { falso: 'la app', url: r }); },
    put: async (r, respuesta) => { guardado.set(r, respuesta); },
    match: async (r) => guardado.get(r) ?? undefined,
  };

  const mundo = {
    self: {
      addEventListener: (nombre, mano) => escuchas.set(nombre, mano),
      skipWaiting: () => { seAdelanto = true; },
      clients: { claim: () => { tomoElControl = true; } },
    },
    caches: {
      open: async () => cacheFalso,
      keys: async () => [...cachesIniciales],
      delete: async (nombre) => { borradas.push(nombre); return true; },
    },
    fetch: async (pedido) => {
      pedidosALaRed.push(pedido);
      if (respuestaDeRed instanceof Error) throw respuestaDeRed;
      return respuestaDeRed;
    },
    Response: { error: () => ({ esError: true }) },
  };

  // El trabajador se ejecuta con ese mundo en vez del del navegador.
  new Function('self', 'caches', 'fetch', 'Response', codigo)(
    mundo.self, mundo.caches, mundo.fetch, mundo.Response);

  return { escuchas, guardado, borradas, pedidosALaRed,
    tomoElControl: () => tomoElControl, seAdelanto: () => seAdelanto };
}

/** Un evento de instalación/activación: junta lo que se le pasa a `waitUntil`. */
function eventoDeEspera() {
  const esperas = [];
  return { evento: { waitUntil: (p) => esperas.push(p) }, listo: () => Promise.all(esperas) };
}

/** Un evento de navegación, que junta con qué se lo respondió. */
function eventoDeNavegacion(pedido) {
  let respondido = null;
  return {
    evento: { request: pedido, respondWith: (p) => { respondido = p; } },
    respuesta: () => respondido,
  };
}

const navegar = { method: 'GET', mode: 'navigate', url: 'https://viajecor/' };


// ── Instalación ──────────────────────────────────────────────────────────────

test('al instalarse guarda la página, para que la primera vez sin red funcione', async () => {
  const t = encender();
  const { evento, listo } = eventoDeEspera();

  t.escuchas.get('install')(evento);
  await listo();

  assert.deepEqual([...t.guardado.keys()], ['/']);
  assert.equal(t.seAdelanto(), true, 'sin esto la copia recién sirve la próxima vez');
});


// ── Activación ───────────────────────────────────────────────────────────────

test('al activarse tira las copias de versiones anteriores', async () => {
  // Sin esto, cada publicación deja medio megabyte olvidado en el teléfono.
  const t = encender({ cachesIniciales: ['viajecor-9.9.9', 'viajecor-vieja', 'otra-cosa'] });
  const { evento, listo } = eventoDeEspera();

  t.escuchas.get('activate')(evento);
  await listo();

  assert.deepEqual(t.borradas.sort(), ['otra-cosa', 'viajecor-vieja']);
  assert.equal(t.borradas.includes('viajecor-9.9.9'), false, 'la de ESTA versión se queda');
  assert.equal(t.tomoElControl(), true);
});


// ── Con red ──────────────────────────────────────────────────────────────────

test('con red se responde con lo de la red, y se guarda una copia fresca', async () => {
  // Es la mitad que evita el peor final: quedarse con una versión vieja pegada
  // y cargar gastos en una app que ya no es la que se publicó.
  const deLaRed = { ok: true, clone: () => ({ copia: true }) };
  const t = encender({ respuestaDeRed: deLaRed });
  const { evento, respuesta } = eventoDeNavegacion(navegar);

  t.escuchas.get('fetch')(evento);

  assert.equal(await respuesta(), deLaRed);
  assert.deepEqual(t.pedidosALaRed, [navegar]);
  await new Promise((seguir) => setTimeout(seguir, 0));
  assert.deepEqual(t.guardado.get('/'), { copia: true });
});

test('una respuesta con error NO se guarda', async () => {
  // Guardar un 500 sería servirle ese error al usuario cada vez que se quede
  // sin conexión, para siempre.
  const t = encender({ respuestaDeRed: { ok: false, status: 500, clone: () => ({ copia: true }) } });
  const { evento, respuesta } = eventoDeNavegacion(navegar);

  t.escuchas.get('fetch')(evento);
  await respuesta();
  await new Promise((seguir) => setTimeout(seguir, 0));

  assert.equal(t.guardado.has('/'), false);
});


// ── Sin red ──────────────────────────────────────────────────────────────────

test('sin red se responde con la copia guardada', async () => {
  const t = encender({ respuestaDeRed: new Error('sin conexión') });
  t.guardado.set('/', { falso: 'la app guardada' });
  const { evento, respuesta } = eventoDeNavegacion(navegar);

  t.escuchas.get('fetch')(evento);

  assert.deepEqual(await respuesta(), { falso: 'la app guardada' });
});

test('sin red y sin copia, un error honesto: no una página en blanco', async () => {
  const t = encender({ respuestaDeRed: new Error('sin conexión') });
  const { evento, respuesta } = eventoDeNavegacion(navegar);

  t.escuchas.get('fetch')(evento);

  assert.deepEqual(await respuesta(), { esError: true });
});


// ── Lo que NO toca ───────────────────────────────────────────────────────────

test('no se mete con nada que no sea abrir esta app', async () => {
  // No está para interceptar la web: está para que esta página abra sin red.
  const t = encender({ respuestaDeRed: { ok: true, clone: () => ({}) } });

  for (const pedido of [
    { method: 'POST', mode: 'navigate', url: 'https://viajecor/' },
    { method: 'GET', mode: 'cors', url: 'https://otro/' },
    { method: 'GET', mode: 'no-cors', url: 'https://otro/x.png' },
  ]) {
    const { evento, respuesta } = eventoDeNavegacion(pedido);
    t.escuchas.get('fetch')(evento);
    assert.equal(respuesta(), null, `interceptó ${pedido.method} ${pedido.mode}`);
  }

  assert.deepEqual(t.pedidosALaRed, [], 'ni siquiera los pidió');
});
