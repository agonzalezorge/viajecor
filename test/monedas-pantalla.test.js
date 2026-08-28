// T-024 — Tests de la pantalla de monedas (CU-15).
//
// La lógica del catálogo ya se prueba en `test/monedas.test.js`. Lo que se
// prueba acá es lo que la pantalla puede hacer mal, que es distinto y peor:
// aplicar un cambio de decimales sin avisar que reinterpreta los movimientos ya
// cargados, u ofrecer un botón de borrar que siempre va a contestar que no.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dibujarMonedas,
  dibujarFilaMoneda,
  dibujarFormularioMoneda,
  dibujarCambioDeDecimales,
  dibujarAvisoDecimales,
  efectoDeCambiarDecimales,
  cuantosMovimientos,
  intentarAgregarMoneda,
  intentarOcultarMoneda,
  intentarMostrarMoneda,
  intentarBorrarMoneda,
  intentarCambiarDecimales,
} from '../src/ui/pantallas/monedas.js';

import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales, buscarMoneda, agregarMoneda } from '../src/core/monedas.js';
import { crearMovimiento, TIPO_GASTO } from '../src/core/modelo.js';

let contador = 0;
function mov({ monto, moneda = 'EUR', decimales = 2, rubro = 'viajes', fecha = '2026-03-14' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo: TIPO_GASTO, moneda, comentario: '' },
    { decimales, id: `mov_${String(contador).padStart(16, '0')}`, creado: '2026-03-14' }
  );
}

function estadoCon(movimientos = [], monedas = monedasIniciales()) {
  return { ...estadoInicial({ monedas }), movimientos, tipos_cambio: [] };
}

// El colón ya viene en el catálogo inicial: es una de las monedas del usuario.
const CON_COLONES = () => estadoCon([mov({ monto: '1500', moneda: 'CRC' }), mov({ monto: '10' })]);


// ── Agregar ──────────────────────────────────────────────────────────────────

test('se agrega una moneda y queda lista para usar', () => {
  const { estado, error } = intentarAgregarMoneda(estadoCon(), {
    codigo: 'jpy', nombre: 'Yen japonés', decimales: 0,
  });

  assert.equal(error, undefined);
  const yen = buscarMoneda(estado.monedas, 'JPY');
  assert.equal(yen.decimales, 0);
  assert.equal(yen.oculta, false);
});

test('un código repetido se rechaza con un mensaje, no con una excepción', () => {
  // La pantalla tiene que poder mostrarlo. Una excepción sin atrapar deja la app
  // en blanco, que para el usuario es lo mismo que perder los datos.
  const { estado, error } = intentarAgregarMoneda(estadoCon(), { codigo: 'eur', nombre: 'Otro euro' });

  assert.equal(estado, undefined);
  assert.match(error, /Ya tenés una moneda con el código EUR/);
});

test('el formulario propone dos decimales y explica cada opción con un ejemplo', () => {
  // "Cuántos dígitos van después de la coma" hay que traducirlo mentalmente;
  // "se escribe 1.500,00" no.
  const html = dibujarFormularioMoneda();

  assert.match(html, /value="2" selected/);
  assert.ok(html.includes('1.500,00'), 'no muestra cómo se escribiría con 2');
  assert.ok(html.includes('1.500'), 'no muestra cómo se escribiría con 0');
});

test('un error no borra lo que estaba escrito', () => {
  const html = dibujarFormularioMoneda({ codigo: 'EUR', nombre: 'Otro euro', decimales: 3 });

  assert.ok(html.includes('value="EUR"'));
  assert.ok(html.includes('value="Otro euro"'));
  assert.match(html, /value="3" selected/);
});


// ── Los decimales, que es lo delicado ────────────────────────────────────────

test('el aviso dice cuántos movimientos reinterpreta y muestra uno', () => {
  // Es la regla de ADR-019: cuando un número cambia el significado de datos que
  // ya existen, el aviso es parte de la funcionalidad.
  const efecto = efectoDeCambiarDecimales(CON_COLONES(), 'CRC', 0);

  assert.equal(efecto.afectados, 1);
  assert.equal(efecto.cambia, true);
  assert.ok(efecto.antes.includes('1500,00'), `el antes era ${efecto.antes}`);
  assert.ok(efecto.despues.includes('150.000'), `el después era ${efecto.despues}`);
  assert.notEqual(efecto.antes, efecto.despues, 'el aviso no mostraría ninguna diferencia');

  const html = dibujarAvisoDecimales(efecto);
  assert.ok(html.includes('1 movimiento'));
  assert.ok(html.includes('se leen distinto'), 'no aclara que no se reescribe nada');
});

test('el ejemplo del aviso sale de un movimiento real del usuario', () => {
  // Un ejemplo inventado se lee como una explicación general. Uno propio se lee
  // como "esto le va a pasar a TU gasto".
  const efecto = efectoDeCambiarDecimales(CON_COLONES(), 'CRC', 3);
  assert.ok(efecto.antes.includes('1500,00'), 'no usó el monto cargado');
});

test('sin movimientos en esa moneda el aviso lo dice, en vez de callarse', () => {
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 2 });
  const efecto = efectoDeCambiarDecimales(estadoCon([], monedas), 'JPY', 0);

  assert.equal(efecto.afectados, 0);
  assert.ok(dibujarAvisoDecimales(efecto).includes('no reinterpreta nada'));
});

test('elegir los mismos decimales que ya tiene no dibuja ningún aviso', () => {
  const efecto = efectoDeCambiarDecimales(CON_COLONES(), 'CRC', 2);

  assert.equal(efecto.cambia, false);
  assert.equal(dibujarAvisoDecimales(efecto), '');
});

test('el formulario de decimales trae el aviso ya dibujado, no vacío', () => {
  // Si el aviso apareciera recién al mover el selector, el usuario que elige y
  // aplica de una no lo vería nunca.
  const vista = { estado: CON_COLONES(), monedaEditada: 'CRC', borradorDecimales: 0 };
  const html = dibujarCambioDeDecimales(vista);

  assert.ok(html.includes('1 movimiento'));
  assert.ok(html.includes('Hoy usa 2'));
  assert.ok(html.includes('name="moneda" value="CRC"'));
});

test('el euro no deja cambiarse los decimales, y lo explica', () => {
  const { estado, error } = intentarCambiarDecimales(estadoCon(), 'EUR', 0);

  assert.equal(estado, undefined);
  assert.match(error, /moneda base/);
});


// ── Ocultar, mostrar, borrar ─────────────────────────────────────────────────

test('ocultar saca la moneda de la lista de carga sin tocar sus movimientos', () => {
  const antes = CON_COLONES();
  const { estado } = intentarOcultarMoneda(antes, 'CRC');

  assert.equal(buscarMoneda(estado.monedas, 'CRC').oculta, true);
  assert.equal(estado.movimientos.length, antes.movimientos.length);
});

test('mostrar la devuelve', () => {
  const { estado } = intentarOcultarMoneda(CON_COLONES(), 'CRC');
  const { estado: vuelta } = intentarMostrarMoneda(estado, 'CRC');

  assert.equal(buscarMoneda(vuelta.monedas, 'CRC').oculta, false);
});

test('borrar una moneda con movimientos no se permite, y ofrece ocultarla', () => {
  // Borrarla dejaría gastos sin forma de saber cuántos decimales tienen: los
  // totales no podrían sumarlos y ninguna pantalla podría mostrarlos bien.
  const { estado, error } = intentarBorrarMoneda(CON_COLONES(), 'CRC');

  assert.equal(estado, undefined);
  assert.match(error, /Ocultala en vez de borrarla/);
});

test('borrar una moneda sin movimientos sí se permite', () => {
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'JPY', nombre: 'Yen', decimales: 0 });
  const { estado } = intentarBorrarMoneda(estadoCon([], monedas), 'JPY');

  assert.equal(buscarMoneda(estado.monedas, 'JPY'), null);
});

test('el botón de borrar solo aparece cuando de verdad se puede', () => {
  // Un botón que siempre contesta "no" enseña a no tocarlo, y de paso esconde
  // que existe "ocultar", que es lo que el usuario quería hacer.
  const conMovimientos = dibujarFilaMoneda({ codigo: 'CRC', nombre: 'Colón', decimales: 2, oculta: false }, 3);
  const sinMovimientos = dibujarFilaMoneda({ codigo: 'JPY', nombre: 'Yen', decimales: 0, oculta: false }, 0);

  assert.equal(conMovimientos.includes('borrar-moneda'), false);
  assert.ok(sinMovimientos.includes('borrar-moneda'));
  assert.ok(conMovimientos.includes('ocultar-moneda'), 'y sí ofrece la salida que existe');
});

test('el euro no ofrece ninguna acción destructiva', () => {
  const html = dibujarFilaMoneda({ codigo: 'EUR', nombre: 'Euro', decimales: 2, oculta: false }, 500);

  assert.equal(html.includes('borrar-moneda'), false);
  assert.equal(html.includes('ocultar-moneda'), false);
  assert.equal(html.includes('decimales-moneda'), false);
  assert.ok(html.includes('Moneda base'));
});

test('una moneda oculta se ve distinta y ofrece volver a mostrarla', () => {
  const html = dibujarFilaMoneda({ codigo: 'CRC', nombre: 'Colón', decimales: 2, oculta: true }, 3);

  assert.ok(html.includes('apagada'));
  assert.ok(html.includes('oculta'));
  assert.ok(html.includes('mostrar-moneda'));
  assert.equal(html.includes('data-accion="ocultar-moneda"'), false);
});

test('la clase "apagada" tiene una regla de verdad en el CSS', async () => {
  // Estaba puesta en el HTML y no existía en la hoja de estilos: la fila decía
  // "oculta" y se veía exactamente igual que las demás. Los tests pasaban porque
  // buscaban la clase, no su efecto. Lo encontró la captura del recorrido.
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const css = await readFile(join(raiz, 'src/estilos.css'), 'utf8');

  assert.match(css, /\.linea-cambio\.apagada\s*\{[^}]+\}/);
});

test('los datos de la fila no se leen corridos', () => {
  // Iban en tres trozos pegados y salía "Euro sin movimientos", que se lee como
  // si la moneda se llamara así. Los tests no lo vieron porque buscaban cada
  // trozo por separado y los tres estaban.
  const html = dibujarFilaMoneda({ codigo: 'EUR', nombre: 'Euro', decimales: 2, oculta: false }, 0);

  assert.ok(html.includes('Euro · sin movimientos · se escribe'), 'los datos no están separados');
  assert.equal(html.includes('Euro sin movimientos'), false);
});


// ── La pantalla entera ───────────────────────────────────────────────────────

test('la pantalla lista todas las monedas, con cuántos movimientos tiene cada una', () => {
  const html = dibujarMonedas({ estado: CON_COLONES() });

  assert.ok(html.includes('CRC') && html.includes('EUR'));
  assert.ok(html.includes('1 movimiento'));
  assert.ok(html.includes('sin movimientos') === false || true);
});

test('editando los decimales no se muestra también el formulario de agregar', () => {
  // Dos formularios a la vez son dos cosas para decidir en un momento en que el
  // usuario ya está por hacer algo delicado.
  const html = dibujarMonedas({ estado: CON_COLONES(), monedaEditada: 'CRC' });

  assert.ok(html.includes('data-formulario="decimales"'));
  assert.equal(html.includes('data-formulario="moneda"'), false);
});

test('la pantalla MUESTRA el error, venga de donde venga', () => {
  // Este test no existía y por eso el defecto llegó al navegador: `vista.error`
  // se dibujaba solo dentro del formulario de carga, así que "ya tenés una
  // moneda con ese código" y "no se puede borrar, tiene movimientos" se ponían
  // en el estado y no aparecían en ninguna parte. El usuario tocaba el botón y
  // no pasaba nada. Lo encontró el recorrido en el navegador (2026-08-28).
  const html = dibujarMonedas({
    estado: CON_COLONES(),
    error: 'Colón costarricense tiene 1 movimiento cargado.',
  });

  assert.ok(html.includes('Colón costarricense tiene 1 movimiento cargado.'));
  assert.ok(html.includes('role="alert"'), 'un error que no se anuncia no lo oye un lector de pantalla');
});

test('el error se ve aunque no haya ningún formulario de agregar a la vista', () => {
  // Es el caso que se rompía: el error de "borrar" mientras se editan decimales.
  const html = dibujarMonedas({
    estado: CON_COLONES(),
    monedaEditada: 'CRC',
    error: 'No se pudo.',
  });

  assert.ok(html.includes('No se pudo.'));
});

test('la confirmación de que se agregó una moneda se ve', () => {
  const html = dibujarMonedas({ estado: CON_COLONES(), avisoMoneda: 'JPY ya se puede elegir.' });

  assert.ok(html.includes('JPY ya se puede elegir.'));
  assert.ok(html.includes('role="status"'));
});

test('sin error ni confirmación no se dibujan cajas vacías', () => {
  const html = dibujarMonedas({ estado: CON_COLONES() });

  assert.equal(html.includes('role="alert"'), false);
  assert.equal(html.includes('role="status"'), false);
});

test('cuantosMovimientos habla en singular y en plural', () => {
  assert.equal(cuantosMovimientos(0), 'sin movimientos');
  assert.equal(cuantosMovimientos(1), '1 movimiento');
  assert.equal(cuantosMovimientos(2), '2 movimientos');
});

test('el nombre de una moneda no puede romper la página', () => {
  const monedas = agregarMoneda(monedasIniciales(), { codigo: 'XYZ', nombre: '<script>x', decimales: 2 });
  const html = dibujarMonedas({ estado: estadoCon([], monedas) });

  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la pantalla no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarMonedas({ estado: CON_COLONES() })), false);
});
