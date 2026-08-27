// T-017 — Tests de traer un respaldo.
//
// Importar es la única operación de la app que puede **destruir datos que el
// usuario no está mirando**, y la hace alguien convencido de que está
// recuperando datos, no perdiéndolos. Los tests de acá son casi todos sobre las
// dos formas en que eso sale mal: borrar de más al reemplazar, y duplicar todo
// al agregar.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  leerRespaldo,
  previsualizar,
  aplicarImportacion,
  MODO_REEMPLAZAR,
  MODO_AGREGAR,
} from '../src/datos/importar.js';

import { dibujarImportar } from '../src/ui/pantallas/datos.js';
import { contenidoDelRespaldo, anotarRespaldo } from '../src/datos/exportar.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { intentarGuardar, borradorNuevo } from '../src/ui/pantallas/movimiento.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

function estadoLimpio() {
  return estadoInicial({ monedas: monedasIniciales() });
}

let contador = 0;
function cargar(estado, campos = {}) {
  contador += 1;
  const resultado = intentarGuardar(estado, {
    ...borradorNuevo({ estado }),
    fecha: '2026-03-14', rubro: 'supermercado', monto: `${contador},50`, ...campos,
  });
  assert.equal(resultado.error, undefined, resultado.error);
  return resultado.estado;
}

/** Un respaldo leído, como lo devuelve leerRespaldo. */
function respaldoDe(estado) {
  const leido = leerRespaldo(contenidoDelRespaldo(estado, { fecha: '2026-08-25' }));
  assert.equal(leido.error, undefined, leido.error);
  return leido;
}

// ── Leer el archivo ──────────────────────────────────────────────────────────

test('un respaldo propio se lee entero', () => {
  let estado = cargar(estadoLimpio(), { comentario: 'Roma' });
  estado = cargar(estado, { rubro: 'viajes' });
  const leido = respaldoDe(estado);

  assert.equal(leido.estado.movimientos.length, 2);
  assert.deepEqual(leido.estado.movimientos, estado.movimientos);
  assert.equal(leido.exportado, '2026-08-25');
  assert.deepEqual(leido.incidencias, []);
});

test('un archivo que no es un respaldo se rechaza explicando por qué', () => {
  // El usuario tiene que poder entender qué pasó y probar con otro archivo.
  const casos = [
    ['', /vacío/],
    ['   ', /vacío/],
    ['no soy json', /no se pudo leer como JSON/],
    ['[1,2,3]', /no tiene la forma/],
    ['"hola"', /no tiene la forma/],
    ['{"otra":"cosa"}', /no tiene una lista de movimientos/],
    [null, /vacío/],
  ];

  for (const [texto, esperado] of casos) {
    const leido = leerRespaldo(texto);
    assert.match(leido.error, esperado, `con ${JSON.stringify(texto)}`);
    assert.equal(leido.estado, undefined, 'no devuelve datos a medias');
  }
});

test('un respaldo con registros rotos se lee igual, informando cuáles', () => {
  // Descartar el archivo entero por tres movimientos rotos perdería todo lo
  // demás; aceptarlos en silencio metería basura. Se lee lo bueno y se avisa.
  const bueno = cargar(estadoLimpio()).movimientos[0];
  const texto = JSON.stringify({
    esquema: 1,
    movimientos: [bueno, { id: 'mov_roto', fecha: '2026-02-30' }, { no: 'es un movimiento' }],
  });

  const leido = leerRespaldo(texto);
  assert.equal(leido.error, undefined);
  assert.equal(leido.estado.movimientos.length, 1);
  assert.equal(leido.incidencias.length, 1);
  assert.match(leido.incidencias[0], /2 registros de movimientos/);
});

// ── Ver qué va a pasar, antes de que pase ────────────────────────────────────

test('la previa dice cuántos entran, cuántos ya están y cuántos se perderían', () => {
  const compartido = cargar(estadoLimpio());
  const enElArchivo = cargar(compartido, { rubro: 'viajes' });
  const enLaApp = cargar(compartido, { rubro: 'salud' });

  const datos = previsualizar(enLaApp, respaldoDe(enElArchivo));

  assert.equal(datos.trae, 2, 'el archivo trae 2');
  assert.equal(datos.tenes, 2, 'la app tiene 2');
  assert.equal(datos.yaEstan, 1, 'comparten 1');
  assert.equal(datos.nuevos, 1);
  assert.equal(datos.siAgrego, 3);
  assert.equal(datos.siReemplazo, 2);
  assert.equal(datos.sePierden, 1, 'el de salud no está en el archivo');
});

test('previsualizar NO toca nada', () => {
  const estado = cargar(estadoLimpio());
  const antes = JSON.stringify(estado);
  previsualizar(estado, respaldoDe(cargar(estadoLimpio(), { rubro: 'viajes' })));
  assert.equal(JSON.stringify(estado), antes);
});

test('sobre una app vacía, reemplazar no pierde nada y se dice', () => {
  const datos = previsualizar(estadoLimpio(), respaldoDe(cargar(estadoLimpio())));
  assert.equal(datos.sePierden, 0);
  assert.equal(datos.tenes, 0);
});

// ── Agregar: lo que no puede pasar es duplicar ───────────────────────────────

test('importar dos veces el mismo respaldo deja lo mismo que importarlo una', () => {
  // Es LA prueba de esta tarea. Duplicar cada gasto no da error: da todos los
  // totales al doble, en silencio, para siempre.
  const estado = cargar(cargar(estadoLimpio()));
  const respaldo = respaldoDe(estado);

  const unaVez = aplicarImportacion(estado, respaldo, MODO_AGREGAR);
  const dosVeces = aplicarImportacion(unaVez, respaldo, MODO_AGREGAR);

  assert.equal(unaVez.movimientos.length, 2);
  assert.equal(dosVeces.movimientos.length, 2);
  assert.deepEqual(dosVeces.movimientos, estado.movimientos);
});

test('agregar suma solo lo que falta, y conserva lo que había', () => {
  const compartido = cargar(estadoLimpio());
  const enElArchivo = cargar(compartido, { rubro: 'viajes' });
  const enLaApp = cargar(compartido, { rubro: 'salud' });

  const despues = aplicarImportacion(enLaApp, respaldoDe(enElArchivo), MODO_AGREGAR);

  assert.equal(despues.movimientos.length, 3);
  // Los que ya tenía siguen, y en su orden.
  assert.deepEqual(despues.movimientos.slice(0, 2), enLaApp.movimientos);
  assert.ok(despues.movimientos.some((m) => m.rubro === 'viajes'));
  assert.ok(despues.movimientos.some((m) => m.rubro === 'salud'));
});

test('agregar trae también los tipos de cambio que falten', () => {
  // Sin ellos, los movimientos importados entrarían sin poder convertirse a
  // euros y quedarían fuera de todos los totales.
  // Primero el tipo de cambio, después el gasto: al revés la app no deja
  // guardarlo, que es exactamente lo que hace falta que el respaldo resuelva.
  const conCambio = cargar(
    {
      ...estadoLimpio(),
      tipos_cambio: [crearCambio(
        { moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) },
        { creado: '2026-03-14' }
      )],
    },
    { moneda: 'CRC', monto: '10000', rubro: 'viajes' }
  );

  const despues = aplicarImportacion(estadoLimpio(), respaldoDe(conCambio), MODO_AGREGAR);
  assert.equal(despues.tipos_cambio.length, 1);
});

test('un tipo de cambio que ya tenías NO lo pisa el del archivo', () => {
  // Pudiste haberlo corregido después de exportar. Pisarlo con el viejo
  // cambiaría totales que ya diste por buenos, sin decírtelo.
  const viejo = crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(630) }, { creado: '2026-03-14' });
  const corregido = crearCambio({ moneda: 'CRC', mes: '2026-03', euros_por_unidad: desdeUnidadesPorEuro(500) }, { creado: '2026-04-01' });

  const archivo = respaldoDe({ ...estadoLimpio(), tipos_cambio: [viejo] });
  const despues = aplicarImportacion({ ...estadoLimpio(), tipos_cambio: [corregido] }, archivo, MODO_AGREGAR);

  assert.equal(despues.tipos_cambio.length, 1);
  assert.equal(despues.tipos_cambio[0].euros_por_unidad, corregido.euros_por_unidad);
});

test('agregar trae las monedas que falten sin repetir las que hay', () => {
  const conMoneda = {
    ...estadoLimpio(),
    monedas: [...monedasIniciales(), { codigo: 'JPY', nombre: 'Yen japonés', decimales: 0, oculta: false }],
  };
  const despues = aplicarImportacion(estadoLimpio(), respaldoDe(conMoneda), MODO_AGREGAR);

  assert.equal(despues.monedas.length, 5);
  assert.equal(new Set(despues.monedas.map((m) => m.codigo)).size, 5);
});

// ── Reemplazar: lo que no puede pasar es borrar de más ───────────────────────

test('reemplazar deja exactamente lo del archivo', () => {
  const enLaApp = cargar(cargar(estadoLimpio(), { rubro: 'salud' }), { rubro: 'transporte' });
  const enElArchivo = cargar(estadoLimpio(), { rubro: 'viajes' });

  const despues = aplicarImportacion(enLaApp, respaldoDe(enElArchivo), MODO_REEMPLAZAR);

  assert.equal(despues.movimientos.length, 1);
  assert.equal(despues.movimientos[0].rubro, 'viajes');
});

test('importar deja como último respaldo la fecha del archivo si es más nueva', () => {
  // El archivo ES la prueba de que ese día hubo un respaldo. Sin esto, un
  // teléfono nuevo que acaba de importar un archivo de hoy diría "nunca
  // respaldaste", que es lo contrario de la verdad.
  const enLaApp = anotarRespaldo(cargar(estadoLimpio()), { fecha: '2026-08-20' });

  for (const modo of [MODO_AGREGAR, MODO_REEMPLAZAR]) {
    const despues = aplicarImportacion(enLaApp, respaldoDe(estadoLimpio()), modo);
    assert.equal(despues.preferencias.ultimo_respaldo, '2026-08-25', `con modo ${modo}`);
  }
});

test('un archivo viejo no atrasa la fecha del último respaldo', () => {
  // Decir que el último respaldo es más antiguo de lo que fue también es
  // mentir, y en la dirección que hace respaldar de más.
  const enLaApp = anotarRespaldo(cargar(estadoLimpio()), { fecha: '2026-08-30' });

  for (const modo of [MODO_AGREGAR, MODO_REEMPLAZAR]) {
    const despues = aplicarImportacion(enLaApp, respaldoDe(estadoLimpio()), modo);
    assert.equal(despues.preferencias.ultimo_respaldo, '2026-08-30', `con modo ${modo}`);
  }
});

test('un archivo sin fecha válida no rompe la importación', () => {
  // El archivo lo pudo escribir cualquiera; una fecha rota no puede impedir
  // recuperar los gastos.
  const leido = leerRespaldo(JSON.stringify({
    esquema: 1,
    exportado: 'el martes',
    movimientos: cargar(estadoLimpio()).movimientos,
  }));

  const despues = aplicarImportacion(estadoLimpio(), leido, MODO_REEMPLAZAR);
  assert.equal(despues.movimientos.length, 1);
  assert.equal(despues.preferencias.ultimo_respaldo, undefined);
});

test('ninguno de los dos modos modifica el estado que recibe', () => {
  for (const modo of [MODO_AGREGAR, MODO_REEMPLAZAR]) {
    const estado = cargar(estadoLimpio());
    const antes = JSON.stringify(estado);
    aplicarImportacion(estado, respaldoDe(cargar(estadoLimpio(), { rubro: 'viajes' })), modo);
    assert.equal(JSON.stringify(estado), antes, `con modo ${modo}`);
  }
});

test('un modo inventado se rechaza en vez de hacer cualquier cosa', () => {
  assert.throws(
    () => aplicarImportacion(estadoLimpio(), respaldoDe(estadoLimpio()), 'mezclar'),
    /Modo de importación desconocido/
  );
});

// ── Ida y vuelta completa ────────────────────────────────────────────────────

test('exportar, borrar todo e importar deja los datos como estaban', () => {
  // Es el recorrido real: cambiás de teléfono, o borrás los datos del navegador.
  let original = cargar(estadoLimpio(), { comentario: 'Roma', detalle: 'cena' });
  original = cargar(original, { moneda: 'EUR', rubro: 'gastos fijos', comentario: 'Luz' });

  const texto = contenidoDelRespaldo(original, { fecha: '2026-08-25' });
  const enBlanco = estadoLimpio();
  const recuperado = aplicarImportacion(enBlanco, leerRespaldo(texto), MODO_REEMPLAZAR);

  assert.deepEqual(recuperado.movimientos, original.movimientos);
  assert.deepEqual(recuperado.monedas, original.monedas);
  assert.equal(recuperado.preferencias.moneda_predeterminada, original.preferencias.moneda_predeterminada);
});

// ── Lo que se ve en la pantalla ──────────────────────────────────────────────

test('sin archivo elegido, la pantalla ofrece los dos caminos', () => {
  // El mismo motivo que al exportar: la app se abre desde un archivo del disco
  // y no puede confiar en que elegir un archivo funcione siempre.
  const html = dibujarImportar({ estado: estadoLimpio() });

  assert.ok(html.includes('type="file"'));
  assert.ok(html.includes('data-accion="leer-pegado"'));
  assert.equal(html.includes('data-accion="importar"'), false, 'todavía no hay nada que importar');
});

test('la previa muestra los números ANTES de ofrecer los botones', () => {
  const enLaApp = cargar(estadoLimpio(), { rubro: 'salud' });
  const enElArchivo = cargar(estadoLimpio(), { rubro: 'viajes' });
  const leido = respaldoDe(enElArchivo);

  const html = dibujarImportar({
    estado: enLaApp,
    importacion: { leido, datos: previsualizar(enLaApp, leido), exportado: '2026-08-25' },
  });

  assert.ok(html.includes('25 de agosto de 2026'), 'dice de cuándo es el archivo');
  assert.ok(html.includes('Agregar a lo que tenés'));
  assert.ok(html.includes('Reemplazar todo'));
  assert.ok(html.includes(`data-modo="${MODO_AGREGAR}"`));
  assert.ok(html.includes(`data-modo="${MODO_REEMPLAZAR}"`));
});

test('la previa dice con todas las letras cuántos se borrarían', () => {
  // Es el número que nadie mira y el que más duele.
  const enLaApp = cargar(cargar(estadoLimpio(), { rubro: 'salud' }), { rubro: 'transporte' });
  const leido = respaldoDe(cargar(estadoLimpio(), { rubro: 'viajes' }));

  const html = dibujarImportar({
    estado: enLaApp,
    importacion: { leido, datos: previsualizar(enLaApp, leido), exportado: null },
  });

  assert.ok(html.includes('Se borrarían 2 movimientos'));
  assert.ok(html.includes('perdida'), 'y se ve como una pérdida, no como un detalle');
});

test('si no se pierde nada al reemplazar, también se dice', () => {
  const leido = respaldoDe(cargar(estadoLimpio()));
  const html = dibujarImportar({
    estado: estadoLimpio(),
    importacion: { leido, datos: previsualizar(estadoLimpio(), leido), exportado: null },
  });

  assert.ok(html.includes('No perderías ninguno'));
  assert.equal(html.includes('Se borrarían'), false);
});

test('la previa explica por qué agregar puede sumar menos de lo que trae', () => {
  const compartido = cargar(estadoLimpio());
  const leido = respaldoDe(cargar(compartido, { rubro: 'viajes' }));
  const html = dibujarImportar({
    estado: compartido,
    importacion: { leido, datos: previsualizar(compartido, leido), exportado: null },
  });

  assert.ok(html.includes('se saltea 1 que ya tenías'));
});

test('los registros que no se pudieron leer se muestran en la previa', () => {
  const bueno = cargar(estadoLimpio()).movimientos[0];
  const leido = leerRespaldo(JSON.stringify({
    esquema: 1,
    movimientos: [bueno, { id: 'roto', fecha: 'ayer' }],
  }));

  const html = dibujarImportar({
    estado: estadoLimpio(),
    importacion: { leido, datos: previsualizar(estadoLimpio(), leido), exportado: null },
  });

  assert.ok(html.includes('no se pudieron leer'));
  assert.ok(html.includes('role="alert"'));
});

test('un error al leer se muestra y no deja una previa a medias', () => {
  const html = dibujarImportar({
    estado: estadoLimpio(),
    errorImportar: 'Este archivo no es un respaldo de Viajecor.',
  });

  assert.ok(html.includes('no es un respaldo'));
  assert.equal(html.includes('data-accion="importar"'), false);
});

test('cuando no entra nada, la previa lo dice y no ofrece un botón inerte', () => {
  // Lo encontró el recorrido en el navegador: "Entran 0 movimientos nuevos" con
  // un botón "Agregar" que no hace nada. Un botón que no hace nada es peor que
  // ninguno: el usuario cree que falló la app.
  const mismo = cargar(cargar(estadoLimpio()), { rubro: 'viajes' });
  const leido = respaldoDe(mismo);
  const html = dibujarImportar({
    estado: mismo,
    importacion: { leido, datos: previsualizar(mismo, leido), exportado: null },
  });

  assert.ok(html.includes('No entra ninguno'));
  assert.equal(html.includes('Entran 0'), false);
  assert.match(html, /data-modo="agregar" disabled/);
});

test('perder un solo movimiento se dice en singular', () => {
  // "Se borrarían 1 movimiento" es la clase de frase que hace desconfiar del
  // número, que es justo el número que hay que leer con atención.
  const enLaApp = cargar(estadoLimpio());
  const leido = respaldoDe(estadoLimpio());
  const html = dibujarImportar({
    estado: enLaApp,
    importacion: { leido, datos: previsualizar(enLaApp, leido), exportado: null },
  });

  assert.ok(html.includes('Se borraría 1 movimiento'));
  assert.equal(html.includes('Se borrarían 1'), false);
});
