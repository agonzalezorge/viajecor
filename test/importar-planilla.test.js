// T-032 · Importar la planilla.
//
// Esto se corre **una sola vez**, sobre once meses que no están en ningún otro
// lado. Casi todos los tests de acá prueban que una fila rara **no entre** y que
// se explique por qué: importar de más en silencio es peor que no importar, y
// después de importar la planilla se archiva y no queda con qué comparar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  interpretarFila, interpretarPlanilla, esFilaDeDatos, idDeFila, comprobar,
} from '../src/datos/importar-planilla.js';
import { leerPlanilla } from '../src/datos/planilla.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// El 1 de marzo de 2026 y el 1 de abril de 2026, como los guarda Excel.
const MARZO = 46082;
const ABRIL = 46113;
const FEB_2026 = 46054;
const FEB_2024 = 45323;

/** Una fila de la planilla, como la devuelve el lector. */
function fila({ dia = 2, mes = MARZO, rubro = 'supermercado', monto = 54.3, tipo = 'G',
                comentario = '', detalle = '', acumulado } = {}) {
  const celdas = new Map();
  // `null` es "esta celda no está". No se usa `undefined`: en JavaScript activa
  // el valor por omisión del parámetro, así que pedir una fila SIN monto
  // devolvía una fila CON el monto de siempre — y dos tests pasaban por el
  // motivo equivocado.
  const poner = (col, valor, esFecha = false) => {
    if (valor !== undefined && valor !== null && valor !== '') celdas.set(col, { valor, esFecha });
  };
  poner('A', acumulado);
  poner('B', comentario);
  poner('C', dia);
  poner('D', mes, true);
  poner('E', detalle);
  poner('F', rubro);
  poner('G', monto);
  poner('H', tipo);
  return celdas;
}

// ── Qué es una fila de datos (§2 del mapeo) ──────────────────────────────────

test('una fila con día y rubro es un dato', () => {
  assert.equal(esFilaDeDatos(fila()), true);
});

test('el título del mes, los encabezados y las filas vacías no lo son', () => {
  // Se pregunta qué SÍ es un dato en vez de qué hay que saltear: reconocer los
  // títulos por su texto obliga a acertar la lista completa de lo que se ignora.
  const soloA = (valor) => new Map([['A', { valor }]]);

  assert.equal(esFilaDeDatos(soloA('AGOSTO 2026')), false);
  assert.equal(esFilaDeDatos(soloA('INGRESOS Y GASTOS')), false);
  assert.equal(esFilaDeDatos(new Map()), false);
});

test('la fila de encabezados no es un dato: su "DÍA" es texto', () => {
  const encabezados = new Map([
    ['A', { valor: 'G/Acum./Mes' }], ['C', { valor: 'DÍA' }], ['F', { valor: 'RUBRO' }],
  ]);

  assert.equal(esFilaDeDatos(encabezados), false);
});

test('una celda suelta de referencia no es un dato', () => {
  // El usuario tenía un 49,5 al costado de los gráficos: el tipo de cambio del
  // peso uruguayo, anotado a mano.
  assert.equal(esFilaDeDatos(new Map([['J', { valor: 49.5 }]])), false);
});

test('un día fuera de rango no es un dato', () => {
  assert.equal(esFilaDeDatos(fila({ dia: 0 })), false);
  assert.equal(esFilaDeDatos(fila({ dia: 32 })), false);
  assert.equal(esFilaDeDatos(fila({ dia: 1.5 })), false);
});

// ── Lo que entra ─────────────────────────────────────────────────────────────

test('una fila normal se convierte en un movimiento', () => {
  const { movimiento, problema } = interpretarFila(6, fila({ comentario: 'Mercadona' }));

  assert.equal(problema, undefined);
  assert.equal(movimiento.fecha, '2026-03-02');
  assert.equal(movimiento.tipo, 'G');
  assert.equal(movimiento.rubro, 'supermercado');
  assert.equal(movimiento.monto, 5430);
  assert.equal(movimiento.moneda, 'EUR');
  assert.equal(movimiento.comentario, 'Mercadona');
});

test('el rubro y el tipo se normalizan', () => {
  // La planilla tiene las mayúsculas inconsistentes de haberse escrito a mano
  // durante meses (RN-03).
  const { movimiento } = interpretarFila(6, fila({ rubro: '  SUPER MERCADO ', tipo: 'g' }));
  const otro = interpretarFila(7, fila({ rubro: 'COMIDA HECHA', tipo: 'g' }));

  assert.equal(movimiento, undefined, 'un rubro con espacios de más adentro no existe');
  assert.equal(otro.movimiento.rubro, 'comida hecha');
  assert.equal(otro.movimiento.tipo, 'G');
});

test('un ingreso entra como ingreso', () => {
  const { movimiento } = interpretarFila(6, fila({ rubro: 'trabajo', tipo: 'i', monto: 2500 }));

  assert.equal(movimiento.tipo, 'I');
  assert.equal(movimiento.rubro, 'trabajo');
});

test('"otros" es de gasto o de ingreso según la columna I/G', () => {
  // Son cosas distintas que no se mezclan nunca en un total, y lo que las separa
  // es el tipo, no el nombre.
  assert.equal(interpretarFila(6, fila({ rubro: 'otros', tipo: 'G' })).movimiento.tipo, 'G');
  assert.equal(interpretarFila(7, fila({ rubro: 'otros', tipo: 'I' })).movimiento.tipo, 'I');
});

test('un monto de cero no entra, y se distingue de la celda vacía', () => {
  // El modelo no guarda movimientos de cero desde T-003 —«si no hubo dinero de
  // por medio, no hay nada que registrar»—. El mapeo decía lo contrario y este
  // test lo destapó: gana la regla anterior. Lo que aporta el mapeo es que el
  // informe los distinga, porque un 0 escrito a mano casi siempre es una fila a
  // medio cargar.
  const cero = interpretarFila(6, fila({ monto: 0 }));
  const vacio = interpretarFila(7, fila({ monto: null }));

  assert.match(cero.problema.motivo, /es 0/);
  assert.match(vacio.problema.motivo, /está vacío/);
  assert.notEqual(cero.problema.motivo, vacio.problema.motivo);
});

test('el último día de un mes entra', () => {
  assert.equal(interpretarFila(6, fila({ dia: 30, mes: ABRIL })).movimiento.fecha, '2026-04-30');
  assert.equal(interpretarFila(7, fila({ dia: 29, mes: FEB_2024 })).movimiento.fecha, '2024-02-29');
});

// ── Lo que no entra, y por qué ───────────────────────────────────────────────

test('sin monto no entra, y se dice qué decía la fila', () => {
  const { problema } = interpretarFila(1043, fila({ monto: null, detalle: 'alfajores minas' }));

  assert.equal(problema.fila, 1043);
  assert.match(problema.motivo, /monto está vacío/);
  assert.match(problema.decia, /alfajores minas/);
  assert.match(problema.decia, /día 2/);
});

test('un monto que es texto no entra', () => {
  const { problema } = interpretarFila(6, fila({ monto: 'ochenta' }));

  assert.match(problema.motivo, /no es un número/);
  assert.match(problema.motivo, /ochenta/);
});

test('un monto negativo no entra', () => {
  // Podría ser una devolución o un dedazo, y no hay forma de saber cuál.
  // Adivinar el signo de una operación de dinero es lo que no se hace.
  const { problema } = interpretarFila(6, fila({ monto: -15 }));

  assert.match(problema.motivo, /negativo/);
});

test('sin tipo no entra, y NO se supone que es un gasto', () => {
  // Un ingreso importado como gasto mueve el saldo del mes por el DOBLE del
  // importe: no aparece donde suma y aparece donde no debería.
  const { problema } = interpretarFila(6, fila({ tipo: '' }));

  assert.match(problema.motivo, /I\/G está vacía/);
});

test('un tipo raro no entra y dice qué decía', () => {
  const { problema } = interpretarFila(6, fila({ tipo: 'X' }));

  assert.match(problema.motivo, /dice "X"/);
});

test('si el tipo no se entiende, NO se inventa un segundo problema con el rubro', () => {
  // Sin saber el tipo no se sabe contra cuál de las dos listas comparar el
  // rubro. Decir "rubro desconocido" mandaría a arreglar algo que no está roto.
  // Lo destapó aplicar el mapeo a 22 filas raras antes de programar (T-030).
  const { problema } = interpretarFila(6, fila({ tipo: '', rubro: 'viajes' }));

  assert.equal(/rubro/.test(problema.motivo), false, `dijo: ${problema.motivo}`);
});

test('un rubro que no existe no entra, y NO se manda a "otros"', () => {
  // Mandarlo a "otros" lo haría desaparecer dentro de un total que ya existe:
  // se vería bien y estaría mal.
  const { problema } = interpretarFila(6, fila({ rubro: 'mascotas' }));

  assert.match(problema.motivo, /"mascotas" no existe/);
});

test('un rubro de la otra lista lo dice con todas las letras', () => {
  // "supermercado" existe, pero no como ingreso. Decir "rubro desconocido"
  // mandaría a buscar un error de escritura que no está: lo que está mal es la
  // combinación.
  const { problema } = interpretarFila(6, fila({ rubro: 'supermercado', tipo: 'I' }));

  assert.match(problema.motivo, /no es un rubro de ingreso/);
});

test('una fecha que no existe no entra, y no se ajusta al día más cercano', () => {
  // Inventar una fecha que el usuario no escribió es peor que no importar.
  const abril31 = interpretarFila(6, fila({ dia: 31, mes: ABRIL }));
  const febrero29 = interpretarFila(7, fila({ dia: 29, mes: FEB_2026 }));

  assert.match(abril31.problema.motivo, /el día 31 no existe en 2026-04/);
  assert.match(febrero29.problema.motivo, /el día 29 no existe en 2026-02/);
});

test('sin poder leer el mes no entra', () => {
  const { problema } = interpretarFila(6, fila({ mes: 'agosto' }));

  assert.match(problema.motivo, /no se pudo leer el mes/);
});

// ── Los identificadores (§8 del mapeo) ───────────────────────────────────────

test('la misma fila da siempre el mismo identificador', () => {
  // Es lo que hace que importar dos veces no duplique: el mecanismo de T-017
  // —no agregar lo que ya está— alcanza sin código nuevo.
  const uno = interpretarFila(6, fila({ comentario: 'Roma' })).movimiento;
  const otro = interpretarFila(6, fila({ comentario: 'Roma' })).movimiento;

  assert.equal(uno.id, otro.id);
});

test('dos filas idénticas en distinta posición dan identificadores distintos', () => {
  // Dos cafés iguales el mismo día son dos gastos reales. Sin el número de fila
  // en el identificador, el segundo se descartaría como repetido.
  const seis = interpretarFila(6, fila()).movimiento;
  const siete = interpretarFila(7, fila()).movimiento;

  assert.notEqual(seis.id, siete.id);
});

test('cambiar cualquier dato de la fila cambia el identificador', () => {
  const base = interpretarFila(6, fila()).movimiento.id;

  for (const cambio of [{ monto: 54.31 }, { dia: 3 }, { rubro: 'viajes' },
                        { comentario: 'x' }, { detalle: 'y' }, { tipo: 'I', rubro: 'trabajo' }]) {
    assert.notEqual(interpretarFila(6, fila(cambio)).movimiento.id, base,
      `no cambió con ${JSON.stringify(cambio)}`);
  }
});

test('los identificadores tienen la forma que espera la app', () => {
  assert.match(idDeFila(6, 'lo que sea'), /^[0-9a-f]{16}$/);
});

// ── La comprobación contra el acumulado (§6 del mapeo) ───────────────────────

test('si lo importado coincide con el acumulado de la planilla, se dice', () => {
  const comprobaciones = comprobar(new Map([['2026-03', 10107]]), new Map([['2026-03', 10107]]));

  assert.equal(comprobaciones[0].coincide, true);
});

test('un céntimo de diferencia es redondeo, no un dato perdido', () => {
  // La planilla acumula sumando importes ya redondeados a dos decimales, y ese
  // último céntimo puede caer para cualquier lado.
  assert.equal(comprobar(new Map([['2026-03', 10107]]), new Map([['2026-03', 10106]]))[0].coincide, true);
});

test('una diferencia de verdad se informa con su tamaño', () => {
  // No significa necesariamente que la app se equivocó: puede ser que la
  // planilla tuviera una fórmula con un rango corto, que es justamente L-001.
  // Significa que alguno de los dos está mal y hay que mirarlo.
  const [c] = comprobar(new Map([['2026-03', 10107]]), new Map([['2026-03', 9000]]));

  assert.equal(c.coincide, false);
  assert.equal(c.diferencia, 1107);
});

test('un mes sin acumulado en la planilla no se comprueba', () => {
  assert.deepEqual(comprobar(new Map([['2026-03', 10107]]), new Map()), []);
});

// ── La planilla entera ───────────────────────────────────────────────────────

test('la copia de estructura se importa entera y sin problemas', async () => {
  const { filas } = await leerPlanilla(new Uint8Array(await readFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx'))));
  const { movimientos, problemas } = interpretarPlanilla(filas);

  assert.equal(movimientos.length, 288);
  assert.deepEqual(problemas, []);
});

test('ningún título ni encabezado se cuela como movimiento', async () => {
  const { filas } = await leerPlanilla(new Uint8Array(await readFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx'))));
  const { movimientos } = interpretarPlanilla(filas);

  for (const m of movimientos) {
    assert.notEqual(m.rubro, 'rubro');
    assert.ok(m.monto >= 0);
    assert.match(m.fecha, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('no hay dos movimientos con el mismo identificador', async () => {
  // Una colisión no da error: hace desaparecer un gasto, porque el segundo se
  // toma por repetido del primero.
  const { filas } = await leerPlanilla(new Uint8Array(await readFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx'))));
  const { movimientos } = interpretarPlanilla(filas);

  assert.equal(new Set(movimientos.map((m) => m.id)).size, movimientos.length);
});

test('importar dos veces la misma planilla da exactamente lo mismo', async () => {
  const bytes = new Uint8Array(await readFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx')));
  const una = interpretarPlanilla((await leerPlanilla(bytes)).filas);
  const otra = interpretarPlanilla((await leerPlanilla(bytes)).filas);

  assert.deepEqual(una.movimientos.map((m) => m.id), otra.movimientos.map((m) => m.id));
});

test('una fila rota no interrumpe la importación de las demás', () => {
  // Mil filas buenas no se pierden por una mala.
  const filas = new Map([
    [6, fila()],
    [7, fila({ monto: null })],
    [8, fila({ rubro: 'viajes' })],
  ]);
  const { movimientos, problemas } = interpretarPlanilla(filas);

  assert.equal(movimientos.length, 2);
  assert.equal(problemas.length, 1);
  assert.equal(problemas[0].fila, 7);
});

test('la comprobación sale de la columna de acumulado de la planilla', () => {
  const filas = new Map([
    [6, fila({ monto: 54.3, acumulado: 54.3 })],
    [7, fila({ monto: 12.5, acumulado: 66.8 })],
  ]);
  const { comprobaciones } = interpretarPlanilla(filas);

  assert.equal(comprobaciones.length, 1);
  assert.equal(comprobaciones[0].mes, '2026-03');
  assert.equal(comprobaciones[0].importado, 6680);
  assert.equal(comprobaciones[0].coincide, true);
});

test('el monto negativo lo rechaza el importador, con el valor a la vista', () => {
  // El modelo también lo rechazaría, pero con un mensaje sobre el modelo. Acá se
  // detecta antes para poder decir CUÁNTO decía la celda: sin el número, el
  // usuario no sabe qué fila mirar de las que tienen números parecidos.
  const { problema } = interpretarFila(6, fila({ monto: -15.5 }));

  assert.match(problema.motivo, /-15\.5/);
});

test('una fila con día pero sin rubro se saltea, no se informa como problema', () => {
  // Es una fila a medio cargar o parte de la decoración de la planilla. Meterla
  // en el informe llenaría de ruido la lista que el usuario tiene que leer
  // entera — y esa lista solo sirve si es corta y toda relevante.
  const sinRubro = new Map([['C', { valor: 5 }], ['G', { valor: 10 }]]);

  assert.equal(esFilaDeDatos(sinRubro), false);

  const { movimientos, problemas } = interpretarPlanilla(new Map([[6, sinRubro], [7, fila()]]));
  assert.equal(movimientos.length, 1);
  assert.deepEqual(problemas, []);
});

test('el identificador usa sus 64 bits, no 32 repetidos', () => {
  // Las dos mitades salen de semillas distintas. Con una sola, mil filas ya
  // tienen una posibilidad entre cuatro mil de chocar — y una colisión no da
  // error: hace desaparecer un gasto, porque el segundo se toma por repetido.
  for (const contenido of ['a', 'una fila cualquiera', '2026-03-02|G|viajes|1000||']) {
    const id = idDeFila(6, contenido);
    assert.notEqual(id.slice(0, 8), id.slice(8), `las dos mitades son iguales con "${contenido}"`);
  }
});
