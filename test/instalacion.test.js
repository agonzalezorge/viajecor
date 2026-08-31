// T-950 — Tests de lo que la app le pide al navegador para portarse como app.
//
// Todo esto es opcional y todo esto puede decir que no: un navegador viejo, una
// ventana privada, el archivo abierto desde el disco. Lo que se prueba acá es
// que **ninguna de esas respuestas rompa nada**, porque el peor resultado
// posible sería que la app dejara de abrir por una comodidad.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  registrarServicio, pedirPersistencia, RUTA_DEL_SERVICIO,
} from '../src/datos/instalacion.js';
import { manifiesto, COLOR } from '../tools/manifiesto.mjs';
import { buscarFugasDelServicio } from '../tools/privacidad.mjs';
import { dibujarPersistencia, dibujarDatos } from '../src/ui/pantallas/datos.js';
import { enlazarManifiesto } from '../src/ui/app.js';


// ── El trabajador de servicio ────────────────────────────────────────────────

test('desde un archivo no se registra: ahí no hace falta ni se puede', () => {
  // Es el caso MÁS usado hoy. Intentarlo dejaría un error en la consola de
  // todos los que abren el archivo bajado, para nada.
  let intentos = 0;
  const navegador = { serviceWorker: { register: () => { intentos += 1; } } };

  assert.deepEqual(registrarServicio(navegador, 'file:'), { pedido: false, motivo: 'archivo' });
  assert.equal(intentos, 0);
});

test('por http y por https sí, y siempre a la misma dirección', () => {
  for (const protocolo of ['http:', 'https:']) {
    const pedidas = [];
    const navegador = { serviceWorker: { register: (r) => { pedidas.push(r); return { catch: () => {} }; } } };

    assert.deepEqual(registrarServicio(navegador, protocolo), { pedido: true, motivo: null });
    assert.deepEqual(pedidas, [RUTA_DEL_SERVICIO]);
  }
});

test('un navegador que no los tiene no rompe nada', () => {
  assert.deepEqual(registrarServicio(undefined, 'https:'), { pedido: false, motivo: 'no lo tiene' });
  assert.deepEqual(registrarServicio({}, 'https:'), { pedido: false, motivo: 'no lo tiene' });
  assert.deepEqual(registrarServicio({ serviceWorker: {} }, 'https:'), { pedido: false, motivo: 'no lo tiene' });
});

test('si registrar tira, la app sigue: no es un error del usuario', () => {
  const navegador = { serviceWorker: { register: () => { throw new Error('no se puede'); } } };
  assert.deepEqual(registrarServicio(navegador, 'https:'), { pedido: false, motivo: 'falló' });
});

test('si la promesa se rompe después, tampoco queda un error suelto', async () => {
  // Una promesa rechazada sin `catch` deja un aviso en la consola de todos los
  // usuarios, por algo que no pueden ni tienen que arreglar.
  const navegador = { serviceWorker: { register: () => Promise.reject(new Error('nada')) } };
  assert.equal(registrarServicio(navegador, 'https:').pedido, true);
  await new Promise((seguir) => setTimeout(seguir, 5));
});


// ── El almacenamiento permanente ─────────────────────────────────────────────

test('si ya estaba concedido, no se vuelve a pedir', async () => {
  let pedidos = 0;
  const navegador = { storage: { persisted: async () => true, persist: async () => { pedidos += 1; return true; } } };

  assert.equal(await pedirPersistencia(navegador), 'sí');
  assert.equal(pedidos, 0, 'volver a pedir puede mostrarle un cartel al usuario porque sí');
});

test('si no estaba, se pide, y la respuesta se dice tal cual', async () => {
  assert.equal(await pedirPersistencia(
    { storage: { persisted: async () => false, persist: async () => true } }), 'sí');
  assert.equal(await pedirPersistencia(
    { storage: { persisted: async () => false, persist: async () => false } }), 'no');
});

test('un navegador que no sabe contestar da "no se sabe", no un "no"', async () => {
  // La diferencia importa: "no" y "no se sabe" llevan al mismo consejo, pero
  // decir "no" cuando no se sabe es afirmar algo que no se comprobó.
  assert.equal(await pedirPersistencia(undefined), 'no se sabe');
  assert.equal(await pedirPersistencia({}), 'no se sabe');
  assert.equal(await pedirPersistencia({ storage: {} }), 'no se sabe');
  assert.equal(await pedirPersistencia(
    { storage: { persist: async () => { throw new Error('nel'); } } }), 'no se sabe');
});

test('sin `persisted`, se pide igual: no hace falta preguntar antes', async () => {
  assert.equal(await pedirPersistencia({ storage: { persist: async () => true } }), 'sí');
});


// ── Lo que se le dice al usuario ─────────────────────────────────────────────

test('las tres respuestas se escriben, y ninguna promete de más', () => {
  const si = dibujarPersistencia('sí').replace(/\s+/g, ' ');
  assert.match(si, /no borrar/);
  assert.match(si, /Igual conviene respaldar/, 'que no borre por espacio no cubre borrar el historial');

  assert.match(dibujarPersistencia('no').replace(/\s+/g, ' '), /puede borrarlos para hacer lugar/);
  assert.match(dibujarPersistencia('no se sabe').replace(/\s+/g, ' '), /Tratalo como si no/);
});

test('mientras el navegador no contestó, no se dice nada', () => {
  // Un cartel que aparece y cambia solo, medio segundo después de abrir, se lee
  // como un error de la app.
  assert.equal(dibujarPersistencia(undefined), '');
});


// ── El manifiesto ────────────────────────────────────────────────────────────

test('el manifiesto lleva lo que Android necesita para el ícono', () => {
  const m = manifiesto('9.9.9');

  assert.equal(m.name, 'Viajecor');
  assert.equal(m.start_url, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.version, '9.9.9');
  assert.equal(m.theme_color, COLOR);
  assert.deepEqual(m.icons.map((i) => [i.sizes, i.type]), [['180x180', 'image/png']]);
  assert.match(m.icons[0].purpose, /maskable/, 'Android recorta el ícono con su forma');
});

test('el manifiesto no apunta a ningún lado fuera del sitio', () => {
  assert.doesNotMatch(JSON.stringify(manifiesto('1.0.0')), /https?:/);
});


// ── La guardia propia del trabajador de servicio ─────────────────────────────

test('el trabajador puede usar fetch: es su trabajo', () => {
  // Pasarlo por la guardia del HTML lo frenaría por hacer exactamente aquello
  // para lo que existe.
  assert.equal(buscarFugasDelServicio('fetch(pedido).then((r) => r)'), null);
  assert.equal(buscarFugasDelServicio('caches.open("x").then((c) => c.add("/"))'), null);
});

test('pero no puede hablar con ningún otro lado', () => {
  for (const codigo of [
    'fetch("https://ejemplo.com/x")',
    'new XMLHttpRequest()',
    'new WebSocket("x")',
    'new EventSource("x")',
    'navigator.sendBeacon("/x", d)',
    'importScripts("otro.js")',
  ]) {
    assert.match(String(buscarFugasDelServicio(codigo)), /trabajador de servicio tiene/, codigo);
  }
});


// ── El enlace al manifiesto, contra un documento de mentira ──────────────────

function documentoDeMentira() {
  const colgados = [];
  return {
    colgados,
    head: { appendChild: (nodo) => colgados.push(nodo) },
    createElement: () => ({}),
    querySelector: (selector) => colgados.find((n) =>
      selector === 'link[rel="manifest"]' && n.rel === 'manifest') ?? null,
  };
}

test('el manifiesto se cuelga solo cuando hay un servidor detrás', () => {
  for (const protocolo of ['http:', 'https:']) {
    const documento = documentoDeMentira();
    assert.equal(enlazarManifiesto(documento, protocolo), true);
    assert.deepEqual(documento.colgados.map((n) => [n.rel, n.href]),
      [['manifest', '/manifest.webmanifest']]);
  }
});

test('desde un archivo NO se cuelga', () => {
  // El archivo bajado es uno solo: no tiene al lado ningún manifiesto que
  // pedir, y pedirlo sería un error en la consola en el caso más usado.
  const documento = documentoDeMentira();
  assert.equal(enlazarManifiesto(documento, 'file:'), false);
  assert.deepEqual(documento.colgados, []);
});

test('no se cuelga dos veces', () => {
  const documento = documentoDeMentira();
  enlazarManifiesto(documento, 'https:');
  assert.equal(enlazarManifiesto(documento, 'https:'), false);
  assert.equal(documento.colgados.length, 1);
});


// ── La pantalla de Datos lo muestra ──────────────────────────────────────────

test('la pantalla de Datos escribe lo que contestó el navegador', () => {
  const vista = { estado: { movimientos: [], monedas: [], tipos_cambio: [] }, persistencia: 'no' };
  assert.match(dibujarDatos(vista).replace(/\s+/g, ' '), /puede borrarlos para hacer lugar/);

  assert.doesNotMatch(dibujarDatos({ ...vista, persistencia: undefined }), /para hacer lugar/);
});
