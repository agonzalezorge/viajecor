// T-022 — Tests del promedio de gastos fijos (CU-12).
//
// Reemplaza el bloque `GASTOS FIJOS PROMEDIO`. Lo que puede engañar acá es un
// promedio que parece mensual y no lo es, y una lista que no cierra con el total
// del rubro porque descartó filas en silencio.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gastosFijos } from '../src/core/calculos.js';
import {
  dibujarGastosFijos,
  dibujarGastoFijo,
  dibujarCadencia,
  dibujarSinComentario,
} from '../src/ui/pantallas/fijos.js';

import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

let contador = 0;
function mov({ monto, rubro = 'gastos fijos', fecha, comentario = '', tipo = TIPO_GASTO, moneda = 'EUR' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: '2026-01-01' }
  );
}

function estadoCon(movimientos, cambios = []) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios };
}

const LUZ_Y_GAS = estadoCon([
  mov({ monto: '40', fecha: '2025-10-05', comentario: 'Luz' }),
  mov({ monto: '60', fecha: '2025-11-05', comentario: 'luz' }),
  mov({ monto: '30', fecha: '2025-11-06', comentario: 'Gas' }),
  mov({ monto: '30', fecha: '2025-12-06', comentario: 'Gas' }),
]);


// ── El cálculo ───────────────────────────────────────────────────────────────

test('"Luz" y "luz" son la misma factura', () => {
  // RN-03: lo que agrupa se normaliza antes de comparar. Sin esto, una mayúscula
  // de más parte la luz en dos gastos fijos distintos y los dos promedios mienten.
  const { grupos } = gastosFijos(LUZ_Y_GAS);
  const luz = grupos.find((g) => g.clave === 'luz');

  assert.equal(luz.cuantos, 2);
  assert.equal(luz.total, 10000);
  assert.equal(luz.promedio, 5000);
  assert.equal(luz.comentario, 'Luz', 'se muestra la primera escritura que apareció');
});

test('solo cuenta los gastos del rubro "gastos fijos"', () => {
  // Un "Luz" cargado en supermercado no es la factura de la luz.
  const estado = estadoCon([
    mov({ monto: '40', fecha: '2025-10-05', comentario: 'Luz' }),
    mov({ monto: '99', fecha: '2025-10-06', comentario: 'Luz', rubro: 'supermercado' }),
  ]);
  const { grupos } = gastosFijos(estado);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].cuantos, 1);
  assert.equal(grupos[0].total, 4000);
});

test('un ingreso con rubro de gasto no entra al promedio', () => {
  // `crearMovimiento` no deja construir esto —comprobado abajo—, así que el
  // filtro por tipo solo se alcanza con un objeto armado a mano. Se prueba por
  // esa puerta, que es la única que tiene: `gastosFijos` recibe un estado, y
  // nada obliga a que ese estado venga de `leerEstado`. Sin el filtro, plata que
  // ENTRÓ se promediaría junto con plata que SALE.
  assert.throws(
    () => mov({ monto: '500', fecha: '2025-10-01', comentario: 'Luz', tipo: TIPO_INGRESO }),
    /no es un rubro de ingreso/,
  );

  const crudo = {
    id: 'mov_crudo', tipo: TIPO_INGRESO, rubro: 'gastos fijos', comentario: 'Luz',
    monto: 50000, moneda: 'EUR', decimales: 2, fecha: '2025-10-01', detalle: '', creado: '2025-10-01',
  };
  const { grupos } = gastosFijos(estadoCon([
    mov({ monto: '40', fecha: '2025-10-05', comentario: 'Luz' }),
    crudo,
  ]));

  assert.equal(grupos[0].cuantos, 1);
  assert.equal(grupos[0].total, 4000);
});

test('mira todo el historial, no un mes', () => {
  // Un promedio sobre un mes es el gasto de ese mes con otro nombre.
  const { grupos } = gastosFijos(LUZ_Y_GAS);
  const gas = grupos.find((g) => g.clave === 'gas');

  assert.equal(gas.desde, '2025-11');
  assert.equal(gas.hasta, '2025-12');
});

test('los pagos sin comentario se cuentan aparte, no se tiran', () => {
  // Callarlos haría que la lista no cerrara con el total del rubro, y el usuario
  // no tendría forma de saber por qué le falta plata.
  const estado = estadoCon([
    mov({ monto: '40', fecha: '2025-10-05', comentario: 'Luz' }),
    mov({ monto: '25', fecha: '2025-12-06' }),
    mov({ monto: '15', fecha: '2025-12-07' }),
  ]);
  const { grupos, sinComentario, total } = gastosFijos(estado);

  assert.equal(grupos.length, 1);
  assert.equal(sinComentario.cuantos, 2);
  assert.equal(sinComentario.total, 4000);
  assert.equal(total, 8000, 'el total tiene que incluir los que no se pudieron agrupar');
});

test('la suma de la lista más los sueltos da el total del rubro', () => {
  // Es la comprobación que hace que la pantalla no pueda esconder plata.
  const { grupos, sinComentario, total } = gastosFijos(LUZ_Y_GAS);
  const sumado = grupos.reduce((t, g) => t + g.total, 0) + sinComentario.total;

  assert.equal(sumado, total);
});

test('van de mayor a menor por total', () => {
  const { grupos } = gastosFijos(LUZ_Y_GAS);
  assert.deepEqual(grupos.map((g) => g.clave), ['luz', 'gas']);
});

test('un movimiento sin tipo de cambio no se cuenta como cero', () => {
  const estado = estadoCon([
    mov({ monto: '40', fecha: '2025-10-05', comentario: 'Luz' }),
    mov({ monto: '10000', fecha: '2025-11-05', comentario: 'Luz', moneda: 'CRC' }),
  ]);
  const { grupos } = gastosFijos(estado);

  assert.equal(grupos[0].cuantos, 1, 'contó un pago que no sabe cuánto vale');
  assert.equal(grupos[0].promedio, 4000);
});

test('sin gastos fijos no se rompe', () => {
  const { grupos, sinComentario, total } = gastosFijos(estadoCon([]));
  assert.deepEqual(grupos, []);
  assert.equal(sinComentario.cuantos, 0);
  assert.equal(total, 0);
});

test('no tiene ningún tope de movimientos (L-001)', () => {
  const movimientos = [];
  for (let i = 0; i < 1500; i += 1) {
    movimientos.push(mov({ monto: '10', fecha: '2025-10-05', comentario: 'Luz' }));
  }
  const { grupos } = gastosFijos(estadoCon(movimientos));

  assert.equal(grupos[0].cuantos, 1500);
  assert.equal(grupos[0].promedio, 1000);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('el número destacado es el promedio, no el total', () => {
  // La pregunta es "¿cuánto me sale?", no "¿cuánto llevo gastado?".
  const html = dibujarGastoFijo({
    comentario: 'Luz', cuantos: 2, total: 10000, promedio: 5000,
    desde: '2025-10', hasta: '2025-11',
  });
  const destacado = html.match(/class="importe">([^<]*)</)[1];

  assert.ok(destacado.includes('50,00'));
  assert.ok(html.includes('100,00'), 'el total tiene que estar, para poder comprobarlo');
});

test('dice cuántos pagos y entre qué meses', () => {
  // Un promedio por pago, solo, se lee como si fuera mensual. Ocho pagos en once
  // meses no es una factura mensual.
  assert.equal(
    dibujarCadencia({ cuantos: 8, desde: '2025-10', hasta: '2026-08' }),
    '8 pagos · oct 25 → ago 26'
  );
  assert.equal(dibujarCadencia({ cuantos: 1, desde: '2025-10', hasta: '2025-10' }), '1 pago · oct 25');
});

test('la pantalla avisa de los pagos que no pudo agrupar, y dice cómo arreglarlo', () => {
  const html = dibujarSinComentario({ cuantos: 3, total: 4500 });

  assert.ok(html.includes('3 pagos'));
  assert.ok(html.includes('45,00'));
  assert.ok(html.includes('etiqueta'), 'no dice por qué quedaron afuera');
  assert.ok(html.includes('Luz'), 'no dice qué hacer para que entren');
});

test('sin pagos sueltos no se dibuja el aviso', () => {
  assert.equal(dibujarSinComentario({ cuantos: 0, total: 0 }), '');
});

test('la tarjeta muestra el total del rubro, para que se pueda comprobar', () => {
  const html = dibujarGastosFijos(LUZ_Y_GAS);

  assert.ok(html.includes('160,00'), 'no muestra el total de los gastos fijos');
  assert.ok(html.includes('Luz') && html.includes('Gas'));
});

test('sin ningún gasto fijo la tarjeta no se dibuja', () => {
  // Una tarjeta vacía ocupa lugar y no dice nada.
  assert.equal(dibujarGastosFijos(estadoCon([])), '');
  assert.equal(dibujarGastosFijos(estadoCon([mov({ monto: '10', rubro: 'supermercado', fecha: '2025-10-05' })])), '');
});

test('con gastos fijos pero ninguno con comentario, lo dice en vez de mostrar una lista vacía', () => {
  const html = dibujarGastosFijos(estadoCon([mov({ monto: '25', fecha: '2025-12-06' })]));

  assert.ok(html.includes('no hay nada que agrupar'));
  assert.ok(html.includes('25,00'));
});

test('el texto del usuario se escapa', () => {
  const html = dibujarGastosFijos(estadoCon([
    mov({ monto: '10', fecha: '2025-10-05', comentario: '<script>Luz' }),
  ]));

  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la pantalla no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarGastosFijos(LUZ_Y_GAS)), false);
});
