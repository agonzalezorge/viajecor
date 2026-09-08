// T-057 — Tests de las mesetas y del área bajo el saldo.
//
// ── Lo que hay que sostener acá ──────────────────────────────────────────────
//
// El usuario pidió que **el área pintada bajo el saldo fuera proporcional a los
// saldos**. Eso no lo cumple ninguna línea que una los puntos: entre dos meses,
// una línea cuenta el promedio de los dos y no el saldo de cada uno. Con los
// saldos de abajo la proporción verdadera entre lo verde y lo rojo es 3,53 y la
// línea recta que había antes encerraba 15,44.
//
// Estos tests miden el área **integrando el camino que se dibuja**, no
// comprobando que el texto del SVG sea el esperado: un test que compara cadenas
// no habría notado nada, porque el camino "se veía bien" en las dos versiones.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { caminoDeMesetas, CURVA_DE_MESETA, ANCHO, ALTO } from '../src/ui/pantallas/series.js';

const SALDOS = [100, -50, 200, 300, -120];
const SUMA_POSITIVA = 600;
const SUMA_NEGATIVA = -170;

/**
 * El área que encierra un camino SVG contra la línea del cero, en las mismas
 * unidades que los valores. Recorre el camino evaluando las curvas de Bézier y
 * los segmentos rectos, y suma tiritas verticales.
 */
function areaDelCamino(d, y, valorEn) {
  const numeros = (t) => t.trim().split(/[\s,]+/).map(Number);
  const pasos = [];
  for (const orden of d.match(/[MLC][^MLC]*/g)) {
    pasos.push({ tipo: orden[0], n: numeros(orden.slice(1)) });
  }

  let x = 0, altura = 0;
  let arriba = 0, abajo = 0;
  const sumar = (x0, y0, x1, y1) => {         // trapecio de una tirita
    const v0 = valorEn(y0), v1 = valorEn(y1);
    const ancho = x1 - x0;
    const medio = (v0 + v1) / 2;
    if (medio > 0) arriba += medio * ancho; else abajo += medio * ancho;
  };

  for (const paso of pasos) {
    if (paso.tipo === 'M') { [x, altura] = paso.n; continue; }
    if (paso.tipo === 'L') {
      const [x1, y1] = paso.n;
      // Un tramo recto se parte en pedacitos para no perder el cruce del cero.
      const N = 400;
      for (let i = 0; i < N; i += 1) {
        const a = i / N, b = (i + 1) / N;
        sumar(x + (x1 - x) * a, altura + (y1 - altura) * a, x + (x1 - x) * b, altura + (y1 - altura) * b);
      }
      x = x1; altura = y1; continue;
    }
    const [cx1, cy1, cx2, cy2, x1, y1] = paso.n;   // C
    const bezier = (t, p0, p1, p2, p3) => {
      const u = 1 - t;
      return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
    };
    const N = 400;
    for (let i = 0; i < N; i += 1) {
      const a = i / N, b = (i + 1) / N;
      sumar(bezier(a, x, cx1, cx2, x1), bezier(a, altura, cy1, cy2, y1),
            bezier(b, x, cx1, cx2, x1), bezier(b, altura, cy1, cy2, y1));
    }
    x = x1; altura = y1;
  }
  return { arriba, abajo };
}

/** Escalas iguales a las del gráfico, y la vuelta de píxel a importe. */
function conEscala(saldos) {
  const techo = Math.max(...saldos, 0);
  const piso = Math.min(...saldos, 0);
  const x = (t) => (t / saldos.length) * ANCHO;
  const y = (v) => ALTO - ((v - piso) / (techo - piso)) * ALTO;
  const valorEn = (py) => piso + ((ALTO - py) / ALTO) * (techo - piso);
  const porPixel = saldos.length / ANCHO;          // el ancho ya está en meses
  return { x, y, valorEn, porPixel };
}


test('el área de cada mes es la del escalón: ancho uno por su saldo', () => {
  // Es la propiedad que hace que todo lo demás funcione. La transición entre dos
  // mesetas es antisimétrica respecto del borde: lo que le saca a un mes se lo
  // da al otro.
  const { x, y, valorEn, porPixel } = conEscala(SALDOS);
  const d = caminoDeMesetas(SALDOS, x, y);
  const { arriba, abajo } = areaDelCamino(d, y, valorEn);
  const total = (arriba + abajo) * porPixel;

  assert.ok(Math.abs(total - (SUMA_POSITIVA + SUMA_NEGATIVA)) < 1,
    `el área con signo debería ser 430 y da ${total.toFixed(2)}`);
});

test('el reparto entre verde y rojo se parece mucho más al real que con una línea', () => {
  const { x, y, valorEn, porPixel } = conEscala(SALDOS);
  const { arriba, abajo } = areaDelCamino(caminoDeMesetas(SALDOS, x, y), y, valorEn);
  const proporcion = (arriba * porPixel) / -(abajo * porPixel);
  const verdadera = SUMA_POSITIVA / -SUMA_NEGATIVA;      // 3,53

  // La línea recta de antes daba 15,44: casi cinco veces la verdadera.
  assert.ok(Math.abs(proporcion - verdadera) < 0.4,
    `la proporción debería rondar ${verdadera.toFixed(2)} y da ${proporcion.toFixed(2)}`);
});

test('cuanto más angosta la transición, más exacta el área', () => {
  // La única fuga está en los cruces del cero, y se achica con la transición.
  // Sirve para poder elegir el ancho con un número y no a ojo.
  const { x, y, valorEn, porPixel } = conEscala(SALDOS);
  const error = (curva) => {
    const { arriba } = areaDelCamino(caminoDeMesetas(SALDOS, x, y, curva), y, valorEn);
    return Math.abs(arriba * porPixel - SUMA_POSITIVA);
  };

  assert.ok(error(0.15) < error(0.4), 'una transición más angosta miente menos');
  assert.ok(error(0.4) < error(0.8));
  assert.ok(error(CURVA_DE_MESETA) < SUMA_POSITIVA * 0.03, 'el que se eligió queda por debajo del 3 %');
});

test('con un solo valor no hay transiciones, solo la meseta', () => {
  const d = caminoDeMesetas([50], (t) => t * 100, (v) => 100 - v);
  assert.equal(d, 'M 0,50 L 100,50');
});

test('sin valores no se dibuja nada', () => {
  assert.equal(caminoDeMesetas([], (t) => t, (v) => v), '');
});

test('la meseta de cada mes está a la altura EXACTA de su saldo', () => {
  // Es lo que la otra solución posible —interpolar la acumulada y dibujar su
  // derivada— tiene que sacrificar: ahí la curva vale 390 donde el saldo es 300.
  const { x, y } = conEscala(SALDOS);
  const d = caminoDeMesetas(SALDOS, x, y);
  const alturas = [...d.matchAll(/[\d.-]+,([\d.-]+)/g)].map((m) => Number(m[1]));

  for (const saldo of SALDOS) {
    assert.ok(alturas.some((a) => Math.abs(a - y(saldo)) < 0.01),
      `ninguna parte del camino está a la altura de ${saldo}`);
  }
});


// ── La geometría del mes como tramo, y el área pintada ───────────────────────

import { interiorDeSerie } from '../src/ui/pantallas/series.js';
import { dibujarMesAMes } from '../src/ui/pantallas/graficos.js';

const SERIE = {
  id: 'prueba',
  titulo: 'Prueba',
  nota: 'Una nota.',
  forma: 'meseta',
  rellenar: 'saldo',
  series: [{ clase: 'ingreso', nombre: 'Ingresos' }, { clase: 'saldo', nombre: 'Saldo' }],
  puntos: [
    { etiqueta: 'p0', cuando: 'uno', valores: [1000, 300] },
    { etiqueta: 'p1', cuando: 'dos', valores: [1000, -200] },
    { etiqueta: 'p2', cuando: 'tres', valores: [1000, 500] },
  ],
};

test('con mesetas, el punto vive en el MEDIO de su tramo y no en el borde', () => {
  // Es lo que hace que el primer y el último mes tengan un tramo entero de área.
  // Con el punto en el borde, medio mes de cada punta no se pintaría — y el
  // gráfico diría que en el primer mes sobró la mitad de lo que sobró.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const marcas = [...svg.matchAll(/class="marca" x1="([\d.]+)"/g)].map((m) => Number(m[1]));

  assert.deepEqual(marcas, [50, 150, 250], 'tres tramos de 100: los centros van a 50, 150 y 250');
});

test('sin mesetas, los puntos siguen tocando los bordes', () => {
  // El acumulado día por día es un stock, no un flujo: ahí cada punto SÍ es un
  // instante y la línea tiene que llegar hasta las dos puntas del dibujo.
  const svg = interiorDeSerie({ ...SERIE, forma: undefined, rellenar: undefined }, { desde: 0, hasta: 2 });
  const marcas = [...svg.matchAll(/class="marca" x1="([\d.]+)"/g)].map((m) => Number(m[1]));

  assert.deepEqual(marcas, [0, 150, 300]);
});

test('el área se cierra contra la línea del cero, no contra el piso del dibujo', () => {
  // Cerrarla contra el piso pintaría de verde todo lo que hay debajo de un saldo
  // positivo hasta el fondo del gráfico: un mes con saldo 300 se vería como un
  // bloque enorme y el color dejaría de significar nada.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const areas = [...svg.matchAll(/class="area \w+" d="([^"]*)"/g)].map((m) => m[1]);

  assert.equal(areas.length, 2, 'una verde y una roja');
  // Y cada una con SU recorte: sin él, la capa verde se pinta entera y tapa la
  // roja, así que un mes con saldo negativo se vería verde.
  assert.match(svg, /class="area ingreso"[^>]*clip-path="url\(#sobre-cero-prueba\)"/);
  assert.match(svg, /class="area gasto"[^>]*clip-path="url\(#bajo-cero-prueba\)"/);
  const cero = Number(svg.match(/class="cero"[^>]*y1="([\d.]+)"/)[1]);
  for (const d of areas) {
    assert.ok(d.endsWith(`L ${ALTO * 2},${cero} L 0,${cero} Z`), `no cierra en el cero: ${d.slice(-40)}`);
  }
});

test('cada mitad del área se recorta de su lado del cero', () => {
  // Si los dos recortes fueran iguales, una de las dos capas taparía a la otra y
  // habría verde debajo del cero o rojo arriba: el error más grave posible acá,
  // porque el color es TODO lo que este relleno comunica.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const cero = Number(svg.match(/class="cero"[^>]*y1="([\d.]+)"/)[1]);

  const sobre = svg.match(/id="sobre-cero-prueba"><rect x="0" y="([\d.]+)" width="\d+" height="([\d.]+)"/);
  const bajo = svg.match(/id="bajo-cero-prueba"><rect x="0" y="([\d.]+)" width="\d+" height="([\d.]+)"/);

  assert.equal(Number(sobre[1]), 0, 'lo verde arranca arriba de todo');
  assert.equal(Number(sobre[2]), cero, 'y termina en el cero');
  assert.equal(Number(bajo[1]), cero, 'lo rojo arranca en el cero');
  assert.equal(Number(bajo[2]), ALTO - cero, 'y baja hasta el piso');
});

test('el área sigue a la línea del SALDO y no a otra', () => {
  // Pintar bajo los gastos o bajo los ingresos daría un dibujo igual de lindo y
  // completamente falso: esas dos líneas nunca son negativas.
  const svg = interiorDeSerie(SERIE, { desde: 0, hasta: 2 });
  const saldo = svg.match(/class="traza saldo"[^>]*d="([^"]*)"/)[1];
  const ingreso = svg.match(/class="traza ingreso"[^>]*d="([^"]*)"/)[1];
  const area = svg.match(/class="area ingreso" d="([^"]*)"/)[1];

  assert.ok(area.startsWith(saldo), 'el área tiene que arrancar con el camino del saldo');
  assert.equal(area.startsWith(ingreso), false, 'y no con el de los ingresos');
});

test('el gráfico de mes a mes viene con mesetas y con el área bajo el saldo', () => {
  const svg = dibujarMesAMes([
    { mes: '2026-01', gastos: 100000, ingresos: 200000, saldo: 100000 },
    { mes: '2026-02', gastos: 300000, ingresos: 200000, saldo: -100000 },
    { mes: '2026-03', gastos: 100000, ingresos: 250000, saldo: 150000 },
  ]);

  assert.equal((svg.match(/class="traza \w+"/g) ?? []).length, 3);
  assert.equal((svg.match(/<polyline/g) ?? []).length, 0, 'ya no hay polilíneas');
  assert.match(svg, /class="area ingreso"/);
  assert.match(svg, /class="area gasto"/);

  // Y el relleno va bajo el SALDO. Bajo los gastos daría un dibujo igual de
  // lindo y sin sentido: los gastos nunca son negativos, así que no habría nada
  // rojo nunca y el verde mediría plata gastada.
  const saldo = svg.match(/class="traza saldo"[^>]*d="([^"]*)"/)[1];
  assert.ok(svg.match(/class="area ingreso" d="([^"]*)"/)[1].startsWith(saldo));
});
