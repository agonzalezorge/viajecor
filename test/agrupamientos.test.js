// T-946 — Tests de los otros grupos de gastos (CU-18).
//
// Lo que se prueba acá no es una suma: es un **reparto**. Tres pantallas miran
// las mismas etiquetas y cada una tiene que quedarse con las suyas. El error
// caro no es un total mal calculado, es la misma etiqueta apareciendo en dos
// listas con dos totales distintos —o desapareciendo de las tres—, que es
// exactamente lo que pasa cuando la cascada se toca sin un test que la sujete.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  categoriaDeEtiqueta, otrosGrupos, PARTE_DE_VIAJE, RUBRO_FIJO,
} from '../src/core/agrupamientos.js';
import { dibujarAlcance, dibujarGrupo, dibujarGrupos } from '../src/ui/pantallas/grupos.js';
import { dibujarGastoFijo } from '../src/ui/pantallas/fijos.js';

import { viajes } from '../src/core/viajes.js';
import { gastosFijos } from '../src/core/calculos.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

let contador = 0;
function mov({ monto, rubro = 'supermercado', fecha = '2026-07-03', comentario = '', tipo = TIPO_GASTO, moneda = 'EUR' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: fecha }
  );
}

const estadoCon = (movimientos, cambios = []) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios });

/** Una mudanza: varios rubros, ninguno `viajes`, ninguno `gastos fijos`. */
const MUDANZA = () => [
  mov({ monto: '300', rubro: 'otros', fecha: '2026-05-02', comentario: 'Mudanza' }),
  mov({ monto: '80', rubro: 'transporte', fecha: '2026-05-04', comentario: 'Mudanza' }),
];


// ── La cascada: qué categoría le toca a cada etiqueta ────────────────────────

test('todo del rubro gastos fijos → es un gasto fijo', () => {
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '40', rubro: 'gastos fijos', comentario: 'Luz' }),
    mov({ monto: '41', rubro: 'gastos fijos', comentario: 'Luz' }),
  ]), 'fijo');
});

test('alcanza UN gasto de otro rubro para que deje de ser un gasto fijo', () => {
  // Es el paso 1 de la cascada, y es un "todos", no un "la mayoría": si la
  // etiqueta junta algo más que la factura, ya no responde "¿cuánto me sale la
  // luz?" sino "¿cuánto me salió esto?", que es la pregunta de esta pantalla.
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '40', rubro: 'gastos fijos', comentario: 'Casa' }),
    mov({ monto: '41', rubro: 'gastos fijos', comentario: 'Casa' }),
    mov({ monto: '10', rubro: 'otros', comentario: 'Casa' }),
  ]), 'otro');
});

test('con un solo gasto del rubro viajes ya es un viaje', () => {
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '100', rubro: 'comida hecha', comentario: 'Roma' }),
    mov({ monto: '50', rubro: 'transporte', comentario: 'Roma' }),
  ]), 'viaje');
});

test('el 66 % de rubro viajes de un viaje real sigue siendo un viaje', () => {
  // El número que decidió la regla. El usuario propuso "más del 75 % del rubro
  // viajes"; su propio viaje de prueba es 300 € de `viajes` contra 150 € de
  // comida y transporte, y con ese umbral se caería de la pantalla de viajes.
  assert.equal(PARTE_DE_VIAJE, 0);
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '100', rubro: 'comida hecha', comentario: 'Roma' }),
    mov({ monto: '50', rubro: 'transporte', comentario: 'Roma' }),
    mov({ monto: '20', rubro: 'supermercado', comentario: 'Roma' }),
    mov({ monto: '20', rubro: 'entretenimiento', comentario: 'Roma' }),
  ]), 'viaje');
});

test('viajes gana sobre gastos fijos cuando la etiqueta mezcla los dos', () => {
  // El orden de la cascada importa: la etiqueta no es "todo gastos fijos", así
  // que el paso 1 no la toma, y el paso 2 sí. Sin orden, quedaría en las dos.
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '40', rubro: 'gastos fijos', comentario: 'Roma' }),
  ]), 'viaje');
});

test('ni fijo ni viaje → otro', () => {
  assert.equal(categoriaDeEtiqueta(MUDANZA()), 'otro');
});

test('una etiqueta sin gastos no clasifica en nada: es otro', () => {
  assert.equal(categoriaDeEtiqueta([]), 'otro');
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '500', tipo: TIPO_INGRESO, rubro: 'trabajo', comentario: 'Devolución' }),
  ]), 'otro');
});

test('el rubro se compara normalizado, no letra por letra', () => {
  // RN-03 y L-002: "Gastos Fijos" con mayúsculas es el mismo rubro.
  assert.equal(RUBRO_FIJO, 'gastos fijos');
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '40', rubro: 'Gastos Fijos', comentario: 'Luz' }),
  ]), 'fijo');
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '300', rubro: 'VIAJES', comentario: 'Roma' }),
    mov({ monto: '10', rubro: 'entretenimiento', comentario: 'Roma' }),
  ]), 'viaje');
});

test('los ingresos no cambian la categoría', () => {
  // Una devolución con la misma etiqueta no convierte un viaje en otra cosa.
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '300', rubro: 'viajes', comentario: 'Roma' }),
    mov({ monto: '200', tipo: TIPO_INGRESO, rubro: 'otros', comentario: 'Roma' }),
  ]), 'viaje');
});

test('un ingreso no le rompe el "todos" a un gasto fijo', () => {
  // El caso que obliga a mirar solo los gastos: el rubro de un ingreso nunca es
  // `gastos fijos` —esa lista es de gastos—, así que si los ingresos contaran,
  // una factura con una devolución dejaría de ser un gasto fijo por tener
  // adentro un movimiento que jamás podría cumplir la condición.
  assert.equal(categoriaDeEtiqueta([
    mov({ monto: '40', rubro: 'gastos fijos', comentario: 'Luz' }),
    mov({ monto: '5', tipo: TIPO_INGRESO, rubro: 'otros', comentario: 'Luz' }),
  ]), 'fijo');
});


// ── La lista de otros grupos ────────────────────────────────────────────────

test('solo aparecen las etiquetas que no son ni viaje ni gasto fijo', () => {
  const estado = estadoCon([
    ...MUDANZA(),
    mov({ monto: '300', rubro: 'viajes', fecha: '2026-07-03', comentario: 'Roma' }),
    mov({ monto: '40', rubro: 'gastos fijos', fecha: '2026-06-01', comentario: 'Luz' }),
    mov({ monto: '25', rubro: 'supermercado', fecha: '2026-06-02' }),
  ]);

  assert.deepEqual(otrosGrupos(estado).map((g) => g.etiqueta), ['Mudanza']);
});

test('el total de un grupo incluye todos sus rubros', () => {
  const [grupo] = otrosGrupos(estadoCon(MUDANZA()));
  assert.equal(grupo.total, 38000);
  assert.equal(grupo.cuantos, 2);
});

test('van de más caro a más barato', () => {
  const estado = estadoCon([
    mov({ monto: '20', rubro: 'otros', comentario: 'Regalos' }),
    ...MUDANZA(),
    mov({ monto: '100', rubro: 'otros', comentario: 'Auto' }),
  ]);

  assert.deepEqual(otrosGrupos(estado).map((g) => g.etiqueta), ['Mudanza', 'Auto', 'Regalos']);
});

test('con el mismo total, el orden es estable por clave', () => {
  // Sin desempate, dos grupos iguales se ordenan distinto según el motor y la
  // lista "se mueve sola" entre recargas.
  const estado = estadoCon([
    mov({ monto: '50', rubro: 'otros', comentario: 'Zapatos' }),
    mov({ monto: '50', rubro: 'otros', comentario: 'Auto' }),
  ]);

  assert.deepEqual(otrosGrupos(estado).map((g) => g.etiqueta), ['Auto', 'Zapatos']);
});

test('dos maneras de escribir la etiqueta son un solo grupo', () => {
  const estado = estadoCon([
    mov({ monto: '300', rubro: 'otros', comentario: 'Mudanza' }),
    mov({ monto: '80', rubro: 'transporte', comentario: '  MUDANZA ' }),
  ]);

  const grupos = otrosGrupos(estado);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].total, 38000);
});

test('trae desde, hasta y en cuántos meses distintos aparece', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'otros', fecha: '2026-05-20', comentario: 'Gimnasio' }),
    mov({ monto: '10', rubro: 'otros', fecha: '2026-06-20', comentario: 'Gimnasio' }),
    mov({ monto: '10', rubro: 'otros', fecha: '2026-06-25', comentario: 'Gimnasio' }),
  ]);

  const [grupo] = otrosGrupos(estado);
  assert.equal(grupo.desde, '2026-05-20');
  assert.equal(grupo.hasta, '2026-06-25');
  assert.equal(grupo.meses, 2);
});

test('las fechas salen de la más vieja y la más nueva, no del orden de carga', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'otros', fecha: '2026-06-25', comentario: 'Gimnasio' }),
    mov({ monto: '10', rubro: 'otros', fecha: '2026-05-20', comentario: 'Gimnasio' }),
  ]);

  const [grupo] = otrosGrupos(estado);
  assert.equal(grupo.desde, '2026-05-20');
  assert.equal(grupo.hasta, '2026-06-25');
});

test('un gasto en otra moneda se suma convertido', () => {
  const estado = estadoCon(
    [
      mov({ monto: '100', rubro: 'otros', fecha: '2026-05-02', comentario: 'Mudanza', moneda: 'USD' }),
    ],
    [crearCambio({ moneda: 'USD', mes: '2026-05', euros_por_unidad: desdeUnidadesPorEuro(2) })]
  );

  assert.equal(otrosGrupos(estado)[0].total, 5000);
});

test('sin movimientos no hay grupos', () => {
  assert.deepEqual(otrosGrupos(estadoCon([])), []);
});


// ── El reparto entre las tres pantallas ─────────────────────────────────────

test('cada etiqueta tiene UN grupo propio en UNA sola pantalla', () => {
  const estado = estadoCon([
    ...MUDANZA(),
    mov({ monto: '300', rubro: 'viajes', fecha: '2026-07-03', comentario: 'Roma' }),
    mov({ monto: '100', rubro: 'comida hecha', fecha: '2026-07-05', comentario: 'Roma' }),
    mov({ monto: '40', rubro: 'gastos fijos', fecha: '2026-06-01', comentario: 'Luz' }),
    mov({ monto: '41', rubro: 'gastos fijos', fecha: '2026-07-01', comentario: 'Luz' }),
    mov({ monto: '25', rubro: 'supermercado', fecha: '2026-06-02' }),
  ]);

  const enViajes = viajes(estado).map((v) => v.clave);
  const enFijos = gastosFijos(estado).grupos.map((g) => g.clave);
  const enOtros = otrosGrupos(estado).map((g) => g.clave);

  assert.deepEqual(enViajes, ['roma']);
  assert.deepEqual(enFijos, ['luz']);
  assert.deepEqual(enOtros, ['mudanza']);

  const todas = [...enViajes, ...enFijos, ...enOtros];
  assert.equal(new Set(todas).size, todas.length);
});

test('una etiqueta mixta está en las dos pantallas, con dos números distintos', () => {
  // Lo pidió el usuario y tiene razón: el rubro y la etiqueta son
  // independientes. La tarjeta de gastos fijos sigue mostrando "Casa" con SU
  // PARTE del rubro (40 €), y los otros grupos la muestran entera (50 €). Cada
  // pantalla dice qué suma; lo que no puede pasar es que el mismo número
  // aparezca dos veces sin explicación.
  const estado = estadoCon([
    mov({ monto: '40', rubro: 'gastos fijos', fecha: '2026-06-01', comentario: 'Casa' }),
    mov({ monto: '10', rubro: 'otros', fecha: '2026-06-02', comentario: 'Casa' }),
  ]);

  const fijos = gastosFijos(estado);
  assert.equal(fijos.grupos.length, 1);
  assert.equal(fijos.grupos[0].total, 4000, 'solo el rubro gastos fijos');
  assert.equal(fijos.grupos[0].conGrupoPropio, true);
  assert.equal(fijos.total, 4000, 'el total del rubro no se movió');

  const [grupo] = otrosGrupos(estado);
  assert.equal(grupo.clave, 'casa');
  assert.equal(grupo.total, 5000, 'la etiqueta entera, con todos sus rubros');
});

test('la fila de gastos fijos avisa cuando la etiqueta tiene su grupo propio', () => {
  const html = dibujarGastoFijo({
    clave: 'casa', comentario: 'Casa', total: 4000, cuantos: 1, promedio: 4000,
    desde: '2026-06', hasta: '2026-06', conGrupoPropio: true,
  });
  assert.match(html, /solo lo que "Casa" gastó en el rubro/);
  assert.match(html, /otros grupos de gastos/);
});

test('sin grupo propio, la fila no dice nada de más', () => {
  const html = dibujarGastoFijo({
    clave: 'luz', comentario: 'Luz', total: 4000, cuantos: 1, promedio: 4000,
    desde: '2026-06', hasta: '2026-06', conGrupoPropio: false,
  });
  assert.doesNotMatch(html, /otros grupos/);
});


// ── La pantalla ─────────────────────────────────────────────────────────────


test('el alcance dice cuántos gastos, entre qué fechas y en cuántos meses', () => {
  const texto = dibujarAlcance({ cuantos: 3, desde: '2026-05-20', hasta: '2026-06-25', meses: 2 });
  assert.match(texto, /3 gastos/);
  assert.match(texto, /20\/05\/2026/);
  assert.match(texto, /25\/06\/2026/);
  assert.match(texto, /en 2 meses/);
});

test('con un solo gasto en un solo día no se repite la fecha ni se pluraliza', () => {
  const texto = dibujarAlcance({ cuantos: 1, desde: '2026-05-20', hasta: '2026-05-20', meses: 1 });
  assert.match(texto, /1 gasto ·/);
  assert.doesNotMatch(texto, /gastos/);
  assert.doesNotMatch(texto, /→/);
  assert.match(texto, /en un mes/);
});

test('la fila del grupo abre el filtro por esa etiqueta', () => {
  const html = dibujarGrupo({ clave: 'mudanza', etiqueta: 'Mudanza', total: 38000, cuantos: 2, desde: '2026-05-02', hasta: '2026-05-04', meses: 1 });
  assert.match(html, /data-accion="ver-comentario"/);
  assert.match(html, /data-comentario="Mudanza"/);
});

test('la etiqueta se escapa: no puede inyectar HTML', () => {
  const html = dibujarGrupo({ clave: 'x', etiqueta: '<img src=x>', total: 100, cuantos: 1, desde: '2026-05-02', hasta: '2026-05-02', meses: 1 });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('la pantalla lista los grupos y avisa que el total lleva todos los rubros', () => {
  const html = dibujarGrupos({ estado: estadoCon(MUDANZA()) });
  assert.match(html, /Otros grupos de gastos/);
  assert.match(html, /Mudanza/);
  assert.match(html, /todos<\/strong> los rubros/);
});

test('sin ningún grupo, la pantalla explica qué va a aparecer ahí', () => {
  const html = dibujarGrupos({ estado: estadoCon([]) });
  assert.match(html, /Todavía no hay ninguno/);
  assert.doesNotMatch(html, /<li/);
});
