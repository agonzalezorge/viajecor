// T-057 — Tests de las curvas del gráfico mes a mes y del área bajo el saldo.
//
// ── Lo que hay que sostener acá ──────────────────────────────────────────────
//
// La primera versión de esta tarea conservaba el área exacta y se veía como
// escalones; el usuario la rechazó (2026-09-08) y eligió curvas de verdad,
// sabiendo que el área pasa a ser orientativa.
//
// Pero "curva" no puede significar "cualquier curva". Suavizar una polilínea de
// la forma fácil —Catmull-Rom— hace que la curva **se pase de largo** entre dos
// puntos: con un mes de saldo alto seguido de uno bajo, baja de más antes de
// enderezarse, y el gráfico pinta de rojo un mes que en los datos está en verde.
// Eso no es un defecto estético: es plata que no existe.
//
// Por eso la curva es monótona por tramos (PCHIP), y estos tests lo comprueban
// **evaluando las Béziers**, no mirando el texto del camino.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  caminoDeCurva, interiorDeSerie, ANCHO, ALTO,
} from '../src/ui/pantallas/series.js';
import { dibujarMesAMes } from '../src/ui/pantallas/graficos.js';

/** Los tramos de un camino `M … C … C …`, con sus cuatro puntos cada uno. */
function tramosDe(d) {
  const numeros = (t) => t.trim().split(/[\s,]+/).map(Number);
  const ordenes = d.match(/[MC][^MC]*/g);
  const tramos = [];
  let actual = numeros(ordenes[0].slice(1));
  for (const orden of ordenes.slice(1)) {
    const n = numeros(orden.slice(1));
    tramos.push([actual, [n[0], n[1]], [n[2], n[3]], [n[4], n[5]]]);
    actual = [n[4], n[5]];
  }
  return tramos;
}

const enBezier = (t, p0, p1, p2, p3) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** Todos los puntos de la curva, muestreados. */
function recorrer(d, pasos = 200) {
  const puntos = [];
  for (const [a, c1, c2, b] of tramosDe(d)) {
    for (let i = 0; i <= pasos; i += 1) {
      const t = i / pasos;
      puntos.push([enBezier(t, a[0], c1[0], c2[0], b[0]), enBezier(t, a[1], c1[1], c2[1], b[1])]);
    }
  }
  return puntos;
}

const x = (i) => i * 60;
const y = (v) => 150 - v / 10;


test('la curva pasa EXACTAMENTE por todos los puntos', () => {
  // Es lo que la versión anterior de esta tarea no podía prometer y por lo que se
  // descartó la otra solución posible: si la app dice "saldo 500" al tocar un
  // mes, la curva tiene que estar en 500 ahí.
  const valores = [300, -200, 800, 1500, 100];
  const tramos = tramosDe(caminoDeCurva(valores, x, y));

  assert.equal(tramos.length, valores.length - 1);
  valores.forEach((v, i) => {
    const punto = i === 0 ? tramos[0][0] : tramos[i - 1][3];
    assert.deepEqual(punto, [x(i), y(v)], `el punto ${i}`);
  });
});

test('la curva NO se pasa de largo entre dos puntos', () => {
  // El caso que rompe a Catmull-Rom: un pico seguido de una bajada suave. Sin
  // monotonía la curva se hunde por debajo del valor más bajo del tramo — y si
  // eso cruza el cero, pinta de rojo un mes que cerró en verde.
  const valores = [100, 1500, 200, 150, 900];
  const puntos = recorrer(caminoDeCurva(valores, x, y));

  for (const [px, py] of puntos) {
    const i = Math.min(Math.max(Math.floor(px / 60), 0), valores.length - 2);
    const techo = Math.max(y(valores[i]), y(valores[i + 1]));
    const piso = Math.min(y(valores[i]), y(valores[i + 1]));
    assert.ok(py >= piso - 0.01 && py <= techo + 0.01,
      `en x=${px.toFixed(1)} la curva vale ${py.toFixed(1)}, fuera de [${piso.toFixed(1)}, ${techo.toFixed(1)}]`);
  }
});

test('un saldo que nunca baja de cero no dibuja curva por debajo de cero', () => {
  // La consecuencia concreta de lo anterior, dicha en plata: con estos saldos no
  // puede aparecer ni un píxel rojo.
  const valores = [50, 1500, 100, 80, 900];
  const cero = y(0);
  for (const [, py] of recorrer(caminoDeCurva(valores, x, y))) {
    assert.ok(py <= cero + 0.01, `la curva se metió abajo del cero (${py.toFixed(1)} > ${cero})`);
  }
});

test('en un pico y en un valle la curva se aplana en vez de rebotar', () => {
  // Es lo que evita el rebote: la pendiente en un extremo local es cero.
  const tramos = tramosDe(caminoDeCurva([100, 900, 100], x, y));
  const [, , c2, b] = tramos[0];

  assert.equal(b[1], y(900), 'el pico está donde tiene que estar');
  assert.equal(c2[1], y(900), 'y llega con la tangente horizontal');
});

test('con un valor solo, o con ninguno, no rompe', () => {
  assert.equal(caminoDeCurva([], x, y), '');
  assert.equal(caminoDeCurva([500], x, y), 'M 0,100');
});

test('una serie plana da una curva plana, sin ondas', () => {
  const puntos = recorrer(caminoDeCurva([400, 400, 400, 400], x, y));
  for (const [, py] of puntos) assert.ok(Math.abs(py - y(400)) < 1e-9, `${py}`);
});


// ── El área pintada ──────────────────────────────────────────────────────────

const SERIE = {
  id: 'prueba',
  titulo: 'Prueba',
  nota: 'Una nota.',
  forma: 'curva',
  rellenar: 'saldo',
  series: [{ clase: 'ingreso', nombre: 'Ingresos' }, { clase: 'saldo', nombre: 'Saldo' }],
  puntos: [
    { etiqueta: 'p0', cuando: 'uno', valores: [1000, 300] },
    { etiqueta: 'p1', cuando: 'dos', valores: [1000, -200] },
    { etiqueta: 'p2', cuando: 'tres', valores: [1000, 500] },
  ],
};

test('el área se cierra contra la línea del cero, no contra el piso del dibujo', () => {
  // Cerrarla contra el piso pintaría de verde todo lo que hay debajo de un saldo
  // positivo hasta el fondo: el color dejaría de significar nada.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const areas = [...svg.matchAll(/class="area \w+" d="([^"]*)"/g)].map((m) => m[1]);
  const cero = Number(svg.match(/class="cero"[^>]*y1="([\d.]+)"/)[1]);

  assert.equal(areas.length, 2, 'una verde y una roja');
  for (const d of areas) assert.ok(d.endsWith(`L ${ANCHO},${cero} L 0,${cero} Z`), d.slice(-40));
});

test('cada mitad del área se recorta de su lado del cero', () => {
  // Sin los recortes, la capa verde se pinta entera y tapa a la roja: un mes con
  // saldo negativo se vería verde, que es el único error que este relleno no
  // puede cometer.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const cero = Number(svg.match(/class="cero"[^>]*y1="([\d.]+)"/)[1]);

  const sobre = svg.match(/id="sobre-cero-prueba"><rect x="0" y="([\d.]+)" width="\d+" height="([\d.]+)"/);
  const bajo = svg.match(/id="bajo-cero-prueba"><rect x="0" y="([\d.]+)" width="\d+" height="([\d.]+)"/);

  assert.equal(Number(sobre[1]), 0);
  assert.equal(Number(sobre[2]), cero, 'lo verde termina en el cero');
  assert.equal(Number(bajo[1]), cero, 'lo rojo arranca en el cero');
  assert.equal(Number(bajo[2]), ALTO - cero);

  assert.match(svg, /class="area ingreso"[^>]*clip-path="url\(#sobre-cero-prueba\)"/);
  assert.match(svg, /class="area gasto"[^>]*clip-path="url\(#bajo-cero-prueba\)"/);
});

test('el área sigue a la línea del SALDO y no a otra', () => {
  // Pintar bajo los gastos daría un dibujo igual de lindo y sin sentido: los
  // gastos nunca son negativos, así que no habría nada rojo nunca.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const saldo = svg.match(/class="traza saldo"[^>]*d="([^"]*)"/)[1];
  const ingreso = svg.match(/class="traza ingreso"[^>]*d="([^"]*)"/)[1];
  const area = svg.match(/class="area ingreso" d="([^"]*)"/)[1];

  assert.ok(area.startsWith(saldo));
  assert.equal(area.startsWith(ingreso), false);
});

test('sin curva no hay área: el acumulado día por día sigue siendo una polilínea', () => {
  const svg = interiorDeSerie({ ...SERIE, forma: undefined }, { desde: 0, hasta: 2 });

  assert.match(svg, /<polyline class="traza saldo"/);
  assert.equal(svg.includes('class="area'), false);
});

test('el gráfico de mes a mes viene con curvas y con el área bajo el saldo', () => {
  const svg = dibujarMesAMes([
    { mes: '2026-01', gastos: 100000, ingresos: 200000, saldo: 100000 },
    { mes: '2026-02', gastos: 300000, ingresos: 200000, saldo: -100000 },
    { mes: '2026-03', gastos: 100000, ingresos: 250000, saldo: 150000 },
  ]);

  assert.equal((svg.match(/class="traza \w+"/g) ?? []).length, 3);
  assert.equal((svg.match(/<polyline/g) ?? []).length, 0, 'ya no hay polilíneas acá');
  assert.match(svg, /class="area ingreso"/);
  assert.match(svg, /class="area gasto"/);

  const saldo = svg.match(/class="traza saldo"[^>]*d="([^"]*)"/)[1];
  assert.ok(svg.match(/class="area ingreso" d="([^"]*)"/)[1].startsWith(saldo));
});

test('la nota del gráfico no promete que el área sea proporcional', () => {
  // Lo prometía en la versión de escalones, donde era cierto. Con curvas dejó de
  // serlo, y un gráfico que promete una precisión que no tiene es peor que uno
  // que no promete nada.
  const svg = dibujarMesAMes([
    { mes: '2026-01', gastos: 100000, ingresos: 200000, saldo: 100000 },
    { mes: '2026-02', gastos: 300000, ingresos: 200000, saldo: -100000 },
  ]);

  assert.equal(/proporcional/i.test(svg), false);
  assert.match(svg, /verde lo que sobró/);
});
