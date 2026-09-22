// T-072 — Tests de "Mis ahorros" (CU-22).
//
// ── Lo que hay que sostener acá ─────────────────────────────────────────────
//
// Tres cosas, y las tres son las mismas que sostienen los ahorros conjuntos,
// porque es el mismo tipo de registro:
//
//   1. **Ningún total junta monedas.** Sumar dólares con euros exige
//      convertirlos, y esa conversión inventa un número que cambia solo.
//   2. **Es un historial, no una foto.** Lo que entró suma, lo que salió resta,
//      y el total sale de recorrer TODO — nunca un límite de filas (L-001).
//   3. **Agrupar normaliza.** Es lo único que hace viable la cuenta escrita a
//      mano: "Santander" y "santander " son la misma cuenta (RN-03, L-002).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  crearMiAhorro, misAhorrosOrdenados, totalPorMonedaMio, totalPorCuenta,
  cuentasDe, cuentasUsadas, buscarMiAhorro, buscarEnMisAhorros, misAhorrosDe,
} from '../src/core/mis-ahorros.js';
import { AHORRO_ENTRA, AHORRO_SALE } from '../src/core/ahorros.js';
import {
  borradorDeMiAhorro, borradorDesdeMiAhorro, intentarGuardarMiAhorro,
  borrarMiAhorro, restaurarMiAhorro, dibujarMisAhorros, dibujarNuevoMiAhorro,
  dibujarMovimientoMio, dibujarDeshacerMiAhorro,
} from '../src/ui/pantallas/mis-ahorros.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

const MONEDAS = monedasIniciales();
const vacio = () => estadoInicial({ monedas: MONEDAS });

const cargar = (estado, cambios) => intentarGuardarMiAhorro(estado, {
  ...borradorDeMiAhorro({ estado }), fecha: '2026-05-01', monto: '100', cuenta: 'Santander', ...cambios,
});

/** Carga varios seguidos y devuelve el estado final. */
const conMovimientos = (lista) => lista.reduce((estado, cambios) => {
  const { estado: nuevo, error } = cargar(estado, cambios);
  assert.equal(error, undefined, error);
  return nuevo;
}, vacio());


// ── Cargar ───────────────────────────────────────────────────────────────────

test('un movimiento se guarda con su cuenta, su monto en unidades mínimas y su moneda', () => {
  const { estado, error } = cargar(vacio(), { monto: '1.500,50', cuenta: 'Revolut', moneda: 'EUR' });

  assert.equal(error, undefined);
  const [guardado] = misAhorrosDe(estado);
  assert.equal(guardado.cuenta, 'Revolut');
  assert.equal(guardado.monto, 150050, 'el dinero va en enteros, nunca en decimales');
  assert.equal(guardado.moneda, 'EUR');
  assert.equal(guardado.tipo, AHORRO_ENTRA);
});

test('sin decir dónde está, no se guarda', () => {
  // Es el sentido entero de la pantalla: "en algún lado" no es una respuesta.
  const { error, estado } = cargar(vacio(), { cuenta: '   ' });

  assert.match(error, /Falta decir dónde está/);
  assert.equal(misAhorrosDe(estado).length, 0);
});

test('un movimiento de cero no se guarda', () => {
  assert.match(cargar(vacio(), { monto: '0' }).error, /no hay nada que registrar/);
});

test('sin saber los decimales de la moneda, se niega a adivinar', () => {
  // Guardar sin ese dato dejaría el monto cien veces más grande o más chico.
  assert.throws(() => crearMiAhorro({ cuenta: 'X', tipo: AHORRO_ENTRA, monto: '1', fecha: '2026-05-01', moneda: 'EUR' }),
    /cien veces más grande o más chico/);
});

test('la cuenta se guarda como se escribió, con sus mayúsculas', () => {
  const { estado } = cargar(vacio(), { cuenta: '  Banco   República  ' });

  assert.equal(misAhorrosDe(estado)[0].cuenta, 'Banco República', 'se limpian los espacios, no las mayúsculas');
});

test('corregir cambia el movimiento y no crea uno nuevo', () => {
  const estado = conMovimientos([{ monto: '100' }]);
  const original = misAhorrosDe(estado)[0];

  const { estado: corregido } = intentarGuardarMiAhorro(estado, {
    ...borradorDesdeMiAhorro(original, 2), monto: '250',
  });

  assert.equal(misAhorrosDe(corregido).length, 1);
  assert.equal(misAhorrosDe(corregido)[0].monto, 25000);
  assert.equal(misAhorrosDe(corregido)[0].id, original.id, 'es el mismo movimiento, no uno nuevo');
});

test('después de cargar, el formulario conserva la cuenta y la fecha', () => {
  // Quien pone al día una cuenta carga varios seguidos del mismo lado.
  const { borrador } = cargar(vacio(), { cuenta: 'Revolut', fecha: '2026-04-09' });

  assert.equal(borrador.cuenta, 'Revolut');
  assert.equal(borrador.fecha, '2026-04-09');
  assert.equal(borrador.monto, '', 'pero el monto se vacía');
});


// ── Los totales ──────────────────────────────────────────────────────────────

test('lo que entró suma y lo que salió resta', () => {
  const estado = conMovimientos([
    { monto: '1000' },
    { monto: '400', tipo: AHORRO_SALE },
  ]);

  assert.deepEqual(totalPorMonedaMio(estado).map((b) => [b.moneda, b.total]), [['EUR', 60000]]);
});

test('cada moneda va por su lado y ningún total las junta', () => {
  // Es la regla que hace distinto a este registro. Si algún día aparece un
  // total general, es porque alguien convirtió sin que el usuario lo pidiera.
  const estado = conMovimientos([
    { monto: '100', moneda: 'EUR' },
    { monto: '5000', moneda: 'UYU' },
  ]);

  const totales = totalPorMonedaMio(estado);
  assert.equal(totales.length, 2);
  assert.ok(!Object.hasOwn(totales, 'total'), 'no hay ningún total de todo');
});

test('el total recorre TODOS los movimientos, sin ningún límite de filas', () => {
  // L-001: así es como la planilla original miente en silencio.
  const estado = conMovimientos(Array.from({ length: 120 }, () => ({ monto: '10' })));

  assert.equal(totalPorMonedaMio(estado)[0].total, 120 * 1000);
});

test('cuánto hay en cada cuenta, dentro de cada moneda', () => {
  const estado = conMovimientos([
    { monto: '1000', cuenta: 'Santander' },
    { monto: '300', cuenta: 'Revolut' },
    { monto: '200', cuenta: 'Santander', tipo: AHORRO_SALE },
  ]);

  const [eur] = totalPorCuenta(estado);
  assert.equal(eur.total, 110000);
  assert.deepEqual(eur.cuentas.map((c) => [c.cuenta, c.total]), [['Santander', 80000], ['Revolut', 30000]]);
});

test('una cuenta de otra moneda no aparece en la moneda que no usa', () => {
  // La lista de cuentas es abierta: mostrarlas todas en todas las monedas
  // llenaría la pantalla de ceros que no dicen nada.
  const estado = conMovimientos([
    { monto: '100', moneda: 'EUR', cuenta: 'Santander' },
    { monto: '5000', moneda: 'UYU', cuenta: 'Brou' },
  ]);

  for (const bloque of totalPorCuenta(estado)) {
    assert.equal(bloque.cuentas.length, 1, `${bloque.moneda} muestra cuentas que no son suyas`);
  }
});

test('una cuenta que quedó en cero se sigue mostrando', () => {
  // Que la hayas vaciado es información. Una fila que desaparece se lee como
  // que nunca existió.
  const estado = conMovimientos([
    { monto: '100', cuenta: 'Revolut' },
    { monto: '100', cuenta: 'Revolut', tipo: AHORRO_SALE },
  ]);

  assert.deepEqual(totalPorCuenta(estado)[0].cuentas, [{ cuenta: 'Revolut', total: 0 }]);
});


// ── Agrupar normaliza (RN-03) ────────────────────────────────────────────────

test('"Santander" y "santander " son la misma cuenta', () => {
  // Es lo único que hace viable escribir la cuenta a mano en vez de elegirla.
  const estado = conMovimientos([
    { monto: '100', cuenta: 'Santander' },
    { monto: '50', cuenta: '  santander ' },
  ]);

  const [eur] = totalPorCuenta(estado);
  assert.equal(eur.cuentas.length, 1, 'quedaron dos cuentas donde el usuario ve una');
  assert.deepEqual(eur.cuentas[0], { cuenta: 'Santander', total: 15000 });
});

test('y la forma que se muestra es la primera que se escribió', () => {
  assert.deepEqual(cuentasDe([{ cuenta: 'Revolut' }, { cuenta: 'REVOLUT' }]), ['Revolut']);
});

test('las tildes cuentan: "Bancó" no es "Banco"', () => {
  // Normalizar es para mayúsculas y espacios, no para volver igual lo distinto.
  assert.equal(cuentasDe([{ cuenta: 'Banco' }, { cuenta: 'Bancó' }]).length, 2);
});

test('las cuentas usadas salen ordenadas, para sugerirlas', () => {
  const estado = conMovimientos([
    { monto: '1', cuenta: 'Revolut' },
    { monto: '1', cuenta: 'Brou' },
    { monto: '1', cuenta: 'Santander' },
  ]);

  assert.deepEqual(cuentasUsadas(estado), ['Brou', 'Revolut', 'Santander']);
});


// ── Historial, borrar y deshacer ─────────────────────────────────────────────

test('el historial va del más nuevo al más viejo', () => {
  const estado = conMovimientos([
    { monto: '1', fecha: '2026-01-10' },
    { monto: '2', fecha: '2026-03-05' },
    { monto: '3', fecha: '2026-02-01' },
  ]);

  assert.deepEqual(misAhorrosOrdenados(estado).map((m) => m.fecha),
    ['2026-03-05', '2026-02-01', '2026-01-10']);
});

test('entre dos del mismo día, primero el último cargado', () => {
  // Lo último que anotaste es lo que vas a querer corregir.
  const estado = conMovimientos([
    { monto: '1', fecha: '2026-03-05', cuenta: 'Primero' },
    { monto: '2', fecha: '2026-03-05', cuenta: 'Segundo' },
  ]);

  assert.deepEqual(misAhorrosOrdenados(estado).map((m) => m.cuenta), ['Segundo', 'Primero']);
});

test('borrar saca el movimiento, y deshacer lo devuelve a su lugar exacto', () => {
  const estado = conMovimientos([
    { monto: '1', cuenta: 'A' }, { monto: '2', cuenta: 'B' }, { monto: '3', cuenta: 'C' },
  ]);
  const delMedio = misAhorrosDe(estado)[1];

  const { estado: sinEl, borrado } = borrarMiAhorro(estado, delMedio.id);
  assert.deepEqual(misAhorrosDe(sinEl).map((m) => m.cuenta), ['A', 'C']);

  assert.deepEqual(misAhorrosDe(restaurarMiAhorro(sinEl, borrado)).map((m) => m.cuenta), ['A', 'B', 'C']);
});

test('borrar algo que no existe no rompe ni toca nada', () => {
  const estado = conMovimientos([{ monto: '1' }]);
  const { estado: igual, borrado } = borrarMiAhorro(estado, 'no-existe');

  assert.equal(borrado, null);
  assert.equal(misAhorrosDe(igual).length, 1);
  assert.equal(restaurarMiAhorro(estado, null), estado);
});

test('se busca por cuenta y por detalle, sin tildes ni mayúsculas', () => {
  const estado = conMovimientos([
    { monto: '1', cuenta: 'Banco República', detalle: 'plazo fijo' },
    { monto: '2', cuenta: 'Revolut', detalle: 'sueldo' },
  ]);

  assert.deepEqual(buscarEnMisAhorros(estado, 'republica').map((m) => m.cuenta), ['Banco República']);
  assert.deepEqual(buscarEnMisAhorros(estado, 'PLAZO').map((m) => m.cuenta), ['Banco República']);
  assert.equal(buscarEnMisAhorros(estado, '').length, 2);
});

test('se busca uno por su identificador', () => {
  const estado = conMovimientos([{ monto: '1' }]);
  const guardado = misAhorrosDe(estado)[0];

  assert.equal(buscarMiAhorro(estado, guardado.id), guardado);
  assert.equal(buscarMiAhorro(estado, 'no-existe'), null);
});


// ── Lo que se guarda y se respalda ───────────────────────────────────────────

test('los movimientos viajan en el respaldo', () => {
  const estado = conMovimientos([{ monto: '100', cuenta: 'Revolut' }]);
  const vuelto = migrarEstado(JSON.parse(JSON.stringify(estado)));

  assert.deepEqual(misAhorrosDe(vuelto), misAhorrosDe(estado));
});

test('un registro roto se descarta solo, sin llevarse a los demás', () => {
  // Perder un movimiento es molesto; perder los otros sesenta por culpa de ese,
  // no. Es la misma regla que los ahorros conjuntos.
  const incidencias = [];
  const estado = migrarEstado({
    mis_ahorros: [
      { id: 'a', fecha: '2026-05-01', cuenta: 'Revolut', tipo: 'I', monto: 1000, moneda: 'EUR' },
      { id: 'b', fecha: '2026-05-02', cuenta: '', tipo: 'I', monto: 1000, moneda: 'EUR' },
      { id: 'c', fecha: '2026-05-03', cuenta: 'Brou', tipo: 'X', monto: 1000, moneda: 'EUR' },
      { id: 'd', fecha: '2026-05-04', cuenta: 'Brou', tipo: 'I', monto: 0, moneda: 'EUR' },
    ],
  }, incidencias);

  assert.deepEqual(misAhorrosDe(estado).map((m) => m.id), ['a']);
  const dicho = incidencias.filter((i) => i.includes('mis ahorros'));
  assert.equal(dicho.length, 1, 'y lo dice, en vez de tragárselo');
  assert.match(dicho[0], /3 registros de mis ahorros no se pudieron leer/);
});

test('un estado sin la clave no rompe nada: es todo respaldo anterior a T-072', () => {
  const estado = migrarEstado({ movimientos: [] });

  assert.deepEqual(misAhorrosDe(estado), []);
  assert.deepEqual(totalPorCuenta(estado), []);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('vacía, explica para qué es y ofrece cargar', () => {
  const html = dibujarMisAhorros({ estado: vacio() });

  assert.match(html, /Mis ahorros/);
  assert.match(html, /data-pantalla="nuevo-mi-ahorro"/);
});

test('con datos, muestra cada moneda con sus cuentas y dice que no se suman', () => {
  const estado = conMovimientos([
    { monto: '1000', cuenta: 'Santander', moneda: 'EUR' },
    { monto: '5000', cuenta: 'Brou', moneda: 'UYU' },
  ]);
  const html = dibujarMisAhorros({ estado });

  assert.match(html, /Santander/);
  assert.match(html, /Brou/);
  assert.match(html, /No se suman entre sí/);
});

test('el signo dice si entró o salió, y el color acompaña', () => {
  const [entrada] = misAhorrosDe(conMovimientos([{ monto: '100' }]));
  const [salida] = misAhorrosDe(conMovimientos([{ monto: '100', tipo: AHORRO_SALE }]));

  assert.match(dibujarMovimientoMio(entrada, MONEDAS), /importe ingreso">\+/);
  assert.match(dibujarMovimientoMio(salida, MONEDAS), /importe gasto">−/);
});

test('el formulario pregunta dónde está y sugiere las cuentas ya usadas', () => {
  const estado = conMovimientos([{ monto: '1', cuenta: 'Revolut' }]);
  const html = dibujarNuevoMiAhorro({ estado });

  assert.match(html, /¿Dónde está\?/);
  assert.match(html, /Revolut/);
  assert.match(html, /Entró a la cuenta/);
  assert.match(html, /Salió de la cuenta/);
});

test('el formulario no pide tipo de cambio ni rubro: acá no existen', () => {
  const html = dibujarNuevoMiAhorro({ estado: vacio() });

  assert.doesNotMatch(html, /name="rubro"/);
  assert.doesNotMatch(html, /cotización/i);
});

test('el cartel de deshacer nombra la cuenta que se borró', () => {
  const [movimiento] = misAhorrosDe(conMovimientos([{ monto: '1', cuenta: 'Revolut' }]));
  const html = dibujarDeshacerMiAhorro({ miAhorroBorrado: { movimiento, posicion: 0 } });

  assert.match(html, /Revolut/);
  assert.match(html, /data-accion="deshacer-mi-ahorro"/);
});

test('sin nada borrado, no hay cartel', () => {
  assert.equal(dibujarDeshacerMiAhorro({}), '');
});
