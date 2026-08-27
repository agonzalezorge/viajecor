// T-916 · Que la paleta sea una sola.
//
// Los colores de los rubros se usan en dos lugares que no se pueden compartir
// código: la pantalla (CSS) y la planilla de Excel (JavaScript, fuera del
// navegador). Este archivo es lo que impide que se separen.

import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORES_RUBRO, FONDOS_RUBRO, fondoDeFranja } from '../src/core/paleta.js';


// ── Una sola paleta (T-916) ──────────────────────────────────────────────────

test('los colores del CSS son exactamente los de core/paleta.js', async () => {
  // La paleta vive en `core/paleta.js` porque la usa también la planilla de
  // Excel, fuera del navegador. El CSS la repite —no puede leer un módulo sin
  // una petición de red, y eso está prohibido (RN-06)—, así que lo que impide
  // que las dos copias se separen es este test.
  //
  // Sin él, alguien cambia un tono en la pantalla, la planilla se queda con el
  // viejo, y el mismo gasto pasa a ser de dos colores según dónde se lo mire.
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const css = await readFile(join(raiz, 'src/estilos.css'), 'utf8');

  for (const [i, color] of COLORES_RUBRO.entries()) {
    const declaracion = new RegExp(`--rubro-${i + 1}:\\s*${color}\\s*;`);
    assert.match(css, declaracion, `el CSS no declara --rubro-${i + 1} como ${color}`);
  }
});

test('hay un tono claro por cada tono, y son distintos entre sí', () => {
  assert.equal(FONDOS_RUBRO.length, COLORES_RUBRO.length);
  assert.equal(new Set(FONDOS_RUBRO).size, FONDOS_RUBRO.length, 'hay dos fondos iguales');
});

test('los tonos claros son claros de verdad, para que se lea el texto negro', () => {
  // En una celda el color es fondo de un texto negro. Un tono oscuro ahí deja
  // la celda ilegible, que es peor que no pintarla.
  for (const [i, fondo] of FONDOS_RUBRO.entries()) {
    const [r, g, b] = [1, 3, 5].map((j) => parseInt(fondo.slice(j, j + 2), 16));
    // Luminancia relativa aproximada, la fórmula de siempre para texto/fondo.
    const luz = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    assert.ok(luz > 0.7, `el fondo ${i + 1} (${fondo}) es demasiado oscuro: ${luz.toFixed(2)}`);
  }
});

test('el fondo para Excel viene sin almohadilla y en mayúsculas', () => {
  // Excel escribe los colores como AARRGGBB en hexadecimal, sin "#".
  assert.equal(fondoDeFranja(1), 'D0E1F6');
  assert.match(fondoDeFranja(8), /^[0-9A-F]{6}$/);
});

test('una franja fuera de rango no rompe: cae en la última', () => {
  assert.equal(fondoDeFranja(99), fondoDeFranja(FONDOS_RUBRO.length));
});
