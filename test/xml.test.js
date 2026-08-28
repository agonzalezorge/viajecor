// T-031 · El lector de XML mínimo.
//
// No es un parser de propósito general y no pretende serlo: entiende lo que un
// `.xlsx` usa y nada más. Lo que se prueba acá son los casos donde un lector
// ingenuo se rompe **en silencio** — que es la única forma de romperse que
// importa, porque un XML mal leído no da error: da datos corridos.

import test from 'node:test';
import assert from 'node:assert/strict';

import { recorrerXml, desescapar } from '../src/datos/xml.js';

/** Los eventos del recorrido, para poder afirmar sobre ellos. */
function eventosDe(xml) {
  const eventos = [];
  recorrerXml(xml, {
    alAbrir: (nombre, atributos, vacia) => eventos.push(['abre', nombre, atributos, vacia]),
    alCerrar: (nombre) => eventos.push(['cierra', nombre]),
    alTexto: (texto) => { if (texto.trim() !== '') eventos.push(['texto', texto]); },
  });
  return eventos;
}

// ── Lo básico ────────────────────────────────────────────────────────────────

test('lee etiquetas, atributos y texto', () => {
  assert.deepEqual(eventosDe('<a r="1">hola</a>'), [
    ['abre', 'a', { r: '1' }, false],
    ['texto', 'hola'],
    ['cierra', 'a'],
  ]);
});

test('una etiqueta vacía abre y cierra', () => {
  // `<c r="B2" s="1"/>` es una celda con formato y sin valor: si no cerrara,
  // todo lo que sigue quedaría anidado adentro de ella.
  assert.deepEqual(eventosDe('<c r="B2" s="1"/>'), [
    ['abre', 'c', { r: 'B2', s: '1' }, true],
    ['cierra', 'c'],
  ]);
});

test('acepta atributos con comillas simples', () => {
  assert.deepEqual(eventosDe("<a r='1'/>")[0][2], { r: '1' });
});

test('acepta atributos con espacios alrededor del igual', () => {
  assert.deepEqual(eventosDe('<a r = "1" />')[0][2], { r: '1' });
});

// ── Donde un lector ingenuo se rompe ─────────────────────────────────────────

test('un ">" adentro de un atributo no parte la etiqueta', () => {
  // Buscar el primer ">" a secas corta la etiqueta al medio, y todo lo que sigue
  // se lee corrido. No da error: da datos de otra celda.
  const [abre] = eventosDe('<c r="A1" t="x>y">hola</c>');

  assert.deepEqual(abre, ['abre', 'c', { r: 'A1', t: 'x>y' }, false]);
});

test('las entidades se traducen, también en los atributos', () => {
  const eventos = eventosDe('<a t="Mercadona &amp; &lt;Lidl&gt;">2 &gt; 1</a>');

  assert.equal(eventos[0][2].t, 'Mercadona & <Lidl>');
  assert.equal(eventos[1][1], '2 > 1');
});

test('las entidades numéricas también', () => {
  assert.equal(desescapar('&#241;andú y &#x00F1;andú'), 'ñandú y ñandú');
});

test('un "&" que no es una entidad se deja como está', () => {
  // Hay archivos con "&" sueltos. Romper por eso sería negarse a leer una
  // planilla entera por un carácter.
  assert.equal(desescapar('AT&T'), 'AT&T');
  assert.equal(desescapar('&noexiste;'), '&noexiste;');
});

test('la declaración, los comentarios y las instrucciones se saltean', () => {
  const eventos = eventosDe('<?xml version="1.0"?><!-- nota --><a/><!DOCTYPE x>');

  assert.deepEqual(eventos, [['abre', 'a', {}, true], ['cierra', 'a']]);
});

test('un comentario con un ">" adentro no corta el salteo', () => {
  const eventos = eventosDe('<!-- a > b --><a/>');

  assert.deepEqual(eventos, [['abre', 'a', {}, true], ['cierra', 'a']]);
});

test('CDATA se lee como texto', () => {
  const eventos = eventosDe('<a><![CDATA[esto <no> es xml]]></a>');

  assert.equal(eventos[1][1], 'esto <no> es xml');
});

test('un XML cortado a la mitad termina sin tirar', () => {
  // Un archivo dañado tiene que dar un resultado incompleto, no una excepción:
  // quien llama es alguien eligiendo un archivo de su teléfono.
  assert.doesNotThrow(() => eventosDe('<a><b r="1'));
  assert.doesNotThrow(() => eventosDe('<a>texto sin cerrar'));
  assert.doesNotThrow(() => eventosDe(''));
});

test('un texto suelto sin etiquetas se lee igual', () => {
  assert.deepEqual(eventosDe('hola'), [['texto', 'hola']]);
});

test('no se pierde el texto partido en varios trozos', () => {
  // Excel parte un texto en varios `<t>` cuando tiene partes con formatos
  // distintos. Quedarse con el último trozo perdería el resto de la palabra.
  const trozos = [];
  recorrerXml('<si><t>Bar</t><t>celona</t></si>', { alTexto: (t) => trozos.push(t) });

  assert.equal(trozos.join(''), 'Barcelona');
});
