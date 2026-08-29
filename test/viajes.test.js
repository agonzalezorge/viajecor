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

import {
  viajes, fechasDeViaje, fijarFechasDeViaje, duracionEnDias, RUBRO_VIAJE,
} from '../src/core/viajes.js';
import {
  dibujarViajes, dibujarViaje, dibujarFechasDeViaje, dibujarFechas, dibujarRango,
  dibujarDuracion, intentarFijarFechas, intentarBorrarFechas,
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


// ── Las fechas se escriben; los días se calculan ────────────────────────────

/** Un almacén de mentira con un contenido puesto a mano. */
const almacenCon = (crudo) => ({
  getItem: (c) => (c === CLAVE_DATOS ? crudo : null),
  setItem: () => {},
  removeItem: () => {},
});

test('sin fechas escritas NO hay gasto por día', () => {
  // Deducirlas de la primera y la última fecha con gastos daría 7 días acá, y
  // el viaje pudo ser de 10: el número saldría 40 % más alto, con cara de exacto.
  const viaje = viajes(ROMA())[0];

  assert.equal(viaje.fechas, null);
  assert.equal(viaje.dias, null);
  assert.equal(viaje.porDia, null);
});

test('con las fechas escritas, los días se cuentan CON las dos puntas', () => {
  // Del 1 al 10 son diez días, no nueve: el 1 se viajó y el 10 también. Es la
  // cuenta que hace una persona, y la que no hace una resta de fechas a secas.
  const estado = fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10');
  const viaje = viajes(estado)[0];

  assert.equal(viaje.dias, 10);
  assert.equal(viaje.porDia, 4500, '450 € en 10 días');
  assert.deepEqual(viaje.fechas, { desde: '2026-07-01', hasta: '2026-07-10' });
});

test('duracionEnDias cuenta bien los bordes', () => {
  assert.equal(duracionEnDias('2026-07-03', '2026-07-03'), 1, 'un viaje de un día');
  assert.equal(duracionEnDias('2026-07-28', '2026-08-02'), 6, 'cruzando el fin de mes');
  assert.equal(duracionEnDias('2025-12-30', '2026-01-02'), 4, 'cruzando el fin de año');
  // Cruzando el cambio de hora, que es donde una resta de fechas ingenua falla.
  assert.equal(duracionEnDias('2026-03-28', '2026-03-30'), 3);
  assert.equal(duracionEnDias('2026-10-24', '2026-10-26'), 3);
  assert.equal(duracionEnDias('2024-02-28', '2024-03-01'), 3, 'año bisiesto');
});

test('las fechas se guardan por clave, así que sobreviven a cambiar mayúsculas', () => {
  const estado = fijarFechasDeViaje(ROMA(), 'ROMA', '2026-07-01', '2026-07-10');
  assert.deepEqual(fechasDeViaje(estado, 'roma'), { desde: '2026-07-01', hasta: '2026-07-10' });
  assert.deepEqual(fechasDeViaje(estado, ' Roma '), { desde: '2026-07-01', hasta: '2026-07-10' });
});

test('escribirlas otra vez las reemplaza, no las duplica', () => {
  let estado = fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10');
  estado = fijarFechasDeViaje(estado, 'roma', '2026-07-02', '2026-07-06');

  assert.equal(estado.fechas_de_viaje.length, 1);
  assert.equal(viajes(estado)[0].dias, 5);
});

test('se pueden borrar las fechas: "no me acuerdo" es una respuesta', () => {
  const conFechas = fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10');
  const sinFechas = fijarFechasDeViaje(conFechas, 'roma', null, null);

  assert.equal(fechasDeViaje(sinFechas, 'roma'), null);
  assert.equal(viajes(sinFechas)[0].porDia, null);
});

test('una sola fecha no alcanza, y lo dice', () => {
  // Con solo la de inicio no hay duración, y guardarla a medias dejaría un dato
  // que ninguna pantalla puede usar y que el usuario cree haber cargado.
  assert.throws(() => fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', ''), /las dos fechas/);
  assert.throws(() => fijarFechasDeViaje(ROMA(), 'roma', '', '2026-07-10'), /las dos fechas/);
});

test('un viaje no puede terminar antes de empezar', () => {
  assert.throws(() => fijarFechasDeViaje(ROMA(), 'roma', '2026-07-10', '2026-07-01'),
    /terminar antes de empezar/);
});

test('una fecha que no existe se rechaza, no se corre al día siguiente', () => {
  // El 31 de abril tiene la forma correcta y no existe. Comprobar la forma no es
  // comprobar la fecha (L-005).
  for (const mala of ['2026-04-31', '2026-13-01', '2026-02-30', 'ayer', '']) {
    assert.throws(() => fijarFechasDeViaje(ROMA(), 'roma', mala, '2026-07-10'));
  }
});

test('diez años de viaje se rechazan, por las dudas', () => {
  assert.throws(() => fijarFechasDeViaje(ROMA(), 'roma', '2000-01-01', '2026-07-10'), /muchos/);
});

test('las fechas sobreviven a guardar y volver a leer', () => {
  // Si no se leyeran al arrancar, el usuario las escribiría una vez por sesión.
  const estado = fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10');
  const { estado: leido } = leerEstado(almacenCon(JSON.stringify(estado)));

  assert.deepEqual(fechasDeViaje(leido, 'roma'), { desde: '2026-07-01', hasta: '2026-07-10' });
});

test('unas fechas rotas en el archivo no se llevan a las demás', () => {
  const crudo = JSON.stringify({
    ...estadoInicial({ monedas: monedasIniciales() }),
    fechas_de_viaje: [
      { clave: 'roma', desde: '2026-07-01', hasta: '2026-07-10' },
      { clave: 'paris', desde: '2026-04-31', hasta: '2026-05-02' },
      { clave: 'lima', desde: '2026-05-10', hasta: '2026-05-01' },
      { desde: '2026-01-01', hasta: '2026-01-02' },
    ],
  });
  const { estado, incidencias } = leerEstado(almacenCon(crudo));

  assert.equal(estado.fechas_de_viaje.length, 1);
  assert.deepEqual(fechasDeViaje(estado, 'roma'), { desde: '2026-07-01', hasta: '2026-07-10' });
  assert.ok(incidencias.length > 0, 'lo que no se pudo leer tiene que decirse');
});


// ── El orden: por cuándo TERMINÓ el viaje ───────────────────────────────────

test('los viajes van del que terminó más recientemente al más viejo', () => {
  // Pedido del usuario (2026-08-28). Antes iban de más caro a más barato, que
  // es un orden útil para otra pregunta pero no para "¿cuándo fui a dónde?".
  let estado = estadoCon([
    mov({ monto: '900', rubro: 'viajes', fecha: '2026-01-10', comentario: 'Costa Rica' }),
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-07-10', comentario: 'Roma' }),
    mov({ monto: '500', rubro: 'viajes', fecha: '2026-04-10', comentario: 'París' }),
  ]);
  estado = fijarFechasDeViaje(estado, 'costa rica', '2026-01-05', '2026-01-20');
  estado = fijarFechasDeViaje(estado, 'roma', '2026-07-01', '2026-07-12');
  estado = fijarFechasDeViaje(estado, 'parís', '2026-04-05', '2026-04-09');

  assert.deepEqual(viajes(estado).map((v) => v.comentario), ['Roma', 'París', 'Costa Rica']);
});

test('el orden manda sobre el importe', () => {
  // Costa Rica es nueve veces más caro y va abajo igual: lo que ordena es cuándo
  // terminó, no cuánto salió.
  let estado = estadoCon([
    mov({ monto: '900', rubro: 'viajes', fecha: '2026-01-10', comentario: 'Costa Rica' }),
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-07-10', comentario: 'Roma' }),
  ]);
  estado = fijarFechasDeViaje(estado, 'costa rica', '2026-01-05', '2026-01-20');
  estado = fijarFechasDeViaje(estado, 'roma', '2026-07-01', '2026-07-12');

  assert.deepEqual(viajes(estado).map((v) => v.comentario), ['Roma', 'Costa Rica']);
});

test('un viaje sin fechas se ordena por su último gasto', () => {
  // Sin esta regla, todos los viajes sin fechas se amontonarían en una punta de
  // la lista, lejos de cuando de verdad pasaron.
  let estado = estadoCon([
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-01-10', comentario: 'Viejo' }),
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-07-10', comentario: 'Nuevo' }),
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-04-10', comentario: 'Medio' }),
  ]);
  estado = fijarFechasDeViaje(estado, 'medio', '2026-04-01', '2026-04-15');

  assert.deepEqual(viajes(estado).map((v) => v.comentario), ['Nuevo', 'Medio', 'Viejo']);
});

test('las fechas escritas mandan sobre las de los gastos para ordenar', () => {
  // Un viaje cuyos gastos se cargaron tarde —el hotel se paga a la vuelta— no
  // tiene por qué aparecer como el más reciente.
  let estado = estadoCon([
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-08-01', comentario: 'Enero' }),
    mov({ monto: '100', rubro: 'viajes', fecha: '2026-07-10', comentario: 'Julio' }),
  ]);
  estado = fijarFechasDeViaje(estado, 'enero', '2026-01-05', '2026-01-20');
  estado = fijarFechasDeViaje(estado, 'julio', '2026-07-01', '2026-07-12');

  assert.deepEqual(viajes(estado).map((v) => v.comentario), ['Julio', 'Enero']);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('el número grande es el total del viaje', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);
  assert.match(html, /class="importe">450,00/);
});

test('sin fechas, en vez de un promedio inventado hay un botón para escribirlas', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);

  assert.ok(html.includes('¿Cuándo fue?'));
  assert.ok(html.includes('data-accion="fechas-viaje"'));
  assert.equal(html.includes('por día'), false, 'no puede haber un gasto por día sin fechas');
});

test('con fechas, se muestra el gasto por día y las fechas para cambiarlas', () => {
  const html = dibujarViaje(viajes(fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10'))[0]);

  assert.ok(html.includes('45,00'));
  assert.ok(html.includes('por día'));
  assert.ok(html.includes('en 10 días'));
  assert.ok(html.includes('01/07/2026'), 'el botón para cambiar muestra las fechas');
});

test('un día en singular se escribe en singular', () => {
  const html = dibujarViaje(viajes(fijarFechasDeViaje(ROMA(), 'roma', '2026-07-03', '2026-07-03'))[0]);
  assert.ok(html.includes('en 1 día'));
  assert.equal(html.includes('en 1 días'), false);
});

test('el viaje lleva a sus gastos', () => {
  const html = dibujarViaje(viajes(ROMA())[0]);
  assert.ok(html.includes('data-accion="ver-comentario"'));
  assert.ok(html.includes('data-comentario="Roma"'));
});

test('el formulario de fechas explica por qué se escriben', () => {
  const html = dibujarFechasDeViaje({ estado: ROMA(), viajeEditado: 'roma' });

  assert.ok(html.includes('03/07/2026'), 'no dice entre qué fechas se gastó');
  assert.ok(html.includes('no se deducen'), 'no explica por qué se piden');
  assert.ok(html.includes('No me acuerdo cuándo fue'), 'no se puede volver atrás');
  assert.ok(html.includes('name="desde"') && html.includes('name="hasta"'));
});

test('el formulario muestra LA CUENTA HECHA antes de guardar', () => {
  // Es lo que convierte dos fechas en el dato que interesa sin pedir confianza.
  const html = dibujarFechasDeViaje({
    estado: ROMA(), viajeEditado: 'roma',
    borradorFechas: { desde: '2026-07-01', hasta: '2026-07-10' },
  });

  assert.ok(html.includes('Son 10 días'));
});

test('la cuenta de días avisa antes de dejar guardar un rango dado vuelta', () => {
  assert.match(dibujarDuracion('2026-07-10', '2026-07-01'), /no puede terminar antes/);
  assert.match(dibujarDuracion('2026-07-01', ''), /Escribí las dos fechas/);
  assert.match(dibujarDuracion('', ''), /Escribí las dos fechas/);
  assert.match(dibujarDuracion('2026-07-03', '2026-07-03'), /Son 1 día,/);
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

test('editando las fechas no se muestra también la lista', () => {
  const html = dibujarViajes({ estado: ROMA(), viajeEditado: 'roma' });

  assert.ok(html.includes('data-formulario="fechas-viaje"'));
  assert.equal(html.includes('<ul class="rubros">'), false);
});

test('un rango de un solo día se escribe con una sola fecha', () => {
  assert.equal(dibujarFechas({ desde: '2026-07-03', hasta: '2026-07-03' }), '03/07/2026');
  assert.equal(dibujarFechas({ desde: '2026-07-03', hasta: '2026-07-09' }), '03/07/2026 → 09/07/2026');
  assert.equal(dibujarRango('2026-07-03', '2026-07-09'), '03/07/2026 → 09/07/2026');
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

test('intentarBorrarFechas deja el estado sin esas fechas', () => {
  const conFechas = fijarFechasDeViaje(ROMA(), 'roma', '2026-07-01', '2026-07-10');
  const { estado } = intentarBorrarFechas(conFechas, 'roma');

  assert.equal(fechasDeViaje(estado, 'roma'), null);
});

test('intentarFijarFechas devuelve el error en vez de tirar', () => {
  // La pantalla tiene que poder mostrarlo. Una excepción sin atrapar deja la app
  // en blanco, que para el usuario es lo mismo que perder los datos.
  const { estado, error } = intentarFijarFechas(ROMA(), 'roma', '2026-07-10', '2026-07-01');

  assert.equal(estado, undefined);
  assert.match(error, /terminar antes de empezar/);
});
