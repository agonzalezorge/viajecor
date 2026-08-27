// T-906 · El ZIP escrito a mano.
//
// Lo que se comprueba acá no es "no tira una excepción": es que el resultado sea
// **un ZIP de verdad**, según algo que no sea este mismo código. Un escritor de
// formatos que solo se prueba contra sí mismo produce archivos que abre él solo.
//
// Por eso hay dos clases de test: los que miran la estructura byte a byte, y los
// que comparan contra `zlib.crc32` de Node, que es una implementación
// independiente de la misma suma de control.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as crc32DeNode } from 'node:zlib';

import { crearZip, crc32 } from '../src/datos/zip.js';

const bytesDe = (texto) => new TextEncoder().encode(texto);
const leer32 = (zip, donde) => new DataView(zip.buffer, zip.byteOffset).getUint32(donde, true);
const leer16 = (zip, donde) => new DataView(zip.buffer, zip.byteOffset).getUint16(donde, true);

// ── La suma de control ───────────────────────────────────────────────────────

test('el CRC coincide con el de Node, que es otra implementación', () => {
  // Es la comprobación que importa: si mi tabla estuviera mal, daría números
  // consistentes consigo misma y ningún test propio lo notaría.
  for (const texto of ['', 'hola mundo', 'ñandú', '<a>&amp;</a>', 'x'.repeat(5000)]) {
    const bytes = bytesDe(texto);
    assert.equal(crc32(bytes), crc32DeNode(Buffer.from(bytes)), `con "${texto.slice(0, 20)}"`);
  }
});

test('el CRC de un texto vacío es 0', () => {
  assert.equal(crc32(bytesDe('')), 0);
});

// ── La estructura del ZIP ────────────────────────────────────────────────────

test('el archivo empieza con la firma de un ZIP', () => {
  const zip = crearZip([{ nombre: 'a.txt', contenido: 'hola' }]);

  // "PK\3\4" — las iniciales de Phil Katz, que inventó el formato en 1989.
  assert.equal(leer32(zip, 0), 0x04034b50);
});

test('el cierre dice cuántas entradas hay', () => {
  const zip = crearZip([
    { nombre: 'a.txt', contenido: 'uno' },
    { nombre: 'b.txt', contenido: 'dos' },
    { nombre: 'c/d.xml', contenido: '<x/>' },
  ]);

  // El cierre son los últimos 22 bytes, y es lo primero que lee un lector de ZIP.
  const cierre = zip.length - 22;
  assert.equal(leer32(zip, cierre), 0x06054b50);
  assert.equal(leer16(zip, cierre + 8), 3);
  assert.equal(leer16(zip, cierre + 10), 3);
});

test('el índice apunta a donde realmente empieza cada entrada', () => {
  // Si este número está mal, el ZIP se abre en algunos programas y en otros no,
  // que es la peor forma de estar roto.
  const zip = crearZip([
    { nombre: 'a.txt', contenido: 'uno' },
    { nombre: 'b.txt', contenido: 'dos' },
  ]);

  const cierre = zip.length - 22;
  const inicioDelIndice = leer32(zip, cierre + 16);

  // El desplazamiento que guarda el índice es desde el principio del archivo,
  // no desde el índice: en las dos entradas tiene que caer justo en una firma.
  const primera = leer32(zip, inicioDelIndice + 42);
  const segunda = leer32(zip, inicioDelIndice + 46 + 5 + 42);

  assert.equal(primera, 0);
  assert.equal(leer32(zip, primera), 0x04034b50);
  assert.notEqual(segunda, 0);
  assert.equal(leer32(zip, segunda), 0x04034b50);
});

test('el tamaño del índice coincide con lo que ocupa', () => {
  const zip = crearZip([{ nombre: 'a.txt', contenido: 'uno' }]);
  const cierre = zip.length - 22;

  const tamano = leer32(zip, cierre + 12);
  const inicio = leer32(zip, cierre + 16);

  assert.equal(inicio + tamano, cierre);
});

test('cada entrada guarda su propio CRC y su tamaño', () => {
  const contenido = 'ñandú con acentos';
  const zip = crearZip([{ nombre: 'a.txt', contenido }]);
  const bytes = bytesDe(contenido);

  assert.equal(leer32(zip, 14), crc32DeNode(Buffer.from(bytes)));
  assert.equal(leer32(zip, 18), bytes.length);
  assert.equal(leer32(zip, 22), bytes.length);
});

test('el contenido se guarda sin comprimir, y el método lo dice', () => {
  // Método 0 = guardado tal cual. Si el método dijera otra cosa, el lector
  // intentaría descomprimir texto plano y el archivo no abriría.
  const zip = crearZip([{ nombre: 'a.txt', contenido: 'hola' }]);

  assert.equal(leer16(zip, 8), 0);
  assert.equal(new TextDecoder().decode(zip.slice(30 + 5, 30 + 5 + 4)), 'hola');
});

test('los acentos sobreviven, medidos en bytes y no en letras', () => {
  // "ñandú" tiene 5 letras y 7 bytes en UTF-8. Guardar 5 como tamaño rompería
  // el archivo, y es el error clásico de escribir un formato binario.
  const zip = crearZip([{ nombre: 'a.txt', contenido: 'ñandú' }]);

  assert.equal(leer32(zip, 18), 7);
});

test('un nombre con acentos también se mide en bytes', () => {
  const zip = crearZip([{ nombre: 'ñ.txt', contenido: 'x' }]);

  assert.equal(leer16(zip, 26), bytesDe('ñ.txt').length);
});

test('un ZIP vacío sigue siendo un ZIP', () => {
  const zip = crearZip([]);

  assert.equal(zip.length, 22);
  assert.equal(leer32(zip, 0), 0x06054b50);
  assert.equal(leer16(zip, 8), 0);
});

test('la fecha de las entradas es fija', () => {
  // La app no guarda horas (ADR-021), y una fecha de creación variable haría
  // que exportar dos veces los mismos datos diera archivos distintos.
  const uno = crearZip([{ nombre: 'a.txt', contenido: 'hola' }]);
  const dos = crearZip([{ nombre: 'a.txt', contenido: 'hola' }]);

  assert.deepEqual([...uno], [...dos]);
});
