// T-065 — Las instrucciones de la app (CU-21).
//
// ── El riesgo de una pantalla como esta ─────────────────────────────────────
//
// Un texto que describe la app **envejece solo**. No da error, no rompe ningún
// test, no se ve raro: sigue ahí, diciendo tranquilamente cosas que dejaron de
// ser ciertas. Es exactamente lo que pasó con el cartel de "Corregir y borrar
// llega con T-015", que estuvo meses prometiendo algo ya hecho hasta que el
// usuario lo leyó.
//
// Por eso estos tests no comprueban la redacción —eso es del usuario— sino que
// **lo que el texto nombra siga existiendo**: las pantallas, los botones y las
// palabras con las que la app se refiere a sus propias cosas.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dibujarInstrucciones } from '../src/ui/pantallas/instrucciones.js';
import { dibujarAjustes } from '../src/ui/pantallas/ajustes.js';
import { pantallasRegistradas, pantalla, dibujarApp, vistaInicial, PERFIL_AHORROS } from '../src/ui/app.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales, monedaBaseDe } from '../src/core/monedas.js';
import { cambiarMonedaBase } from '../src/core/base.js';

const estado = estadoInicial({ monedas: monedasIniciales() });
const html = () => dibujarInstrucciones({ estado });

/** El texto que ve una persona: sin etiquetas ni comentarios del HTML. */
const visible = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');


// ── Que se llegue ───────────────────────────────────────────────────────────

test('Ajustes lleva a las instrucciones, y las pone arriba de todo', () => {
  // Es lo primero que necesita quien abre la app sin saber qué es, y el último
  // lugar donde lo buscaría es abajo de "Tipos de cambio".
  const ajustes = dibujarAjustes({ estado });

  assert.match(ajustes, /data-pantalla="instrucciones"/);
  assert.ok(ajustes.indexOf('instrucciones') < ajustes.indexOf('data-pantalla="rubros"'),
    'el enlace tiene que estar antes que el resto');
});

test('la pantalla está registrada y se dibuja en los dos perfiles', () => {
  // Quien abre los ahorros conjuntos por primera vez tiene el mismo derecho a
  // que le expliquen qué son.
  const definicion = pantalla('instrucciones');

  assert.equal(definicion.enBarra, false, 'no ocupa lugar en la barra de abajo');
  for (const perfil of ['cotidiana', PERFIL_AHORROS]) {
    const app = dibujarApp({ ...vistaInicial({ estado }), pantalla: 'instrucciones', perfil });
    assert.match(app, /Cómo funciona Viajecor/, `no se dibuja en ${perfil}`);
  }
});


// ── Que no mienta ───────────────────────────────────────────────────────────

test('cada pestaña que el texto nombra existe de verdad', () => {
  const texto = visible(html());
  const etiquetas = pantallasRegistradas()
    .filter((p) => p.enBarra !== false)
    .map((p) => p.etiqueta);

  // Las cinco de la barra se nombran en el recorrido, así que todas tienen que
  // seguir llamándose así. Si alguien renombra "Datos", este test lo manda acá.
  for (const cual of ['Cargar', 'Mes', 'Movimientos', 'Datos', 'Ajustes']) {
    assert.ok(etiquetas.includes(cual), `la pestaña ${cual} ya no se llama así`);
    assert.ok(texto.includes(cual), `las instrucciones dejaron de nombrar ${cual}`);
  }
});

test('las pantallas que el texto describe siguen existiendo', () => {
  for (const nombre of ['viajes', 'grupos', 'evolucion', 'rubros', 'etiquetas',
    'monedas', 'cambios', 'moneda-base', 'ahorros', 'datos']) {
    assert.ok(pantalla(nombre), `las instrucciones describen "${nombre}", que ya no existe`);
  }
});

test('no promete ninguna tarea futura ni nombra tareas internas', () => {
  // La misma guardia que el cartel viejo de "llega con T-015" (T-058).
  const texto = visible(html());

  assert.equal(/T-\d+/.test(texto), false, `una tarea a la vista: ${texto.match(/.{0,40}T-\d+/)}`);
  assert.equal(/llega con|próximamente|más adelante|todavía no/i.test(texto), false);
});

test('la moneda base que nombra es la que el usuario tiene puesta', () => {
  // Escribirla a mano —"todos los totales se ven en euros"— sería falso para
  // quien puso el peso, que es justo el caso en el que uno lee las
  // instrucciones.
  const enPesos = cambiarMonedaBase(estado, 'UYU');

  assert.match(visible(dibujarInstrucciones({ estado: enPesos })), /ahora es UYU/);
  assert.match(visible(html()), /ahora es EUR/);
  assert.equal(monedaBaseDe(enPesos), 'UYU');
});


// ── Que se pueda leer ───────────────────────────────────────────────────────

test('viene plegada: la primera pantalla es un índice, no una pared de texto', () => {
  const h = html();
  const abiertas = (h.match(/<details class="instruccion" open>/g) ?? []).length;

  assert.ok((h.match(/<details/g) ?? []).length >= 7, 'hay secciones para plegar');
  assert.equal(abiertas, 1, 'solo la primera viene abierta');
});

test('cada sección tiene su título a la vista', () => {
  const h = html();
  const titulos = [...h.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1].trim());

  assert.equal(titulos.length, (h.match(/<details/g) ?? []).length);
  for (const t of titulos) assert.ok(t.length > 0 && t.length < 60, `título raro: "${t}"`);
});

test('explica lo que de verdad importa: que los datos se pueden perder', () => {
  // Si esta pantalla sirve para una sola cosa, es para esto. Alguien que la lee
  // entera y no se entera de que tiene que bajar un respaldo perdió el tiempo.
  const texto = visible(html());

  assert.match(texto, /respaldo/i);
  assert.match(texto, /se pierden|se van con él/i);
});

test('el texto del usuario no puede inyectar HTML', () => {
  // La moneda base sale del estado, y el estado puede venir de un respaldo
  // editado a mano.
  const raro = { ...estado, preferencias: { moneda_base: '<img src=x>' } };
  const h = dibujarInstrucciones({ estado: raro });

  assert.equal(h.includes('<img'), false);
});
