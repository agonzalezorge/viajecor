// T-943 — Tests de buscar texto en todos los movimientos (CU-17).
//
// Lo que puede salir mal en una búsqueda no es que no encuentre: es que
// **encuentre de menos y no lo diga**. Un gasto que existe y no aparece se lee
// como un gasto que no se cargó, y el usuario lo vuelve a cargar. Por eso casi
// todos los tests de acá son de la forma "esto TIENE que aparecer".

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buscar, palabrasDe, normalizarBusqueda, textoDeMovimiento } from '../src/core/busqueda.js';
import { dibujarBuscador, dibujarResultados, dibujarLista } from '../src/ui/pantallas/lista.js';
import { irA } from '../src/ui/app.js';

import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

let contador = 0;
function mov({ monto, rubro = 'viajes', fecha = '2026-03-14', comentario = '', detalle = '', tipo = TIPO_GASTO, moneda = 'EUR' }) {
  contador += 1;
  const m = crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: fecha }
  );
  return { ...m, detalle };
}

const estadoCon = (movimientos, cambios = []) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios });

const VARIOS = () => estadoCon([
  mov({ monto: '12,50', comentario: 'Perú', detalle: 'cena', fecha: '2025-10-03' }),
  mov({ monto: '99', comentario: 'Roma', detalle: 'hotel', fecha: '2026-03-14' }),
  mov({ monto: '40', rubro: 'gastos fijos', comentario: 'Luz', fecha: '2026-07-05' }),
  mov({ monto: '2100', rubro: 'trabajo', tipo: TIPO_INGRESO, fecha: '2026-07-01' }),
]);

const comentarios = (encontrados) => encontrados.map((m) => m.comentario || m.rubro);


// ── Dónde busca ──────────────────────────────────────────────────────────────

test('busca en la etiqueta, el detalle y el rubro', () => {
  assert.deepEqual(comentarios(buscar(VARIOS(), 'roma')), ['Roma']);
  assert.deepEqual(comentarios(buscar(VARIOS(), 'hotel')), ['Roma']);
  assert.deepEqual(comentarios(buscar(VARIOS(), 'gastos fijos')), ['Luz']);
});

test('busca en el importe, como se ve y como se guarda', () => {
  // El usuario busca por lo que ve en la pantalla, no por lo que hay en el
  // archivo: `12,50` es lo que lee y `1250` es lo que está guardado.
  assert.deepEqual(comentarios(buscar(VARIOS(), '12,50')), ['Perú']);
  assert.deepEqual(comentarios(buscar(VARIOS(), '1250')), ['Perú']);
});

test('busca en la fecha, en las dos formas', () => {
  assert.deepEqual(comentarios(buscar(VARIOS(), '2025-10-03')), ['Perú']);
  assert.deepEqual(comentarios(buscar(VARIOS(), '03/10/2025')), ['Perú']);
});

test('busca por tipo y por moneda', () => {
  assert.deepEqual(comentarios(buscar(VARIOS(), 'ingreso')), ['trabajo']);
  assert.equal(buscar(VARIOS(), 'gasto').length, 3);
  assert.equal(buscar(VARIOS(), 'eur').length, 4);
});

test('busca también por el valor en euros de un gasto en otra moneda', () => {
  // Es el número que se ve en la lista cuando el gasto es en colones.
  const cambio = crearCambio(
    { moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) },
    { creado: '2026-03-01' }
  );
  const estado = estadoCon([mov({ monto: '6300', moneda: 'CRC', comentario: 'San José' })], [cambio]);

  assert.equal(buscar(estado, '10,00').length, 1, '6300 colones son 10 euros');
  assert.equal(buscar(estado, '6300').length, 1, 'y también se encuentra por su monto propio');
});


// ── Cómo compara ─────────────────────────────────────────────────────────────

test('no distingue mayúsculas', () => {
  assert.equal(buscar(VARIOS(), 'ROMA').length, 1);
  assert.equal(buscar(VARIOS(), 'RoMa').length, 1);
});

test('BUSCAR sí saca las tildes, aunque agrupar no', () => {
  // No es una contradicción con ADR-013: agrupar junta plata y equivocarse ahí
  // no se ve; buscar solo muestra, y equivocarse de menos esconde un gasto que
  // existe.
  assert.deepEqual(comentarios(buscar(VARIOS(), 'peru')), ['Perú']);
  assert.deepEqual(comentarios(buscar(VARIOS(), 'PERÚ')), ['Perú']);
  assert.equal(normalizarBusqueda('  Perú  Ñandú '), 'peru ñandu');
  assert.equal(normalizarBusqueda('pingüino'), 'pinguino', 'la diéresis sí se saca');
});

test('la Ñ NO es una N con tilde', () => {
  // Para Unicode sí lo es, y `NFD` la parte igual que a la á. Para el español es
  // otra letra: sin cuidarla, buscar `ano` encontraría todos los `año`.
  assert.equal(normalizarBusqueda('año'), 'año');
  assert.equal(normalizarBusqueda('MAÑANA'), 'mañana');
  assert.equal(normalizarBusqueda('Coruña'), 'coruña');

  const estado = estadoCon([
    mov({ monto: '10', comentario: 'Año nuevo' }),
    mov({ monto: '10', comentario: 'Ano de prueba' }),
  ]);
  assert.deepEqual(comentarios(buscar(estado, 'año')), ['Año nuevo']);
  assert.deepEqual(comentarios(buscar(estado, 'ano')), ['Ano de prueba']);
});

test('con varias palabras tienen que estar TODAS', () => {
  // Buscar dos palabras es acordarse de dos cosas del mismo gasto, no de dos
  // gastos distintos.
  assert.equal(buscar(VARIOS(), 'roma hotel').length, 1);
  assert.equal(buscar(VARIOS(), 'roma cena').length, 0, 'son de movimientos distintos');
});

test('los espacios de más no cambian el resultado', () => {
  assert.equal(buscar(VARIOS(), '  roma   hotel  ').length, 1);
});

test('buscar nada no devuelve todo', () => {
  // Devolver todo haría que abrir la lupa y no escribir se viera como una
  // búsqueda con 900 resultados.
  for (const nada of ['', '   ', null, undefined]) {
    assert.deepEqual(buscar(VARIOS(), nada), []);
    assert.deepEqual(palabrasDe(nada), []);
  }
});


// ── Qué devuelve ─────────────────────────────────────────────────────────────

test('mira TODO el historial, no el mes que se está viendo', () => {
  // Quien busca "psicóloga" no sabe en qué mes fue: si lo supiera no buscaría.
  const encontrados = buscar(VARIOS(), 'gasto');
  const meses = new Set(encontrados.map((m) => m.fecha.slice(0, 7)));

  assert.ok(meses.size > 1, 'la búsqueda se quedó en un solo mes');
});

test('del más nuevo al más viejo', () => {
  const fechas = buscar(VARIOS(), 'gasto').map((m) => m.fecha);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test('un movimiento con la fecha rota igual se encuentra por su etiqueta', () => {
  // Un dato roto no puede sacar al movimiento de TODA búsqueda: es justamente
  // el que hay que poder encontrar para arreglarlo.
  const roto = { ...mov({ monto: '10', comentario: 'Roto' }), fecha: 'ayer' };
  assert.equal(buscar(estadoCon([roto]), 'roto').length, 1);
});

test('sin tope de filas (L-001)', () => {
  const movimientos = Array.from({ length: 1500 }, () => mov({ monto: '1', comentario: 'Roma' }));
  assert.equal(buscar(estadoCon(movimientos), 'roma').length, 1500);
});

test('textoDeMovimiento junta todo en minúsculas y sin tildes', () => {
  const texto = textoDeMovimiento(VARIOS(), VARIOS().movimientos[0]);

  assert.ok(texto.includes('peru'));
  assert.ok(texto.includes('cena'));
  assert.ok(texto.includes('viajes'));
  assert.equal(texto, texto.toLowerCase());
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('la lupa está en la pestaña de movimientos', () => {
  const html = dibujarLista({ estado: VARIOS(), mes: '2026-03' });

  assert.ok(html.includes('name="busqueda"'));
  assert.ok(html.includes('🔍'), 'sin la lupa no se ve que se puede buscar');
  assert.ok(html.includes('type="search"'), 'en el celular es el teclado con "buscar"');
});

test('la lupa está aunque el mes esté vacío', () => {
  // Es justamente cuando más falta hace buscar en los otros meses.
  const html = dibujarLista({ estado: estadoCon([]), mes: '2026-03' });

  assert.ok(html.includes('name="busqueda"'));
  assert.ok(html.includes('No hay movimientos en este mes'));
});

test('buscando, la lista del mes no se dibuja abajo', () => {
  // Serían dos listas de movimientos una abajo de la otra, y la de abajo se
  // leería como parte de los resultados.
  const html = dibujarLista({ estado: VARIOS(), mes: '2026-03', busqueda: 'roma' });

  assert.ok(html.includes('Roma'));
  assert.equal(html.includes('en marzo de 2026.'), false);
});

test('los resultados dicen cuántos son y cuánto suman', () => {
  const html = dibujarResultados({ estado: VARIOS(), mes: '2026-03', busqueda: 'gasto' });

  assert.ok(html.includes('3 movimientos'));
  assert.ok(html.includes('151,50'), 'no suma lo encontrado');
  assert.ok(html.includes('en todos los meses'));
});

test('cada resultado dice de qué día es', () => {
  // La búsqueda cruza once meses: sin la fecha, la lista no se puede leer.
  const html = dibujarResultados({ estado: VARIOS(), mes: '2026-03', busqueda: 'gasto' });

  assert.ok(html.includes('3 de octubre de 2025'));
  assert.ok(html.includes('14 de marzo de 2026'));
});

test('sin resultados se explica dónde se buscó', () => {
  // "No hay nada" sobre datos que sí están se lee como que la app perdió algo.
  const html = dibujarResultados({ estado: VARIOS(), mes: '2026-03', busqueda: 'tokio' });

  assert.ok(html.includes('Ningún movimiento dice'));
  assert.ok(html.includes('tokio'));

  // Y la explicación tiene que VERSE, no solo estar: un `hidden` la deja en la
  // página y fuera de la pantalla, y una mutación pasó por ahí (L-026).
  const explicacion = html.match(/<p([^>]*)>Se busca en la etiqueta[\s\S]*?<\/p>/);
  assert.ok(explicacion, 'no dice dónde busca');
  assert.equal(/\bhidden\b/.test(explicacion[1]), false, 'la explicación está escondida');
  assert.ok(explicacion[0].includes('tildes'), 'no dice que no distingue tildes');
});

test('sin nada escrito no se dibujan resultados', () => {
  assert.equal(dibujarResultados({ estado: VARIOS(), busqueda: '' }), '');
  assert.equal(dibujarResultados({ estado: VARIOS(), busqueda: undefined }), '');
});

test('desde los resultados se puede corregir y borrar', () => {
  // Encontrar un dedazo y no poder arreglarlo ahí mismo obliga a ir a buscarlo
  // otra vez al mes que sea.
  const html = dibujarResultados({ estado: VARIOS(), mes: '2026-03', busqueda: 'roma' });

  assert.ok(html.includes('data-accion="editar"') || html.includes('Corregir'));
  assert.ok(html.includes('Borrar'));
});

test('lo buscado se conserva al redibujar la pantalla', () => {
  // Borrar un movimiento desde los resultados repinta todo: si lo buscado no
  // sobreviviera, la búsqueda se perdería justo al usarla.
  const html = dibujarBuscador({ busqueda: 'roma' });
  assert.ok(html.includes('value="roma"'));
});

test('la búsqueda NO sobrevive a cambiar de pestaña', () => {
  // Es lo mismo que el filtro (ADR-034): una lista incompleta a la que se
  // vuelve media hora después se lee como datos que faltan.
  const vista = { pantalla: 'movimientos', mes: '2026-03', estado: VARIOS(), busqueda: 'roma' };

  assert.equal(irA(vista, 'datos').busqueda, '');
  assert.equal(irA(vista, 'movimientos').busqueda, '');
});

test('el texto buscado no puede romper la página', () => {
  const html = dibujarResultados({ estado: VARIOS(), busqueda: '<script>x' });

  assert.equal(html.includes('<script>x'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la búsqueda no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarResultados({ estado: VARIOS(), busqueda: 'roma' })), false);
});
