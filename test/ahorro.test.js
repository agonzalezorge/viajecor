// T-045 — Tests de cargar, corregir y borrar un movimiento de ahorro (CU-14).
//
// La pantalla de ahorros era de solo lectura: se llenaba importando la planilla
// y nada más. O sea que para anotar un ahorro nuevo había que escribirlo en el
// Excel y volver a importar — exactamente lo que la app vino a reemplazar.
//
// Lo que se prueba acá no es que el formulario dibuje bien: es que **se comporte
// igual que el de gastos**. Dos pantallas parecidas con mecánicas distintas
// obligan a aprender la app dos veces.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  borradorDeAhorro, borradorDesdeAhorro, intentarGuardarAhorro,
  borrarAhorro, restaurarAhorro, buscarAhorro, etiquetasDeAhorros,
  dibujarNuevoAhorro,
} from '../src/ui/pantallas/ahorro.js';
import { dibujarMovimientoDeAhorro, dibujarDeshacerAhorro, dibujarAhorros } from '../src/ui/pantallas/ahorros.js';
import { AHORRO_ENTRA, AHORRO_SALE, totalPorMoneda } from '../src/core/ahorros.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

const MONEDAS = monedasIniciales();
const estadoCon = (ahorros = []) => ({ ...estadoInicial({ monedas: MONEDAS }), ahorros });

const cargar = (estado, cambios) => intentarGuardarAhorro(estado, {
  ...borradorDeAhorro({ estado }), fecha: '2026-05-01', monto: '100', ...cambios,
});


// ── Cargar ───────────────────────────────────────────────────────────────────

test('el formulario arranca con la fecha de hoy y con "entró"', () => {
  const borrador = borradorDeAhorro({ estado: estadoCon() });
  assert.equal(borrador.tipo, AHORRO_ENTRA);
  assert.match(borrador.fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(borrador.persona, 'ALE');
});

test('cargar un ahorro lo agrega al estado, sin tocar los movimientos', () => {
  const estado = { ...estadoCon(), movimientos: [{ id: 'm1' }] };
  const { estado: nuevo, error } = cargar(estado, { monto: '1500,50', moneda: 'USD', comentario: 'Regalos' });

  assert.equal(error, undefined);
  assert.equal(nuevo.ahorros.length, 1);
  assert.equal(nuevo.ahorros[0].monto, 150050);
  assert.deepEqual(nuevo.movimientos, [{ id: 'm1' }], 'los gastos no se tocan');
});

test('el formulario se vacía pero conserva la fecha y la persona', () => {
  // Quien anota los ahorros del mes carga varios seguidos, casi siempre del
  // mismo lado y del mismo día.
  const { borrador } = cargar(estadoCon(), { fecha: '2026-03-15', persona: 'IRE', monto: '10' });

  assert.equal(borrador.monto, '');
  assert.equal(borrador.comentario, '');
  assert.equal(borrador.fecha, '2026-03-15');
  assert.equal(borrador.persona, 'IRE');
});

test('NO se pide tipo de cambio, a diferencia de los gastos', () => {
  // Es la misma regla de siempre vista del otro lado: los ahorros no se
  // convierten a euros nunca, así que no hay ningún total del que puedan
  // quedar afuera. Pedir un dato que no se va a usar es pedirlo porque sí.
  const { estado, error } = cargar(estadoCon(), { moneda: 'UYU', monto: '40000' });

  assert.equal(error, undefined);
  assert.equal(estado.ahorros.length, 1);
  assert.equal(estado.tipos_cambio.length, 0);
});

test('lo que el modelo rechaza no se guarda, y no se pierde lo escrito', () => {
  const estado = estadoCon();
  const { estado: mismo, borrador, error } = cargar(estado, { monto: '0', comentario: 'Regalos' });

  assert.match(error, /cero no se guarda/);
  assert.equal(mismo, estado, 'el estado vuelve tal cual');
  assert.equal(borrador.comentario, 'Regalos', 'lo escrito sigue ahí');
});

test('una moneda que no está en el catálogo se explica, no se traga', () => {
  const { error } = cargar(estadoCon(), { moneda: 'JPY' });
  assert.match(error, /no está en tu lista/);
});

test('la moneda elegida queda como predeterminada para la próxima', () => {
  const { estado } = cargar(estadoCon(), { moneda: 'USD' });
  assert.equal(estado.preferencias.moneda_predeterminada, 'USD');
});


// ── Corregir ─────────────────────────────────────────────────────────────────

test('corregir cambia el movimiento y NO crea uno nuevo', () => {
  const { estado } = cargar(estadoCon(), { monto: '100', comentario: 'Regalos' });
  const original = estado.ahorros[0];

  const { estado: corregido, corrigiendo } = intentarGuardarAhorro(estado, {
    ...borradorDesdeAhorro(original, 2), monto: '160', persona: 'IRE',
  });

  assert.equal(corrigiendo, true);
  assert.equal(corregido.ahorros.length, 1);
  assert.equal(corregido.ahorros[0].monto, 16000);
  assert.equal(corregido.ahorros[0].persona, 'IRE');
  assert.equal(corregido.ahorros[0].id, original.id, 'es el mismo movimiento');
  assert.equal(corregido.ahorros[0].creado, original.creado, 'y conserva cuándo entró');
});

test('el formulario de corregir vuelve el monto a como se escribe en español', () => {
  // Si volviera "1500.5", el usuario vería su movimiento escrito de una forma
  // en la que él nunca lo escribiría.
  const { estado } = cargar(estadoCon(), { monto: '1500,50', moneda: 'USD' });
  assert.equal(borradorDesdeAhorro(estado.ahorros[0], 2).monto, '1500,50');
});

test('corregir mantiene el orden de la lista', () => {
  let estado = cargar(estadoCon(), { monto: '1', comentario: 'uno' }).estado;
  estado = cargar(estado, { monto: '2', comentario: 'dos' }).estado;
  estado = cargar(estado, { monto: '3', comentario: 'tres' }).estado;

  const { estado: corregido } = intentarGuardarAhorro(estado, {
    ...borradorDesdeAhorro(estado.ahorros[1], 2), monto: '20',
  });

  assert.deepEqual(corregido.ahorros.map((a) => a.comentario), ['uno', 'dos', 'tres']);
  assert.equal(corregido.ahorros[1].monto, 2000);
});


// ── Borrar y deshacer ────────────────────────────────────────────────────────

test('borrar saca el movimiento y guarda con qué deshacerlo', () => {
  const { estado } = cargar(estadoCon(), { monto: '100', comentario: 'Regalos' });
  const { estado: sinEl, borrado } = borrarAhorro(estado, estado.ahorros[0].id);

  assert.deepEqual(sinEl.ahorros, []);
  assert.equal(borrado.ahorro.comentario, 'Regalos');
  assert.equal(borrado.posicion, 0);
});

test('deshacer lo devuelve a su lugar exacto, no al final', () => {
  let estado = cargar(estadoCon(), { monto: '1', comentario: 'uno' }).estado;
  estado = cargar(estado, { monto: '2', comentario: 'dos' }).estado;
  estado = cargar(estado, { monto: '3', comentario: 'tres' }).estado;

  const { estado: sinEl, borrado } = borrarAhorro(estado, estado.ahorros[1].id);
  const vuelto = restaurarAhorro(sinEl, borrado);

  assert.deepEqual(vuelto.ahorros.map((a) => a.comentario), ['uno', 'dos', 'tres']);
});

test('borrar algo que no está no rompe nada', () => {
  const estado = estadoCon();
  assert.deepEqual(borrarAhorro(estado, 'no-existe'), { estado, borrado: null });
  assert.equal(restaurarAhorro(estado, null), estado);
});

test('borrar cambia los totales, y deshacer los devuelve', () => {
  const { estado } = cargar(estadoCon(), { monto: '100', moneda: 'EUR' });
  const { estado: sinEl, borrado } = borrarAhorro(estado, estado.ahorros[0].id);

  assert.deepEqual(totalPorMoneda(sinEl), []);
  assert.equal(totalPorMoneda(restaurarAhorro(sinEl, borrado))[0].total, 10000);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('cada movimiento trae Corregir y Borrar', () => {
  const { estado } = cargar(estadoCon(), { monto: '100', comentario: 'Regalos' });
  const html = dibujarMovimientoDeAhorro(estado.ahorros[0], MONEDAS);

  assert.match(html, /data-accion="editar-ahorro"/);
  assert.match(html, /data-accion="borrar-ahorro"/);
});

test('borrar pregunta antes: es plata', () => {
  const { estado } = cargar(estadoCon(), { monto: '100' });
  const html = dibujarMovimientoDeAhorro(estado.ahorros[0], MONEDAS, { confirmando: true });

  assert.match(html, /¿Borrar este movimiento de ahorro\?/);
  assert.match(html, /data-accion="borrar-ahorro-si"/);
  assert.doesNotMatch(html, /data-accion="borrar-ahorro"[^-]/, 'no se ofrecen las dos cosas a la vez');
});

test('después de borrar se ofrece deshacer, diciendo qué se borró', () => {
  const html = dibujarDeshacerAhorro({
    ahorroBorrado: { ahorro: { comentario: 'Vuelos Roma', fecha: '2025-10-20' }, posicion: 0 },
  });

  assert.match(html, /Vuelos Roma/);
  assert.match(html, /20\/10\/2025/);
  assert.match(html, /data-accion="deshacer-ahorro"/);
});

test('sin nada borrado, no hay cartel de deshacer', () => {
  assert.equal(dibujarDeshacerAhorro({}), '');
});

test('la pantalla ofrece cargar, incluso cuando todavía no hay nada', () => {
  for (const estado of [estadoCon(), cargar(estadoCon(), { monto: '10' }).estado]) {
    assert.match(dibujarAhorros({ estado }), /data-pantalla="nuevo-ahorro"/);
  }
});

test('el formulario dice "Entró" y "Salió", no "Ingreso" y "Gasto"', () => {
  // Acá la plata no entra ni sale de la casa: entra o sale DEL AHORRO. Un
  // ahorro usado para pagar un vuelo no es un ingreso de nada.
  const html = dibujarNuevoAhorro({ estado: estadoCon() });

  assert.match(html, /Entró al ahorro/);
  assert.match(html, /Salió del ahorro/);
  assert.doesNotMatch(html, />Ingreso</);
});

test('el formulario ofrece las dos personas y las monedas visibles', () => {
  const html = dibujarNuevoAhorro({ estado: estadoCon() });

  assert.match(html, /<option value="ALE"/);
  assert.match(html, /<option value="IRE"/);
  assert.match(html, /<option value="EUR"/);
});

test('al corregir, el formulario lo dice y trae los datos cargados', () => {
  const { estado } = cargar(estadoCon(), { monto: '1500,50', moneda: 'USD', persona: 'IRE' });
  const html = dibujarNuevoAhorro({
    estado, borradorDeAhorro: borradorDesdeAhorro(estado.ahorros[0], 2),
  });

  assert.match(html, /Corregir movimiento de ahorro/);
  assert.match(html, /value="1500,50"/);
  assert.match(html, /<option value="IRE" selected/);
  assert.match(html, /Guardar los cambios/);
});

test('las etiquetas ya usadas se ofrecen al escribir', () => {
  // Es lo que agrupa (RN-03): ofrecer las que ya existen es la forma más barata
  // de que el usuario elija la escritura que ya tiene en vez de inventar otra.
  let estado = cargar(estadoCon(), { monto: '1', comentario: 'Para viajes' }).estado;
  estado = cargar(estado, { monto: '2', comentario: 'para viajes' }).estado;
  estado = cargar(estado, { monto: '3', comentario: 'Regalos' }).estado;

  assert.deepEqual(etiquetasDeAhorros(estado), ['Para viajes', 'Regalos']);
});

test('buscarAhorro encuentra por id, y no inventa si no está', () => {
  const { estado } = cargar(estadoCon(), { monto: '100' });
  assert.equal(buscarAhorro(estado, estado.ahorros[0].id).monto, 10000);
  assert.equal(buscarAhorro(estado, 'no-existe'), null);
});
