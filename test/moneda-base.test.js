// T-059 — Tests de la guardia de la moneda base.
//
// La guardia existe porque un valor por defecto (`base = MONEDA_BASE`) dejó once
// llamadas convirtiendo contra el euro en silencio, y la más visible le impidió
// a una persona cargar un solo gasto. Ninguna fallaba: ni un error, ni un test.
//
// Un guardián sin tests es una promesa igual de frágil que la que vino a
// reemplazar, así que acá se comprueba que **encuentra lo que tiene que
// encontrar** y que **no marca lo que no debe**.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { llamadasSinBase, argumentosDe, CONVIERTEN_PLATA } from '../tools/moneda-base.mjs';

const uno = (codigo) => llamadasSinBase(new Map([['prueba.js', codigo]]));


test('encuentra el olvido exacto que rompió la carga en pesos', () => {
  const problemas = uno('const falta = faltaCambioPara(movimiento, estado.tipos_cambio);');

  assert.equal(problemas.length, 1);
  assert.equal(problemas[0].nombre, 'faltaCambioPara');
  assert.equal(problemas[0].linea, 1);
  assert.match(problemas[0].mensaje, /le falta la moneda base/);
});

test('deja pasar la llamada correcta', () => {
  assert.deepEqual(uno('faltaCambioPara(m, cambios, monedaBaseDe(estado));'), []);
  assert.deepEqual(uno('movimientoEnEuros(m, cambios, monedas, base);'), []);
});

test('vigila las seis funciones que deciden contra qué moneda se convierte', () => {
  // Si mañana alguien agrega una séptima y no la anota acá, esta lista es el
  // único lugar donde se ve que falta.
  assert.deepEqual([...CONVIERTEN_PLATA.keys()].sort(), [
    'buscarCambio', 'cambiosQueFaltan', 'faltaCambioPara',
    'movimientoEnEuros', 'separarConvertibles', 'totalEnEuros',
  ]);

  for (const [nombre, esperados] of CONVIERTEN_PLATA) {
    const cortos = Array.from({ length: esperados - 1 }, (_, i) => `a${i}`).join(', ');
    assert.equal(uno(`${nombre}(${cortos});`).length, 1, `no vigila ${nombre}`);
  }
});

test('separarConvertibles se vigila aunque no convierta nada', () => {
  // Decide QUIÉN se puede convertir llamando a faltaCambioPara: sin base le pasa
  // undefined, y el default se cuela un piso más abajo. Dos de las once llamadas
  // rotas eran por acá.
  assert.equal(uno('separarConvertibles(movs, estado.tipos_cambio);').length, 1);
});

test('no marca un ejemplo escrito en un comentario', () => {
  // Un guardián que se queja de la documentación enseña a ignorarlo.
  assert.deepEqual(uno('// antes decía faltaCambioPara(m, cambios);\nfaltaCambioPara(m, c, base);'), []);
  assert.deepEqual(uno('/* faltaCambioPara(m, cambios); */'), []);
});

test('no marca el nombre de la función escrito dentro de un texto', () => {
  // Pasó en la primera corrida: el mensaje de error de totalEnEuros() nombra a
  // la función entre comillas, y la guardia se marcaba a sí misma.
  assert.deepEqual(uno("throw new Error('totalEnEuros() espera una lista.');"), []);
});

test('no confunde un método con el mismo nombre', () => {
  assert.deepEqual(uno('registro.faltaCambioPara(m, cambios);'), []);
});

test('cuenta bien los argumentos aunque haya llamadas y comas adentro', () => {
  assert.deepEqual(uno('movimientoEnEuros(m, cambiosDe(a, b), monedas, base);'), []);
  assert.deepEqual(uno("movimientoEnEuros(m, c, monedas, base ?? 'EUR');"), []);
  assert.equal(uno('movimientoEnEuros(m, cambiosDe(a, b), monedas);').length, 1, 'y sigue contando los que faltan');
});

test('señala la línea de verdad, no una corrida por los comentarios', () => {
  // Los bloques /* */ se reemplazan por sus mismos saltos de línea; si se
  // colapsaran, el error apuntaría a una línea que no tiene nada que ver.
  const codigo = ['/*', ' * una nota', ' * de varias líneas', ' */', 'faltaCambioPara(m, c);'].join('\n');
  assert.equal(uno(codigo)[0].linea, 5);
});

test('argumentosDe cuenta lo que hay entre paréntesis', () => {
  assert.equal(argumentosDe('f(a, b, c)', 1), 3);
  assert.equal(argumentosDe('f()', 1), 0);
  assert.equal(argumentosDe('f(g(a, b), c)', 1), 2);
  assert.equal(argumentosDe('f("a, b")', 1), 1);
  assert.equal(argumentosDe('f([1, 2], {a: 1})', 1), 2);
  assert.equal(argumentosDe('f(a, b', 1), null, 'sin cerrar, no inventa');
});

test('todo el código de src/ pasa la guardia', () => {
  // El test que habría atrapado el error original en el momento de escribirlo.
  const archivos = new Map();
  const recorrer = (carpeta) => {
    for (const entrada of readdirSync(carpeta)) {
      const ruta = join(carpeta, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.set(ruta, readFileSync(ruta, 'utf8'));
    }
  };
  recorrer('src');

  const problemas = llamadasSinBase(archivos);
  assert.deepEqual(problemas.map((p) => p.mensaje), []);
});
