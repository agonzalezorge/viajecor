// T-011 — Tests de la pantalla de carga.
//
// Es la puerta por la que entra todo lo que la app va a mostrar después. Los
// tests de acá se reparten en dos: qué pasa cuando algo sale mal —que es la
// mitad interesante— y qué queda puesto para la próxima carga, que es lo que
// hace que anotar un gasto lleve quince segundos y no cuarenta.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  borradorNuevo,
  intentarGuardar,
  dibujarNuevo,
  fechaEnPalabras,
} from '../src/ui/pantallas/movimiento.js';

import { movimientosDelMes } from '../src/core/calculos.js';

import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio } from '../src/core/cambio.js';
import { hoy, TIPO_GASTO, TIPO_INGRESO, crearMovimiento } from '../src/core/modelo.js';

const DURO = ' ';

function estadoLimpio(extra = {}) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), ...extra };
}

/** Un estado con movimientos ya cargados, para probar el autocompletado. */
function conComentarios(...comentarios) {
  return estadoLimpio({
    movimientos: comentarios.map((comentario, i) => crearMovimiento(
      { tipo: TIPO_GASTO, rubro: 'supermercado', monto: '10', moneda: 'EUR', fecha: `2026-03-0${i + 1}`, comentario },
      { decimales: 2, id: `mov_${i}`, creado: `2026-03-0${i + 1}` }
    )),
  });
}

/** Un estado con detalles ya cargados. */
function conDetalles(...detalles) {
  return estadoLimpio({
    movimientos: detalles.map((detalle, i) => crearMovimiento(
      { tipo: TIPO_GASTO, rubro: 'supermercado', monto: '10', moneda: 'EUR', fecha: `2026-03-0${i + 1}`, comentario: '', detalle },
      { decimales: 2, id: `mov_${i}`, creado: `2026-03-0${i + 1}` }
    )),
  });
}

function borradorDe(campos = {}) {
  return { ...borradorNuevo({ estado: estadoLimpio() }), rubro: 'supermercado', monto: '12,50', ...campos };
}

// ── El formulario que viene puesto ───────────────────────────────────────────

test('el formulario nuevo viene con fecha de hoy, gasto y euros', () => {
  const borrador = borradorNuevo({ estado: estadoLimpio() });
  assert.equal(borrador.fecha, hoy());
  assert.equal(borrador.tipo, TIPO_GASTO);
  assert.equal(borrador.moneda, 'EUR');
  assert.equal(borrador.monto, '');
  assert.equal(borrador.rubro, '');
});

test('la moneda que viene puesta es la última usada (RN-04)', () => {
  // Es lo que evita elegir "colón" treinta veces seguidas en un viaje.
  const estado = estadoLimpio({ preferencias: { moneda_predeterminada: 'CRC' } });
  assert.equal(borradorNuevo({ estado }).moneda, 'CRC');
});

// ── Guardar bien ─────────────────────────────────────────────────────────────

test('se puede cargar un gasto (CU-01)', () => {
  const { estado, aviso, error } = intentarGuardar(estadoLimpio(), borradorDe());

  assert.equal(error, undefined);
  assert.equal(estado.movimientos.length, 1);
  const mov = estado.movimientos[0];
  assert.equal(mov.tipo, 'G');
  assert.equal(mov.monto, 1250);
  assert.equal(mov.rubro, 'supermercado');
  assert.equal(mov.moneda, 'EUR');
  assert.equal(aviso.movimiento.id, mov.id);
});

test('se puede cargar un ingreso (CU-02)', () => {
  const { estado, error } = intentarGuardar(
    estadoLimpio(),
    borradorDe({ tipo: TIPO_INGRESO, rubro: 'trabajo', monto: '2100' })
  );

  assert.equal(error, undefined);
  assert.equal(estado.movimientos[0].tipo, 'I');
  assert.equal(estado.movimientos[0].monto, 210000);
});

test('guardar no modifica el estado que recibe', () => {
  const antes = estadoLimpio();
  intentarGuardar(antes, borradorDe());
  assert.equal(antes.movimientos.length, 0);
});

test('la moneda usada queda de predeterminada para la próxima (RN-04)', () => {
  const conCambio = estadoLimpio({
    tipos_cambio: [crearCambio({ moneda: 'CRC', mes: hoy().slice(0, 7), euros_por_unidad: 0.00164 }, { creado: hoy() })],
  });
  const { estado, borrador } = intentarGuardar(conCambio, borradorDe({ moneda: 'CRC', monto: '10000' }));

  assert.equal(estado.preferencias.moneda_predeterminada, 'CRC');
  assert.equal(borrador.moneda, 'CRC');
});

test('el formulario se vacía pero conserva la fecha', () => {
  // Cargar tres gastos del sábado no puede obligar a poner la fecha tres veces.
  const { borrador } = intentarGuardar(estadoLimpio(), borradorDe({ fecha: '2026-03-14', comentario: 'Roma' }));

  assert.equal(borrador.fecha, '2026-03-14');
  assert.equal(borrador.monto, '');
  assert.equal(borrador.rubro, '');
  assert.equal(borrador.comentario, '');
});

test('dos gastos seguidos se suman a la lista, no se pisan', () => {
  const primero = intentarGuardar(estadoLimpio(), borradorDe({ monto: '10' }));
  const segundo = intentarGuardar(primero.estado, borradorDe({ monto: '20' }));

  assert.equal(segundo.estado.movimientos.length, 2);
  assert.deepEqual(segundo.estado.movimientos.map((m) => m.monto), [1000, 2000]);
  // Y con identificadores distintos, o editar uno cambiaría el otro.
  assert.notEqual(segundo.estado.movimientos[0].id, segundo.estado.movimientos[1].id);
});

// ── Guardar mal: la mitad interesante ────────────────────────────────────────

test('un error de validación NO pierde lo que se escribió', () => {
  // Castigar dos veces el mismo error —rechazarlo y además borrar el
  // formulario— es la forma más rápida de que alguien deje de cargar gastos.
  const borrador = borradorDe({ rubro: '', comentario: 'Roma', detalle: 'cena' });
  const resultado = intentarGuardar(estadoLimpio(), borrador);

  assert.ok(resultado.error);
  assert.deepEqual(resultado.borrador, borrador);
  assert.equal(resultado.estado.movimientos.length, 0);
});

test('los mensajes de error son los del modelo, no otros nuevos', () => {
  // Reescribirlos acá sería tener dos versiones de la misma regla, que tarde o
  // temprano dicen cosas distintas.
  const casos = [
    [{ monto: '' }, /Falta el monto/],
    [{ monto: '0' }, /cero no se guarda/],
    [{ monto: '-5' }, /no puede ser negativo/],
    [{ monto: '1.234' }, /dos formas/],
    [{ rubro: 'cripto' }, /no es un rubro de gasto/],
    [{ tipo: TIPO_INGRESO, rubro: 'supermercado' }, /no es un rubro de ingreso/],
    [{ fecha: '2026-02-30' }, /no existe en el calendario/],
    [{ fecha: '' }, /fecha/i],
  ];

  for (const [campos, esperado] of casos) {
    const resultado = intentarGuardar(estadoLimpio(), borradorDe(campos));
    assert.match(resultado.error, esperado, `con ${JSON.stringify(campos)}`);
    assert.equal(resultado.estado.movimientos.length, 0);
  }
});

test('intentarGuardar nunca tira, siempre devuelve un error legible', () => {
  // La pantalla no puede romperse por un dato mal escrito: tiene que poder
  // mostrar qué pasó y dejar seguir.
  for (const campos of [{ monto: 'mucho' }, { moneda: 'XX' }, { fecha: null }, { tipo: 'Z' }]) {
    const resultado = intentarGuardar(estadoLimpio(), borradorDe(campos));
    assert.equal(typeof resultado.error, 'string');
    assert.ok(resultado.error.length > 10, 'el error tiene que explicar algo');
  }
});

test('una moneda que no está en el catálogo se rechaza sin suponer nada', () => {
  const resultado = intentarGuardar(estadoLimpio(), borradorDe({ moneda: 'JPY' }));
  assert.match(resultado.error, /no está en tu lista/);
});

// ── El tipo de cambio que falta (RN-04) ──────────────────────────────────────

test('sin tipo de cambio, un gasto en otra moneda NO se guarda', () => {
  // Guardarlo igual lo dejaría fuera de todos los totales sin que nada lo
  // delate: existiría en la lista y no existiría en ningún número.
  const resultado = intentarGuardar(estadoLimpio(), borradorDe({ moneda: 'CRC', monto: '10000' }));

  assert.equal(resultado.estado.movimientos.length, 0);
  assert.match(resultado.error, /Falta el tipo de cambio de CRC/);
  // Y dice de qué mes en español, no "2026-03", que no le dice nada a nadie.
  assert.match(resultado.error, /para \w+ de \d{4}\./);
  assert.deepEqual(resultado.faltaCambio.moneda, 'CRC');
});

test('con el tipo de cambio cargado, el mismo gasto entra', () => {
  const mes = hoy().slice(0, 7);
  const estado = estadoLimpio({
    tipos_cambio: [crearCambio({ moneda: 'CRC', mes, euros_por_unidad: 0.00164 }, { creado: hoy() })],
  });
  const resultado = intentarGuardar(estado, borradorDe({ moneda: 'CRC', monto: '10000' }));

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.estado.movimientos[0].monto, 1000000);
});

test('un gasto en euros nunca pide tipo de cambio', () => {
  const resultado = intentarGuardar(estadoLimpio(), borradorDe({ moneda: 'EUR' }));
  assert.equal(resultado.error, undefined);
});

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

test('el formulario trae todos los campos de CU-01', () => {
  const html = dibujarNuevo({ estado: estadoLimpio() });
  for (const campo of ['monto', 'moneda', 'rubro', 'fecha', 'comentario', 'detalle']) {
    assert.ok(html.includes(`name="${campo}"`), `falta el campo ${campo}`);
  }
  assert.ok(html.includes('data-accion="guardar"'));
});

test('el monto abre el teclado numérico del celular', () => {
  // Con el teclado de texto, escribir un importe son tres toques más. Es la
  // diferencia entre anotar el gasto y dejarlo para después.
  assert.ok(dibujarNuevo({ estado: estadoLimpio() }).includes('inputmode="decimal"'));
});

test('los rubros que se ofrecen son los del tipo elegido (RN-02)', () => {
  const estado = estadoLimpio();

  const gasto = dibujarNuevo({ estado, borrador: borradorDe({ tipo: TIPO_GASTO }) });
  assert.ok(gasto.includes('>Supermercado<'));
  assert.equal(gasto.includes('>Trabajo<'), false);

  const ingreso = dibujarNuevo({ estado, borrador: borradorDe({ tipo: TIPO_INGRESO, rubro: '' }) });
  assert.ok(ingreso.includes('>Trabajo<'));
  assert.equal(ingreso.includes('>Supermercado<'), false);
});

test('el título y el botón dicen si es gasto o ingreso', () => {
  const estado = estadoLimpio();
  assert.ok(dibujarNuevo({ estado, borrador: borradorDe() }).includes('Nuevo gasto'));
  assert.ok(dibujarNuevo({ estado, borrador: borradorDe({ tipo: TIPO_INGRESO }) }).includes('Nuevo ingreso'));
});

test('el selector de moneda muestra solo el código', () => {
  // "EUR — Euro" no entra al lado del monto en un celular y se corta a la
  // mitad, que es peor que no ponerlo.
  const html = dibujarNuevo({ estado: estadoLimpio() });
  assert.ok(html.includes('>EUR</option>'));
  assert.equal(html.includes('EUR — Euro'), false);
});

test('solo se ofrecen las monedas visibles', () => {
  const estado = estadoLimpio({
    monedas: monedasIniciales().map((m) => (m.codigo === 'USD' ? { ...m, oculta: true } : m)),
  });
  const html = dibujarNuevo({ estado });

  assert.ok(html.includes('value="CRC"'));
  assert.equal(html.includes('value="USD"'), false);
});

test('lo escrito se vuelve a dibujar tal cual tras un error', () => {
  const borrador = borradorDe({ comentario: 'Costa Rica', detalle: 'almuerzo', monto: '12,50' });
  const html = dibujarNuevo({ estado: estadoLimpio(), borrador, error: 'algo salió mal' });

  assert.ok(html.includes('value="Costa Rica"'));
  assert.ok(html.includes('value="almuerzo"'));
  assert.ok(html.includes('value="12,50"'));
  assert.ok(html.includes('algo salió mal'));
  assert.ok(html.includes('role="alert"'));
});

test('la confirmación dice qué se guardó, con su importe', () => {
  const { estado, aviso } = intentarGuardar(estadoLimpio(), borradorDe());
  const html = dibujarNuevo({ estado, aviso });

  assert.ok(html.includes('Gasto guardado'));
  assert.ok(html.includes(`12,50${DURO}€`));
  assert.ok(html.includes('role="status"'));
});

test('los últimos cargados se ven, para saber que se guardó', () => {
  let estado = estadoLimpio();
  for (const monto of ['10', '20', '30']) {
    estado = intentarGuardar(estado, borradorDe({ monto, comentario: 'Roma' })).estado;
  }
  const html = dibujarNuevo({ estado });

  assert.ok(html.includes('Últimos cargados'));
  assert.ok(html.includes(`30,00${DURO}€`));
  assert.ok(html.includes('Roma'));
  // El más nuevo primero.
  assert.ok(html.indexOf(`30,00${DURO}€`) < html.indexOf(`10,00${DURO}€`));
});

test('sin movimientos no se dibuja la lista de últimos', () => {
  assert.equal(dibujarNuevo({ estado: estadoLimpio() }).includes('Últimos cargados'), false);
});

test('un comentario con HTML no rompe la página', () => {
  // El comentario es texto libre. Alcanza un "<" para romper todo.
  const estado = intentarGuardar(estadoLimpio(), borradorDe({ comentario: '<b>Roma</b>' })).estado;
  const html = dibujarNuevo({ estado });

  assert.equal(html.includes('<b>Roma</b>'), false);
  assert.ok(html.includes('&lt;b&gt;Roma&lt;/b&gt;'));
});

// ── La fecha, sin depender del idioma del navegador (L-013) ──────────────────

test('la fecha se escribe también en español, debajo del calendario', () => {
  // El control "type=date" lo dibuja el sistema y elige el formato según SU
  // idioma: puede mostrar 08/25/2026. La app no puede decidirlo, así que en vez
  // de confiar en que salga bien, escribe la fecha sin ambigüedad posible.
  assert.equal(fechaEnPalabras('2026-08-25'), 'martes, 25 de agosto de 2026');
  assert.equal(fechaEnPalabras('2026-01-01'), 'jueves, 1 de enero de 2026');

  const html = dibujarNuevo({ estado: estadoLimpio(), borrador: borradorDe({ fecha: '2026-08-25' }) });
  assert.ok(html.includes('25 de agosto de 2026'));
});

test('una fecha a medio escribir no rompe la etiqueta', () => {
  // Mientras se usa el calendario el campo pasa por estados incompletos. Eso no
  // es un error: es alguien escribiendo.
  for (const media of ['', '2026-', '2026-08', 'nada', null]) {
    assert.equal(fechaEnPalabras(media), '');
  }
});

// ── Filtrar por mes ──────────────────────────────────────────────────────────

test('los movimientos de un mes son los de ese mes, sin límite de filas', () => {
  let estado = estadoLimpio();
  for (const fecha of ['2026-03-01', '2026-03-31', '2026-04-01', '2026-02-28']) {
    estado = intentarGuardar(estado, borradorDe({ fecha })).estado;
  }

  assert.equal(movimientosDelMes(estado.movimientos, '2026-03').length, 2);
  assert.equal(movimientosDelMes(estado.movimientos, '2026-04').length, 1);
  assert.equal(movimientosDelMes(estado.movimientos, '2026-01').length, 0);
});

// ── Orden de los campos y autocompletado (T-912) ─────────────────────────────

test('el detalle va penúltimo y el comentario último', () => {
  // Pedido del usuario (2026-08-27). Se comprueba por la posición relativa y no
  // por el HTML entero: así el test sobrevive a cualquier cambio de estilo.
  const html = dibujarNuevo({ estado: estadoLimpio() });
  const donde = (nombre) => html.indexOf(`name="${nombre}"`);

  assert.ok(donde('monto') < donde('rubro'));
  assert.ok(donde('rubro') < donde('fecha'));
  assert.ok(donde('fecha') < donde('detalle'), 'el detalle tiene que ir después de la fecha');
  assert.ok(donde('detalle') < donde('comentario'), 'el comentario tiene que ser el último');
});

test('con el campo vacío no se ofrece nada', () => {
  // Una lista de veinte sugerencias apenas se toca el campo tapa el formulario
  // en un celular.
  const html = dibujarNuevo({ estado: conComentarios('Barcelona26') });

  assert.equal(/data-accion="sugerencia"/.test(html), false);
});

test('al escribir el principio de un comentario ya usado, se ofrece', () => {
  // El caso exacto que el usuario probó en su celular (2026-08-28).
  const estado = conComentarios('Barcelona26');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'Barce' } });

  assert.match(html, /data-accion="sugerencia"/);
  assert.match(html, /data-campo="comentario"/);
  assert.ok(html.includes('>Barcelona26</button>'));
});

test('las sugerencias NO dependen de <datalist>', () => {
  // El navegador lo dibuja como quiere, y en el Android del usuario no dibuja
  // nada. Un control que no hace nada y no avisa es L-013 en su forma más cara.
  const estado = conComentarios('Barcelona26');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'Barce' } });

  assert.equal(html.includes('<datalist'), false);
  assert.equal(/list="/.test(html), false);
});

test('el detalle también sugiere lo ya escrito', () => {
  // El usuario probó el autocompletado ahí (2026-08-28) y tenía razón en
  // esperarlo: "alquiler", "luz", "psicóloga" se repiten todos los meses.
  const estado = conDetalles('alquiler', 'almuerzo');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), detalle: 'alq' } });

  assert.match(html, /data-campo="detalle"/);
  assert.ok(html.includes('>alquiler</button>'));
  assert.equal(html.includes('>almuerzo</button>'), false, 'no empieza ni contiene "alq"');
});

test('se sugiere sin importar mayúsculas ni acentos', () => {
  // Si hubiera que acertar las mayúsculas, el autocompletado no serviría para lo
  // único que sirve: no volver a escribir lo mismo de otra manera (RN-03).
  const estado = conComentarios('Barcelona26');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'barce' } });

  assert.ok(html.includes('>Barcelona26</button>'));
});

test('lo que ya está escrito igual no se sugiere a sí mismo', () => {
  const estado = conComentarios('Roma');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'Roma' } });

  assert.equal(/data-accion="sugerencia"/.test(html), false);
});

test('pero escrito con otras mayúsculas SÍ se sugiere', () => {
  // Es todo el punto: que elija la escritura que ya tiene en vez de crear un
  // segundo grupo con la misma palabra (RN-03). Un test anterior daba esto por
  // "ya escrito" y lo salteaba — se saltaba justo el caso que más importa.
  const estado = conComentarios('Roma');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'roma' } });

  assert.ok(html.includes('>Roma</button>'));
});

test('un comentario no se ofrece dos veces aunque esté escrito distinto', () => {
  // "Barcelona26" y "barcelona26" son el mismo grupo (RN-03). Ofrecer los dos
  // sería enseñarle al usuario a separarlos.
  const estado = conComentarios('Barcelona26', 'barcelona26');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'Barce' } });

  assert.equal((html.match(/data-accion="sugerencia"/g) ?? []).length, 1);
  assert.ok(html.includes('>Barcelona26</button>'), 'se muestra la primera escritura');
});

test('las comillas en un comentario no rompen la sugerencia', () => {
  const estado = conComentarios('Viaje "raro" & <cosas>');
  const html = dibujarNuevo({ estado, borrador: { ...borradorDe(), comentario: 'Viaje' } });

  assert.ok(html.includes('&quot;raro&quot;'));
  assert.equal(html.includes('data-texto="Viaje "raro"'), false);
});
