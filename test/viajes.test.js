// T-023 — Tests del gasto por viaje (CU-11).
//
// Es el bloque que le da el nombre a la planilla, y el que más maneras tiene de
// mentir: el total de un viaje sale de sumar por comentario, y un comentario
// escrito de dos formas lo parte en dos (L-002). El gasto por día sale de
// dividir por unos días que **nadie puede deducir**, y una división por un
// supuesto no confirmado es la forma más limpia de dar un número equivocado con
// cara de exacto.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { viajes, diasDeViaje, fijarDiasDeViaje, RUBRO_VIAJE } from '../src/core/viajes.js';
import {
  dibujarViajes, dibujarViaje, dibujarDiasDeViaje, dibujarFechas,
  intentarFijarDias, intentarBorrarDias,
} from '../src/ui/pantallas/viajes.js';

import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial, leerEstado, CLAVE_DATOS } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

let contador = 0;
function mov({ monto, rubro = 'viajes', fecha = '2026-07-03', comentario = '', tipo = TIPO_GASTO, moneda = 'EUR' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: fecha }
  );
}

const estadoCon = (movimientos, cambios = []) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios });

const ROMA = () => estadoCon([
  mov({ monto: '300', rubro: 'viajes', fecha: '2026-07-03', comentario: 'Roma' }),
  mov({ monto: '100', rubro: 'comida hecha', fecha: '2026-07-05', comentario: 'Roma' }),
  mov({ monto: '50', rubro: 'transporte', fecha: '2026-07-09', comentario: 'Roma' }),
  mov({ monto: '40', rubro: 'gastos fijos', fecha: '2026-07-05', comentario: 'Luz' }),
  mov({ monto: '20', rubro: 'supermercado', fecha: '2026-07-05' }),
]);


// ── Qué es un viaje ──────────────────────────────────────────────────────────

test('un viaje es un comentario con al menos un gasto del rubro viajes', () => {
  const lista = viajes(ROMA());

  assert.equal(lista.length, 1);
  assert.equal(lista[0].comentario, 'Roma');
});

test('"Luz" no es un viaje por más que sea un comentario repetido', () => {
  // La regla sale de los datos y no de una lista aparte: dos lugares que digan
  // cuáles son los viajes son dos lugares que se desincronizan.
  assert.equal(viajes(ROMA()).find((v) => v.clave === 'luz'), undefined);
});

test('el total del viaje suma TODOS sus rubros, no solo el de viajes', () => {
  // En un viaje se come, se toma transporte y se compra en el supermercado, y
  // todo eso es plata del viaje. Es lo que hace la planilla.
  assert.equal(viajes(ROMA())[0].total, 45000);
  assert.equal(viajes(ROMA())[0].cuantos, 3);
});

test('los gastos sin comentario no se cuelan en ningún viaje', () => {
  // El supermercado de 20 € del mismo día no lleva comentario: no es del viaje.
  assert.equal(viajes(ROMA())[0].total, 45000, 'se coló un gasto sin comentario');
});

test('un ingreso con el comentario del viaje no baja su gasto', () => {
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '100', rubro: 'regalos', comentario: 'Roma', tipo: TIPO_INGRESO }),
  ]);

  assert.equal(viajes(estado)[0].total, 30000, 'un ingreso no es un gasto del viaje');
});

test('dos escrituras del mismo viaje siguen siendo dos, y se arreglan en T-025', () => {
  // No se juntan solas a propósito (ADR-013): la app no saca tildes ni adivina.
  // La salida es renombrar en Datos → Comentarios y detalles.
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '100', rubro: 'viajes', comentario: 'roma 26' }),
  ]);

  assert.equal(viajes(estado).length, 2);
});

test('van de más caro a más barato', () => {
  const estado = estadoCon([
    mov({ monto: '100', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '900', rubro: 'viajes', comentario: 'Costa Rica' }),
  ]);

  assert.deepEqual(viajes(estado).map((v) => v.comentario), ['Costa Rica', 'Roma']);
});

test('dice entre qué fechas se gastó', () => {
  const viaje = viajes(ROMA())[0];
  assert.equal(viaje.desde, '2026-07-03');
  assert.equal(viaje.hasta, '2026-07-09');
});

test('sin viajes no se rompe', () => {
  assert.deepEqual(viajes(estadoCon([])), []);
  assert.deepEqual(viajes(estadoCon([mov({ monto: '10', rubro: 'supermercado' })])), []);
  assert.equal(RUBRO_VIAJE, 'viajes');
});

test('un gasto sin tipo de cambio marca el viaje en vez de contarse como cero', () => {
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '10000', rubro: 'comida hecha', comentario: 'Roma', moneda: 'CRC' }),
  ]);
  const viaje = viajes(estado)[0];

  assert.equal(viaje.total, 30000, 'no puede contar como cero lo que no sabe convertir');
  assert.equal(viaje.incompleto, true, 'y tiene que decir que está incompleto');
});

test('con el tipo de cambio cargado, el gasto en otra moneda entra', () => {
  const cambio = crearCambio(
    { moneda: 'CRC', mes: '2026-07', euros_por_unidad: desdeUnidadesPorEuro(630) },
    { creado: '2026-07-01' }
  );
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '6300', rubro: 'comida hecha', comentario: 'Roma', moneda: 'CRC' }),
  ], [cambio]);

  assert.equal(viajes(estado)[0].total, 31000, '6300 colones son 10 euros');
  assert.equal(viajes(estado)[0].incompleto, false);
});

test('sin tope de filas (L-001)', () => {
  const movimientos = Array.from({ length: 1500 },
    () => mov({ monto: '1', rubro: 'viajes', comentario: 'Roma' }));
  assert.equal(viajes(estadoCon(movimientos))[0].cuantos, 1500);
});


// ── Los días: se escriben, no se deducen ─────────────────────────────────────

test('sin días escritos NO hay gasto por día', () => {
  // Deducirlo de la primera y la última fecha daría 7 días acá, y el viaje pudo
  // ser de 10: el número saldría 40 % más alto, con cara de exacto.
  const viaje = viajes(ROMA())[0];

  assert.equal(viaje.dias, null);
  assert.equal(viaje.porDia, null);
});

test('con los días escritos, el gasto por día sale de ellos', () => {
  const estado = fijarDiasDeViaje(ROMA(), 'roma', 10);
  const viaje = viajes(estado)[0];

  assert.equal(viaje.dias, 10);
  assert.equal(viaje.porDia, 4500, '450 € en 10 días');
});

test('los días se guardan por clave, así que sobreviven a cambiar mayúsculas', () => {
  const estado = fijarDiasDeViaje(ROMA(), 'ROMA', 10);
  assert.equal(diasDeViaje(estado, 'roma'), 10);
  assert.equal(diasDeViaje(estado, ' Roma '), 10);
});

test('escribir los días otra vez los reemplaza, no los duplica', () => {
  let estado = fijarDiasDeViaje(ROMA(), 'roma', 10);
  estado = fijarDiasDeViaje(estado, 'roma', 5);

  assert.equal(estado.dias_de_viaje.length, 1);
  assert.equal(diasDeViaje(estado, 'roma'), 5);
});

test('se pueden borrar los días, que es distinto de poner cero', () => {
  // "No sé cuántos días fue" es una respuesta; "cero días" no significa nada, y
  // dividir por cero daría infinito.
  const conDias = fijarDiasDeViaje(ROMA(), 'roma', 10);
  const sinDias = fijarDiasDeViaje(conDias, 'roma', null);

  assert.equal(diasDeViaje(sinDias, 'roma'), null);
  assert.equal(viajes(sinDias)[0].porDia, null);
  assert.throws(() => fijarDiasDeViaje(ROMA(), 'roma', 0), /entero de 1 para arriba/);
});

test('los días tienen que ser un número entero razonable', () => {
  for (const malo of [-1, 1.5, 'siete', NaN, 4000]) {
    assert.throws(() => fijarDiasDeViaje(ROMA(), 'roma', malo));
  }
});

test('un campo vacío no guarda cero días', () => {
  // `Number('')` da 0, y sin este filtro el gasto por día sería infinito.
  for (const escrito of ['', '   ', '7 días', 'siete', '1,5']) {
    assert.notEqual(intentarFijarDias(ROMA(), 'roma', escrito).error, undefined, escrito);
  }
  assert.equal(intentarFijarDias(ROMA(), 'roma', ' 7 ').error, undefined);
});

/** Un almacén de mentira con un contenido puesto a mano. */
const almacenCon = (crudo) => ({
  getItem: (c) => (c === CLAVE_DATOS ? crudo : null),
  setItem: () => {},
  removeItem: () => {},
});

test('los días sobreviven a guardar y volver a leer', () => {
  // Si no se leyeran al arrancar, el usuario los escribiría una vez por sesión.
  const estado = fijarDiasDeViaje(ROMA(), 'roma', 10);
  const { estado: leido } = leerEstado(almacenCon(JSON.stringify(estado)));

  assert.equal(diasDeViaje(leido, 'roma'), 10);
});

test('unos días rotos en el archivo no se llevan a los demás', () => {
  const crudo = JSON.stringify({
    ...estadoInicial({ monedas: monedasIniciales() }),
    dias_de_viaje: [{ clave: 'roma', dias: 10 }, { clave: 'paris', dias: 'ocho' }, { dias: 3 }],
  });
  const { estado, incidencias } = leerEstado(almacenCon(crudo));

  assert.equal(diasDeViaje(estado, 'roma'), 10);
  assert.equal(estado.dias_de_viaje.length, 1);
  assert.ok(incidencias.length > 0, 'lo que no se pudo leer tiene que decirse');
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('el número grande es el total del viaje', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);
  assert.match(html, /class="importe">450,00/);
});

test('sin días, en vez de un promedio inventado hay un botón para escribirlos', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);

  assert.ok(html.includes('¿Cuántos días fue?'));
  assert.ok(html.includes('data-accion="dias-viaje"'));
  assert.equal(html.includes('por día'), false, 'no puede haber un gasto por día sin días');
});

test('con días, se muestra el gasto por día y se puede cambiar', () => {
  const html = dibujarViaje(viajes(fijarDiasDeViaje(ROMA(), 'roma', 10))[0]);

  assert.ok(html.includes('45,00'));
  assert.ok(html.includes('por día'));
  assert.ok(html.includes('en 10 días'));
  assert.ok(html.includes('cambiar'));
});

test('un día en singular se escribe en singular', () => {
  const html = dibujarViaje(viajes(fijarDiasDeViaje(ROMA(), 'roma', 1))[0]);
  assert.ok(html.includes('en 1 día'));
  assert.equal(html.includes('en 1 días'), false);
});

test('el viaje lleva a sus gastos', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);
  assert.ok(html.includes('data-accion="ver-comentario"'));
  assert.ok(html.includes('data-comentario="Roma"'));
});

test('el formulario de días explica por qué se escriben', () => {
  const html = dibujarDiasDeViaje({ estado: ROMA(), viajeEditado: 'roma' });

  assert.ok(html.includes('03/07/2026'));
  assert.ok(html.includes('no se deducen'), 'no explica por qué se piden');
  assert.ok(html.includes('No sé cuántos días fue'), 'no se puede volver atrás');
});

test('el aviso de total incompleto se muestra', () => {
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '10000', rubro: 'comida hecha', comentario: 'Roma', moneda: 'CRC' }),
  ]);
  assert.ok(dibujarViaje(viajes(estado)[0]).includes('el total está incompleto'));
});

test('sin viajes la pantalla explica cómo se crea uno', () => {
  const html = dibujarViajes({ estado: estadoCon([]) });

  assert.ok(html.includes('Todavía no hay ninguno'));
  assert.ok(html.includes('viajes'), 'no dice qué rubro marca un viaje');
});

test('la pantalla aclara que el total incluye todos los rubros', () => {
  const html = dibujarViajes({ estado: ROMA() });
  assert.ok(html.includes('todos'));
  assert.ok(html.includes('Roma'));
});

test('editando los días no se muestra también la lista', () => {
  const html = dibujarViajes({ estado: ROMA(), viajeEditado: 'roma' });

  assert.ok(html.includes('data-formulario="dias-viaje"'));
  assert.equal(html.includes('<ul class="rubros">'), false);
});

test('dibujarFechas dice una sola cuando el viaje fue de un día', () => {
  assert.equal(dibujarFechas({ desde: '2026-07-03', hasta: '2026-07-03' }), '03/07/2026');
  assert.equal(dibujarFechas({ desde: '2026-07-03', hasta: '2026-07-09' }), '03/07/2026 → 09/07/2026');
});

test('el nombre de un viaje no puede romper la página', () => {
  const estado = estadoCon([mov({ monto: '10', rubro: 'viajes', comentario: '<script>x' })]);
  const html = dibujarViajes({ estado });

  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la pantalla no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarViajes({ estado: ROMA() })), false);
});

test('intentarBorrarDias deja el estado sin esos días', () => {
  const { estado } = intentarBorrarDias(fijarDiasDeViaje(ROMA(), 'roma', 10), 'roma');
  assert.equal(diasDeViaje(estado, 'roma'), null);
});
