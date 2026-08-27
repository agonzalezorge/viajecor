// T-903 · El recordatorio de respaldo.
//
// Lo que se prueba acá no es "aparece un cartel": es **cuándo NO tiene que
// aparecer**. Un aviso que sale cuando no corresponde enseña a ignorarlo, y el
// día que sí importa ya nadie lo lee. Esa es la falla cara, no la contraria.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sinRespaldar, estadoDelRecordatorio, posponerRecordatorio, DIAS_PARA_RECORDAR,
} from '../src/datos/recordatorio.js';
import { anotarRespaldo } from '../src/datos/exportar.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { crearMovimiento } from '../src/core/modelo.js';
import { monedasIniciales } from '../src/core/monedas.js';

function estadoLimpio() {
  return { ...estadoInicial(), monedas: monedasIniciales() };
}

/** Carga un gasto anotando el día en que se cargó. */
function cargar(estado, creado, { monto = '10' } = {}) {
  return {
    ...estado,
    movimientos: [
      ...(estado.movimientos ?? []),
      crearMovimiento(
        { tipo: 'G', rubro: 'comida hecha', monto, moneda: 'EUR', fecha: creado, comentario: '' },
        { decimales: 2, creado }
      ),
    ],
  };
}

// ── Qué está sin respaldar ───────────────────────────────────────────────────

test('sin respaldo previo, todo está sin respaldar', () => {
  const estado = cargar(cargar(estadoLimpio(), '2026-08-01'), '2026-08-10');

  assert.equal(sinRespaldar(estado).length, 2);
});

test('lo cargado después del respaldo está sin respaldar; lo de antes no', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = anotarRespaldo(estado, { fecha: '2026-08-05' });
  estado = cargar(estado, '2026-08-10');

  const pendientes = sinRespaldar(estado);
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].creado, '2026-08-10');
});

test('lo cargado el mismo día del respaldo cuenta como sin respaldar', () => {
  // La app no guarda horas (ADR-021), así que no se puede saber si el gasto se
  // cargó antes o después de exportar. Equivocarse hacia "ya está respaldado"
  // es equivocarse hacia perder datos: se elige el otro lado.
  let estado = cargar(estadoLimpio(), '2026-08-05');
  estado = anotarRespaldo(estado, { fecha: '2026-08-05' });

  assert.equal(sinRespaldar(estado).length, 1);
});

// ── Cuándo NO tiene que avisar ───────────────────────────────────────────────

test('sin movimientos no avisa, por más tiempo que pase', () => {
  const estado = anotarRespaldo(estadoLimpio(), { fecha: '2025-01-01' });
  const recordatorio = estadoDelRecordatorio(estado, { fecha: '2026-08-27' });

  assert.equal(recordatorio.haceFalta, false);
  assert.equal(recordatorio.cuantos, 0);
});

test('con todo respaldado no avisa, por más tiempo que pase', () => {
  // Un año sin respaldar es irrelevante si no cargaste nada en ese año: no hay
  // nada que perder. Avisar igual sería el aviso que enseña a ignorar avisos.
  let estado = cargar(estadoLimpio(), '2025-08-01');
  estado = anotarRespaldo(estado, { fecha: '2025-08-02' });

  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, false);
});

test('recién cargado no avisa aunque nunca hayas respaldado', () => {
  // Reclamarle un respaldo a quien cargó su primer gasto hace diez minutos es
  // la forma más rápida de que el aviso pierda todo su valor.
  const estado = cargar(estadoLimpio(), '2026-08-27');

  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, false);
});

test('el día anterior al plazo todavía no avisa', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = anotarRespaldo(estado, { fecha: '2026-08-20' });
  estado = cargar(estado, '2026-08-20');

  const casi = estadoDelRecordatorio(estado, { fecha: '2026-08-26' });
  assert.equal(casi.desde, DIAS_PARA_RECORDAR - 1);
  assert.equal(casi.haceFalta, false);
});

// ── Cuándo sí ────────────────────────────────────────────────────────────────

test('cumplido el plazo con movimientos nuevos, avisa', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = anotarRespaldo(estado, { fecha: '2026-08-20' });
  estado = cargar(estado, '2026-08-21');
  estado = cargar(estado, '2026-08-25');

  const recordatorio = estadoDelRecordatorio(estado, { fecha: '2026-08-27' });
  assert.equal(recordatorio.haceFalta, true);
  assert.equal(recordatorio.cuantos, 2);
  assert.equal(recordatorio.desde, 7);
  assert.equal(recordatorio.nunca, false);
});

test('si nunca respaldaste, el plazo corre desde el movimiento más viejo', () => {
  let estado = cargar(estadoLimpio(), '2026-08-15');
  estado = cargar(estado, '2026-08-26');

  const recordatorio = estadoDelRecordatorio(estado, { fecha: '2026-08-27' });
  assert.equal(recordatorio.haceFalta, true);
  assert.equal(recordatorio.nunca, true);
  assert.equal(recordatorio.cuantos, 2);
  assert.equal(recordatorio.desde, 12);
});

test('el plazo se puede cambiar sin tocar el código de la pantalla', () => {
  let estado = cargar(estadoLimpio(), '2026-08-24');

  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, false);
  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27', dias: 3 }).haceFalta, true);
});

// ── Posponer ─────────────────────────────────────────────────────────────────

test('posponer calla el aviso por hoy', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, true);

  estado = posponerRecordatorio(estado, { fecha: '2026-08-27' });
  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, false);
});

test('mañana el aviso vuelve', () => {
  // Un aviso que se apaga para siempre no sirve para nada. Este se pospone por
  // el día, no se cancela.
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = posponerRecordatorio(estado, { fecha: '2026-08-27' });

  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-28' }).haceFalta, true);
});

test('posponer no toca los movimientos ni el estado que recibe', () => {
  const estado = cargar(estadoLimpio(), '2026-08-01');
  const antes = JSON.stringify(estado);
  const despues = posponerRecordatorio(estado, { fecha: '2026-08-27' });

  assert.equal(JSON.stringify(estado), antes);
  assert.equal(despues.movimientos.length, 1);
  assert.equal(despues.preferencias.recordatorio_pospuesto, '2026-08-27');
});

test('respaldar apaga el aviso de verdad, no por un día', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  assert.equal(estadoDelRecordatorio(estado, { fecha: '2026-08-27' }).haceFalta, true);

  estado = anotarRespaldo(estado, { fecha: '2026-08-27' });
  const recordatorio = estadoDelRecordatorio(estado, { fecha: '2026-09-30' });

  assert.equal(recordatorio.haceFalta, false);
  assert.equal(recordatorio.cuantos, 0);
});

// ── Lo que se ve ─────────────────────────────────────────────────────────────

import { dibujarRecordatorio, dibujarApp, vistaInicial } from '../src/ui/app.js';

/** Una vista con datos sin respaldar desde hace rato. */
function vistaConPendientes(pantalla = 'mes') {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = cargar(estado, '2026-08-05');
  return { ...vistaInicial({ estado }), pantalla };
}

test('en la pantalla del mes, el aviso aparece', () => {
  const html = dibujarRecordatorio(vistaConPendientes('mes'), { fecha: '2026-08-27' });

  assert.ok(html.includes('Nunca respaldaste'));
  assert.ok(html.includes('2 movimientos'));
  assert.ok(html.includes('Respaldar ahora'));
  assert.ok(html.includes('Ahora no'));
});

test('en la pantalla de Datos NO aparece', () => {
  // Ahí ya está toda la información y los botones de verdad. Repetirlo sería
  // ruido justo donde el usuario ya está haciendo lo correcto.
  assert.equal(dibujarRecordatorio(vistaConPendientes('datos'), { fecha: '2026-08-27' }), '');
});

test('el aviso no aparece si no hace falta', () => {
  let estado = anotarRespaldo(cargar(estadoLimpio(), '2026-08-26'), { fecha: '2026-08-27' });
  const vista = { ...vistaInicial({ estado }), pantalla: 'mes' };

  assert.equal(dibujarRecordatorio(vista, { fecha: '2026-08-27' }), '');
});

test('el aviso dice cuántos días, no solo que falta respaldar', () => {
  let estado = cargar(estadoLimpio(), '2026-08-01');
  estado = anotarRespaldo(estado, { fecha: '2026-08-15' });
  estado = cargar(estado, '2026-08-16');
  const vista = { ...vistaInicial({ estado }), pantalla: 'movimientos' };

  const html = dibujarRecordatorio(vista, { fecha: '2026-08-27' });
  assert.ok(html.includes('Hace 12 días que no respaldás'));
});

test('con un solo movimiento, el aviso habla en singular', () => {
  const estado = cargar(estadoLimpio(), '2026-08-01');
  const vista = { ...vistaInicial({ estado }), pantalla: 'mes' };

  const html = dibujarRecordatorio(vista, { fecha: '2026-08-27' });
  assert.ok(html.includes('1 movimiento tuyo existe'));
  assert.ok(html.includes('se pierde.'));
  assert.equal(html.includes('movimientos'), false);
});

test('el botón de respaldar lleva a la pantalla de Datos', () => {
  const html = dibujarRecordatorio(vistaConPendientes('mes'), { fecha: '2026-08-27' });

  assert.match(html, /data-accion="ir" data-pantalla="datos"/);
  assert.match(html, /data-accion="posponer-recordatorio"/);
});

test('el aviso está enchufado a la app, no solo escrito', () => {
  // L-014: una función con tests puede estar muerta. Quitar la llamada de
  // `dibujarApp` no rompía ningún test, así que este mira la app entera.
  const vista = vistaConPendientes('mes');

  assert.ok(dibujarApp(vista).includes('posponer-recordatorio'));
  assert.equal(dibujarApp({ ...vista, pantalla: 'datos' }).includes('posponer-recordatorio'), false);
});
