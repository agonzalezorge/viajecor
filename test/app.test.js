// T-010 — Tests del armazón de la interfaz.
//
// La interfaz está partida en dos: funciones puras que devuelven texto HTML, y
// una sola función que toca el documento. Estos tests miran la primera capa, que
// es donde vive casi todo lo que puede estar mal — qué se muestra, en qué mes,
// con qué texto. Lo que no se puede testear así (que un clic llegue a donde
// tiene que llegar) se prueba abriendo la app, y por eso hay lo menos posible.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  escapar,
  versionApp,
  pantallasRegistradas,
  pantalla,
  dibujarEncabezado,
  dibujarNavegacion,
  dibujarAvisos,
  dibujarApp,
  vistaInicial,
  moverMes,
  irA,
} from '../src/ui/app.js';

import { mesAnterior, mesSiguiente, mesDe, hoy } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

// Un estado vacío de verdad: desde que la pantalla del mes está construida
// (T-014), dibujar la app lee los datos, y pasarle null probaría otra cosa.
const VISTA = {
  pantalla: 'mes',
  mes: '2026-03',
  estado: estadoInicial({ monedas: monedasIniciales() }),
  incidencias: [],
};

// ── Aritmética de meses ──────────────────────────────────────────────────────

test('moverse de mes cruza bien el fin de año', () => {
  assert.equal(mesAnterior('2026-01'), '2025-12');
  assert.equal(mesSiguiente('2026-12'), '2027-01');
  assert.equal(mesAnterior('2026-03'), '2026-02');
  assert.equal(mesSiguiente('2026-03'), '2026-04');
});

test('el mes se calcula con números, no moviendo una fecha', () => {
  // A un Date del 31 de marzo restarle un mes da el 3 de marzo, porque febrero
  // no tiene 31 días. Comprobado: es el motivo de no usar Date acá.
  const fecha = new Date(Date.UTC(2026, 2, 31));
  fecha.setUTCMonth(fecha.getUTCMonth() - 1);
  assert.equal(fecha.toISOString().slice(0, 10), '2026-03-03');

  // La aritmética propia no tiene ese problema: no hay días de por medio.
  assert.equal(mesAnterior('2026-03'), '2026-02');
});

test('ir y volver deja el mes donde estaba, doce veces seguidas', () => {
  let mes = '2026-03';
  for (let i = 0; i < 12; i += 1) mes = mesSiguiente(mes);
  assert.equal(mes, '2027-03');
  for (let i = 0; i < 12; i += 1) mes = mesAnterior(mes);
  assert.equal(mes, '2026-03');
});

test('un mes mal escrito se rechaza en vez de moverse a cualquier lado', () => {
  for (const malo of ['marzo', '2026-13', '2026-3', '', null, '2026-00']) {
    assert.throws(() => mesAnterior(malo), /mes/i);
    assert.throws(() => mesSiguiente(malo), /mes/i);
  }
});

// ── Escapado ─────────────────────────────────────────────────────────────────

test('el texto del usuario se escapa antes de entrar en la página', () => {
  // El comentario y el detalle son texto libre: alcanza un "<" para romper la
  // página. No es una precaución teórica, es un dato que el usuario escribe.
  assert.equal(escapar('<script>'), '&lt;script&gt;');
  assert.equal(escapar('Marks & Spencer'), 'Marks &amp; Spencer');
  assert.equal(escapar('comilla " doble'), 'comilla &quot; doble');
  assert.equal(escapar(null), '');
  assert.equal(escapar(undefined), '');
});

test('un aviso con caracteres raros no rompe la página', () => {
  const html = dibujarAvisos(['El archivo <respaldo> & la copia no se pudieron leer']);
  assert.equal(html.includes('<respaldo>'), false);
  assert.ok(html.includes('&lt;respaldo&gt;'));
  assert.ok(html.includes('&amp;'));
});

// ── Encabezado ───────────────────────────────────────────────────────────────

test('el encabezado muestra el mes en español y la versión', () => {
  const html = dibujarEncabezado({ mes: '2026-03', conMes: true });
  assert.ok(html.includes('marzo de 2026'));
  assert.ok(html.includes('Viajecor'));
  assert.ok(html.includes(`v${versionApp()}`));
});

test('el encabezado trae las flechas para cambiar de mes', () => {
  const html = dibujarEncabezado({ mes: '2026-03', conMes: true });
  assert.ok(html.includes('data-accion="mes-anterior"'));
  assert.ok(html.includes('data-accion="mes-siguiente"'));
  // Con etiqueta, porque "‹" solo no le dice nada a un lector de pantalla.
  assert.ok(html.includes('aria-label="Mes anterior"'));
});

test('en una pantalla que no es de un mes, el selector no se dibuja', () => {
  // Un control que no hace nada enseña a desconfiar de los controles.
  const html = dibujarEncabezado({ mes: '2026-03', conMes: false });
  assert.equal(html.includes('data-accion="mes-anterior"'), false);
  assert.equal(html.includes('marzo de 2026'), false);
  assert.ok(html.includes('Viajecor'));
});

// ── Navegación ───────────────────────────────────────────────────────────────

test('la barra tiene una pestaña por sección, más el botón de cargar', () => {
  const html = dibujarNavegacion('mes');
  for (const p of pantallasRegistradas().filter((x) => x.enBarra !== false)) {
    assert.ok(html.includes(`data-pantalla="${p.nombre}"`), `falta la pestaña ${p.nombre}`);
    assert.ok(html.includes(p.etiqueta));
  }
  assert.ok(html.includes('class="pestania nueva'));
});

test('la barra tiene tres pestañas y nada más, para que entren en un celular', () => {
  const enBarra = pantallasRegistradas().filter((p) => p.enBarra !== false);
  assert.deepEqual(enBarra.map((p) => p.nombre), ['mes', 'movimientos', 'datos']);
});

test('la pantalla de carga no aparece como una pestaña más', () => {
  // Tiene su propio botón, destacado y al final: es la acción que se hace
  // treinta veces por mes, no una sección que se visita.
  const html = dibujarNavegacion('mes');
  const pestanias = html.match(/class="pestania[^"]*"/g) ?? [];
  assert.equal(pestanias.filter((c) => c.includes('nueva')).length, 1);
  assert.equal(pantalla('nuevo').enBarra, false);
});

test('la pestaña actual se marca, y solo una', () => {
  const html = dibujarNavegacion('datos');
  assert.equal((html.match(/class="pestania activa"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);

  // Y es la que corresponde: la marca cae en el bloque del botón de datos.
  const trozo = html.slice(html.indexOf('data-pantalla="datos"') - 120, html.indexOf('data-pantalla="datos"') + 40);
  assert.ok(trozo.includes('activa'));
});

test('están las secciones previstas, la carga y los tipos de cambio', () => {
  assert.deepEqual(
    pantallasRegistradas().map((p) => p.nombre),
    ['mes', 'movimientos', 'datos', 'cambios', 'nuevo']
  );
});

// ── Avisos ───────────────────────────────────────────────────────────────────

test('sin incidencias no se dibuja ningún aviso', () => {
  assert.equal(dibujarAvisos([]), '');
  assert.equal(dibujarAvisos(), '');
});

test('los avisos del almacenamiento se muestran, no se tragan', () => {
  // almacenamiento.js se toma el trabajo de explicar qué no se pudo leer.
  // Tragarnos eso acá haría inútil todo ese cuidado.
  const html = dibujarAvisos([
    'Lo que había guardado no se pudo leer y se apartó sin tocarlo.',
    '3 registros de movimientos no se pudieron leer.',
  ]);
  assert.ok(html.includes('no se pudo leer'));
  assert.ok(html.includes('3 registros'));
  assert.ok(html.includes('role="alert"'));
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
});

test('el título del aviso concuerda en número', () => {
  assert.ok(dibujarAvisos(['una']).includes('Hay algo que tenés que saber'));
  assert.ok(dibujarAvisos(['una', 'otra']).includes('Hay cosas que tenés que saber'));
});

// ── La app entera ────────────────────────────────────────────────────────────

test('la app dibuja encabezado, contenido y navegación', () => {
  const html = dibujarApp(VISTA);
  assert.ok(html.includes('Viajecor'));
  assert.ok(html.includes('marzo de 2026'));
  assert.ok(html.includes('<main class="contenido">'));
  assert.ok(html.includes('class="navegacion"'));
});

test('lo que falta de una pantalla se dice, con la tarea que lo trae', () => {
  // Ya no quedan pantallas enteras sin construir. Lo que queda son partes, y se
  // nombran igual: una pantalla que no dice lo que le falta parece terminada.
  const html = dibujarApp({ ...VISTA, pantalla: 'datos' });
  assert.ok(html.includes('Todavía no'));
  assert.ok(/T-0\d\d/.test(html));
});

test('una pantalla que no existe cae en la del mes, sin romperse', () => {
  const html = dibujarApp({ ...VISTA, pantalla: 'inventada' });
  // Con el mes vacío, la pantalla del mes ofrece cargar algo.
  assert.ok(html.includes('marzo de 2026'));
  assert.ok(html.includes('Cargar un movimiento'));
});

test('la app no contiene ninguna dirección de internet (RN-06)', () => {
  // La guardia de T-007 revisa el archivo construido; esto lo detecta antes,
  // en la pieza donde sería más fácil que se cuele un enlace.
  const html = dibujarApp(VISTA);
  assert.equal(/https?:\/\//.test(html), false);
});

// ── El estado de la vista ────────────────────────────────────────────────────

test('la vista arranca en el mes de hoy', () => {
  assert.equal(vistaInicial().mes, mesDe(hoy()));
  assert.equal(vistaInicial().pantalla, 'mes');
});

test('moverse de mes no modifica la vista anterior', () => {
  const antes = { ...VISTA };
  const despues = moverMes(VISTA, 'siguiente');
  assert.equal(despues.mes, '2026-04');
  assert.deepEqual(VISTA, antes);
});

test('cambiar de pantalla conserva el mes que se estaba mirando', () => {
  // Si volver del listado de datos te devolviera a hoy, perderías el lugar cada
  // vez que exportás mirando un mes viejo.
  const enOtroMes = moverMes(moverMes(VISTA, 'anterior'), 'anterior');
  assert.equal(irA(enOtroMes, 'datos').mes, '2026-01');
});

test('ir a una pantalla que no existe no cambia nada', () => {
  assert.deepEqual(irA(VISTA, 'inventada'), VISTA);
});

test('la pantalla registrada se puede consultar por nombre', () => {
  assert.equal(pantalla('mes').etiqueta, 'Mes');
  assert.equal(pantalla('inventada'), null);
});
