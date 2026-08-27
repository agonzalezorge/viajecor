// T-004 — Tests del almacenamiento local.
//
// Acá vive la única copia de los gastos del usuario: no hay servidor, ni
// papelera, ni historial. Un error de este módulo no da un número mal, borra
// meses de registro. Por eso la mayoría de estos tests no comprueban que
// guardar y leer funcione —eso es lo fácil— sino que **lo que no se entiende no
// se pisa**.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAVE_DATOS,
  ESQUEMA_ACTUAL,
  PREFIJO_RESCATE,
  estadoInicial,
  leerEstado,
  guardarEstado,
  migrarEstado,
  borrarEstado,
  listarRescates,
} from '../src/datos/almacenamiento.js';

/**
 * Un localStorage de mentira, con la misma interfaz que el del navegador.
 * Se le puede pedir que falle, para probar los casos que en un navegador real
 * son difíciles de provocar (cuota llena, modo privado de Safari).
 */
function almacenFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    fallaAlEscribir: null,
    fallaAlLeer: null,
    get length() {
      return datos.size;
    },
    key(i) {
      return [...datos.keys()][i] ?? null;
    },
    getItem(clave) {
      if (this.fallaAlLeer) throw this.fallaAlLeer;
      return datos.has(clave) ? datos.get(clave) : null;
    },
    setItem(clave, valor) {
      if (this.fallaAlEscribir) throw this.fallaAlEscribir;
      datos.set(clave, String(valor));
    },
    removeItem(clave) {
      datos.delete(clave);
    },
  };
}

const MOVIMIENTO = {
  id: 'mov_9f2c1a4b3d7e5602',
  fecha: '2026-03-14',
  tipo: 'G',
  rubro: 'supermercado',
  monto: 1250,
  moneda: 'EUR',
  comentario: 'Roma',
  detalle: 'cena',
  creado: '2026-03-14',
};

const CAMBIO = {
  moneda: 'CRC',
  mes: '2026-03',
  euros_por_unidad: 0.00164,
  creado: '2026-03-14',
};

// ── Primer arranque ──────────────────────────────────────────────────────────

test('primer arranque: no hay nada guardado y la app abre vacía', () => {
  const almacen = almacenFalso();
  const { estado, incidencias, primerArranque } = leerEstado(almacen);

  assert.equal(primerArranque, true);
  assert.deepEqual(incidencias, []);
  assert.equal(estado.esquema, ESQUEMA_ACTUAL);
  assert.deepEqual(estado.movimientos, []);
  assert.deepEqual(estado.tipos_cambio, []);
  assert.equal(estado.preferencias.moneda_predeterminada, 'EUR');
});

test('leer no escribe nada: un primer arranque deja el almacenamiento intacto', () => {
  // Si leer creara la clave, un usuario que abre la app y no carga nada tendría
  // datos escritos igual. Y peor: escribir en el primer arranque es la forma más
  // fácil de pisar algo que estaba y no se entendió.
  const almacen = almacenFalso();
  leerEstado(almacen);
  assert.equal(almacen.datos.size, 0);
});

test('el estado inicial no trae monedas: esa lista es de otro módulo', () => {
  // Tenerlas también acá serían dos listas que se desincronizan (L-005).
  assert.deepEqual(estadoInicial().monedas, []);
  assert.deepEqual(estadoInicial({ monedas: [{ codigo: 'EUR' }] }).monedas, [{ codigo: 'EUR' }]);
});

// ── Ida y vuelta ─────────────────────────────────────────────────────────────

test('lo que se guarda es exactamente lo que se lee', () => {
  const almacen = almacenFalso();
  const original = {
    ...estadoInicial({ monedas: [{ codigo: 'EUR', nombre: 'Euro', decimales: 2, oculta: false }] }),
    movimientos: [MOVIMIENTO],
    tipos_cambio: [CAMBIO],
    preferencias: { moneda_predeterminada: 'CRC' },
  };

  guardarEstado(original, almacen);
  const { estado, incidencias, primerArranque } = leerEstado(almacen);

  assert.deepEqual(incidencias, []);
  assert.equal(primerArranque, false);
  assert.deepEqual(estado.movimientos, [MOVIMIENTO]);
  assert.deepEqual(estado.tipos_cambio, [CAMBIO]);
  assert.deepEqual(estado.monedas, original.monedas);
  assert.equal(estado.preferencias.moneda_predeterminada, 'CRC');
});

test('el monto sobrevive la ida y vuelta como entero, no como decimal', () => {
  // JSON.stringify(12.50) da "12.5". Si en algún punto el monto pasara por un
  // número con coma, volvería distinto de como se fue.
  const almacen = almacenFalso();
  guardarEstado({ ...estadoInicial(), movimientos: [MOVIMIENTO] }, almacen);

  const guardado = JSON.parse(almacen.datos.get(CLAVE_DATOS));
  assert.equal(guardado.movimientos[0].monto, 1250);
  assert.equal(Number.isInteger(leerEstado(almacen).estado.movimientos[0].monto), true);
});

test('guardar escribe una sola clave', () => {
  const almacen = almacenFalso();
  guardarEstado(estadoInicial(), almacen);
  assert.deepEqual([...almacen.datos.keys()], [CLAVE_DATOS]);
});

test('guardar sella siempre el número de esquema actual', () => {
  const almacen = almacenFalso();
  guardarEstado({ ...estadoInicial(), esquema: 99 }, almacen);
  assert.equal(JSON.parse(almacen.datos.get(CLAVE_DATOS)).esquema, ESQUEMA_ACTUAL);
});

test('mil movimientos van y vuelven sin perder ninguno', () => {
  // Ningún cálculo ni recorrido de este módulo tiene un tope escrito a mano
  // (L-001). Este test lo comprueba con más registros que el Excel de un año.
  const almacen = almacenFalso();
  const movimientos = Array.from({ length: 1000 }, (unused, i) => ({
    ...MOVIMIENTO,
    id: `mov_${String(i).padStart(16, '0')}`,
    monto: i + 1,
  }));

  guardarEstado({ ...estadoInicial(), movimientos }, almacen);
  const { estado, incidencias } = leerEstado(almacen);

  assert.deepEqual(incidencias, []);
  assert.equal(estado.movimientos.length, 1000);
  assert.equal(estado.movimientos.at(-1).monto, 1000);
});

// ── Datos corruptos: lo que no se entiende NO se pisa ────────────────────────

test('lo guardado no es ni JSON: la app abre y el dato queda apartado', () => {
  const almacen = almacenFalso({ [CLAVE_DATOS]: 'esto no es json {{{' });
  const { estado, incidencias, rescate } = leerEstado(almacen);

  // La app abre.
  assert.deepEqual(estado.movimientos, []);
  // Y avisa: no se pierde nada en silencio.
  assert.equal(incidencias.length, 1);
  assert.match(incidencias[0], /no se pudo leer/i);
  // Y el contenido original sigue existiendo, apartado con su fecha.
  assert.ok(rescate.startsWith(PREFIJO_RESCATE));
  assert.equal(almacen.datos.get(rescate), 'esto no es json {{{');
  assert.deepEqual(listarRescates(almacen), [rescate]);
});

test('leer datos corruptos no borra el original', () => {
  // Es LA regla del módulo: un dato ilegible se puede rescatar a mano; uno
  // sobrescrito, no.
  const almacen = almacenFalso({ [CLAVE_DATOS]: '{roto' });
  leerEstado(almacen);
  assert.equal(almacen.datos.get(CLAVE_DATOS), '{roto');
});

test('lo guardado es JSON pero no un juego de datos', () => {
  for (const basura of ['[1,2,3]', '"hola"', '42', 'null']) {
    const almacen = almacenFalso({ [CLAVE_DATOS]: basura });
    const { estado, incidencias } = leerEstado(almacen);
    assert.deepEqual(estado.movimientos, []);
    assert.equal(incidencias.length >= 1, true);
    assert.equal(almacen.datos.get(CLAVE_DATOS), basura, 'no se tocó el original');
  }
});

test('tres movimientos rotos no se llevan puestos a los que están bien', () => {
  // Tirar 497 movimientos buenos porque 3 están rotos es perder datos; aceptar
  // los 3 en silencio cambia el total del mes sin que nadie se entere. Se
  // conservan los buenos y se informa cuáles no se pudieron leer.
  const buenos = Array.from({ length: 497 }, (unused, i) => ({
    ...MOVIMIENTO,
    id: `mov_${String(i).padStart(16, '0')}`,
  }));
  const movimientos = [
    ...buenos.slice(0, 100),
    { ...MOVIMIENTO, fecha: '2026-02-30' },
    ...buenos.slice(100, 300),
    { ...MOVIMIENTO, monto: 'mucho' },
    ...buenos.slice(300),
    { no: 'es un movimiento' },
  ];

  const almacen = almacenFalso({
    [CLAVE_DATOS]: JSON.stringify({ ...estadoInicial(), movimientos }),
  });
  const { estado, incidencias } = leerEstado(almacen);

  assert.equal(estado.movimientos.length, 497);
  assert.equal(incidencias.length, 1);
  assert.match(incidencias[0], /3 registros de movimientos/);
  // El parte dice CUÁLES y POR QUÉ, no solo cuántos.
  assert.match(incidencias[0], /#101/);
  assert.match(incidencias[0], /no existe en el calendario/);
  assert.match(incidencias[0], /#302/);
});

test('un tipo de cambio inválido se descarta con aviso y el resto queda', () => {
  const tipos_cambio = [
    CAMBIO,
    { ...CAMBIO, euros_por_unidad: 0 },
    { ...CAMBIO, mes: 'marzo' },
    { ...CAMBIO, moneda: 'COLONES' },
    { ...CAMBIO, mes: '2026-04' },
  ];
  const almacen = almacenFalso({
    [CLAVE_DATOS]: JSON.stringify({ ...estadoInicial(), tipos_cambio }),
  });
  const { estado, incidencias } = leerEstado(almacen);

  assert.equal(estado.tipos_cambio.length, 2);
  assert.match(incidencias[0], /3 registros de tipos de cambio/);
  assert.match(incidencias[0], /mayor que cero/);
});

test('las listas que no son listas se ignoran con aviso', () => {
  const almacen = almacenFalso({
    [CLAVE_DATOS]: JSON.stringify({
      esquema: 1,
      movimientos: 'ninguno',
      tipos_cambio: { CRC: 0.00164 },
      monedas: 'EUR',
    }),
  });
  const { estado, incidencias } = leerEstado(almacen);

  assert.deepEqual(estado.movimientos, []);
  assert.deepEqual(estado.tipos_cambio, []);
  assert.deepEqual(estado.monedas, []);
  assert.equal(incidencias.length, 3);
});

test('faltar campos enteros no rompe nada', () => {
  const almacen = almacenFalso({ [CLAVE_DATOS]: JSON.stringify({ esquema: 1 }) });
  const { estado, incidencias } = leerEstado(almacen);

  assert.deepEqual(estado.movimientos, []);
  assert.deepEqual(estado.tipos_cambio, []);
  assert.equal(estado.preferencias.moneda_predeterminada, 'EUR');
  assert.deepEqual(incidencias, []);
});

test('TODAS las preferencias sobreviven a guardar y volver a leer', () => {
  // Este test existe por un error real: `ultimo_respaldo` se guardaba bien y
  // desaparecía al recargar, porque migrarEstado leía una sola preferencia y
  // descartaba el resto en silencio. El síntoma era el peor posible — funcionaba
  // con la app abierta y se perdía al volver. Ver L-015.
  const almacen = almacenFalso();
  const preferencias = { moneda_predeterminada: 'CRC', ultimo_respaldo: '2026-08-25' };

  guardarEstado({ ...estadoInicial(), preferencias }, almacen);
  const { estado } = leerEstado(almacen);

  assert.deepEqual(estado.preferencias, preferencias);
});

test('una fecha de respaldo inventada no se acepta', () => {
  for (const mala of ['ayer', '25/08/2026', '2026-13-01', 42, null]) {
    const almacen = almacenFalso({
      [CLAVE_DATOS]: JSON.stringify({ esquema: 1, preferencias: { ultimo_respaldo: mala } }),
    });
    assert.equal(leerEstado(almacen).estado.preferencias.ultimo_respaldo, undefined);
  }
});

test('una preferencia con basura no pisa el valor por omisión', () => {
  for (const mala of [{ moneda_predeterminada: 'EUROS' }, { moneda_predeterminada: 7 }, 'EUR', null]) {
    const almacen = almacenFalso({
      [CLAVE_DATOS]: JSON.stringify({ esquema: 1, preferencias: mala }),
    });
    assert.equal(leerEstado(almacen).estado.preferencias.moneda_predeterminada, 'EUR');
  }
});

// ── Esquema y migración ──────────────────────────────────────────────────────

test('datos de una versión más nueva no se tocan', () => {
  // Este código no sabe qué significan. Guardar encima los destruiría, y el
  // usuario todavía puede abrirlos con la versión que los escribió.
  const futuro = JSON.stringify({ esquema: ESQUEMA_ACTUAL + 1, movimientos: [MOVIMIENTO] });
  const almacen = almacenFalso({ [CLAVE_DATOS]: futuro });
  const { estado, incidencias, soloLectura } = leerEstado(almacen);

  assert.equal(soloLectura, true);
  assert.deepEqual(estado.movimientos, []);
  assert.match(incidencias[0], /versión más nueva/);
  assert.equal(almacen.datos.get(CLAVE_DATOS), futuro, 'no se tocó el original');
});

test('datos sin número de esquema se leen como los actuales, avisando', () => {
  const almacen = almacenFalso({
    [CLAVE_DATOS]: JSON.stringify({ movimientos: [MOVIMIENTO] }),
  });
  const { estado, incidencias } = leerEstado(almacen);

  assert.equal(estado.movimientos.length, 1);
  assert.match(incidencias[0], /con qué versión del formato/);
});

test('migrarEstado se puede usar suelto, sin almacenamiento', () => {
  // Es la puerta por la que va a entrar la migración de esquema cuando haga
  // falta, y también la que usa el importador de respaldos (T-017).
  const incidencias = [];
  const estado = migrarEstado({ esquema: 1, movimientos: [MOVIMIENTO] }, incidencias);
  assert.equal(estado.movimientos.length, 1);
  assert.deepEqual(incidencias, []);
});

// ── Cuando el navegador no deja ──────────────────────────────────────────────

test('si el almacenamiento está lleno, guardar TIRA y lo dice claro', () => {
  // La tentación es atrapar el error para que la app no se corte. Sería peor:
  // el usuario seguiría cargando gastos que se ven en pantalla y no se guardan.
  const almacen = almacenFalso();
  const error = new Error('cuota');
  error.name = 'QuotaExceededError';
  almacen.fallaAlEscribir = error;

  assert.throws(() => guardarEstado(estadoInicial(), almacen), (e) => {
    assert.match(e.message, /está lleno/);
    assert.match(e.message, /NO se guardó/);
    return true;
  });
});

test('el código de cuota de Safari también se reconoce', () => {
  const almacen = almacenFalso();
  const error = new Error('QUOTA_EXCEEDED_ERR');
  error.code = 22;
  almacen.fallaAlEscribir = error;
  assert.throws(() => guardarEstado(estadoInicial(), almacen), /está lleno/);
});

test('si ni siquiera se puede leer, la app abre igual y avisa', () => {
  // Safari en ventana privada puede tirar al tocar localStorage.
  const almacen = almacenFalso();
  almacen.fallaAlLeer = new Error('acceso denegado');
  const { estado, incidencias } = leerEstado(almacen);

  assert.deepEqual(estado.movimientos, []);
  assert.match(incidencias[0], /No se pudo acceder al almacenamiento/);
});

test('si no se puede apartar lo corrupto, se avisa de que está en riesgo', () => {
  const almacen = almacenFalso({ [CLAVE_DATOS]: '{roto' });
  almacen.fallaAlEscribir = new Error('sin espacio');
  const { incidencias, rescate } = leerEstado(almacen);

  assert.equal(rescate, null);
  assert.match(incidencias.join(' '), /No guardes nada nuevo/);
});

// ── Borrar ───────────────────────────────────────────────────────────────────

test('borrar saca los datos pero conserva lo apartado', () => {
  // Lo apartado es justamente lo que hay que conservar cuando algo salió mal.
  const almacen = almacenFalso({
    [CLAVE_DATOS]: JSON.stringify(estadoInicial()),
    [`${PREFIJO_RESCATE}2026-03-14T00:00:00.000Z`]: '{roto',
  });

  borrarEstado(almacen);

  assert.equal(almacen.datos.has(CLAVE_DATOS), false);
  assert.equal(listarRescates(almacen).length, 1);
  assert.equal(leerEstado(almacen).primerArranque, true);
});

test('guardar algo que no es un estado se rechaza', () => {
  const almacen = almacenFalso();
  for (const malo of [null, undefined, 'datos', 42]) {
    assert.throws(() => guardarEstado(malo, almacen), /estado/);
  }
});
