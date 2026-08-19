// T-003 — Tests del modelo del movimiento.
//
// Este módulo es la puerta por la que entra cada gasto y cada ingreso. Los casos
// de acá no son el camino feliz: son las formas concretas en que el Excel
// original perdía datos en silencio (L-002, L-003, L-005) y las que un dedazo
// puede reproducir.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIPO_GASTO,
  TIPO_INGRESO,
  RUBROS_GASTO,
  RUBROS_INGRESO,
  rubrosDe,
  normalizarTextoVisible,
  normalizarClave,
  claveDeComentario,
  normalizarTipo,
  normalizarRubro,
  normalizarMoneda,
  validarFecha,
  mesDe,
  esFechaFutura,
  nuevoId,
  crearMovimiento,
  validarMovimiento,
} from '../src/core/modelo.js';

// Un movimiento válido de referencia. Cada test cambia lo que quiere probar.
const BASE = {
  fecha: '2026-03-14',
  tipo: 'G',
  rubro: 'supermercado',
  monto: '12,50',
  moneda: 'EUR',
  comentario: '',
  detalle: '',
};

const OPCIONES = { decimales: 2, ahora: '2026-03-14T20:11:03.000Z' };

function crear(cambios = {}, opciones = OPCIONES) {
  return crearMovimiento({ ...BASE, ...cambios }, opciones);
}

// ── Lo que la tarea pide explícitamente ──────────────────────────────────────

test('VIAJES, viajes y " Viajes " son el mismo rubro (RN-03, L-002)', () => {
  const escrituras = ['VIAJES', 'viajes', ' Viajes ', 'Viajes', 'ViAjEs', 'viajes  '];
  const rubros = escrituras.map((r) => crear({ rubro: r }).rubro);

  for (const rubro of rubros) {
    assert.equal(rubro, 'viajes');
  }
  // Y el conjunto de rubros distintos tiene exactamente un elemento: si alguna
  // escritura se colara distinta, acá habría dos categorías con parte del dinero.
  assert.equal(new Set(rubros).size, 1);
});

test('un rubro de ingreso en un gasto se rechaza (RN-02)', () => {
  assert.throws(() => crear({ tipo: 'G', rubro: 'trabajo' }), /no es un rubro de gasto/);
  assert.throws(() => crear({ tipo: 'I', rubro: 'supermercado' }), /no es un rubro de ingreso/);
});

test('monto cero o negativo se rechaza (CU-01)', () => {
  assert.throws(() => crear({ monto: '0' }), /cero no se guarda/);
  assert.throws(() => crear({ monto: '0,00' }), /cero no se guarda/);
  assert.throws(() => crear({ monto: 0 }), /cero no se guarda/);
  // El signo lo da el campo tipo, no el número: un gasto se registra como gasto.
  assert.throws(() => crear({ monto: '-5' }), /no puede ser negativo/);
  assert.throws(() => crear({ monto: -5 }), /no puede ser negativo/);
});

// ── Tipo ─────────────────────────────────────────────────────────────────────

test('el tipo se acepta en minúscula, como viene en el Excel (L-002)', () => {
  assert.equal(normalizarTipo('g'), TIPO_GASTO);
  assert.equal(normalizarTipo(' i '), TIPO_INGRESO);
  assert.equal(crear({ tipo: 'g' }).tipo, 'G');
});

test('un tipo que no es G ni I se rechaza', () => {
  for (const malo of ['X', '', 'gasto', null, undefined, 3]) {
    assert.throws(() => normalizarTipo(malo), /El tipo de un movimiento/);
  }
});

// ── Rubros ───────────────────────────────────────────────────────────────────

test('"otros" existe en las dos listas y son cosas distintas', () => {
  assert.ok(RUBROS_GASTO.includes('otros'));
  assert.ok(RUBROS_INGRESO.includes('otros'));

  const gasto = crear({ tipo: 'G', rubro: 'otros' });
  const ingreso = crear({ tipo: 'I', rubro: 'Otros' });

  // Mismo nombre de rubro, distinto tipo: lo que impide que se sumen juntos es
  // el campo tipo, y por eso los dos tienen que sobrevivir a la normalización.
  assert.equal(gasto.rubro, 'otros');
  assert.equal(ingreso.rubro, 'otros');
  assert.notEqual(gasto.tipo, ingreso.tipo);
});

test('rubrosDe devuelve la lista del tipo', () => {
  assert.deepEqual(rubrosDe('G'), RUBROS_GASTO);
  assert.deepEqual(rubrosDe('i'), RUBROS_INGRESO);
});

test('las listas de rubros no se pueden modificar desde afuera', () => {
  // Están congeladas: si una pantalla le agregara un rubro a la lista, ese rubro
  // existiría solo mientras la app esté abierta y desaparecería al recargar,
  // dejando movimientos con un rubro que ya no está en ninguna lista.
  assert.throws(() => RUBROS_GASTO.push('cripto'), TypeError);
});

test('todos los rubros documentados se aceptan tal como están escritos', () => {
  for (const rubro of RUBROS_GASTO) {
    assert.equal(normalizarRubro(rubro, 'G'), rubro);
  }
  for (const rubro of RUBROS_INGRESO) {
    assert.equal(normalizarRubro(rubro, 'I'), rubro);
  }
});

test('un rubro inventado se rechaza y el mensaje dice cuáles valen', () => {
  assert.throws(() => crear({ rubro: 'cripto' }), (error) => {
    assert.match(error.message, /"cripto" no es un rubro de gasto/);
    assert.match(error.message, /supermercado/);
    return true;
  });
});

// ── Normalización de texto ───────────────────────────────────────────────────

test('los espacios repetidos del medio también se juntan', () => {
  // "Costa  Rica" con dos espacios se ve igual que con uno en cualquier pantalla,
  // y sin esto serían dos viajes distintos (L-003).
  assert.equal(normalizarTextoVisible('  Costa   Rica  '), 'Costa Rica');
  assert.equal(claveDeComentario('Costa  Rica'), claveDeComentario(' costa rica '));
});

test('dos formas Unicode de la misma palabra dan la misma clave', () => {
  // "Perú" con la ú de una sola pieza, y con u + tilde suelta. Se ven idénticas
  // y === dice que no lo son. Los teclados de iOS producen a veces la segunda.
  const compuesta = 'Per\u00FA';        // ú de una sola pieza
  const descompuesta = 'Peru\u0301';   // u + tilde combinante

  assert.notEqual(compuesta, descompuesta);
  assert.equal(claveDeComentario(compuesta), claveDeComentario(descompuesta));
  assert.equal(crear({ comentario: descompuesta }).comentario, compuesta);
});

test('la clave no saca las tildes: Perú y Peru son distintos (ADR-013)', () => {
  assert.notEqual(claveDeComentario('Perú'), claveDeComentario('Peru'));
});

test('el comentario se guarda como se escribió, y agrupa por su clave', () => {
  // Se guarda "Roma" para poder mostrarlo así; lo que agrupa es la clave.
  const uno = crear({ comentario: ' Roma ' });
  const otro = crear({ comentario: 'ROMA' });

  assert.equal(uno.comentario, 'Roma');
  assert.equal(otro.comentario, 'ROMA');
  assert.equal(claveDeComentario(uno.comentario), claveDeComentario(otro.comentario));
});

test('el detalle es texto libre: no se toca más que en los bordes', () => {
  // No agrupa nada (PRODUCTO §4), así que respetarlo entero es lo correcto.
  const mov = crear({ detalle: '  cena  con   Ire  ' });
  assert.equal(mov.detalle, 'cena  con   Ire');
});

test('comentario y detalle pueden estar vacíos', () => {
  const mov = crear();
  assert.equal(mov.comentario, '');
  assert.equal(mov.detalle, '');
});

test('normalizarClave pasa a minúsculas y normalizarTextoVisible no', () => {
  assert.equal(normalizarClave(' Gastos Fijos '), 'gastos fijos');
  assert.equal(normalizarTextoVisible(' Gastos Fijos '), 'Gastos Fijos');
});

// ── Moneda ───────────────────────────────────────────────────────────────────

test('el código de moneda se guarda en mayúsculas', () => {
  assert.equal(normalizarMoneda('eur'), 'EUR');
  assert.equal(normalizarMoneda(' crc '), 'CRC');
  assert.equal(crear({ moneda: 'uyu' }).moneda, 'UYU');
});

test('un código de moneda que no son tres letras se rechaza', () => {
  for (const malo of ['EUROS', 'E', '', 'EU1', null, 978]) {
    assert.throws(() => normalizarMoneda(malo), /tres letras/);
  }
});

// ── Fecha (RN-01, L-005) ─────────────────────────────────────────────────────

test('un día que no existe se rechaza en vez de correrse de mes', () => {
  // new Date('2026-02-30') no falla: devuelve el 2 de marzo. Si nos
  // conformáramos con la forma del texto, ese gasto se iría a otro mes y el
  // total de febrero daría de menos sin ningún aviso.
  assert.equal(new Date('2026-02-30').getUTCMonth(), 2);
  assert.throws(() => validarFecha('2026-02-30'), /no existe en el calendario/);
  assert.throws(() => validarFecha('2026-04-31'), /no existe en el calendario/);
  assert.throws(() => validarFecha('2026-13-01'), /no existe en el calendario/);
});

test('el 29 de febrero existe en los años bisiestos y no en los demás', () => {
  assert.equal(validarFecha('2024-02-29'), '2024-02-29');
  assert.throws(() => validarFecha('2026-02-29'), /no existe en el calendario/);
  // 1900 NO fue bisiesto, aunque Excel crea que sí. Es el error histórico que el
  // importador va a tener que esquivar (T-030).
  assert.throws(() => validarFecha('1900-02-29'), /no existe en el calendario/);
});

test('la fecha tiene que estar escrita AAAA-MM-DD', () => {
  for (const mala of ['14/03/2026', '2026-3-14', '20260314', '', 'hoy', null, 20260314]) {
    assert.throws(() => validarFecha(mala), /fecha/i);
  }
});

test('el mes se deriva de la fecha, no es un campo aparte (RN-01)', () => {
  assert.equal(mesDe('2026-03-14'), '2026-03');
  assert.equal(mesDe('2025-12-31'), '2025-12');
  // No hay forma de guardar un movimiento cuyo mes no sea el de su fecha: el
  // objeto no tiene campo mes. Esta es la contramedida a L-005.
  assert.equal(Object.hasOwn(crear({ fecha: '2025-12-31' }), 'mes'), false);
});

test('una fecha futura se permite pero se puede detectar (CU-01)', () => {
  assert.equal(esFechaFutura('2026-03-15', '2026-03-14'), true);
  assert.equal(esFechaFutura('2026-03-14', '2026-03-14'), false);
  assert.equal(esFechaFutura('2026-03-13', '2026-03-14'), false);
  // Se permite: crear no tira.
  assert.equal(crear({ fecha: '2099-01-01' }).fecha, '2099-01-01');
});

// ── Monto ────────────────────────────────────────────────────────────────────

test('el monto entra como lo escribe el usuario y sale en enteros (ADR-005)', () => {
  assert.equal(crear({ monto: '12,50' }).monto, 1250);
  assert.equal(crear({ monto: '12.50' }).monto, 1250);
  assert.equal(crear({ monto: 12.5 }).monto, 1250);
  assert.equal(crear({ monto: '1.234,56' }).monto, 123456);
});

test('una moneda sin decimales guarda el monto tal cual', () => {
  const mov = crear({ monto: '1500', moneda: 'JPY' }, { ...OPCIONES, decimales: 0 });
  assert.equal(mov.monto, 1500);
});

test('un monto ambiguo se sigue rechazando desde el modelo (ADR-012)', () => {
  // La regla vive en dinero.js; este test comprueba que crear un movimiento no
  // la esquiva por algún camino propio.
  assert.throws(() => crear({ monto: '1.234' }), /dos formas/);
});

test('crear sin decir los decimales de la moneda se rechaza', () => {
  // Es el error que desplazaría todos los importes de una moneda por cien.
  // Mejor frenar acá que guardar un número que nadie va a poder distinguir.
  assert.throws(() => crearMovimiento(BASE, { ahora: OPCIONES.ahora }), /decimales/);
});

// ── Forma del movimiento creado ──────────────────────────────────────────────

test('el movimiento tiene exactamente los campos de ARQUITECTURA §5', () => {
  const mov = crear({ comentario: 'Roma', detalle: 'cena' });
  assert.deepEqual(Object.keys(mov).sort(), [
    'comentario', 'creado', 'detalle', 'fecha', 'id', 'moneda', 'monto', 'rubro', 'tipo',
  ]);
});

test('los campos de más que vengan en la entrada no se guardan', () => {
  // Un respaldo editado a mano, o el archivo de otra versión, puede traer campos
  // que ya no existen. Arrastrarlos hacia adentro es cómo un dato viejo
  // sobrevive a su propia migración.
  const mov = crear({ importe_en_euros: 999, mes: '2020-01' });
  assert.equal(Object.hasOwn(mov, 'importe_en_euros'), false);
  assert.equal(Object.hasOwn(mov, 'mes'), false);
});

test('no se guarda el importe convertido a euros (RN-05)', () => {
  assert.equal(Object.hasOwn(crear(), 'euros'), false);
});

test('crear no modifica el objeto que recibe', () => {
  const entrada = { ...BASE, rubro: 'VIAJES', monto: '12,50' };
  const copia = { ...entrada };
  crearMovimiento(entrada, OPCIONES);
  assert.deepEqual(entrada, copia);
});

test('crear rechaza cualquier cosa que no sea un objeto', () => {
  for (const malo of [null, undefined, 'gasto', 42, []]) {
    assert.throws(() => crearMovimiento(malo, OPCIONES));
  }
});

// ── Identificador ────────────────────────────────────────────────────────────

test('cada movimiento nace con un identificador propio', () => {
  const a = crear();
  const b = crear();
  assert.match(a.id, /^mov_[0-9a-f]{16}$/);
  assert.notEqual(a.id, b.id);
});

test('diez mil identificadores seguidos no repiten ninguno', () => {
  // No prueba que sean únicos —eso es probabilidad, no un test— pero sí detecta
  // un generador roto que devuelva siempre lo mismo o que use pocos bits.
  const ids = new Set();
  for (let i = 0; i < 10000; i += 1) ids.add(nuevoId());
  assert.equal(ids.size, 10000);
});

test('se puede imponer el identificador, para poder importar respaldos', () => {
  assert.equal(crear({}, { ...OPCIONES, id: 'mov_abc' }).id, 'mov_abc');
});

test('creado queda en el momento de la carga', () => {
  assert.equal(crear().creado, '2026-03-14T20:11:03.000Z');
  // Sin ahora explícito, es una fecha real y reciente.
  const mov = crearMovimiento(BASE, { decimales: 2 });
  assert.ok(Math.abs(Date.parse(mov.creado) - Date.now()) < 5000);
});

// ── validarMovimiento: lo que ya estaba guardado ─────────────────────────────

const GUARDADO = {
  id: 'mov_9f2c1a4b3d7e5602',
  fecha: '2026-03-14',
  tipo: 'G',
  rubro: 'supermercado',
  monto: 1250,
  moneda: 'EUR',
  comentario: 'Roma',
  detalle: 'cena',
  creado: '2026-03-14T20:11:03.000Z',
};

test('un movimiento guardado se valida sin reinterpretar el monto', () => {
  // Acá 1250 son 12,50 € y tienen que quedar 1250. Si esta función usara la
  // misma puerta que crearMovimiento, saldrían 125000: cien veces más.
  assert.equal(validarMovimiento(GUARDADO).monto, 1250);
  assert.deepEqual(validarMovimiento(GUARDADO), GUARDADO);
});

test('un movimiento guardado con el monto en decimales se rechaza', () => {
  // Si un dato guardado tiene 12.5 en vez de 1250, algo lo escribió mal y
  // seguir calculando encima propaga el error a todos los totales.
  assert.throws(() => validarMovimiento({ ...GUARDADO, monto: 12.5 }), /entero/);
});

test('un movimiento guardado sin identificador se rechaza', () => {
  assert.throws(() => validarMovimiento({ ...GUARDADO, id: undefined }), /identificador/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, id: '   ' }), /identificador/);
});

test('un movimiento guardado con datos corruptos se rechaza uno por uno', () => {
  assert.throws(() => validarMovimiento({ ...GUARDADO, fecha: '2026-02-30' }), /no existe/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, tipo: 'X' }), /El tipo/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, rubro: 'trabajo' }), /no es un rubro/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, monto: 0 }), /monto cero/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, monto: -1 }), /negativo/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, moneda: 'EUROS' }), /tres letras/);
  assert.throws(() => validarMovimiento({ ...GUARDADO, creado: 'ayer' }), /fecha de creación/);
  assert.throws(() => validarMovimiento(null), /movimiento/);
});

test('validar limpia los campos de más de un dato guardado', () => {
  const conBasura = { ...GUARDADO, hoja: 'Gastos', fila: 128 };
  assert.deepEqual(validarMovimiento(conBasura), GUARDADO);
});

test('lo que crea crearMovimiento pasa validarMovimiento', () => {
  // Las dos puertas tienen que coincidir: si crear produjera algo que validar
  // rechaza, la app guardaría datos que no puede volver a leer.
  const mov = crear({ comentario: 'Roma', detalle: 'cena', monto: '1.234,56' });
  assert.deepEqual(validarMovimiento(mov), mov);
});
