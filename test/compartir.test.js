// T-905 · Entregarle el respaldo al teléfono.
//
// Este contenedor no tiene el compartir del sistema —Chromium en Linux de
// escritorio no lo trae—, así que acá se prueba la lógica contra navegadores
// falsos, que es donde vive lo que puede salir mal: un navegador que comparte
// texto pero no archivos, un usuario que se arrepiente, un destino que falla.
// Que el compartir de verdad funcione en el Android del usuario es T-019, y no
// se puede afirmar desde acá.

import test from 'node:test';
import assert from 'node:assert/strict';

import { archivoDelRespaldo, sePuedeCompartir, compartirRespaldo } from '../src/ui/compartir.js';

const RESPALDO = { nombre: 'viajecor-2026-08-27.json', contenido: '{"movimientos":[]}', tipo: 'application/json' };

/** Un navegador que comparte archivos, y anota qué le pidieron. */
function navegadorQueComparte(alCompartir = async () => {}) {
  const pedidos = [];
  return {
    pedidos,
    canShare: (datos) => Array.isArray(datos?.files) && datos.files.length > 0,
    share: async (datos) => {
      pedidos.push(datos);
      return alCompartir(datos);
    },
  };
}

function fallar(nombre, mensaje = 'algo salió mal') {
  const error = new Error(mensaje);
  error.name = nombre;
  return error;
}

// ── El archivo ───────────────────────────────────────────────────────────────

test('el respaldo se convierte en un archivo con su nombre y su tipo', () => {
  const archivo = archivoDelRespaldo(RESPALDO, File);

  assert.equal(archivo.name, 'viajecor-2026-08-27.json');
  assert.equal(archivo.type, 'application/json');
  assert.ok(archivo.size > 0);
});

test('el archivo lleva el contenido entero del respaldo', async () => {
  const archivo = archivoDelRespaldo(RESPALDO, File);
  assert.equal(await archivo.text(), RESPALDO.contenido);
});

// ── ¿Se puede? ───────────────────────────────────────────────────────────────

test('un navegador sin compartir dice que no', () => {
  assert.equal(sePuedeCompartir({}, archivoDelRespaldo(RESPALDO, File)), false);
  assert.equal(sePuedeCompartir(undefined, archivoDelRespaldo(RESPALDO, File)), false);
});

test('un navegador que comparte texto pero no archivos dice que no', () => {
  // Es el caso peligroso: `share` existe, así que preguntar solo por `share`
  // pondría un botón que falla recién cuando el usuario lo aprieta.
  const soloTexto = { share: async () => {}, canShare: (datos) => !datos?.files };

  assert.equal(sePuedeCompartir(soloTexto, archivoDelRespaldo(RESPALDO, File)), false);
});

test('un navegador con `share` pero sin `canShare` dice que no', () => {
  // Sin `canShare` no hay forma de preguntar antes, y adivinar acá se paga con
  // un error después de haber apretado.
  assert.equal(sePuedeCompartir({ share: async () => {} }, archivoDelRespaldo(RESPALDO, File)), false);
});

test('si preguntar tira, la respuesta es que no, no una excepción', () => {
  const roto = { share: async () => {}, canShare: () => { throw new Error('no me gusta'); } };

  assert.equal(sePuedeCompartir(roto, archivoDelRespaldo(RESPALDO, File)), false);
});

test('un navegador que comparte archivos dice que sí', () => {
  assert.equal(sePuedeCompartir(navegadorQueComparte(), archivoDelRespaldo(RESPALDO, File)), true);
});

// ── Compartir ────────────────────────────────────────────────────────────────

test('compartir entrega el archivo del respaldo', async () => {
  const navegador = navegadorQueComparte();
  const resultado = await compartirRespaldo(navegador, RESPALDO, File);

  assert.deepEqual({ ...resultado }, { compartido: true });
  assert.equal(navegador.pedidos.length, 1);
  assert.equal(navegador.pedidos[0].files.length, 1);
  assert.equal(navegador.pedidos[0].files[0].name, 'viajecor-2026-08-27.json');
});

test('no se manda texto junto con el archivo', async () => {
  // Hay destinos que, si viene texto, mandan el texto y se olvidan del archivo.
  // El respaldo se perdería y el usuario creería que respaldó.
  const navegador = navegadorQueComparte();
  await compartirRespaldo(navegador, RESPALDO, File);

  assert.equal(navegador.pedidos[0].text, undefined);
  assert.equal(navegador.pedidos[0].url, undefined);
});

test('cancelar no es fallar', async () => {
  // Si el usuario abre el menú y se arrepiente, el navegador rechaza con
  // AbortError. Un error rojo por haber cambiado de idea enseña a desconfiar.
  const navegador = navegadorQueComparte(async () => { throw fallar('AbortError'); });
  const resultado = await compartirRespaldo(navegador, RESPALDO, File);

  assert.equal(resultado.cancelado, true);
  assert.equal(resultado.error, undefined);
  assert.equal(resultado.compartido, undefined);
});

test('un fallo de permiso se explica en castellano y manda a la descarga', async () => {
  // Es el caso real del Android del usuario (2026-08-27): `canShare` dijo que sí
  // y `share` falló con "Permission denied". Ese texto no le dice nada a nadie,
  // y menos a alguien que está tratando de poner sus datos a salvo.
  const navegador = navegadorQueComparte(async () => { throw fallar('NotAllowedError', 'Permission denied'); });
  const resultado = await compartirRespaldo(navegador, RESPALDO, File);

  assert.equal(resultado.compartido, undefined);
  assert.equal(resultado.cancelado, undefined);
  assert.equal(resultado.error.includes('Permission denied'), false, 'no se muestra el error crudo');
  assert.match(resultado.error, /descargar/);
  assert.equal(resultado.noVaAFuncionar, true, 'hay que recordar que este teléfono no puede');
});

test('un fallo raro sí muestra el detalle, para poder entenderlo', () => {
  // Con un error que no se reconoce, esconder el detalle deja a todos sin nada
  // que mirar. Se explica lo que se sabe explicar y se muestra el resto.
  return compartirRespaldo(
    navegadorQueComparte(async () => { throw fallar('DataError', 'el archivo es muy grande'); }),
    RESPALDO, File
  ).then((resultado) => {
    assert.match(resultado.error, /el archivo es muy grande/);
    assert.match(resultado.error, /descargar/);
  });
});

test('un navegador que no puede compartir archivos no lo intenta igual', async () => {
  const resultado = await compartirRespaldo({}, RESPALDO, File);

  assert.match(resultado.error, /no puede compartir archivos/);
  assert.match(resultado.error, /descargar/);
});

test('compartir nunca tira, pase lo que pase', async () => {
  const casos = [
    [{}, RESPALDO],
    [navegadorQueComparte(async () => { throw fallar('DataError'); }), RESPALDO],
    [navegadorQueComparte(), { nombre: 'x', contenido: 'y', tipo: 'application/json' }],
  ];

  for (const [navegador, respaldo] of casos) {
    const resultado = await compartirRespaldo(navegador, respaldo, File);
    assert.equal(typeof resultado, 'object');
  }
});
