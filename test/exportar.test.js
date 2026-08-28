// T-016 — Tests del respaldo.
//
// El archivo que produce este módulo es **la única copia de seguridad que el
// usuario va a tener**: sus datos viven en un solo navegador, sin servidor y sin
// papelera. Un respaldo incompleto no se nota al hacerlo — se nota el día que
// hace falta, que es el peor momento posible para enterarse.
//
// De ahí que la mitad de estos tests comprueben lo mismo desde ángulos
// distintos: que no falte nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nombreDelRespaldo,
  contenidoDelRespaldo,
  prepararRespaldo,
  anotarRespaldo,
  diasSinRespaldar,
  TIPO_JSON,
} from '../src/datos/exportar.js';

import { dibujarDatos, dibujarEstadoRespaldo, tamanoLegible } from '../src/ui/pantallas/datos.js';
import { estadoInicial, migrarEstado, ESQUEMA_ACTUAL } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { intentarGuardar, borradorNuevo } from '../src/ui/pantallas/movimiento.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';
import { hoy } from '../src/core/modelo.js';

const HOY = '2026-08-25';

function estadoLimpio() {
  return {
    ...estadoInicial({ monedas: monedasIniciales() }),
    tipos_cambio: [crearCambio(
      { moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) },
      { creado: '2026-03-14' }
    )],
  };
}

function cargar(estado, campos = {}) {
  const resultado = intentarGuardar(estado, {
    ...borradorNuevo({ estado }),
    fecha: '2026-03-14', rubro: 'supermercado', monto: '12,50', ...campos,
  });
  assert.equal(resultado.error, undefined, resultado.error);
  return resultado.estado;
}

// ── Que no falte nada ────────────────────────────────────────────────────────

test('el respaldo lleva TODO, no lo que se está mirando', () => {
  // Un respaldo que solo guarda el mes en pantalla es un respaldo que descubrís
  // incompleto el día que lo necesitás.
  let estado = cargar(estadoLimpio(), { fecha: '2026-01-10' });
  estado = cargar(estado, { fecha: '2026-03-14' });
  estado = cargar(estado, { fecha: '2026-08-01' });

  const respaldo = JSON.parse(contenidoDelRespaldo(estado, { fecha: HOY }));

  assert.equal(respaldo.movimientos.length, 3);
  assert.equal(respaldo.tipos_cambio.length, 1);
  assert.equal(respaldo.monedas.length, 4);
  assert.ok(respaldo.preferencias);
});

test('lo exportado se puede volver a leer sin perder nada', () => {
  // Es la prueba de fuego de un respaldo: que la ida y la vuelta den lo mismo.
  // Se usa migrarEstado, que es por donde entra un respaldo al reimportarse.
  let estado = cargar(estadoLimpio(), { comentario: 'Roma', detalle: 'cena' });
  estado = cargar(estado, { moneda: 'CRC', monto: '12500', rubro: 'viajes' });

  const leido = migrarEstado(JSON.parse(contenidoDelRespaldo(estado, { fecha: HOY })));

  assert.deepEqual(leido.movimientos, estado.movimientos);
  assert.deepEqual(leido.tipos_cambio, estado.tipos_cambio);
  assert.deepEqual(leido.monedas, estado.monedas);
  assert.equal(leido.preferencias.moneda_predeterminada, estado.preferencias.moneda_predeterminada);
});

test('los montos vuelven como enteros, no como decimales', () => {
  // JSON.stringify(12.50) da "12.5". Si un monto pasara por un número con coma
  // en algún punto, el respaldo devolvería otro importe.
  const estado = cargar(estadoLimpio(), { monto: '12,50' });
  const respaldo = JSON.parse(contenidoDelRespaldo(estado, { fecha: HOY }));

  assert.equal(respaldo.movimientos[0].monto, 1250);
  assert.equal(Number.isInteger(respaldo.movimientos[0].monto), true);
});

test('mil movimientos entran enteros en el respaldo (L-001)', () => {
  let estado = estadoLimpio();
  for (let i = 0; i < 1000; i += 1) estado = cargar(estado);

  const respaldo = JSON.parse(contenidoDelRespaldo(estado, { fecha: HOY }));
  assert.equal(respaldo.movimientos.length, 1000);
  assert.equal(prepararRespaldo(estado, { fecha: HOY }).cuantos, 1000);
});

test('los acentos y los caracteres raros sobreviven', () => {
  const estado = cargar(estadoLimpio(), { comentario: 'Coruña', detalle: 'café & té «cañón»' });
  const respaldo = JSON.parse(contenidoDelRespaldo(estado, { fecha: HOY }));

  assert.equal(respaldo.movimientos[0].comentario, 'Coruña');
  assert.equal(respaldo.movimientos[0].detalle, 'café & té «cañón»');
});

// ── Que el archivo se explique solo ──────────────────────────────────────────

test('el archivo dice de dónde salió, cuándo y con qué formato', () => {
  // Un viajecor-2026-08-25.json encontrado dentro de tres años tiene que poder
  // explicarse sin nadie al lado.
  const respaldo = JSON.parse(contenidoDelRespaldo(estadoLimpio(), { fecha: HOY }));

  assert.equal(respaldo.aplicacion, 'Viajecor');
  assert.equal(respaldo.exportado, HOY);
  assert.equal(respaldo.esquema, ESQUEMA_ACTUAL);
  assert.ok('version_app' in respaldo);
});

test('el archivo se puede leer a ojo, con saltos de línea y sangría', () => {
  // Si dentro de cinco años esta app no abre, el respaldo se tiene que seguir
  // entendiendo con cualquier editor de texto.
  const contenido = contenidoDelRespaldo(cargar(estadoLimpio()), { fecha: HOY });

  assert.ok(contenido.includes('\n'), 'una sola línea sería ilegible');
  assert.ok(contenido.includes('\n  "movimientos"'), 'con sangría');
  assert.ok(contenido.endsWith('\n'), 'termina en salto de línea, como todo archivo de texto');
});

test('el nombre lleva la fecha adelante, para que se ordenen solos', () => {
  assert.equal(nombreDelRespaldo('2026-08-25'), 'viajecor-2026-08-25.json');
  assert.equal(nombreDelRespaldo('2026-08-25', 'csv'), 'viajecor-2026-08-25.csv');
  // Ordenados por nombre quedan ordenados por fecha, que es como los ordena el
  // celular.
  const nombres = ['2026-01-05', '2025-12-31', '2026-08-25'].map((f) => nombreDelRespaldo(f));
  assert.deepEqual([...nombres].sort(), [
    'viajecor-2025-12-31.json', 'viajecor-2026-01-05.json', 'viajecor-2026-08-25.json',
  ]);
});

test('prepararRespaldo trae todo lo que la pantalla necesita decir', () => {
  const estado = cargar(estadoLimpio());
  const r = prepararRespaldo(estado, { fecha: HOY });

  assert.equal(r.nombre, 'viajecor-2026-08-25.json');
  assert.equal(r.tipo, TIPO_JSON);
  assert.equal(r.cuantos, 1);
  assert.ok(r.bytes > 0);
  // Los bytes son los de verdad, contando los acentos como lo que ocupan.
  assert.equal(r.bytes, new TextEncoder().encode(r.contenido).length);
});

// ── Cuánto hace que no se respalda ───────────────────────────────────────────

test('anotar el respaldo no toca ningún otro dato', () => {
  const estado = cargar(estadoLimpio());
  const despues = anotarRespaldo(estado, { fecha: HOY });

  assert.equal(despues.preferencias.ultimo_respaldo, HOY);
  assert.deepEqual(despues.movimientos, estado.movimientos);
  assert.equal(despues.preferencias.moneda_predeterminada, estado.preferencias.moneda_predeterminada);
  assert.equal(estado.preferencias.ultimo_respaldo, undefined, 'no modifica el que recibe');
});

test('los días sin respaldar se cuentan bien, incluso cruzando meses', () => {
  const con = (ultimo) => ({ preferencias: { ultimo_respaldo: ultimo } });

  assert.equal(diasSinRespaldar(con('2026-08-25'), { fecha: HOY }), 0);
  assert.equal(diasSinRespaldar(con('2026-08-24'), { fecha: HOY }), 1);
  assert.equal(diasSinRespaldar(con('2026-08-10'), { fecha: HOY }), 15);
  assert.equal(diasSinRespaldar(con('2026-07-25'), { fecha: HOY }), 31);
  assert.equal(diasSinRespaldar(con('2025-08-25'), { fecha: HOY }), 365);
});

test('sin ningún respaldo hecho, no se inventa una fecha', () => {
  assert.equal(diasSinRespaldar(estadoLimpio(), { fecha: HOY }), null);
  assert.equal(diasSinRespaldar({ preferencias: { ultimo_respaldo: 'ayer' } }, { fecha: HOY }), null);
  assert.equal(diasSinRespaldar({}, { fecha: HOY }), null);
});

// ── Lo que se ve en la pantalla ──────────────────────────────────────────────

test('la pantalla dice cuánto hace que no respaldás, siempre', () => {
  // Saber que respaldaste ayer también es información. Un aviso que solo aparece
  // cuando hay problema enseña a ignorarlo cuando aparece.
  const estado = cargar(estadoLimpio());

  assert.ok(dibujarEstadoRespaldo(estado, { fecha: HOY }).includes('Nunca respaldaste'));
  assert.ok(dibujarEstadoRespaldo(anotarRespaldo(estado, { fecha: HOY }), { fecha: HOY }).includes('Respaldaste hoy'));
  assert.ok(dibujarEstadoRespaldo(anotarRespaldo(estado, { fecha: '2026-08-24' }), { fecha: HOY }).includes('Respaldaste ayer'));
  assert.ok(dibujarEstadoRespaldo(anotarRespaldo(estado, { fecha: '2026-08-22' }), { fecha: HOY }).includes('Hace 3 días'));
});

test('pasada una semana el aviso se ve distinto', () => {
  const estado = anotarRespaldo(cargar(estadoLimpio()), { fecha: '2026-08-01' });
  const html = dibujarEstadoRespaldo(estado, { fecha: HOY });

  assert.ok(html.includes('pendiente-respaldo'), 'a los 24 días tiene que destacarse');
  assert.ok(html.includes('role="status"'));
});

test('sin datos cargados no se pide respaldar nada', () => {
  const html = dibujarEstadoRespaldo(estadoLimpio(), { fecha: HOY });
  assert.ok(html.includes('no hay nada que respaldar'));
  assert.equal(html.includes('Nunca respaldaste'), false);
});

test('la pantalla ofrece los DOS caminos para el mismo respaldo', () => {
  // La app se abre desde un archivo del disco, y ahí las descargas dependen del
  // navegador. Un respaldo que solo funciona si el navegador coopera no es un
  // respaldo.
  const html = dibujarDatos({ estado: cargar(estadoLimpio()) });

  assert.ok(html.includes('data-accion="exportar"'));
  assert.ok(html.includes('data-accion="ver-respaldo"'));
});

test('el texto para copiar muestra el respaldo entero', () => {
  const estado = cargar(estadoLimpio(), { comentario: 'Roma' });
  const html = dibujarDatos({ estado, mostrarRespaldo: true });

  assert.ok(html.includes('<textarea'));
  assert.ok(html.includes('Roma'));
  assert.ok(html.includes('&quot;movimientos&quot;'), 'el JSON va escapado dentro del HTML');
});

test('sin datos, ningún botón de exportar se puede apretar', () => {
  // Se cuentan por acción y no por cantidad: contar "cuántos disabled hay" hace
  // que agregar un botón rompa el test sin que nada esté mal, y peor, que
  // agregar uno SIN apagar lo deje pasar si otro se apagó de más.
  const html = dibujarDatos({ estado: estadoLimpio(), puedeCompartir: true });

  for (const accion of ['exportar', 'ver-respaldo', 'exportar-planilla', 'exportar-csv',
                        'compartir', 'compartir-planilla']) {
    const boton = html.match(new RegExp(`<button[^>]*data-accion="${accion}"[^>]*>`));
    assert.ok(boton, `no está el botón ${accion}`);
    assert.match(boton[0], /disabled/, `el botón ${accion} se puede apretar sin datos`);
  }
});

test('la pantalla dice cuánto pesa y qué se lleva', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()) });
  assert.ok(html.includes('1 movimiento'));
  assert.ok(/\d+ bytes|kB|MB/.test(html));
});

test('un tamaño se muestra en la unidad que se entiende', () => {
  assert.equal(tamanoLegible(500), '500 bytes');
  assert.equal(tamanoLegible(12283), '12,0 kB');
  assert.equal(tamanoLegible(5 * 1024 * 1024), '5,0 MB');
});

test('la pantalla avisa que la app no sube nada (RN-06)', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()) });
  assert.ok(html.includes('no sube nada'));
  // Y advierte lo que pasa después: es la parte que la app ya no controla.
  assert.ok(html.includes('deja de ser'));
});

test('nada de lo que dibuja la pantalla contiene una dirección de internet', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()), mostrarRespaldo: true });
  assert.equal(/https?:\/\//.test(html), false);
});

test('por omisión el respaldo se prepara con la fecha de hoy', () => {
  assert.equal(prepararRespaldo(estadoLimpio()).nombre, nombreDelRespaldo(hoy()));
});

// ── Recordar que compartir no funciona (T-914) ───────────────────────────────

test('con compartir disponible, se ofrece el botón', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()), puedeCompartir: true });

  assert.match(html, /data-accion="compartir"/);
});

test('si ya falló una vez, el botón no se vuelve a ofrecer', () => {
  // `canShare({files})` dice que sí y `share()` falla igual — pasó en el Android
  // del usuario. Como el navegador miente, la única fuente confiable es haberlo
  // intentado. Repetir el error cada semana enseña a desconfiar de la pantalla.
  const estado = cargar(estadoLimpio());
  const conFallo = { ...estado, preferencias: { ...estado.preferencias, compartir_no_funciona: true } };
  const html = dibujarDatos({ estado: conFallo, puedeCompartir: true });

  assert.equal(/data-accion="compartir"/.test(html), false);
  assert.equal(/data-accion="compartir-planilla"/.test(html), false);
});

test('cuando no se ofrece compartir, descargar vuelve a ser el botón principal', () => {
  const estado = cargar(estadoLimpio());
  const conFallo = { ...estado, preferencias: { ...estado.preferencias, compartir_no_funciona: true } };
  const boton = dibujarDatos({ estado: conFallo, puedeCompartir: true })
    .match(/<button[^>]*data-accion="exportar"[^>]*>/)[0];

  assert.match(boton, /class="principal"/);
});

test('la pantalla explica por qué no está el botón, y deja reintentar', () => {
  // Un botón que desaparece sin explicación se lee como un error de la app. Y
  // puede ser un permiso que el usuario cambie después: tiene que poder volver.
  const estado = cargar(estadoLimpio());
  const conFallo = { ...estado, preferencias: { ...estado.preferencias, compartir_no_funciona: true } };
  const html = dibujarDatos({ estado: conFallo, puedeCompartir: true });

  assert.match(html, /no funciona en este teléfono/);
  assert.match(html, /data-accion="reintentar-compartir"/);
});

test('sin haber fallado, no se explica nada ni se ofrece reintentar', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()), puedeCompartir: true });

  assert.equal(/reintentar-compartir/.test(html), false);
});

// ── El CSV en la pantalla (T-018) ────────────────────────────────────────────

test('la pantalla ofrece descargar el CSV, con su nombre', () => {
  const html = dibujarDatos({ estado: cargar(estadoLimpio()) });

  assert.match(html, /data-accion="exportar-csv"/);
  assert.match(html, /viajecor-\d{4}-\d{2}-\d{2}\.csv/);
});

test('la pantalla explica para qué es el CSV y en qué se diferencia', () => {
  // Dos botones que bajan "los datos" sin decir en qué se diferencian obligan a
  // probar los dos para entenderlo.
  const html = dibujarDatos({ estado: cargar(estadoLimpio()) });

  assert.match(html, /el tipo de cambio que se aplicó/);
  assert.match(html, /para procesar/);
});
