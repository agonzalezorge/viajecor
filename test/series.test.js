// T-942 — Tests de los gráficos que se pueden recorrer.
//
// El zoom, el desplazamiento y "qué punto estoy tocando" son **cuentas**, no
// gestos: se reducen a mover una ventana de dos índices. Por eso viven en
// `pantallas/series.js`, que es puro, y se prueban acá. Lo único que queda para
// el navegador es traducir un dedo en una ventana, y eso se prueba abriendo la
// app.
//
// Lo que puede salir mal no es que el zoom no ande: es que ande y **muestre otro
// valor del que dice**. Una ventana mal acomodada deja el gráfico vacío; una
// escala que no se recalcula deja tres líneas planas; un índice mal traducido
// hace que tocar marzo diga los números de abril.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  acomodarVentana, acercar, correr, indicesConEtiqueta,
  interiorDeSerie, dibujarLectura, dibujarSerie, MINIMO_VISIBLE, ANCHO, ALTO,
  pasoDeImporte, marcasDeImporte, etiquetaDeImporte,
} from '../src/ui/pantallas/series.js';

/** Una serie de `n` puntos, con dos líneas: una que sube y otra que baja. */
function serieDe(n) {
  return {
    id: 'prueba',
    titulo: 'Prueba',
    nota: 'Una nota.',
    series: [{ clase: 'ingreso', nombre: 'Ingresos' }, { clase: 'gasto', nombre: 'Gastos' }],
    puntos: Array.from({ length: n }, (_, i) => ({
      etiqueta: `p${i}`,
      cuando: `punto ${i}`,
      valores: [i * 100, (n - i) * 100],
    })),
  };
}


// ── La ventana: lo que hace que el zoom no rompa nada ────────────────────────

test('una ventana entera se deja como está', () => {
  assert.deepEqual(acomodarVentana({ desde: 0, hasta: 9 }, 10), { desde: 0, hasta: 9 });
});

test('una ventana que se sale de la serie se mete adentro', () => {
  assert.deepEqual(acomodarVentana({ desde: -5, hasta: 3 }, 10), { desde: 0, hasta: 3 });
  assert.deepEqual(acomodarVentana({ desde: 7, hasta: 40 }, 10), { desde: 7, hasta: 9 });
});

test('nunca queda menos de dos puntos: con uno no hay línea', () => {
  assert.deepEqual(acomodarVentana({ desde: 5, hasta: 5 }, 10), { desde: 5, hasta: 6 });
  // Y pegada al final, el mínimo se consigue corriendo el principio para atrás,
  // no estirando el final fuera de la serie.
  assert.deepEqual(acomodarVentana({ desde: 9, hasta: 9 }, 10), { desde: 8, hasta: 9 });
});

test('una ventana dada vuelta se endereza en vez de dibujar nada', () => {
  assert.deepEqual(acomodarVentana({ desde: 8, hasta: 2 }, 10), { desde: 2, hasta: 8 });
});

test('sin ventana, se ve todo', () => {
  assert.deepEqual(acomodarVentana(undefined, 10), { desde: 0, hasta: 9 });
  assert.deepEqual(acomodarVentana({}, 10), { desde: 0, hasta: 9 });
});

test('una ventana con basura adentro no rompe el gráfico', () => {
  assert.deepEqual(acomodarVentana({ desde: NaN, hasta: 'cinco' }, 10), { desde: 0, hasta: 9 });
});

test('acercar angosta la ventana alrededor del centro', () => {
  // De 0..10 (once puntos) al 60 %: quedan seis, centradas en el 5.
  assert.deepEqual(acercar({ desde: 0, hasta: 10 }, 11, 0.6), { desde: 2, hasta: 8 });
});

test('acercar alrededor del punto elegido y no del centro', () => {
  // Si acercara siempre por el centro, el punto que estás mirando se te va de la
  // pantalla justo cuando querés verlo mejor.
  const ventana = acercar({ desde: 0, hasta: 10 }, 11, 0.5, 9);
  assert.ok(ventana.desde <= 9 && 9 <= ventana.hasta, `el 9 quedó fuera de ${JSON.stringify(ventana)}`);
});

test('alejar ensancha, y frena contra las puntas', () => {
  assert.deepEqual(acercar({ desde: 4, hasta: 6 }, 11, 2), { desde: 3, hasta: 7 });
  // Alejar mucho no se pasa del principio ni del final.
  assert.deepEqual(acercar({ desde: 4, hasta: 6 }, 11, 100), { desde: 0, hasta: 10 });
});

test('acercar hasta el fondo LLEGA al mínimo de dos, y no se atasca antes', () => {
  // Se atascaba en tres: el 60 % de un ancho de dos vuelve a redondear a dos, y
  // el botón dejaba de hacer nada sin decir por qué. Ahora cada toque angosta al
  // menos un punto.
  let ventana = { desde: 0, hasta: 10 };
  for (let i = 0; i < 20; i += 1) ventana = acercar(ventana, 11, 0.6);

  assert.equal(ventana.hasta - ventana.desde + 1, MINIMO_VISIBLE);
});

test('alejar desde el mínimo vuelve a ensanchar, un punto por vez al menos', () => {
  // El espejo del anterior: si alejar tampoco moviera nada desde el mínimo, el
  // gráfico quedaría trabado en dos puntos.
  let ventana = { desde: 4, hasta: 5 };
  ventana = acercar(ventana, 11, 1 / 0.6);
  assert.ok(ventana.hasta - ventana.desde + 1 > MINIMO_VISIBLE, JSON.stringify(ventana));
});

test('correr mueve la ventana sin cambiarle el ancho', () => {
  assert.deepEqual(correr({ desde: 2, hasta: 5 }, 20, 3), { desde: 5, hasta: 8 });
  assert.deepEqual(correr({ desde: 2, hasta: 5 }, 20, -1), { desde: 1, hasta: 4 });
});

test('correr choca contra las puntas y se queda, sin achicarse', () => {
  // Si al chocar se achicara, arrastrar hasta el borde cambiaría el zoom solo.
  assert.deepEqual(correr({ desde: 2, hasta: 5 }, 20, -100), { desde: 0, hasta: 3 });
  assert.deepEqual(correr({ desde: 2, hasta: 5 }, 20, 100), { desde: 16, hasta: 19 });
});


// ── Las marcas del eje ───────────────────────────────────────────────────────

test('con pocos puntos, todos llevan etiqueta', () => {
  assert.deepEqual(indicesConEtiqueta(0, 2), [0, 1, 2]);
  assert.deepEqual(indicesConEtiqueta(0, 4), [0, 1, 2, 3, 4]);
});

test('con muchos puntos, cinco repartidas parejo', () => {
  // Once fechas en 300 píxeles se pisan y no se lee ninguna.
  assert.deepEqual(indicesConEtiqueta(0, 10), [0, 3, 5, 8, 10]);
  assert.deepEqual(indicesConEtiqueta(0, 300).length, 5);
});

test('la primera y la última SIEMPRE llevan etiqueta', () => {
  // Sin ellas no se sabe entre qué momentos se está mirando, que es lo primero
  // que hay que saber después de hacer zoom.
  for (const [desde, hasta] of [[0, 10], [3, 7], [0, 300], [12, 13]]) {
    const indices = indicesConEtiqueta(desde, hasta);
    assert.equal(indices[0], desde);
    assert.equal(indices.at(-1), hasta);
  }
});

test('las etiquetas del eje son las de los puntos de la ventana', () => {
  const svg = interiorDeSerie(serieDe(11), { desde: 4, hasta: 6 });
  // Solo las del eje del tiempo: las de importe llevan la clase `importe` y
  // están en el mismo elemento, así que hay que distinguirlas.
  const etiquetas = [...svg.matchAll(/class="marca-eje (?:inicio|medio|fin)"[^>]*>([^<]*)</g)]
    .map((m) => m[1]);

  assert.deepEqual(etiquetas, ['p4', 'p5', 'p6']);
});

test('la primera etiqueta se ancla a la izquierda y la última a la derecha', () => {
  // Centradas se salen del dibujo por la mitad de su ancho.
  const svg = interiorDeSerie(serieDe(11), { desde: 0, hasta: 10 });

  assert.match(svg, /class="marca-eje inicio"/);
  assert.match(svg, /class="marca-eje fin"/);
  assert.match(svg, /class="marca-eje medio"/);
});

test('hay una marquita por punto cuando entran', () => {
  const pocos = interiorDeSerie(serieDe(11), { desde: 0, hasta: 10 });
  assert.equal([...pocos.matchAll(/class="marca"/g)].length, 11);

  // Con trescientos días, una marca por día sería una mancha: solo las
  // etiquetadas.
  const muchos = interiorDeSerie(serieDe(300), { desde: 0, hasta: 299 });
  assert.equal([...muchos.matchAll(/class="marca"/g)].length, 5);
});


// ── El zoom tiene que cambiar la ESCALA, no solo estirar ─────────────────────

test('la escala vertical se calcula sobre lo que se ve', () => {
  // Es lo que hace que el zoom sirva: acercarse a tres meses de un año y seguir
  // viendo la escala del año deja las líneas pegadas y planas.
  const serie = serieDe(11);
  const conTodo = interiorDeSerie(serie, { desde: 0, hasta: 10 });
  const acercado = interiorDeSerie(serie, { desde: 8, hasta: 10 });

  // Se mide la GEOMETRÍA y no las etiquetas: con marcas redondas, dos ventanas
  // distintas pueden dar los mismos números —0, 5, 10— y el test pasaría sin
  // haber comprobado nada. Lo que no puede coincidir es dónde cae un mismo
  // punto: si la escala fuera global, el punto 9 estaría a la misma altura en
  // los dos dibujos.
  const alturaDelUltimo = (svg) => Number(
    svg.match(/class="traza ingreso" points="([^"]*)"/)[1].split(' ').at(-1).split(',')[1],
  );

  assert.notEqual(alturaDelUltimo(conTodo), alturaDelUltimo(acercado));
  assert.equal(alturaDelUltimo(acercado), 0, 'acercado, el punto más alto va arriba de todo');
});

test('la ventana acercada dibuja solo sus puntos, de punta a punta', () => {
  const svg = interiorDeSerie(serieDe(11), { desde: 4, hasta: 6 });
  const puntos = svg.match(/class="traza ingreso" points="([^"]*)"/)[1].split(' ');

  assert.equal(puntos.length, 3);
  assert.equal(puntos[0].split(',')[0], '0', 'el primero pegado a la izquierda');
  assert.equal(puntos[2].split(',')[0], String(ANCHO), 'el último pegado a la derecha');
});

test('el dibujo acomoda la ventana él mismo, pase lo que pase', () => {
  // La interacción le puede pasar cualquier cosa: un arrastre largo, un
  // pellizco raro, un índice fuera de la serie. Si el dibujo confiara en lo que
  // le llegó, el gráfico quedaría VACÍO —sin error, sin aviso— justo cuando el
  // usuario está moviendo el dedo. Una mutación pasó por acá.
  const serie = serieDe(11);

  for (const ventana of [
    { desde: -50, hasta: 500 },
    { desde: 8, hasta: 2 },
    { desde: 10, hasta: 10 },
    { desde: NaN, hasta: undefined },
    {},
  ]) {
    const svg = interiorDeSerie(serie, ventana);
    const puntos = svg.match(/class="traza ingreso" points="([^"]*)"/);
    assert.ok(puntos, `quedó vacío con ${JSON.stringify(ventana)}`);
    assert.ok(puntos[1].split(' ').length >= MINIMO_VISIBLE,
      `quedó con menos de dos puntos con ${JSON.stringify(ventana)}`);
  }
});

test('la línea del cero aparece solo si algo es negativo', () => {
  const conNegativos = {
    ...serieDe(3),
    puntos: [
      { etiqueta: 'a', valores: [100, -100] },
      { etiqueta: 'b', valores: [200, -50] },
      { etiqueta: 'c', valores: [300, 50] },
    ],
  };
  assert.match(interiorDeSerie(conNegativos, { desde: 0, hasta: 2 }), /class="cero"/);
  assert.equal(interiorDeSerie(serieDe(11), { desde: 0, hasta: 10 }).includes('class="cero"'), false);
});


// ── El eje de los importes (T-944) ──────────────────────────────────────────

test('el paso es un número redondo, no el rango dividido en cinco', () => {
  // Un eje que dice `1.842,33 €` es exacto y no significa nada. Lo que sirve es
  // que diga 1.000, 2.000.
  assert.equal(pasoDeImporte(0, 230000), 50000, 'de 0 a 2300 €: cada 500 €');
  assert.equal(pasoDeImporte(0, 4500), 1000, 'de 0 a 45 €: cada 10 €');
  assert.equal(pasoDeImporte(0, 100), 50, 'de 0 a 1 €: cada 50 céntimos');
});

test('las marcas son los múltiplos del paso que caen adentro', () => {
  assert.deepEqual(marcasDeImporte(0, 4500), [0, 1000, 2000, 3000, 4000]);
  assert.deepEqual(marcasDeImporte(1000, 1200), [1000, 1050, 1100, 1150, 1200]);
});

test('ninguna marca se sale del dibujo', () => {
  // Una marca fuera del rango se dibujaría arriba del borde o abajo del eje.
  for (const [piso, techo] of [[0, 4500], [-40000, 250000], [333, 7777], [1000, 1200]]) {
    for (const marca of marcasDeImporte(piso, techo)) {
      assert.ok(marca >= piso && marca <= techo, `${marca} se sale de ${piso}..${techo}`);
    }
  }
});

test('el cero SIEMPRE lleva marca si el rango lo cruza', () => {
  // Es la línea que dice si un mes cerró en más o en menos.
  const marcas = marcasDeImporte(-40000, 250000);
  assert.ok(marcas.includes(0), `no estaba el cero en ${JSON.stringify(marcas)}`);
});

test('el cero se escribe "0" y no "-0"', () => {
  // `Math.ceil(-0.4) * 100000` da −0, que se formatea como "-0 €" y se lee como
  // un error de la app.
  for (const marca of marcasDeImporte(-40000, 250000)) {
    assert.equal(Object.is(marca, -0), false, 'hay un cero negativo');
  }
  assert.equal(etiquetaDeImporte(0, 50000), '0');
});

test('las etiquetas del eje van sin decimales cuando el paso es de euros', () => {
  // `2.100,00` ocupa el doble que `2100` en el margen de un teléfono y no dice
  // nada más. Los céntimos se ven al tocar el punto, que es donde importan.
  assert.equal(etiquetaDeImporte(210000, 50000), '2100');
  assert.equal(etiquetaDeImporte(1050, 50), '10,50', 'con pasos chicos sí hacen falta');
});

test('con un rango de cero no se inventan marcas', () => {
  assert.equal(pasoDeImporte(100, 100), null);
  assert.deepEqual(marcasDeImporte(100, 100), []);
});

test('el dibujo pone una línea VISIBLE y un número por cada marca', () => {
  // Visible, no solo presente: un `hidden` deja la línea en la página y fuera de
  // la pantalla, y una mutación pasó por ahí. Es L-026 otra vez.
  const svg = interiorDeSerie(serieDe(11), { desde: 0, hasta: 10 });
  const lineas = [...svg.matchAll(/<line([^>]*)class="guia-importe"/g)];
  const numeros = [...svg.matchAll(/class="marca-eje importe"/g)].length;

  assert.ok(numeros >= 3, `solo había ${numeros} marcas de importe`);
  assert.equal(lineas.length, numeros, 'cada número tiene que tener su línea');
  for (const [, atributos] of lineas) {
    assert.equal(/\bhidden\b/.test(atributos), false, 'hay una línea escondida');
  }
});

test('la línea del cero se dibuja distinta, no como una raya más', () => {
  const conNegativos = {
    ...serieDe(3),
    puntos: [
      { etiqueta: 'a', valores: [100, -100] },
      { etiqueta: 'b', valores: [200, -50] },
      { etiqueta: 'c', valores: [300, 50] },
    ],
  };
  const svg = interiorDeSerie(conNegativos, { desde: 0, hasta: 2 });

  assert.match(svg, /class="cero"/);
  assert.equal([...svg.matchAll(/class="cero"/g)].length, 1, 'el cero no se dibuja dos veces');
});

test('los números del eje entran en el dibujo', () => {
  // Se dibujan a la izquierda del cero, así que el viewBox tiene que abrir ahí:
  // sin ese margen se dibujan igual, fuera del recorte, y no se ven.
  const html = dibujarSerie(serieDe(11));
  const [x] = html.match(/viewBox="(-?\d+)/).slice(1).map(Number);

  assert.ok(x <= -40, `el viewBox arranca en ${x} y los números van en x = −6`);
});


// ── Tocar un punto ───────────────────────────────────────────────────────────

test('el punto elegido se marca con una guía y un punto por línea', () => {
  const svg = interiorDeSerie(serieDe(11), { desde: 0, hasta: 10 }, 5);

  assert.match(svg, /class="guia"/);
  assert.equal([...svg.matchAll(/class="punto /g)].length, 2, 'un punto por serie');
});

test('un punto elegido fuera de la ventana no se dibuja en el borde', () => {
  // Dibujarlo igual lo pegaría a una punta y diría que ahí pasó algo que no.
  const svg = interiorDeSerie(serieDe(11), { desde: 0, hasta: 3 }, 9);
  assert.equal(svg.includes('class="guia"'), false);
});

test('la lectura dice CUÁNDO es y cuánto valía cada línea', () => {
  // Es el pedido central del usuario.
  const html = dibujarLectura(serieDe(11), 5);

  assert.ok(html.includes('punto 5'), 'no dice en qué momento del tiempo estoy');
  assert.ok(html.includes('Ingresos'));
  assert.ok(html.includes('Gastos'));
  // serieDe(11) da [i·100, (11−i)·100]: en el punto 5 son 500 y 600 céntimos.
  assert.ok(html.includes('5,00'), 'no muestra el valor de la primera línea');
  assert.ok(html.includes('6,00'), 'no muestra el valor de la segunda');
});

test('sin punto elegido, la lectura dice qué hacer en vez de quedar en blanco', () => {
  // Un espacio vacío debajo de un gráfico se lee como que algo no cargó.
  const html = dibujarLectura(serieDe(11), null);

  assert.match(html, /Tocá el gráfico/);
  assert.equal(dibujarLectura(serieDe(11), 99), html, 'un índice inexistente tampoco rompe');
});

test('la lectura lleva el color de cada línea al lado del nombre', () => {
  // Para que se ate a la línea de arriba sin depender del color solo.
  const html = dibujarLectura(serieDe(11), 5);
  assert.match(html, /marca-serie ingreso/);
  assert.match(html, /marca-serie gasto/);
});


// ── El gráfico entero ────────────────────────────────────────────────────────

test('trae los tres controles, y no solo el gesto', () => {
  // Un gesto que el teléfono no interprete deja el gráfico sin salida. Este
  // proyecto ya pagó esa lección con el <datalist> (L-021).
  const html = dibujarSerie(serieDe(11));

  assert.ok(html.includes('data-accion="grafico-acercar"'));
  assert.ok(html.includes('data-accion="grafico-alejar"'));
  assert.ok(html.includes('data-accion="grafico-todo"'));
  assert.ok(html.includes('aria-label="Acercar"'), 'un "+" solo no lo lee un lector de pantalla');
});

test('lleva sus datos adentro, para que la interacción no los recalcule', () => {
  const html = dibujarSerie(serieDe(3));
  const datos = JSON.parse(html.match(/data-puntos="([^"]*)"/)[1].replace(/&quot;/g, '"'));

  assert.equal(datos.puntos.length, 3);
  assert.equal(datos.series.length, 2);
});

test('el texto del usuario no puede romper la página desde una serie', () => {
  const serie = { ...serieDe(3), titulo: '<script>x', puntos: serieDe(3).puntos.map((p) => ({ ...p, etiqueta: '<b>' })) };
  const html = dibujarSerie(serie);

  assert.equal(html.includes('<script>x'), false);
  assert.equal(html.includes('>&lt;b&gt;<') || html.includes('&lt;b&gt;'), true);
});

test('con menos de dos puntos no se dibuja nada', () => {
  assert.equal(dibujarSerie(serieDe(1)), '');
  assert.equal(dibujarSerie(serieDe(0)), '');
});

test('con todo en cero no se dibuja una línea plana sin sentido', () => {
  const plana = { ...serieDe(3), puntos: serieDe(3).puntos.map((p) => ({ ...p, valores: [0, 0] })) };
  assert.equal(dibujarSerie(plana), '');
});

test('el gráfico no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarSerie(serieDe(11))), false);
});
