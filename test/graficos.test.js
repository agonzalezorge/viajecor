// T-918 — Tests de los dos gráficos del mes.
//
// Un gráfico miente distinto que un número: no muestra un valor equivocado,
// muestra el valor correcto con la forma equivocada. Por eso lo que se prueba
// acá es la **geometría**, no el texto. Una porción que dice "20 %" al lado de
// un pedazo que ocupa la mitad del círculo es peor que no dibujar nada, porque
// el dibujo se cree antes que el número (es L-016, la que encontró el usuario
// en su celular con dos barras llenas que decían 50 %).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dibujarTorta, dibujarLinea, dibujarAcumulado, dibujarAcumuladoHistorico,
  dibujarMesAMes, diasHasta } from '../src/ui/pantallas/graficos.js';
import { COLORES_RUBRO, COLORES_RUBRO_OSCURO } from '../src/core/paleta.js';
import { claseDeRubro, franjaDeRubro } from '../src/ui/colores.js';
import { TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';

/** Una fila como la que devuelve `porRubro`. El porcentaje sale del total. */
function filas(pares) {
  const total = pares.reduce((suma, [, monto]) => suma + monto, 0);
  return pares.map(([rubro, monto]) => ({
    rubro, total: monto, cuantos: 1, porcentaje: (monto / total) * 100,
  }));
}

/**
 * Los ángulos que barre cada porción, leídos del SVG dibujado.
 *
 * No se le pregunta al código cuánto quiso dibujar: se mide el dibujo. Un test
 * que compara el número que la función calculó contra ese mismo número no puede
 * fallar nunca (L-018).
 */
function angulos(svg) {
  const grados = ([x, y]) => (Math.atan2(Number(y), Number(x)) * 180) / Math.PI + 90;
  return [...svg.matchAll(/d="M 0 0 L (\S+) (\S+) A \d+ \d+ 0 (\d) 1 (\S+) (\S+) Z"/g)]
    .map((m) => {
      const barrido = grados([m[4], m[5]]) - grados([m[1], m[2]]);
      return { barrido: (barrido + 360) % 360, arcoGrande: Number(m[3]) };
    });
}

const rubroDePorcion = (svg) => [...svg.matchAll(/class="porcion (rubro-\d)"/g)].map((m) => m[1]);


// ── La torta ─────────────────────────────────────────────────────────────────

test('cada porción ocupa su parte del total, no su parte del rubro más grande', () => {
  // La regla, en forma de torta. 60/30/10 son 216°, 108° y 36°.
  const svg = dibujarTorta(filas([['viajes', 6000], ['salud', 3000], ['transporte', 1000]]), TIPO_GASTO);
  const medidos = angulos(svg).map((a) => Math.round(a.barrido));

  // Se ordenan porque la torta se dibuja en el orden de la paleta, no por tamaño.
  assert.deepEqual(medidos.sort((a, b) => b - a), [216, 108, 36]);
});

test('dos rubros iguales dan dos medios círculos', () => {
  // El caso exacto que reportó el usuario con las barras (2026-08-27).
  const svg = dibujarTorta(filas([['viajes', 5000], ['salud', 5000]]), TIPO_GASTO);
  assert.deepEqual(angulos(svg).map((a) => Math.round(a.barrido)), [180, 180]);
});

test('las porciones cierran el círculo', () => {
  // Con importes que no dan porcentajes redondos: si los ángulos salieran del
  // porcentaje redondeado, la suma daría 359 o 361 y quedaría un hueco.
  const svg = dibujarTorta(filas([['viajes', 3333], ['salud', 3333], ['transporte', 3334]]), TIPO_GASTO);
  const total = angulos(svg).reduce((suma, a) => suma + a.barrido, 0);

  assert.ok(Math.abs(total - 360) < 0.5, `las porciones suman ${total}°`);
});

test('una porción de más de media torta se dibuja por el lado largo', () => {
  // El error clásico del arco de SVG: sin la bandera, un 70 % se dibuja como el
  // 30 % que le sobra. El número diría 70 y el dibujo mostraría 30.
  const svg = dibujarTorta(filas([['viajes', 7000], ['salud', 3000]]), TIPO_GASTO);
  const grande = angulos(svg).find((a) => a.barrido > 180);

  assert.equal(grande.arcoGrande, 1, 'la porción mayor a 180° no lleva la bandera de arco largo');
  assert.equal(angulos(svg).find((a) => a.barrido < 180).arcoGrande, 0);
});

test('el orden de dibujo es el de la paleta, y no cambia con los tamaños', () => {
  // Es lo que hace que los pares de colores que quedan pegados sean siempre los
  // mismos, que es lo único que se puede validar con ocho colores (ADR-029).
  const chico = dibujarTorta(filas([['salud', 100], ['viajes', 9000]]), TIPO_GASTO);
  const grande = dibujarTorta(filas([['salud', 9000], ['viajes', 100]]), TIPO_GASTO);

  assert.deepEqual(rubroDePorcion(chico), rubroDePorcion(grande));
  assert.deepEqual(rubroDePorcion(chico), ['rubro-4', 'rubro-7'], 'viajes antes que salud');
});

test('el color de cada porción es el que ese rubro tiene en todas las pantallas', () => {
  const svg = dibujarTorta(filas([['salud', 100], ['supermercado', 200], ['otros', 300]]), TIPO_GASTO);

  for (const rubro of ['salud', 'supermercado', 'otros']) {
    assert.ok(svg.includes(`class="porcion ${claseDeRubro(TIPO_GASTO, rubro)}"`), rubro);
  }
});

test('solo las porciones grandes llevan su número escrito adentro', () => {
  // Ocho números en una torta chica se pisan entre sí. Los porcentajes de todos
  // los rubros están en la lista de abajo, que es donde se leen.
  const svg = dibujarTorta(filas([['viajes', 9500], ['salud', 300], ['transporte', 200]]), TIPO_GASTO);
  const rotulos = [...svg.matchAll(/class="rotulo-porcion"[^>]*>(\d+) %</g)].map((m) => Number(m[1]));

  assert.deepEqual(rotulos, [95]);
});

test('la torta arranca arriba, a las 12', () => {
  // Nadie lee una torta empezando a las 3 en punto. Sobrevivía a todos los
  // demás tests: los ángulos entre porciones seguían siendo los correctos, la
  // torta entera estaba girada un cuarto de vuelta.
  const svg = dibujarTorta(filas([['viajes', 100], ['salud', 100]]), TIPO_GASTO);
  const [primera] = [...svg.matchAll(/d="M 0 0 L (\S+) (\S+) A/g)];

  assert.equal(Number(primera[1]), 0, 'no arranca en el eje vertical');
  assert.ok(Number(primera[2]) < 0, 'arranca para abajo en vez de para arriba');
});

test('con menos de dos rubros no hay torta', () => {
  assert.equal(dibujarTorta(filas([['viajes', 100]]), TIPO_GASTO), '');
  assert.equal(dibujarTorta([], TIPO_GASTO), '');
});

test('un tipo sin importe no dibuja una torta vacía', () => {
  // Dividir por cero da NaN, y un SVG con NaN adentro no dibuja nada pero
  // tampoco avisa: queda un hueco blanco donde tendría que haber un gráfico.
  const svg = dibujarTorta(filas([['viajes', 0], ['salud', 0]]), TIPO_GASTO);

  assert.equal(svg, '');
});

test('la torta se puede leer sin verla', () => {
  const svg = dibujarTorta(filas([['viajes', 7500], ['salud', 2500]]), TIPO_GASTO);

  assert.ok(svg.includes('role="img"'));
  assert.match(svg, /aria-label="[^"]*Viajes 75 %[^"]*Salud 25 %/);
});

test('los ingresos también tienen su torta, con sus propios colores', () => {
  const svg = dibujarTorta(filas([['trabajo', 9000], ['regalos', 1000]]), TIPO_INGRESO);

  assert.ok(svg.includes(`class="porcion rubro-${franjaDeRubro(TIPO_INGRESO, 'trabajo')}"`));
  assert.ok(svg.includes(`class="porcion rubro-${franjaDeRubro(TIPO_INGRESO, 'regalos')}"`));
});

test('el número escrito adentro de una porción se lee sobre los ocho colores', () => {
  // Es el único texto de la app que va encima de un color de rubro, así que su
  // color se elige contra ESE fondo. El negro aguanta los ocho, en claro y en
  // oscuro. Si algún día la paleta cambia y un tono deja de aguantarlo, tiene
  // que fallar acá y no descubrirlo el usuario mirando un 32 % ilegible.
  const luminancia = (hex) => {
    const canal = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (const paleta of [COLORES_RUBRO, COLORES_RUBRO_OSCURO]) {
    for (const [i, color] of paleta.entries()) {
      const contraste = (luminancia(color) + 0.05) / 0.05;
      assert.ok(contraste >= 4.2,
        `el negro sobre el rubro ${i + 1} (${color}) contrasta ${contraste.toFixed(1)}:1`);
    }
  }
});


// ── La línea del acumulado ───────────────────────────────────────────────────

/** Días como los que devuelve `porDia`: gasto fijo por día, sin ingresos. */
function dias(gastos, ingresos = []) {
  let g = 0;
  let i = 0;
  return gastos.map((gasto, indice) => {
    g += gasto;
    i += ingresos[indice] ?? 0;
    return {
      dia: indice + 1,
      fecha: `2026-03-${String(indice + 1).padStart(2, '0')}`,
      gasto,
      ingreso: ingresos[indice] ?? 0,
      gastoAcumulado: g,
      ingresoAcumulado: i,
    };
  });
}

const puntos = (svg, clase) => {
  const encontrado = svg.match(new RegExp(`class="traza ${clase}" points="([^"]*)"`));
  return encontrado[1].split(' ').map((p) => p.split(',').map(Number));
};

test('el mes en curso se dibuja hasta hoy, no hasta fin de mes', () => {
  // Si la línea siguiera hasta el día 31, quedaría plana desde hoy hasta el
  // final, y una meseta en un acumulado se lee como "dejó de gastar".
  const treintaYUno = dias(Array(31).fill(100));
  const svg = dibujarLinea(treintaYUno, { hasta: 10 });

  assert.equal(puntos(svg, 'gasto').length, 10);
  assert.ok(svg.includes('Día 10'));
});

test('un mes terminado se dibuja entero', () => {
  const svg = dibujarLinea(dias(Array(31).fill(100)));
  assert.equal(puntos(svg, 'gasto').length, 31);
  assert.ok(svg.includes('Día 31'));
});

test('el acumulado nunca baja', () => {
  // Es lo que lo distingue del gasto diario: si bajara, no sería un acumulado.
  const svg = dibujarLinea(dias([500, 0, 300, 1200, 0, 50, 900]));
  const alturas = puntos(svg, 'gasto').map(([, y]) => y);

  for (let i = 1; i < alturas.length; i += 1) {
    // En SVG el eje y crece hacia abajo: más gasto es una y más chica.
    assert.ok(alturas[i] <= alturas[i - 1], `el día ${i + 1} subió en la pantalla`);
  }
});

test('las dos líneas comparten una sola escala', () => {
  // Dos escalas en un mismo dibujo es la forma más común de mentir con un
  // gráfico: hace que la línea de abajo parezca alcanzar a la de arriba.
  const svg = dibujarLinea(dias([1000, 1000], [4000, 0]));
  const [, ultimoGasto] = puntos(svg, 'gasto')[1];
  const [, ultimoIngreso] = puntos(svg, 'ingreso')[1];

  // El ingreso (4000) es el techo, así que va arriba de todo; el gasto (2000)
  // es la mitad de ese techo, así que va a la mitad del alto.
  assert.equal(ultimoIngreso, 0);
  assert.equal(ultimoGasto, 70);
});

test('el techo de la escala está escrito', () => {
  // Una línea sin ninguna cifra dice la forma pero no el tamaño: la misma
  // curva sirve para 200 € y para 20 000 €.
  const svg = dibujarLinea(dias([1234, 8766]));
  assert.ok(svg.includes('100,00'), 'no dice a cuánto llega el eje');
});

test('cada línea dice cuál es donde termina', () => {
  const svg = dibujarLinea(dias([1000, 1000], [500, 500]));

  assert.ok(svg.includes('>Gastos<'));
  assert.ok(svg.includes('>Ingresos<'));
});

test('con un día solo no hay línea', () => {
  // Una línea de un punto es un punto, y no dice nada de cómo se acumuló.
  assert.equal(dibujarLinea(dias([1000])), '');
  assert.equal(dibujarLinea(dias(Array(31).fill(100)), { hasta: 1 }), '');
});

test('un mes sin nada no dibuja una línea pegada al piso', () => {
  assert.equal(dibujarLinea(dias([0, 0, 0])), '');
  assert.equal(dibujarAcumulado(dias([0, 0, 0])), '');
});

test('la tarjeta del acumulado trae su título', () => {
  assert.ok(dibujarAcumulado(dias([100, 200])).includes('Cómo se fue acumulando'));
});

test('diasHasta sin límite devuelve todo', () => {
  const treinta = dias(Array(30).fill(1));
  assert.equal(diasHasta(treinta, undefined).length, 30);
  assert.equal(diasHasta(treinta, 5).length, 5);
});

test('ningún gráfico pide nada a internet', () => {
  const torta = dibujarTorta(filas([['viajes', 100], ['salud', 200]]), TIPO_GASTO);
  const linea = dibujarAcumulado(dias([100, 200, 300]));

  assert.equal(/https?:\/\//.test(torta + linea), false);
  assert.equal(/xlink:href|<image/.test(torta + linea), false);
});


// ── Los dos gráficos de Analisis1 — T-940 ───────────────────────────────────

/** Días de historial, como los devuelve `acumuladoHistorico`. */
function historial(pares) {
  let g = 0;
  let i = 0;
  return pares.map(([gasto, ingreso], indice) => {
    g += gasto;
    i += ingreso;
    const dia = indice + 1;
    return {
      dia,
      fecha: `2025-10-${String(dia).padStart(2, '0')}`,
      mes: indice < 3 ? '2025-10' : '2025-11',
      gastoAcumulado: g,
      ingresoAcumulado: i,
    };
  });
}

test('el acumulado histórico rotula el eje con MESES, no con días', () => {
  // Es la diferencia con el del mes: acá el eje cruza meses, y "Día 1 → Día 300"
  // no le dice nada a nadie.
  const svg = dibujarAcumuladoHistorico(historial([[100, 0], [50, 900], [0, 0], [200, 0]]));

  // Se miran las marcas del eje, no toda la página: el texto de la tarjeta dice
  // "Día por día desde el primer movimiento", así que buscar "Día" suelto lo
  // encuentra ahí y el test pasa sin haber mirado el eje. Es L-024 otra vez.
  const marcas = [...svg.matchAll(/class="marca-eje[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);

  assert.ok(marcas.includes('oct 25'), `las marcas eran ${JSON.stringify(marcas)}`);
  assert.ok(marcas.includes('nov 25'));
  assert.equal(marcas.some((m) => m.startsWith('Día')), false);
});

test('el acumulado histórico se ANUNCIA como histórico, no como del mes', () => {
  // Los dos gráficos comparten el dibujo, así que compartían también el texto
  // que lee un lector de pantalla: quien no ve el dibujo escuchaba "Acumulado
  // del mes" sobre un gráfico de once meses.
  const svg = dibujarAcumuladoHistorico(historial([[100, 0], [50, 900], [0, 0], [200, 0]]));
  const anuncio = svg.match(/aria-label="([^"]*)"/)[1];

  assert.match(anuncio, /Todo lo que llevás gastado y cobrado/);
  assert.match(anuncio, /de oct 25 a nov 25/, 'tiene que decir qué tramo se está viendo');
  assert.equal(anuncio.includes('del mes'), false);
});

test('el acumulado histórico dice qué mirar', () => {
  // La altura de las líneas no dice nada por sí sola: lo que importa es si se
  // separan o se juntan.
  const svg = dibujarAcumuladoHistorico(historial([[100, 0], [50, 900]]));
  assert.match(svg.replace(/\s+/g, ' '), /se separan o se juntan/);
});

test('con menos de dos días no hay acumulado histórico', () => {
  assert.equal(dibujarAcumuladoHistorico(historial([[100, 0]])), '');
  assert.equal(dibujarAcumuladoHistorico([]), '');
});

const MESES = [
  { mes: '2025-10', gastos: 100000, ingresos: 210000, saldo: 110000 },
  { mes: '2025-11', gastos: 250000, ingresos: 210000, saldo: -40000 },
  { mes: '2025-12', gastos: 150000, ingresos: 210000, saldo: 60000 },
];

test('mes a mes dibuja las tres series', () => {
  const svg = dibujarMesAMes(MESES);

  for (const clase of ['ingreso', 'gasto', 'saldo']) {
    assert.match(svg, new RegExp(`class="traza ${clase}"`), `falta la línea de ${clase}`);
  }
  // Cada serie tiene que decir cuál es. Los rótulos estaban al final de cada
  // línea; con el zoom eso deja de servir —la línea se sale del dibujo— así que
  // pasaron a una leyenda arriba, con el cuadradito de color al lado del nombre
  // para que la identidad no dependa solo del color (T-942).
  for (const nombre of ['Ingresos', 'Gastos', 'Saldo']) {
    assert.ok(svg.includes(`</span>${nombre}`), `falta ${nombre} en la leyenda`);
  }
  for (const clase of ['ingreso', 'gasto', 'saldo']) {
    assert.match(svg, new RegExp(`marca-serie ${clase}`), `falta el color de ${clase} en la leyenda`);
  }
});

test('las tres comparten una sola escala', () => {
  // Dos escalas en un mismo dibujo hacen que la línea de abajo parezca alcanzar
  // a la de arriba. Es la forma más común de mentir con un gráfico.
  const svg = dibujarMesAMes(MESES);
  const puntos = (clase) => svg.match(new RegExp(`class="traza ${clase}" points="([^"]*)"`))[1]
    .split(' ').map((p) => Number(p.split(',')[1]));

  // El techo es 250000 (los gastos de noviembre) y el piso -40000 (su saldo).
  // Noviembre es el segundo punto de cada línea.
  assert.equal(puntos('gasto')[1], 0, 'el valor más alto va arriba de todo');
  assert.equal(puntos('saldo')[1], 150, 'el más bajo va abajo de todo');
});

test('con saldo negativo se dibuja la línea del cero', () => {
  // Sin ella, −200 y +200 se ven como dos puntos cualesquiera.
  assert.match(dibujarMesAMes(MESES), /class="cero"/);
});

test('sin ningún saldo negativo no se dibuja una línea del cero pegada al piso', () => {
  const svg = dibujarMesAMes([
    { mes: '2025-10', gastos: 100000, ingresos: 210000, saldo: 110000 },
    { mes: '2025-11', gastos: 100000, ingresos: 210000, saldo: 110000 },
  ]);

  assert.equal(svg.includes('class="cero"'), false);
});

test('mes a mes rotula el eje con TODOS los meses cuando entran', () => {
  // El usuario pidió "más coordenadas en el eje de las x" (T-942): antes solo
  // estaban la primera y la última.
  const svg = dibujarMesAMes(MESES);
  const etiquetas = [...svg.matchAll(/class="marca-eje [a-z]+"[^>]*>([^<]*)</g)].map((m) => m[1]);

  assert.deepEqual(etiquetas, ['oct 25', 'nov 25', 'dic 25']);
});

test('con un solo mes no hay nada que comparar', () => {
  assert.equal(dibujarMesAMes([MESES[0]]), '');
  assert.equal(dibujarMesAMes([]), '');
});

test('con todo en cero no se dibuja una línea plana sin sentido', () => {
  const svg = dibujarMesAMes([
    { mes: '2025-10', gastos: 0, ingresos: 0, saldo: 0 },
    { mes: '2025-11', gastos: 0, ingresos: 0, saldo: 0 },
  ]);
  assert.equal(svg, '');
});

test('los dos gráficos nuevos se pueden leer sin verlos', () => {
  assert.match(dibujarMesAMes(MESES), /role="img"[\s\S]*?aria-label="[^"]*oct 25[^"]*dic 25/);
  assert.match(dibujarAcumuladoHistorico(historial([[100, 0], [50, 900]])), /role="img"/);
});

test('ninguno de los dos pide nada a internet', () => {
  const todo = dibujarMesAMes(MESES) + dibujarAcumuladoHistorico(historial([[1, 1], [1, 1]]));
  assert.equal(/https?:\/\//.test(todo), false);
});
