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

test('están las once columnas: los ocho rubros, gastos, ingresos y saldo', () => {
  const matriz = matrizMesRubro(TRES_MESES, '2026-05');
  const html = dibujarEncabezadoMatriz(matriz.rubros);
  const columnas = [...html.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

  assert.equal(columnas.length, 12, 'el mes, los ocho rubros y las tres cuentas');
  assert.equal(columnas[0], 'Mes');
  assert.deepEqual(columnas.slice(-3), ['Gastos', 'Ingresos', 'Saldo']);
});

test('cada columna de rubro lleva el color que ese rubro tiene en el resumen', () => {
  // Es lo que ata las dos pantallas: la columna que dice "Supermercado" acá es
  // la porción ámbar de la torta de allá.
  const html = dibujarEncabezadoMatriz(matrizMesRubro(TRES_MESES, '2026-05').rubros);

  for (const rubro of ['supermercado', 'viajes', 'salud']) {
    assert.ok(html.includes(`punto-rubro ${claseDeRubro(TIPO_GASTO, rubro)}`), rubro);
  }
});

test('los meses van del más nuevo al más viejo', () => {
  // Lo primero que se mira es el mes pasado, no octubre del año anterior.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const meses = [...html.matchAll(/scope="row" class="columna-mes">([a-z]{3} \d{2})/g)].map((m) => m[1]);

  assert.deepEqual(meses, ['mar 26', 'feb 26', 'ene 26']);
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
    gastos: 10000, ingresos: 0, saldo: -10000, incompleto: false,
  });
  const celdas = [...fila.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1].trim());

  assert.equal(celdas.length, 11);
  assert.equal(celdas.filter((c) => c === '').length, 0, 'hay celdas vacías');
});

test('los importes no repiten el símbolo del euro noventa y nueve veces', () => {
  // Son once meses por nueve columnas de plata: el símbolo repetido en cada
  // celda se come una columna entera de rubro en un teléfono. Lo dice el pie.
  const html = dibujarEvolucion({ estado: TRES_MESES }, '2026-03');
  const celdas = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);

  assert.equal(celdas.filter((c) => c.includes('€')).length, 0);
  assert.ok(html.includes('Los importes están en euros'), 'y entonces hay que decirlo');
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
  const filas = [...html.matchAll(/scope="row" class="columna-mes">[a-z]{3} \d{2}/g)];

  assert.equal(filas.length, 60);
  assert.ok(html.includes('ene 21') && html.includes('dic 25'));
});
