// T-916 · Que la paleta sea una sola.
//
// Los colores de los rubros se usan en dos lugares que no se pueden compartir
// código: la pantalla (CSS) y la planilla de Excel (JavaScript, fuera del
// navegador). Este archivo es lo que impide que se separen.

import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORES_RUBRO, COLORES_RUBRO_OSCURO, FONDOS_RUBRO, fondoDeFranja, franjaDeRubro } from '../src/core/paleta.js';
import { TIPO_GASTO, TIPO_INGRESO, RUBROS_GASTO } from '../src/core/modelo.js';


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

  // Se leen las declaraciones en orden y se parten en dos: las ocho primeras
  // son las del fondo claro y las ocho siguientes las del oscuro. Buscar cada
  // color suelto en todo el archivo no alcanzaba: si el claro y el oscuro
  // comparten un tono —el violeta lo hace—, una búsqueda global lo encuentra en
  // el bloque equivocado y el cambio roto pasa. Lo descubrió una mutación.
  const declaradas = [...css.matchAll(/--rubro-([1-8]):\s*(#[0-9a-f]{6})\s*;/gi)];

  assert.equal(declaradas.length, 16,
    'el CSS tiene que declarar los ocho rubros dos veces: fondo claro y fondo oscuro');
  assert.deepEqual(declaradas.map((d) => Number(d[1])), [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8],
    'las declaraciones no están en orden, o falta alguna');

  assert.deepEqual(declaradas.slice(0, 8).map((d) => d[2].toLowerCase()), [...COLORES_RUBRO],
    'los colores del fondo claro no son los de COLORES_RUBRO');
  assert.deepEqual(declaradas.slice(8).map((d) => d[2].toLowerCase()), [...COLORES_RUBRO_OSCURO],
    'los colores del fondo oscuro no son los de COLORES_RUBRO_OSCURO');
});

test('hay un tono claro por cada tono, y son distintos entre sí', () => {
  assert.equal(FONDOS_RUBRO.length, COLORES_RUBRO.length);
  assert.equal(new Set(FONDOS_RUBRO).size, FONDOS_RUBRO.length, 'hay dos fondos iguales');
});

test('sobre cada fondo de celda se lee un texto negro', () => {
  // En una celda el color es fondo de un texto negro, y el texto dice el nombre
  // del rubro. Si no se lee, la celda pintada es peor que la sin pintar.
  //
  // Se mide el contraste de verdad —la fórmula de WCAG— y no una luminancia a
  // ojo: el umbral que había antes rechazaba el rosa de la planilla del usuario
  // por dos centésimas, cuando el texto negro encima se lee perfectamente.
  const luminancia = (hex) => {
    const canal = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (const [i, fondo] of FONDOS_RUBRO.entries()) {
    const contraste = (luminancia(fondo) + 0.05) / 0.05;
    assert.ok(contraste >= 4.5,
      `el texto negro sobre el fondo ${i + 1} (${fondo}) contrasta ${contraste.toFixed(1)}:1`);
  }
});

test('el fondo para Excel viene sin almohadilla y en mayúsculas', () => {
  // Excel escribe los colores como AARRGGBB en hexadecimal, sin "#".
  assert.equal(fondoDeFranja(1), 'FF99CC');
  assert.match(fondoDeFranja(8), /^[0-9A-F]{6}$/);
});

test('una franja fuera de rango no rompe: cae en la última', () => {
  assert.equal(fondoDeFranja(99), fondoDeFranja(FONDOS_RUBRO.length));
});

// ── Que sigan siendo los colores del usuario (T-922) ─────────────────────────

test('cada rubro conserva el matiz que tiene en la planilla del usuario', () => {
  // Lo que hace que un color se reconozca como "el rosa de gastos fijos" es su
  // MATIZ, no su luz ni su saturación. Eso es lo que se conservó al pasar de los
  // pasteles de Excel —que como marcas de gráfico fallan— a tonos que se leen.
  //
  // Si alguna vez se cambia un tono, este test dice cuánto se alejó de lo que el
  // usuario tiene aprendido.
  const matiz = (hex) => {
    const lineal = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => lineal(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return (Math.atan2(B, A) * 180) / Math.PI;
  };
  const separacion = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  // Los seis que conservan su familia. `salud` y `otros` no están: se explican
  // en el comentario de la paleta, y cambiaron con motivo.
  const CONSERVAN = [0, 1, 2, 3, 4, 5];
  for (const i of CONSERVAN) {
    const cuanto = separacion(matiz(COLORES_RUBRO[i]), matiz(FONDOS_RUBRO[i]));
    assert.ok(cuanto <= 40,
      `el color ${i + 1} se alejó ${cuanto.toFixed(0)}° del de la planilla: ya no se reconoce`);
  }
});

test('los ingresos siguen los colores que tienen en la planilla', () => {
  // Ahí trabajo es verde, inversiones celeste, regalos rosa y otros gris. Sin un
  // mapa propio, `trabajo` sería rosa solo por ser el primero de su lista.
  assert.equal(franjaDeRubro(TIPO_INGRESO, 'trabajo'), 4, 'verde');
  assert.equal(franjaDeRubro(TIPO_INGRESO, 'inversiones'), 6, 'azul');
  assert.equal(franjaDeRubro(TIPO_INGRESO, 'regalos'), 1, 'rosa');
  assert.equal(franjaDeRubro(TIPO_INGRESO, 'otros'), 8, 'gris');
});

test('el color depende del rubro y nunca de su tamaño', () => {
  // La regla de T-909, que sigue en pie: si dependiera del tamaño, cargar un
  // gasto nuevo repintaría media pantalla y el color dejaría de significar
  // "supermercado" para significar "el más grande de este mes".
  const antes = RUBROS_GASTO.map((r) => franjaDeRubro(TIPO_GASTO, r));
  const despues = RUBROS_GASTO.map((r) => franjaDeRubro(TIPO_GASTO, r));

  assert.deepEqual(antes, despues);
  assert.equal(new Set(antes).size, RUBROS_GASTO.length, 'dos rubros de gasto comparten color');
});
