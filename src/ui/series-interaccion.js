// Lo único de los gráficos que toca el navegador — T-942.
//
// El dibujo es puro y vive en `pantallas/series.js`: recibe una **ventana** —dos
// índices— y devuelve el SVG de esa parte de la serie. Acá se traduce lo que
// hace el dedo en una ventana nueva, y se vuelve a pedir el dibujo.
//
// Es la misma división que ADR-022 en todos lados: casi todo se puede probar con
// `node --test`, y lo que no —que un gesto llegue a donde tiene que llegar— se
// prueba abriendo la app.
//
// ── Por qué la ventana NO vive en el estado de la app ───────────────────────
//
// Es ADR-023: lo que el usuario está manipulando vive en el documento, no en el
// estado, y no se redibuja la pantalla entera por cada movimiento del dedo.
// Redibujar todo en cada `pointermove` sería lento y perdería el gesto a la
// mitad. La ventana vive en el elemento del gráfico y se va con él, que es lo
// correcto: es cómo estás mirando, no un dato tuyo.

import { interiorDeSerie, dibujarLectura, acomodarVentana, acercar, correr, ANCHO } from './pantallas/series.js';

/** Cuánto se acerca o aleja cada toque de un botón. */
const PASO = 0.6;

/** Un movimiento de menos de esto es un toque, no un arrastre. */
const TOLERANCIA_TOQUE = 8;

const estados = new WeakMap();

function estadoDe(tarjeta) {
  if (!estados.has(tarjeta)) {
    const serie = JSON.parse(tarjeta.dataset.puntos);
    estados.set(tarjeta, {
      serie,
      ventana: { desde: 0, hasta: serie.puntos.length - 1 },
      seleccion: null,
    });
  }
  return estados.get(tarjeta);
}

function repintar(tarjeta) {
  const { serie, ventana, seleccion } = estadoDe(tarjeta);
  tarjeta.querySelector('[data-dibujo]').innerHTML = interiorDeSerie(serie, ventana, seleccion);
  tarjeta.querySelector('[data-lectura]').innerHTML = dibujarLectura(serie, seleccion);
}

/** De dónde se tocó al índice del punto más cercano. */
function indiceEn(tarjeta, clienteX) {
  const { serie, ventana } = estadoDe(tarjeta);
  const svg = tarjeta.querySelector('[data-dibujo]');
  const caja = svg.getBoundingClientRect();
  if (caja.width === 0) return null;

  // El viewBox arranca en −4 y mide ANCHO + 20: hay que pasar del píxel de la
  // pantalla a la coordenada del dibujo antes de convertirla en índice.
  const [vbX, , vbAncho] = svg.getAttribute('viewBox').split(' ').map(Number);
  const enDibujo = vbX + ((clienteX - caja.left) / caja.width) * vbAncho;

  const { desde, hasta } = acomodarVentana(ventana, serie.puntos.length);
  const proporcion = Math.max(0, Math.min(1, enDibujo / ANCHO));
  return desde + Math.round(proporcion * (hasta - desde));
}

/** La distancia entre dos dedos. */
const separacion = (a, b) => Math.abs(a - b);

/**
 * Engancha los gráficos de una pantalla ya dibujada.
 *
 * Se llama después de cada repintado. Los escuchadores van en cada tarjeta y no
 * en la raíz porque el pellizco necesita seguir a los dos dedos dentro de un
 * mismo gráfico, y una pantalla puede tener dos.
 */
export function conectarSeries(raiz) {
  for (const tarjeta of raiz.querySelectorAll('[data-serie]')) {
    if (tarjeta.dataset.conectado === 'sí') continue;
    tarjeta.dataset.conectado = 'sí';
    conectarUna(tarjeta);
  }
}

function conectarUna(tarjeta) {
  const svg = tarjeta.querySelector('[data-dibujo]');
  const dedos = new Map();
  let arrastre = null;

  tarjeta.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || !tarjeta.contains(boton)) return;
    const estado = estadoDe(tarjeta);
    const cuantos = estado.serie.puntos.length;

    if (boton.dataset.accion === 'grafico-acercar') {
      estado.ventana = acercar(estado.ventana, cuantos, PASO, estado.seleccion ?? undefined);
    } else if (boton.dataset.accion === 'grafico-alejar') {
      estado.ventana = acercar(estado.ventana, cuantos, 1 / PASO, estado.seleccion ?? undefined);
    } else if (boton.dataset.accion === 'grafico-todo') {
      estado.ventana = { desde: 0, hasta: cuantos - 1 };
    } else {
      return;
    }
    evento.stopPropagation();
    repintar(tarjeta);
  });

  svg.addEventListener('pointerdown', (evento) => {
    dedos.set(evento.pointerId, evento.clientX);
    svg.setPointerCapture(evento.pointerId);

    if (dedos.size === 1) {
      arrastre = { desdeX: evento.clientX, movido: 0, ventana: { ...estadoDe(tarjeta).ventana } };
    } else if (dedos.size === 2) {
      // Con el segundo dedo empieza el pellizco y se cancela el arrastre: si no,
      // el gráfico se correría además de acercarse.
      const [a, b] = [...dedos.values()];
      arrastre = null;
      tarjeta.dataset.pellizco = JSON.stringify({
        separacion: separacion(a, b),
        ventana: { ...estadoDe(tarjeta).ventana },
      });
    }
  });

  svg.addEventListener('pointermove', (evento) => {
    if (!dedos.has(evento.pointerId)) return;
    dedos.set(evento.pointerId, evento.clientX);
    const estado = estadoDe(tarjeta);
    const cuantos = estado.serie.puntos.length;

    if (dedos.size >= 2 && tarjeta.dataset.pellizco) {
      const inicio = JSON.parse(tarjeta.dataset.pellizco);
      const [a, b] = [...dedos.values()];
      const ahora = separacion(a, b);
      if (inicio.separacion < 1 || ahora < 1) return;
      // Separar los dedos acerca: la ventana se hace más angosta.
      estado.ventana = acercar(inicio.ventana, cuantos, inicio.separacion / ahora);
      repintar(tarjeta);
      return;
    }

    if (arrastre === null) return;
    const corrido = evento.clientX - arrastre.desdeX;
    arrastre.movido = Math.max(arrastre.movido, Math.abs(corrido));
    if (arrastre.movido < TOLERANCIA_TOQUE) return;

    // Cuántos índices son esos píxeles, con el ancho que la ventana tiene ahora.
    const caja = svg.getBoundingClientRect();
    const { desde, hasta } = acomodarVentana(arrastre.ventana, cuantos);
    const porPixel = (hasta - desde) / Math.max(1, caja.width);
    estado.ventana = correr(arrastre.ventana, cuantos, -corrido * porPixel);
    repintar(tarjeta);
  });

  const soltar = (evento) => {
    dedos.delete(evento.pointerId);
    if (dedos.size < 2) delete tarjeta.dataset.pellizco;
    if (dedos.size > 0) return;

    // Un toque —sin arrastre— elige el punto. Con arrastre no: quien movió el
    // gráfico no pidió además cambiar el punto elegido.
    if (arrastre !== null && arrastre.movido < TOLERANCIA_TOQUE) {
      const estado = estadoDe(tarjeta);
      const indice = indiceEn(tarjeta, evento.clientX);
      if (indice !== null) {
        estado.seleccion = indice;
        repintar(tarjeta);
      }
    }
    arrastre = null;
  };

  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);
}
