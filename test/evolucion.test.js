// T-021 — Tests de la pantalla de evolución mes a mes (CU-10).
//
// Reemplaza la hoja `Analisis1`, que es donde el Excel guarda su mentira más
// sutil: un total y un promedio calculados sobre rangos distintos, sin que en
// ningún lado diga si eso fue a propósito (L-006). Acá lo es, y la pantalla lo
// tiene que decir.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dibujarEvolucion,
  dibujarEncabezadoMatriz,
  dibujarFilaMes,
  dibujarPieMatriz,
  dibujarNotaDelPromedio,
  dibujarSinHistorial,
} from '../src/ui/pantallas/evolucion.js';

import { matrizMesRubro } from '../src/core/calculos.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO, hoy, mesDe } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { claseDeRubro } from '../src/ui/colores.js';

let contador = 0;
function mov({ monto, rubro = 'supermercado', fecha, tipo = TIPO_GASTO, moneda = 'EUR' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario: '' },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: '2026-03-14' }
  );
}

function estadoCon(movimientos) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: [] };
}

const TRES_MESES = estadoCon([
  mov({ monto: '100', fecha: '2026-01-10', rubro: 'viajes' }),
  mov({ monto: '40', fecha: '2026-01-11', rubro: 'salud' }),
  mov({ monto: '200', fecha: '2026-02-10', rubro: 'viajes' }),
  mov({ monto: '900', fecha: '2026-02-01', rubro: 'trabajo', tipo: TIPO_INGRESO }),
  mov({ monto: '300', fecha: '2026-03-10', rubro: 'viajes' }),
]);


// ── La tabla ─────────────────────────────────────────────────────────────────

test('están las dieciséis columnas: los rubros de gasto, los de ingreso y las cuentas', () => {
  // Los rubros de ingreso los pidió el usuario el 2026-08-29. Antes la tabla
  // decía cuánto entró, pero no de dónde: el Excel tampoco lo decía.
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEncabezadoMatriz(matriz.rubros, matriz.rubrosIngreso);
  const columnas = [...html.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

  assert.equal(columnas.length, 16, 'el mes, ocho rubros de gasto, cuatro de ingreso y las tres cuentas');
  assert.equal(columnas[0], 'Mes');
  assert.deepEqual(columnas.slice(1, 9), matriz.rubros.map((r) => r[0].toUpperCase() + r.slice(1)));
  assert.equal(columnas[9], 'Gastos');
  assert.deepEqual(columnas.slice(10, 14), ['Trabajo', 'Inversiones', 'Regalos', 'Otros']);
  assert.deepEqual(columnas.slice(-2), ['Ingresos', 'Saldo']);
});

test('una banda arriba dice cuáles son de gasto y cuáles de ingreso', () => {
  // No es decoración: `otros` está en las dos listas y son cosas distintas
  // (RN-02). Además la paleta les da el mismo gris a los dos —viene de la
  // planilla—, así que el color tampoco alcanza para separarlos.
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEncabezadoMatriz(matriz.rubros, matriz.rubrosIngreso);

  assert.match(html, /colspan="8" class="banda">Rubros de gasto/);
  assert.match(html, /colspan="4" class="banda separada">Rubros de ingreso/);
  assert.equal((html.match(/Otros/g) ?? []).length, 2, 'los dos "Otros" están, y por eso hace falta la banda');
});

test('el bloque de ingresos abre con una línea que lo separa del de gastos', () => {
  // Sin esa línea, "Otros" de gasto y "Otros" de ingreso quedan pegados: dos
  // columnas grises con el mismo nombre y nada en el medio.
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEncabezadoMatriz(matriz.rubros, matriz.rubrosIngreso);
  const cabeceras = [...html.matchAll(/<th scope="col"([^>]*)>([\s\S]*?)<\/th>/g)]
    .map((m) => ({ clases: m[1], texto: m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() }));

  const trabajo = cabeceras.find((c) => c.texto === 'Trabajo');
  const inversiones = cabeceras.find((c) => c.texto === 'Inversiones');

  assert.match(trabajo.clases, /separada/, 'Trabajo abre el bloque y lleva la línea');
  assert.doesNotMatch(inversiones.clases, /separada/, 'y los de adentro del bloque no');
});

test('el pie desglosa los ingresos igual que las filas de mes', () => {
  // El pie se dibuja aparte de las filas, así que puede quedarse atrás sin que
  // nada se rompa: la tabla saldría con dieciséis columnas arriba y doce abajo.
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const pie = dibujarPieMatriz(matriz);
  const celdasPorFila = pie.split('<tr>').slice(1)
    .map((f) => (f.match(/<td/g) ?? []).length);

  assert.deepEqual(celdasPorFila, [15, 15], 'total y promedio, con las mismas celdas que un mes');
  assert.match(pie, />900,00</, 'los 900 € de trabajo están en el total');
});

test('cada rubro de ingreso lleva su color, y no el que le tocaría por posición', () => {
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEncabezadoMatriz(matriz.rubros, matriz.rubrosIngreso);

  for (const rubro of ['trabajo', 'inversiones', 'regalos']) {
    assert.ok(html.includes(`punto-rubro ${claseDeRubro(TIPO_INGRESO, rubro)}`), rubro);
  }
});

test('cada columna de rubro lleva el color que ese rubro tiene en el resumen', () => {
  // Es lo que ata las dos pantallas: la columna que dice "Supermercado" acá es
  // la porción ámbar de la torta de allá.
  const html = dibujarEncabezadoMatriz(matrizMesRubro(TRES_MESES, '2026-05').rubros);

  for (const rubro of ['supermercado', 'viajes', 'salud']) {
    assert.ok(html.includes(`punto-rubro ${claseDeRubro(TIPO_GASTO, rubro)}`), rubro);
  }
});

test('los meses van del más viejo al más nuevo, y el total cierra la tabla', () => {
  // Este test pedía lo contrario hasta el 2026-08-28. Lo dio vuelta el usuario:
  // la tabla no se lee para mirar un mes, se lee para seguir una línea de
  // tiempo, y una línea de tiempo va para adelante. Es además el orden de
  // `Analisis1` y el de la hoja del .xlsx, que tendría que haber pesado desde
  // el principio: dos vistas de la misma tabla en órdenes distintos.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const meses = [...html.matchAll(/data-accion="ver-mes"[^>]*>([a-z]{3} \d{2})</g)].map((m) => m[1]);

  assert.deepEqual(meses, ['ene 26', 'feb 26', 'mar 26']);
  // Y el pie va promedio y después total, dado vuelta por el usuario el
  // 2026-09-04: el total es el número más grande de la tabla y cierra abajo de
  // todo, que es donde el ojo lo busca en cualquier planilla.
  assert.ok(html.indexOf('mar 26') < html.indexOf('>Promedio<'));
  assert.ok(html.indexOf('>Promedio<') < html.indexOf('>Total<'));
});

test('un mes vacío en el medio aparece igual, en ceros', () => {
  const estado = estadoCon([
    mov({ monto: '100', fecha: '2026-01-10', rubro: 'viajes' }),
    mov({ monto: '300', fecha: '2026-03-10', rubro: 'viajes' }),
  ]);
  const html = dibujarEvolucion({ estado }, '2026-05');

  assert.ok(html.includes('feb 26'), 'febrero desapareció de la tabla');
});

test('la columna del mes queda fija al deslizar', () => {
  // Una fila de once números sin su etiqueta a la vista no se puede leer, y en
  // un teléfono la tabla se desliza siempre.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');

  assert.ok(html.includes('class="tabla-ancha"'), 'la tabla no está en su caja deslizable');
  assert.ok(html.includes('columna-mes'));
});

test('el cero se escribe, no se deja la celda en blanco', () => {
  // Es una matriz: una celda vacía se lee como "no sé", y sí se sabe: es cero.
  const fila = dibujarFilaMes({
    mes: '2026-01', rubros: [0, 0, 0, 10000, 0, 0, 0, 0],
    rubrosIngreso: [0, 0, 0, 0],
    gastos: 10000, ingresos: 0, saldo: -10000, incompleto: false,
  });
  const celdas = [...fila.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1].trim());

  assert.equal(celdas.length, 15);
  assert.equal(celdas.filter((c) => c === '').length, 0, 'hay celdas vacías');
});

test('la fila trae los rubros de ingreso, cada uno en su columna', () => {
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const febrero = matriz.filas.find((f) => f.mes === '2026-02');

  assert.deepEqual(febrero.rubrosIngreso, [90000, 0, 0, 0], 'los 900 € entraron por trabajo');
  assert.equal(febrero.ingresos, 90000, 'y la suma del bloque es el total de ingresos');

  const html = dibujarFilaMes(febrero, matriz.rubros, matriz.rubrosIngreso);
  assert.match(html, /data-tipo="I"\s+data-rubro="trabajo"/);
});

test('tocar una celda de ingreso filtra por INGRESO, no por gasto', () => {
  // `otros` está en las dos listas: sin el tipo, tocar "Otros" de ingreso
  // mostraría los otros gastos, que es la peor forma de fallar — con datos.
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-05');

  assert.match(html, /data-mes="2026-02" data-tipo="I"\s+data-rubro="trabajo"/);
  assert.match(html, /data-tipo="G"\s+data-rubro="viajes"/);
  assert.equal(matriz.rubrosIngreso.length, 4);
});

test('el total y el promedio también desglosan los ingresos', () => {
  const matriz = matrizMesRubro(TRES_MESES, '2026-03');

  assert.deepEqual(matriz.total.rubrosIngreso, [90000, 0, 0, 0]);
  // Marzo está en curso, así que el promedio es sobre enero y febrero.
  assert.equal(matriz.mesesDelPromedio, 2);
  assert.deepEqual(matriz.promedio.rubrosIngreso, [45000, 0, 0, 0]);
});

test('los importes no repiten el símbolo del euro noventa y nueve veces', () => {
  // Son once meses por nueve columnas de plata: el símbolo repetido en cada
  // celda se come una columna entera de rubro en un teléfono. Lo dice el pie.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const celdas = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').trim());

  assert.equal(celdas.filter((c) => c.includes('€')).length, 0);
  assert.match(html.replace(/\s+/g, ' '), /Los importes están en EUR/, 'y entonces hay que decirlo');
});

test('el pie de la tabla nombra la moneda base que el usuario eligió', () => {
  // Sin esto la tabla diría "euros" con los totales en pesos: el peor error
  // posible en una pantalla de plata, porque se lee y se cree.
  const enPesos = { ...TRES_MESES, preferencias: { moneda_base: 'UYU' } };
  const html = dibujarEvolucion({ estado: enPesos }, '2026-03').replace(/\s+/g, ' ');

  assert.match(html, /Los importes están en UYU/);
  assert.doesNotMatch(html, /están en EUR/);
});

test('los importes van con cifras de ancho fijo', () => {
  // Es lo que permite comparar una columna sin leer número por número.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  assert.ok(html.includes('class="importe'));
});


// ── El total y el promedio (L-006) ───────────────────────────────────────────

test('la pantalla dice sobre cuántos meses es el promedio, y cuál dejó afuera', () => {
  // El Excel sumaba once meses y promediaba diez sin decirlo. Una decisión sin
  // explicación es indistinguible de un error.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');

  assert.ok(html.includes('2 meses'), 'no dice sobre cuántos meses promedia');
  assert.ok(html.includes('mar 26'), 'no dice cuál mes dejó afuera');
  assert.ok(html.includes('El total sí lo incluye'));
});

test('si no dejó ningún mes afuera, no inventa una explicación', () => {
  const matriz = matrizMesRubro(TRES_MESES, '2026-09');
  const nota = dibujarNotaDelPromedio(matriz);

  assert.ok(nota.includes('3 meses'));
  assert.equal(nota.includes('deja afuera'), false);
});

test('el total y el promedio están los dos, y son distintos', () => {
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');

  assert.ok(html.includes('>Total<'));
  assert.ok(html.includes('>Promedio<'));
});


// ── Lo que puede engañar ─────────────────────────────────────────────────────

test('un mes al que le falta un tipo de cambio se marca y se explica', () => {
  // Un total al que le falta un gasto y que no lo dice es peor que ningún total.
  const estado = estadoCon([
    mov({ monto: '100', fecha: '2026-01-10', rubro: 'viajes' }),
    mov({ monto: '10000', fecha: '2026-02-10', rubro: 'viajes', moneda: 'CRC' }),
  ]);
  const html = dibujarEvolucion({ estado }, '2026-05');

  assert.ok(html.includes('<abbr'), 'el mes incompleto no está marcado');
  assert.ok(html.includes('les falta un tipo de cambio'), 'la marca no se explica');
});

test('sin meses incompletos no se dibuja el aviso', () => {
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  assert.equal(html.includes('les falta un tipo de cambio'), false);
  assert.equal(html.includes('<abbr'), false);
});

test('sin movimientos no muestra una tabla vacía', () => {
  const html = dibujarEvolucion({ estado: estadoCon([]) }, '2026-03');

  assert.equal(html.includes('<table'), false);
  assert.ok(html.includes('no hay meses'));
  assert.ok(html.includes('data-pantalla="nuevo"'), 'ofrece lo único que tiene sentido hacer');
});

test('el texto del usuario no puede romper la página', () => {
  assert.ok(dibujarSinHistorial().includes('Viajecor') === false);
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  assert.equal(/<script/.test(html), false);
});

test('la pantalla no pide nada a internet', () => {
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  assert.equal(/https?:\/\//.test(html), false);
});

test('la tabla no tiene ningún tope de meses (L-001)', () => {
  // El Excel suma hasta una fila escrita a mano. Cinco años, sesenta filas.
  const movimientos = [];
  for (let anio = 2021; anio <= 2025; anio += 1) {
    for (let mes = 1; mes <= 12; mes += 1) {
      movimientos.push(mov({ monto: '10', fecha: `${anio}-${String(mes).padStart(2, '0')}-05`, rubro: 'viajes' }));
    }
  }
  const html = dibujarEvolucion({ estado: estadoCon(movimientos) }, '2026-03');
  const filas = [...html.matchAll(/data-accion="ver-mes"[^>]*>[a-z]{3} \d{2}</g)];

  assert.equal(filas.length, 60);
  assert.ok(html.includes('ene 21') && html.includes('dic 25'));
});


// ── El CSS que hace legible la tabla ancha (L-026: la clase sin la regla que la
//    hace algo es una clase que no hace nada) ─────────────────────────────────

test('la caja de la tabla ancha recorta con borde, no con padding', async () => {
  // `overflow` recorta en el borde INTERNO de la caja: con `padding`, las
  // columnas que ya pasaron se siguen dibujando en ese centímetro y asoman por
  // detrás de la columna del mes. Se vio en el navegador, no en un test.
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/estilos.css', import.meta.url), 'utf8');
  const caja = css.slice(css.indexOf('.tabla-ancha {'), css.indexOf('.matriz {'));

  assert.match(caja, /border-left: 1rem solid transparent/);
  assert.doesNotMatch(caja, /padding: 0 1rem/);
});

test('la banda de cada bloque va alineada a la izquierda', async () => {
  // Centrada, el rótulo de ocho columnas cae en el medio de un bloque que no
  // entra en la pantalla de un teléfono: está y no se ve nunca.
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/estilos.css', import.meta.url), 'utf8');
  const banda = css.slice(css.indexOf('.matriz thead .banda {'));

  assert.match(banda.slice(0, banda.indexOf('}')), /text-align: left/);
});


// ── El reparto por rubro de todo el período (T-051) ──────────────────────────
//
// La tabla contesta "cuánto, mes por mes". No contesta "en qué se me va": para
// eso hay que leer la fila Total de punta a punta comparando números de cinco
// cifras. Las dos tortas contestan eso de un vistazo — y la lista de abajo es
// la que permite compararlo con precisión, porque el color no es un número.

test('hay dos repartos, uno de gastos y otro de ingresos', () => {
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03').replace(/\s+/g, ' ');

  assert.match(html, /<h2>En qué se fue, en todo el período<\/h2>/);
  assert.match(html, /<h2>De dónde vino, en todo el período<\/h2>/);
});

test('los porcentajes del reparto son sobre el total de SU tipo', () => {
  // 600 de viajes y 40 de salud son 640 de gastos: 94 % y 6 %. Si los gastos y
  // los ingresos se repartieran juntos, sobre 1.540, darían 39 % y 3 % — dos
  // números que no contestan ninguna pregunta que alguien se haga.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03').replace(/\s+/g, ' ');
  const gastos = html.slice(html.indexOf('En qué se fue'), html.indexOf('De dónde vino'));

  assert.match(gastos, /Viajes.*?600,00 €/);
  assert.match(gastos, /94 %/);
  assert.match(gastos, /6 %/);
  assert.match(html.slice(html.indexOf('De dónde vino')), /Trabajo.*?900,00 €.*?100 %/);
});

test('el reparto suma los meses de la tabla y lo dice', () => {
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03').replace(/\s+/g, ' ');
  assert.match(html, /Los 3 meses de la tabla, sumados: 640,00 €/);
});

test('los rubros sin nada no aparecen en el reparto', () => {
  // Ocho rubros de gasto, dos usados: una torta con seis porciones de cero es
  // seis colores en la leyenda que no corresponden a ninguna plata.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const gastos = html.slice(html.indexOf('En qué se fue'), html.indexOf('De dónde vino'));

  assert.equal((gastos.match(/data-accion="ver-rubro"/g) ?? []).length, 2);
  assert.equal(gastos.includes('Supermercado'), false);
});

test('tocar una fila del reparto lleva a todos los meses, no al mes en curso', () => {
  // El número que se acaba de tocar es de todo el período. Abrir un solo mes
  // mostraría una parte de él sin decir que es una parte.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03').replace(/\s+/g, ' ');

  assert.match(html, /data-accion="ver-rubro" data-tipo="G" data-rubro="viajes" data-todos-los-meses="si"/);
});

test('el reparto avisa cuando falta plata por un tipo de cambio', () => {
  // Sin esto, la torta de un mes incompleto es una mentira redonda: reparte el
  // 100 % de un total que no es el total.
  const conFaltante = estadoCon([
    ...TRES_MESES.movimientos,
    mov({ monto: '500', fecha: '2026-03-12', rubro: 'salud', moneda: 'USD' }),
  ]);
  const html = dibujarEvolucion({ estado: conFaltante }, '2026-03').replace(/\s+/g, ' ');

  assert.match(html, /<strong>Falta plata acá<\/strong>/);
});

test('sin ingresos no se dibuja la torta de ingresos', () => {
  const soloGastos = estadoCon([mov({ monto: '100', fecha: '2026-01-10', rubro: 'viajes' })]);
  const html = dibujarEvolucion({ estado: soloGastos }, '2026-01');

  assert.equal(html.includes('De dónde vino'), false);
  assert.equal(html.includes('En qué se fue'), true, 'el de gastos sí');
});

test('el reparto va de mayor a menor', () => {
  // De arriba abajo se lee "en esto se me va la plata". Ordenado por el orden
  // del catálogo, el rubro más caro puede quedar sexto y hay que buscarlo.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const gastos = html.slice(html.indexOf('En qué se fue'), html.indexOf('De dónde vino'));
  const nombres = [...gastos.matchAll(/data-rubro="([^"]+)"/g)].map((m) => m[1]);

  assert.deepEqual(nombres, ['viajes', 'salud'], '600 antes que 40');
});
