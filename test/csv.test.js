// T-018 · Exportar a CSV.
//
// Un CSV mal exportado **no falla**: se abre y muestra cosas equivocadas. Es la
// forma de fallar más cara que hay, y depende de tres detalles que nadie mira —
// el separador, la codificación y la coma decimal—. Casi todo este archivo
// prueba esos tres.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prepararCsv, contenidoDelCsv, filasDelCsv, comoCampo, comoImporte,
  nombreDelCsv, COLUMNAS, SEPARADOR, MARCA_UTF8, TIPO_CSV,
} from '../src/datos/csv.js';
import { crearMovimiento } from '../src/core/modelo.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';

const CAMBIO_CRC = crearCambio(
  { moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) },
  { creado: '2026-03-01' }
);

function estadoCon(movimientos, cambios = [CAMBIO_CRC]) {
  return { ...estadoInicial(), monedas: monedasIniciales(), tipos_cambio: cambios, movimientos };
}

const mov = (fecha, rubro, monto, tipo = 'G', moneda = 'EUR', extra = {}) =>
  crearMovimiento(
    { tipo, rubro, monto, moneda, fecha, comentario: '', detalle: '', ...extra },
    { decimales: 2, creado: fecha }
  );

/** Las líneas del archivo, sin el BOM y sin la última vacía. */
const lineasDe = (estado) => contenidoDelCsv(estado).slice(MARCA_UTF8.length).trim().split('\r\n');

// ── Los tres detalles que deciden si se abre bien ────────────────────────────

test('el separador es punto y coma, no coma', () => {
  // En español la coma es el separador decimal: `12,50` con separador coma se
  // parte en dos columnas, `12` y `50`. Excel en español espera `;`.
  assert.equal(SEPARADOR, ';');

  const [encabezado] = lineasDe(estadoCon([mov('2026-03-02', 'supermercado', '12,50')]));
  assert.equal(encabezado, COLUMNAS.join(';'));
});

test('el archivo empieza con la marca de UTF-8', () => {
  // Sin esos tres bytes, Excel en Windows abre el archivo con la codificación
  // del sistema y `Ñandú` se convierte en `Ã‘andÃº`. No es estético: `Coruña` y
  // `CoruÃ±a` son dos comentarios distintos, así que un archivo sin marca parte
  // los grupos en dos apenas se lo vuelve a leer.
  const contenido = contenidoDelCsv(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.ok(contenido.startsWith('﻿'), 'falta la marca de UTF-8');
});

test('los acentos sobreviven, y los bytes son los de UTF-8', () => {
  const contenido = contenidoDelCsv(estadoCon([
    mov('2026-03-02', 'viajes', '10', 'G', 'EUR', { comentario: 'Coruña' }),
  ]));
  const bytes = new TextEncoder().encode(contenido);

  assert.ok(contenido.includes('Coruña'));
  // EF BB BF: la marca. Después, la "ñ" en dos bytes (C3 B1), no en uno.
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  assert.ok(contenido.includes('ñ'));
});

test('los importes llevan coma decimal', () => {
  const [, fila] = lineasDe(estadoCon([mov('2026-03-02', 'supermercado', '12,50')]));

  assert.ok(fila.includes('12,50'), `no aparece "12,50" en: ${fila}`);
  assert.equal(fila.includes('12.50'), false, 'el punto decimal es de otro idioma');
});

test('las líneas terminan en CRLF, como manda el formato', () => {
  // Con solo `\n` hay versiones de Excel que meten todo en una sola fila.
  const contenido = contenidoDelCsv(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.ok(contenido.includes('\r\n'));
  assert.equal(/[^\r]\n/.test(contenido), false, 'hay un salto sin retorno de carro');
});

// ── El entrecomillado ────────────────────────────────────────────────────────

test('un texto con el separador adentro se entrecomilla', () => {
  // Sin esto, un comentario con un `;` corre todas las columnas de esa fila una
  // posición, y el archivo se abre igual: mal, y sin avisar.
  assert.equal(comoCampo('Roma; Italia'), '"Roma; Italia"');
});

test('las comillas de adentro se duplican', () => {
  assert.equal(comoCampo('Viaje "raro"'), '"Viaje ""raro"""');
});

test('un salto de línea adentro de un campo se entrecomilla', () => {
  assert.equal(comoCampo('dos\nlíneas'), '"dos\nlíneas"');
});

test('lo que no lo necesita no se entrecomilla', () => {
  // Entrecomillar todo también "funciona", pero llena el archivo de comillas que
  // después alguien tiene que sacar a mano al mirarlo.
  assert.equal(comoCampo('Roma'), 'Roma');
  assert.equal(comoCampo(''), '');
  assert.equal(comoCampo(null), '');
});

test('un comentario con punto y coma no corre las columnas', () => {
  const [, fila] = lineasDe(estadoCon([
    mov('2026-03-02', 'viajes', '10', 'G', 'EUR', { comentario: 'Roma; Italia' }),
  ]));

  // Se cuentan los separadores que están FUERA de comillas: tienen que ser
  // exactamente uno menos que las columnas.
  let dentro = false;
  let separadores = 0;
  for (const caracter of fila) {
    if (caracter === '"') dentro = !dentro;
    else if (caracter === ';' && !dentro) separadores += 1;
  }
  assert.equal(separadores, COLUMNAS.length - 1);
});

// ── Los importes ─────────────────────────────────────────────────────────────

test('un importe se escribe con sus decimales completos', () => {
  assert.equal(comoImporte(1250, 2), '12,50');
  assert.equal(comoImporte(5, 2), '0,05');
  assert.equal(comoImporte(100, 2), '1,00');
});

test('una moneda sin decimales se escribe sin coma', () => {
  // El yen no tiene céntimos: escribir "1500,00" sería inventar una precisión
  // que esa moneda no tiene (RN-04b).
  assert.equal(comoImporte(1500, 0), '1500');
});

test('un importe negativo conserva el signo', () => {
  assert.equal(comoImporte(-1250, 2), '-12,50');
});

test('no se usa separador de miles', () => {
  // "1.882,40" con separador de miles es correcto para leer y veneno para
  // procesar: cualquier lector lo toma como texto.
  assert.equal(comoImporte(188240, 2), '1882,40');
});

// ── Qué lleva cada fila ──────────────────────────────────────────────────────

test('una fila por movimiento, más el encabezado', () => {
  const lineas = lineasDe(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-03-05', 'comida hecha', '20'),
  ]));

  assert.equal(lineas.length, 3);
});

test('un gasto en otra moneda lleva el monto original Y el importe en euros', () => {
  // La planilla lleva solo euros porque se mira; el CSV lleva las dos cosas
  // porque es para hacer cuentas en otro lado, y ahí perder el dato original
  // duele. Un CSV que redondea es un CSV que miente.
  const [fila] = filasDelCsv(estadoCon([mov('2026-03-07', 'viajes', '10000', 'G', 'CRC')]));

  assert.equal(fila.moneda, 'CRC');
  assert.equal(fila.monto, '10000,00');
  assert.equal(fila.euros, '15,87');
});

test('lleva el tipo de cambio que se aplicó, para poder rehacer la cuenta', () => {
  // Es el cambio de ESE mes, no el de hoy. Sin ese dato, el importe en euros es
  // un número que no se puede volver a comprobar.
  const [fila] = filasDelCsv(estadoCon([mov('2026-03-07', 'viajes', '10000', 'G', 'CRC')]));

  assert.equal(fila.unidades_por_euro, '630,00');
});

test('en euros no se escribe un tipo de cambio de 1', () => {
  // Sería ruido en el 90 % de las filas, y un 1 repetido invita a creer que
  // significa algo.
  const [fila] = filasDelCsv(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.equal(fila.unidades_por_euro, '');
});

test('un movimiento sin tipo de cambio entra igual, con los euros vacíos', () => {
  // No se descarta ni se pone en cero: una fila que desaparece en silencio es la
  // falla que la app viene a eliminar (L-001).
  const [fila] = filasDelCsv(estadoCon([mov('2026-04-03', 'viajes', '5000', 'G', 'CRC')]));

  assert.equal(fila.moneda, 'CRC');
  assert.equal(fila.monto, '5000,00');
  assert.equal(fila.euros, '', 'los euros quedan vacíos, no en cero');
});

test('el mes se escribe 03/26, como en la planilla', () => {
  const [fila] = filasDelCsv(estadoCon([mov('2026-03-02', 'supermercado', '10')]));

  assert.equal(fila.fecha, '2026-03-02');
  assert.equal(fila.dia, '2');
  assert.equal(fila.mes, '03/26');
});

test('el rubro se escribe como en la app, con mayúscula inicial', () => {
  const [fila] = filasDelCsv(estadoCon([mov('2026-03-02', 'comida hecha', '10')]));

  assert.equal(fila.rubro, 'Comida hecha');
});

test('las filas salen ordenadas por fecha', () => {
  const filas = filasDelCsv(estadoCon([
    mov('2026-04-03', 'salud', '60'),
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-03-20', 'transporte', '5'),
  ]));

  assert.deepEqual(filas.map((f) => f.fecha), ['2026-03-02', '2026-03-20', '2026-04-03']);
});

// ── El archivo ───────────────────────────────────────────────────────────────

test('el archivo se llama con la fecha adelante', () => {
  assert.equal(nombreDelCsv('2026-08-27'), 'viajecor-2026-08-27.csv');
});

test('el CSV sale listo para guardar, y dice cuántos no se pudieron convertir', () => {
  const csv = prepararCsv(estadoCon([
    mov('2026-03-02', 'supermercado', '10'),
    mov('2026-04-03', 'viajes', '5000', 'G', 'CRC'),
  ]), { fecha: '2026-08-27' });

  assert.equal(csv.nombre, 'viajecor-2026-08-27.csv');
  assert.equal(csv.tipo, TIPO_CSV);
  assert.equal(csv.cuantos, 2);
  assert.equal(csv.sinConvertir, 1);
});

test('sin movimientos, el archivo lleva solo el encabezado', () => {
  // Un archivo vacío del todo no se distingue de uno que falló al escribirse.
  const csv = prepararCsv(estadoCon([]), { fecha: '2026-08-27' });

  assert.equal(csv.cuantos, 0);
  assert.ok(csv.contenido.includes(COLUMNAS.join(';')));
});

test('no hay ningún límite de filas escrito a mano', () => {
  // L-001: el Excel original suma $G$8:$G$1027 y la fila 1028 no se suma.
  const muchos = Array.from({ length: 1500 }, (_, i) =>
    mov(`2026-03-${String((i % 28) + 1).padStart(2, '0')}`, 'supermercado', '1'));

  assert.equal(prepararCsv(estadoCon(muchos)).cuantos, 1500);
});
