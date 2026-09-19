// T-060 — Varias etiquetas por movimiento, y grupos que no son solo de gastos.
//
// ── Lo que el usuario pidió, y por qué ──────────────────────────────────────
//
// Un viaje de trabajo lleva la etiqueta del viaje **y** la del trabajo. Hasta
// ahora había que elegir una y perder la otra pregunta. Y los grupos eran solo
// de gastos: una etiqueta que junta ingresos —un trabajo suelto, unos
// reintegros— no aparecía en ninguna pantalla.
//
// ── Lo que hay que sostener acá ─────────────────────────────────────────────
//
// Que el dato guardado **no cambió**: sigue siendo el mismo texto en el mismo
// campo, y un movimiento viejo tiene exactamente una etiqueta. Eso es lo que
// hace que los respaldos de antes se sigan leyendo y que el Excel siga sirviendo
// en los dos sentidos, sin migrar nada.
//
// Y que un movimiento con dos etiquetas **entra en los dos grupos**, con la
// consecuencia que eso trae: los totales de los grupos ya no suman el total del
// mes. Sumarían de más, y la pantalla lo dice.

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { etiquetasDe, clavesDeEtiquetas, tieneEtiqueta, crearMovimiento, TIPO_GASTO, TIPO_INGRESO }
  from '../src/core/modelo.js';
import { otrosGrupos } from '../src/core/agrupamientos.js';
import { viajes, fijarFechasDeViaje } from '../src/core/viajes.js';
import { dibujarViaje } from '../src/ui/pantallas/viajes.js';
import { movimientosFiltrados, comentariosUsados, etiquetaEnCurso, conEtiquetaElegida, gastosFijos }
  from '../src/core/calculos.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { dibujarLista } from '../src/ui/pantallas/lista.js';
import { monedasIniciales } from '../src/core/monedas.js';

let n = 0;
const mov = (monto, rubro, comentario, tipo = TIPO_GASTO, fecha = '2026-09-10') => {
  n += 1;
  return crearMovimiento({ monto, moneda: 'EUR', fecha, tipo, rubro, comentario },
    { decimales: 2, id: `m${String(n).padStart(4, '0')}`, creado: fecha });
};
const estadoCon = (movimientos) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), tipos_cambio: [], movimientos });


// ── Cómo se leen ─────────────────────────────────────────────────────────────

test('una etiqueta sola sigue siendo una etiqueta sola', () => {
  // Es la mitad que no puede romperse: todos los datos que ya existen son así.
  assert.deepEqual(etiquetasDe('Roma'), ['Roma']);
  assert.deepEqual(etiquetasDe(''), []);
  assert.deepEqual(etiquetasDe('   '), []);
});

test('la coma separa, y los espacios de los bordes no cuentan', () => {
  assert.deepEqual(etiquetasDe('Roma, Trabajo'), ['Roma', 'Trabajo']);
  assert.deepEqual(etiquetasDe(' Roma ,  Trabajo '), ['Roma', 'Trabajo']);
  assert.deepEqual(etiquetasDe('Roma,,Trabajo,'), ['Roma', 'Trabajo'], 'comas de más y al final');
});

test('la misma etiqueta escrita dos veces cuenta una', () => {
  // Si contara dos, su total se duplicaría en su propio grupo — y el error sería
  // invisible: un número más grande, sin ningún aviso.
  assert.deepEqual(etiquetasDe('Roma, roma'), ['Roma']);
  assert.deepEqual(clavesDeEtiquetas('Roma, ROMA, Roma'), ['roma']);
});

test('tieneEtiqueta compara por clave, no por texto', () => {
  const m = mov('100', 'viajes', 'Roma, Trabajo');
  assert.equal(tieneEtiqueta(m, 'roma'), true);
  assert.equal(tieneEtiqueta(m, 'TRABAJO'), true);
  assert.equal(tieneEtiqueta(m, 'Roma, Trabajo'), false, 'el texto entero ya no es una etiqueta');
  assert.equal(tieneEtiqueta(m, 'Mudanza'), false);
});

test('el dato guardado no cambió: un respaldo viejo se lee igual', () => {
  // Es la razón por la que esto se hizo así y no con una lista en el modelo.
  const viejo = { esquema: 1, movimientos: [{ ...mov('100', 'viajes', 'Roma') }] };
  const leido = migrarEstado(JSON.parse(JSON.stringify(viejo)));

  assert.equal(leido.movimientos.length, 1);
  assert.equal(leido.movimientos[0].comentario, 'Roma');
  assert.deepEqual(etiquetasDe(leido.movimientos[0].comentario), ['Roma']);
});


// ── Un movimiento entra en todos sus grupos ─────────────────────────────────

const VIAJE_DE_TRABAJO = () => estadoCon([
  mov('800', 'viajes', 'Roma, Trabajo'),
  mov('200', 'comida hecha', 'Roma, Trabajo'),
  mov('600', 'trabajo', 'Roma, Trabajo', TIPO_INGRESO),
]);

test('un gasto con dos etiquetas suma en los dos viajes', () => {
  const lista = viajes(VIAJE_DE_TRABAJO());

  assert.deepEqual(lista.map((v) => v.comentario).sort(), ['Roma', 'Trabajo']);
  for (const v of lista) assert.equal(v.gastos, 100000, `${v.comentario}: 800 + 200`);
});

test('y tocar uno de esos grupos trae el movimiento', () => {
  // Sin esto, el total diría 1.000 € y la lista al tocarlo estaría vacía: el
  // peor final posible, porque el número queda sin nada que lo respalde.
  const estado = VIAJE_DE_TRABAJO();
  const deRoma = movimientosFiltrados(estado, '2026-09', { comentario: 'Roma' });
  const deTrabajo = movimientosFiltrados(estado, '2026-09', { comentario: 'Trabajo' });

  assert.equal(deRoma.length, 3);
  assert.equal(deTrabajo.length, 3);
});

test('los gastos fijos con dos etiquetas también cuentan en las dos', () => {
  const estado = estadoCon([mov('50', 'gastos fijos', 'Luz, Casa')]);
  const { grupos } = gastosFijos(estado);

  assert.deepEqual(grupos.map((g) => g.comentario).sort(), ['Casa', 'Luz']);
  for (const g of grupos) assert.equal(g.total, 5000);
});


// ── Los viajes y grupos mixtos ──────────────────────────────────────────────

test('un viaje con ingresos cuesta lo que quedaste poniendo', () => {
  // El caso que el usuario nombró: el viaje de trabajo. Pidió expresamente
  // (2026-09-19) que el costo sean los 400 y no los 1.000, para que se lea igual
  // que cualquier otro viaje; los dos lados se ven al abrirlo.
  const roma = viajes(VIAJE_DE_TRABAJO()).find((v) => v.clave === 'roma');

  assert.equal(roma.total, 40000, 'lo que salió del bolsillo');
  assert.equal(roma.costo, 40000);
  assert.equal(roma.gastos, 100000, 'el gasto bruto sigue estando, para desglosarlo');
  assert.equal(roma.ingresos, 60000);
  assert.equal(roma.saldo, -40000);
  assert.equal(roma.mixto, true);
  assert.equal(roma.aFavor, false);
});

test('si los reintegros superan a los gastos, el viaje te dejó plata y lo dice', () => {
  // Ahí mostrarlo "en positivo" sería mentir: no te costó nada, te sobró.
  const estado = estadoCon([
    mov('300', 'viajes', 'Congreso'),
    mov('500', 'trabajo', 'Congreso', TIPO_INGRESO),
  ]);
  const congreso = viajes(estado)[0];

  assert.equal(congreso.aFavor, true);
  assert.equal(congreso.total, -20000, 'con su signo');
  assert.equal(congreso.saldo, 20000);
});

test('un viaje sin ingresos no inventa un saldo', () => {
  // Sería el total en negativo: un número repetido que no agrega nada.
  const soloGastos = viajes(estadoCon([mov('300', 'viajes', 'Colonia')]))[0];

  assert.equal(soloGastos.mixto, false);
  assert.equal(soloGastos.ingresos, 0);
});

test('el gasto bruto no se pierde: se puede seguir mirando aparte', () => {
  // El costo pasó a ser neto (2026-09-19), pero lo que de verdad salió sigue
  // estando: es lo que el desglose muestra al abrir el viaje.
  const roma = viajes(VIAJE_DE_TRABAJO()).find((v) => v.clave === 'roma');
  assert.equal(roma.gastos, 100000);
});


// ── Grupos de ingresos, con su media mensual ────────────────────────────────

test('una etiqueta que solo junta ingresos ahora tiene su grupo', () => {
  const estado = estadoCon([
    mov('3000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-07-05'),
    mov('2000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-05'),
    mov('1000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-20'),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'clases');

  assert.equal(grupo.clase, 'ingreso');
  assert.equal(grupo.ingresos, 600000);
  assert.equal(grupo.total, 0, 'no gastó nada');
});

test('la media de un grupo de ingresos es MENSUAL, no por movimiento', () => {
  // 6.000 € en dos meses son 3.000 por mes. Por movimiento darían 2.000, que no
  // contesta la pregunta: lo que se quiere saber es cuánto entra por mes.
  const estado = estadoCon([
    mov('3000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-07-05'),
    mov('2000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-05'),
    mov('1000', 'trabajo', 'Clases', TIPO_INGRESO, '2026-08-20'),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'clases');

  assert.equal(grupo.meses, 2);
  assert.equal(grupo.mediaMensual, 300000, '6.000 en 2 meses');
});

test('un grupo con gastos e ingresos es mixto y trae su saldo', () => {
  const estado = estadoCon([
    mov('500', 'otros', 'Mudanza'),
    mov('200', 'regalos', 'Mudanza', TIPO_INGRESO),
  ]);
  const grupo = otrosGrupos(estado).find((g) => g.clave === 'mudanza');

  assert.equal(grupo.clase, 'mixto');
  assert.equal(grupo.total, 50000);
  assert.equal(grupo.ingresos, 20000);
  assert.equal(grupo.saldo, -30000);
});

test('un grupo de solo gastos sigue siendo lo que era', () => {
  const grupo = otrosGrupos(estadoCon([mov('150', 'otros', 'Mudanza')]))[0];

  assert.equal(grupo.clase, 'gasto');
  assert.equal(grupo.total, 15000);
  assert.equal(grupo.ingresos, 0);
});

test('un viaje no aparece además en los otros grupos', () => {
  // La cascada de ADR-036 sigue mandando: cada etiqueta tiene UN grupo propio en
  // UNA pantalla. Si no, el viaje de trabajo saldría dos veces.
  const claves = otrosGrupos(VIAJE_DE_TRABAJO()).map((g) => g.clave);
  assert.equal(claves.includes('roma'), false);
  assert.equal(claves.includes('trabajo'), false);
});


// ── El autocompletado con comas ─────────────────────────────────────────────

test('las sugerencias son etiquetas sueltas, no comentarios enteros', () => {
  // Sugerir "Roma, Trabajo" pondría las dos etiquetas de golpe, que casi nunca
  // es lo que se quiere.
  const usados = comentariosUsados(VIAJE_DE_TRABAJO().movimientos);

  assert.deepEqual([...usados].sort(), ['Roma', 'Trabajo']);
});

test('lo que se autocompleta es lo que hay después de la última coma', () => {
  assert.equal(etiquetaEnCurso('Trab'), 'Trab');
  assert.equal(etiquetaEnCurso('Roma, Trab').trim(), 'Trab');
  assert.equal(etiquetaEnCurso('Roma,'), '');
});

test('elegir una sugerencia no borra las etiquetas ya escritas', () => {
  assert.equal(conEtiquetaElegida('Roma, Trab', 'Trabajo'), 'Roma, Trabajo');
  assert.equal(conEtiquetaElegida('Trab', 'Trabajo'), 'Trabajo');
  assert.equal(conEtiquetaElegida('Roma,', 'Trabajo'), 'Roma, Trabajo');
});


// ── El desglose al abrir un grupo mixto (T-062) ─────────────────────────────

test('la lista filtrada de un viaje mixto muestra gastos, ingresos y saldo', () => {
  const html = dibujarLista({
    estado: VIAJE_DE_TRABAJO(), mes: '2026-09', filtro: { comentario: 'Roma' },
  }).replace(/\s+/g, ' ');

  assert.match(html, /Gastos/);
  assert.match(html, /1000,00/);
  assert.match(html, /Ingresos/);
  assert.match(html, /600,00/);
  assert.match(html, /Saldo/);
  assert.match(html, /-400,00/);
});

test('y NO muestra un total que sume gastos con ingresos', () => {
  // 1.000 de gastos y 600 de reintegro darían 1.600: un número que no significa
  // nada, y verlo arriba del desglose que lo desmiente es peor que no verlo.
  const html = dibujarLista({
    estado: VIAJE_DE_TRABAJO(), mes: '2026-09', filtro: { comentario: 'Roma' },
  }).replace(/\s+/g, ' ');

  assert.equal(/1600/.test(html), false);
  assert.match(html, /3 movimientos/, 'pero sí dice cuántos son');
});

test('una lista de puros gastos no gana tres números que no dicen nada', () => {
  // "Ingresos: 0" y un saldo que es el total en negativo empujan hacia abajo lo
  // que sí importa.
  const estado = estadoCon([mov('450', 'viajes', 'Colonia')]);
  const html = dibujarLista({ estado, mes: '2026-09', filtro: { comentario: 'Colonia' } })
    .replace(/\s+/g, ' ');

  assert.equal(html.includes('Saldo'), false);
  assert.match(html, /1 movimiento · <strong>450,00/, 'y conserva su total de siempre');
});

test('el buscador también desglosa cuando encuentra de los dos', () => {
  const html = dibujarLista({ estado: VIAJE_DE_TRABAJO(), mes: '2026-09', busqueda: 'Roma' })
    .replace(/\s+/g, ' ');

  assert.match(html, /Saldo/);
  assert.equal(/1600/.test(html), false);
});

test('el gasto por día de un viaje con reintegros también es neto', () => {
  // Si el por día se calculara sobre el bruto, el mismo viaje diría que costó
  // 400 arriba y 100 por día en cuatro días: dos números que no cierran.
  let estado = estadoCon([
    mov('800', 'viajes', 'Roma', TIPO_GASTO, '2026-09-01'),
    mov('200', 'comida hecha', 'Roma', TIPO_GASTO, '2026-09-02'),
    mov('600', 'trabajo', 'Roma', TIPO_INGRESO, '2026-09-03'),
  ]);
  estado = fijarFechasDeViaje(estado, 'roma', '2026-09-01', '2026-09-04');
  const roma = viajes(estado)[0];

  assert.equal(roma.dias, 4);
  assert.equal(roma.total, 40000);
  assert.equal(roma.porDia, 10000, '400 en 4 días, no 1.000 en 4 días');
});

test('un viaje que te dejó plata lleva un + adelante', () => {
  // En esta lista todos los números son costos, así que uno pelado se lee como
  // "esto me salió". El + avisa, sin depender del color, que este es al revés.
  // Lo pidió el usuario el 2026-09-19.
  const estado = estadoCon([
    mov('300', 'viajes', 'Congreso'),
    mov('500', 'trabajo', 'Congreso', TIPO_INGRESO),
  ]);
  const html = dibujarViaje(viajes(estado)[0]).replace(/\s+/g, ' ');

  assert.match(html, /class="importe ingreso"> \+200,00/, 'verde y con el más adelante');
  assert.equal(/-200,00/.test(html), false, 'nunca con signo de menos');
  assert.match(html, /te quedó a favor/);
});

test('y el valor por día del mismo viaje también lleva el +', () => {
  // Son el mismo número dividido: uno con signo y el otro sin él se leería como
  // un error de tipeo.
  let estado = estadoCon([
    mov('300', 'viajes', 'Congreso', TIPO_GASTO, '2026-09-01'),
    mov('500', 'trabajo', 'Congreso', TIPO_INGRESO, '2026-09-02'),
  ]);
  estado = fijarFechasDeViaje(estado, 'congreso', '2026-09-01', '2026-09-04');
  const html = dibujarViaje(viajes(estado)[0]).replace(/\s+/g, ' ');

  assert.match(html, /<strong>\+50,00[^<]*<\/strong> por día/, '200 a favor en 4 días');
  assert.equal(/-50,00/.test(html), false);
});

test('un viaje normal NO lleva ningún signo', () => {
  // La otra mitad: el + tiene que significar algo, y si apareciera en todos no
  // significaría nada.
  let estado = estadoCon([mov('400', 'viajes', 'Colonia', TIPO_GASTO, '2026-09-01')]);
  estado = fijarFechasDeViaje(estado, 'colonia', '2026-09-01', '2026-09-04');
  const html = dibujarViaje(viajes(estado)[0]).replace(/\s+/g, ' ');

  assert.match(html, /class="importe "> 400,00/);
  assert.equal(html.includes('+'), false, 'ni en el total ni en el por día');
});

test('el CSS pinta los importes que no son costos, no solo les pone la clase', () => {
  // La clase `ingreso` estaba en el HTML desde T-060 y el CSS no la miraba en
  // esta fila: el número salía del mismo color que un gasto. El color es la
  // mitad del aviso —el signo es la otra— y una clase que no pinta es una
  // decisión que parece tomada y no lo está.
  const css = readFileSync('src/estilos.css', 'utf8');

  assert.match(css, /\.rubro-cabeza \.importe\.ingreso \{[^}]*var\(--ingreso\)/);
  assert.match(css, /\.rubro-cabeza \.importe\.gasto \{[^}]*var\(--gasto\)/);
});
