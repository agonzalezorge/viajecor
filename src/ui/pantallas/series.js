// Una serie temporal que se puede recorrer — T-942.
//
// Los dos gráficos del historial —el de ingresos, gastos y saldo mes a mes, y el
// del acumulado día por día— eran dibujos fijos: se veía la forma y no se podía
// leer ningún valor. El usuario pidió tres cosas: **zoom, más marcas en el eje
// de las x, y poder tocar un punto y ver qué pasaba ahí**.
//
// ── Por qué esto es un archivo aparte y no más código en graficos.js ────────
//
// Porque el dibujo sigue siendo **puro** (ADR-022) y la interacción no puede
// serlo. La solución es que el dibujo reciba **qué parte de la serie mostrar**:
//
//     interiorDeSerie(serie, ventana) → el SVG de adentro, para esa ventana
//
// El zoom y el desplazamiento no son más que cambiar la ventana y volver a
// llamar a esa función. Así lo que decide qué se ve se puede probar con
// `node --test`, y lo único que toca el navegador es traducir un gesto en una
// ventana nueva (`ui/series-interaccion.js`).
//
// ── La ventana ──────────────────────────────────────────────────────────────
//
// Es un par de **índices** dentro de los puntos, no un par de fechas. Los datos
// ya vienen ordenados y sin huecos —`acumuladoHistorico()` devuelve todos los
// días, también los vacíos—, así que el índice ES el tiempo, y trabajar con
// índices hace que el zoom no dependa de que los puntos estén parejos.

import { escapar } from '../app.js';
import { formatearEuros, formatearNumero } from '../../core/formato.js';

export const ANCHO = 300;
export const ALTO = 150;

/** Nunca menos de dos puntos: con uno no hay línea, hay un punto. */
export const MINIMO_VISIBLE = 2;

/** Cuántas etiquetas del eje entran sin pisarse en la pantalla de un teléfono. */
const MAXIMO_ETIQUETAS = 5;

/** Cuánto espacio necesita una etiqueta del eje para no pisar a la de al lado. */
const SEPARACION_MINIMA = 56;

/** Cuántas marcas se apunta a poner en el eje de los importes. */
const MARCAS_DE_IMPORTE = 5;

/**
 * Los pasos que dan números redondos, en céntimos: 1, 2, 5, 10, 20, 50, 100…
 *
 * Un eje que dice `1.842,33 €` es peor que no decir nada: el número es exacto y
 * no significa nada. Lo que sirve es que diga `1.000 €`, `2.000 €`. Por eso los
 * pasos salen de esta serie y no de dividir el alto entre cinco.
 */
function pasosRedondos() {
  const pasos = [];
  for (let potencia = 0; potencia <= 9; potencia += 1) {
    for (const base of [1, 2, 5]) pasos.push(base * 10 ** potencia);
  }
  return pasos;
}

/**
 * Cada cuánto poner una marca de importe, en céntimos.
 *
 * Elige el paso redondo más chico que no pase de `MARCAS_DE_IMPORTE` marcas: con
 * un rango de 0 a 2.300 € da 500 €, con uno de 0 a 45 € da 10 €. Es lo que hace
 * que las etiquetas sean números que uno diría en voz alta.
 */
export function pasoDeImporte(piso, techo, maximo = MARCAS_DE_IMPORTE) {
  const rango = techo - piso;
  if (!(rango > 0)) return null;

  for (const paso of pasosRedondos()) {
    if (Math.floor(techo / paso) - Math.ceil(piso / paso) + 1 <= maximo) return paso;
  }
  return null;
}

/**
 * Los importes que llevan marca: los múltiplos del paso que caen adentro.
 *
 * **El cero sale gratis**: si el rango lo cruza, es múltiplo de cualquier paso,
 * así que siempre entra. La primera versión lo agregaba a mano por las dudas y
 * una mutación demostró que esa línea era inalcanzable — borrarla no ponía
 * ningún test en rojo porque no hacía nada.
 */
export function marcasDeImporte(piso, techo, maximo = MARCAS_DE_IMPORTE) {
  const paso = pasoDeImporte(piso, techo, maximo);
  if (paso === null) return [];

  const marcas = [];
  // El `+ 0` no es adorno: `Math.ceil(-0.4) * 100000` da **−0**, que se formatea
  // como "-0" y se lee como un error de la app.
  for (let valor = Math.ceil(piso / paso) * paso + 0; valor <= techo; valor += paso) {
    marcas.push(valor);
  }
  return marcas;
}

/**
 * El importe como se escribe en el eje: **sin decimales** cuando el paso es de
 * un euro o más.
 *
 * `2.100,00 €` en el margen de un gráfico de teléfono ocupa el doble que
 * `2.100 €` y no dice nada más. Los céntimos se ven al tocar el punto, que es
 * donde importan.
 */
export function etiquetaDeImporte(centimos, paso) {
  const enEuros = centimos / 100;
  const decimales = paso !== null && paso >= 100 && Number.isInteger(enEuros) ? 0 : 2;
  return formatearNumero(centimos, 2, decimales);
}

const cortoEnSerie = (n) => Math.round(n * 100) / 100;

/**
 * El camino de una serie dibujada como **curva** — T-057.
 *
 * ── Qué curva, y por qué esa ───────────────────────────────────────────────
 *
 * Una spline monótona por tramos (PCHIP), pasada a Béziers cúbicas. La clave es
 * lo de **monótona**: la curva pasa por todos los puntos y **no se pasa de
 * largo** entre uno y el siguiente. La alternativa fácil —Catmull-Rom, que es lo
 * que sale cuando uno "suaviza" una polilínea— sí se pasa: con un mes de saldo
 * +1.500 seguido de uno de +100, la curva baja hasta −200 antes de subir de
 * nuevo, y el gráfico dibuja un mes en rojo que en los datos no existe. En un
 * gráfico de plata eso no es un defecto estético.
 *
 * Las pendientes se calculan **en píxeles**, sobre los puntos ya proyectados: la
 * proyección es lineal en los dos ejes, así que la monotonía se conserva y no
 * hay que arrastrar dos sistemas de unidades.
 *
 * ── Lo que esto cuesta, dicho de frente ───────────────────────────────────
 *
 * El área que queda bajo la curva **no es proporcional a los saldos**, y no hay
 * curva que pase por los puntos que lo consiga (ADR-051). El usuario lo eligió
 * así el 2026-09-08, sabiendo el precio: la primera versión sí conservaba el
 * área y se veía como escalones. El área pintada dice **de un vistazo si el mes
 * cerró para arriba o para abajo, y más o menos cuánto**; para el número exacto
 * está la tabla, que es donde se leen los números.
 */
export function caminoDeCurva(valores, x, y) {
  if (valores.length === 0) return '';
  const puntos = valores.map((v, i) => [x(i), y(v)]);
  if (puntos.length === 1) return `M ${puntos[0][0]},${puntos[0][1]}`;

  // Pendiente de cada tramo, y la de cada punto (Fritsch–Carlson): en un pico o
  // un valle la pendiente es cero —por eso la curva no se pasa—, y en el resto
  // es la media armónica de sus dos vecinas, que es la que respeta al vecino más
  // chico en vez de promediarlo.
  const anchos = [], pendientes = [];
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const h = puntos[i + 1][0] - puntos[i][0];
    anchos.push(h);
    pendientes.push(h === 0 ? 0 : (puntos[i + 1][1] - puntos[i][1]) / h);
  }

  const m = new Array(puntos.length);
  m[0] = pendientes[0];
  m[puntos.length - 1] = pendientes.at(-1);
  for (let i = 1; i < puntos.length - 1; i += 1) {
    if (pendientes[i - 1] * pendientes[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * anchos[i] + anchos[i - 1];
      const w2 = anchos[i] + 2 * anchos[i - 1];
      m[i] = (w1 + w2) / (w1 / pendientes[i - 1] + w2 / pendientes[i]);
    }
  }

  const partes = [`M ${cortoEnSerie(puntos[0][0])},${cortoEnSerie(puntos[0][1])}`];
  for (let i = 0; i < puntos.length - 1; i += 1) {
    // Hermite → Bézier: los dos controles caen a un tercio del tramo, sobre la
    // recta tangente de cada punta.
    const h = anchos[i] / 3;
    const c1x = puntos[i][0] + h;
    const c1y = puntos[i][1] + m[i] * h;
    const c2x = puntos[i + 1][0] - h;
    const c2y = puntos[i + 1][1] - m[i + 1] * h;
    partes.push(`C ${cortoEnSerie(c1x)},${cortoEnSerie(c1y)} ${cortoEnSerie(c2x)},${cortoEnSerie(c2y)} `
      + `${cortoEnSerie(puntos[i + 1][0])},${cortoEnSerie(puntos[i + 1][1])}`);
  }
  return partes.join(' ');
}

/**
 * Acomoda una ventana para que siempre sea válida: dentro de la serie, con al
 * menos dos puntos, y sin dar vuelta las puntas.
 *
 * Todo lo que mueve la ventana pasa por acá. Repartir esta comprobación entre
 * el zoom, el desplazamiento y el dibujo serían tres reglas que se separan, y la
 * primera que se olvida deja un gráfico vacío sin explicación.
 */
export function acomodarVentana(ventana, cuantos) {
  if (cuantos < MINIMO_VISIBLE) return { desde: 0, hasta: Math.max(0, cuantos - 1) };

  let desde = Math.round(ventana?.desde ?? 0);
  let hasta = Math.round(ventana?.hasta ?? cuantos - 1);
  if (!Number.isFinite(desde)) desde = 0;
  if (!Number.isFinite(hasta)) hasta = cuantos - 1;
  if (hasta < desde) [desde, hasta] = [hasta, desde];

  // Primero el ancho mínimo, después el encaje: al revés, una ventana de un
  // punto pegada al final se estiraría hacia afuera de la serie.
  if (hasta - desde + 1 < MINIMO_VISIBLE) hasta = desde + MINIMO_VISIBLE - 1;
  if (hasta > cuantos - 1) {
    hasta = cuantos - 1;
    desde = Math.min(desde, hasta - MINIMO_VISIBLE + 1);
  }
  if (desde < 0) {
    desde = 0;
    hasta = Math.max(hasta, MINIMO_VISIBLE - 1);
  }
  return { desde, hasta };
}

/**
 * Acerca o aleja alrededor de un punto de anclaje, en índices.
 *
 * **Acercar tiene que angostar la ventana al menos un punto**, o el botón deja
 * de hacer nada antes de llegar al mínimo y no hay forma de saber por qué: con
 * tres puntos, el 60 % de uno y medio vuelve a redondear a uno y medio, y el
 * gráfico se queda ahí para siempre. Lo encontró un test que esperaba llegar al
 * mínimo de dos.
 */
export function acercar(ventana, cuantos, factor, ancla) {
  const { desde, hasta } = acomodarVentana(ventana, cuantos);
  const ancho = hasta - desde;
  const centro = ancla ?? (desde + hasta) / 2;

  let nuevoAncho = ancho * factor;
  if (factor < 1) nuevoAncho = Math.min(nuevoAncho, ancho - 1);
  if (factor > 1) nuevoAncho = Math.max(nuevoAncho, ancho + 1);

  const mitad = nuevoAncho / 2;
  return acomodarVentana({ desde: centro - mitad, hasta: centro + mitad }, cuantos);
}

/** Corre la ventana sin cambiar su ancho. Choca contra las puntas y se queda. */
export function correr(ventana, cuantos, pasos) {
  const { desde, hasta } = acomodarVentana(ventana, cuantos);
  const ancho = hasta - desde;
  let nuevoDesde = Math.round(desde + pasos);
  nuevoDesde = Math.max(0, Math.min(nuevoDesde, cuantos - 1 - ancho));
  return { desde: nuevoDesde, hasta: nuevoDesde + ancho };
}

/**
 * Qué índices llevan etiqueta escrita en el eje.
 *
 * **Siempre la primera y la última**, para que se sepa entre qué momentos se
 * está mirando, y hasta tres en el medio, repartidas parejo. Con menos puntos
 * que eso, van todas.
 *
 * Es lo que pidió el usuario —"más coordenadas en el eje de las x"— resuelto sin
 * amontonarlas: once fechas en 300 px se pisan y no se lee ninguna.
 */
export function indicesConEtiqueta(desde, hasta, maximo = MAXIMO_ETIQUETAS) {
  const cuantos = hasta - desde + 1;
  if (cuantos <= maximo) {
    return Array.from({ length: cuantos }, (_, i) => desde + i);
  }

  // Repartir `maximo` etiquetas parejo no alcanza: al redondear a índices
  // enteros, dos pueden caer en puntos vecinos. Con seis meses eso las deja a
  // 50 px una de otra y "abr 26" mide cuarenta — se pisan y no se lee ninguna.
  //
  // Así que primero se calcula **cada cuántos puntos** hay lugar para una
  // etiqueta, y recién después cuántas entran. Menos etiquetas legibles es mejor
  // que cinco encimadas.
  const anchoDeTramo = ANCHO / cuantos;
  const cadaCuantos = Math.max(1, Math.ceil(SEPARACION_MINIMA / anchoDeTramo));
  const cuantas = Math.min(maximo, Math.floor((cuantos - 1) / cadaCuantos) + 1);
  if (cuantas <= 1) return [desde, hasta];

  const paso = (cuantos - 1) / (cuantas - 1);
  return [...new Set(Array.from({ length: cuantas }, (_, i) => desde + Math.round(i * paso)))];
}


/**
 * El interior del gráfico para una ventana: ejes, marcas, líneas y la guía del
 * punto elegido.
 *
 * La escala vertical **se calcula sobre lo que se ve, no sobre todo**. Es lo que
 * hace que el zoom sirva de algo: acercarse a tres meses de un año y seguir
 * viendo la escala del año dejaría las tres líneas pegadas y planas.
 */
export function interiorDeSerie(serie, ventana = {}, seleccion = null) {
  const { puntos, series } = serie;
  const { desde, hasta } = acomodarVentana(ventana, puntos.length);
  const visibles = puntos.slice(desde, hasta + 1);
  if (visibles.length < MINIMO_VISIBLE) return '';

  const valores = visibles.flatMap((p) => p.valores);
  const techo = Math.max(...valores, 0);
  const piso = Math.min(...valores, 0);
  const alto = techo === piso ? 1 : techo - piso;

  const x = (i) => cortoEnSerie(((i - desde) / (hasta - desde)) * ANCHO);
  const centro = (i) => x(i);
  const y = (valor) => cortoEnSerie(ALTO - ((valor - piso) / alto) * ALTO);

  // Curva o polilínea. La curva es para los pocos puntos del mes a mes; el
  // acumulado día por día trae trescientos sesenta y cinco, donde cada tramo mide
  // menos de un píxel y suavizar no cambia nada de lo que se ve.
  const esCurva = serie.forma === 'curva';
  const enPixeles = (i) => x(desde + i);

  const lineas = series.map((s, n) => {
    const suyos = visibles.map((p) => p.valores[n]);
    if (esCurva) {
      return `<path class="traza ${escapar(s.clase)}" fill="none"
                    d="${caminoDeCurva(suyos, enPixeles, y)}" />`;
    }
    const trazo = suyos.map((v, i) => `${centro(desde + i)},${y(v)}`).join(' ');
    return `<polyline class="traza ${escapar(s.clase)}" points="${trazo}" />`;
  }).join('');

  // El área entre la línea elegida y el cero, verde arriba y roja abajo — T-057.
  // Es UN solo camino relleno, recortado dos veces: la mitad de arriba del cero
  // se pinta de un color y la de abajo del otro. Dibujar dos caminos distintos
  // obligaría a calcular dónde cruza la curva el cero, que en una Bézier es
  // resolver una cúbica — y una raíz mal calculada deja una banda de color del
  // lado equivocado, que es justo lo que este gráfico no puede hacer.
  const nRelleno = serie.rellenar === undefined ? -1 : series.findIndex((s) => s.clase === serie.rellenar);
  const relleno = !esCurva || nRelleno < 0 ? '' : (() => {
    const camino = caminoDeCurva(visibles.map((p) => p.valores[nRelleno]), enPixeles, y);
    const cero = y(0);
    const cerrado = `${camino} L ${ANCHO},${cero} L 0,${cero} Z`;
    const id = escapar(serie.id);
    return `
      <defs>
        <clipPath id="sobre-cero-${id}"><rect x="0" y="0" width="${ANCHO}" height="${Math.max(cero, 0)}" /></clipPath>
        <clipPath id="bajo-cero-${id}"><rect x="0" y="${cero}" width="${ANCHO}" height="${Math.max(ALTO - cero, 0)}" /></clipPath>
      </defs>
      <path class="area ingreso" d="${cerrado}" clip-path="url(#sobre-cero-${id})" />
      <path class="area gasto" d="${cerrado}" clip-path="url(#bajo-cero-${id})" />`;
  })();

  // Una marca por punto visible mientras entren; si no, solo las etiquetadas.
  const conEtiqueta = indicesConEtiqueta(desde, hasta);
  const marcas = (hasta - desde + 1 <= 32 ? visibles.map((_, i) => desde + i) : conEtiqueta)
    .map((i) => `<line class="marca" x1="${centro(i)}" y1="${ALTO}" x2="${centro(i)}" y2="${ALTO + 4}" />`)
    .join('');

  const etiquetas = conEtiqueta.map((i, n) => {
    // La primera pegada a la izquierda y la última a la derecha: centradas se
    // salen del dibujo por la mitad de su ancho.
    const donde = n === 0 ? 'inicio' : n === conEtiqueta.length - 1 ? 'fin' : 'medio';
    return `<text class="marca-eje ${donde}" x="${centro(i)}" y="${ALTO + 16}">${escapar(puntos[i].etiqueta)}</text>`;
  }).join('');

  // Las marcas de importe: una línea fina que cruza el dibujo y su número a la
  // izquierda. La del cero se dibuja distinta —cruzarla significa algo— y por
  // eso no se repite como una raya más.
  const paso = pasoDeImporte(piso, techo);
  const marcasDeY = marcasDeImporte(piso, techo).map((valor) => `
    <line class="${valor === 0 && piso < 0 ? 'cero' : 'guia-importe'}"
          x1="0" y1="${y(valor)}" x2="${ANCHO}" y2="${y(valor)}" />
    <text class="marca-eje importe" x="-6" y="${y(valor) + 4}">${escapar(etiquetaDeImporte(valor, paso))}</text>`)
    .join('');

  // La guía del punto elegido: una línea vertical y un punto por serie. El
  // número no va acá sino en el texto de abajo — en un teléfono, un cartel
  // flotante queda debajo del dedo que lo pidió.
  const elegido = seleccion === null || seleccion < desde || seleccion > hasta ? '' : `
    <line class="guia" x1="${centro(seleccion)}" y1="0" x2="${centro(seleccion)}" y2="${ALTO}" />
    ${series.map((s, n) => `<circle class="punto ${escapar(s.clase)}" cx="${centro(seleccion)}"
        cy="${y(puntos[seleccion].valores[n])}" r="4" />`).join('')}`;

  return `
    ${relleno}
    ${marcasDeY}
    <line class="eje" x1="0" y1="${ALTO}" x2="${ANCHO}" y2="${ALTO}" />
    ${marcas}
    ${lineas}
    ${elegido}
    ${etiquetas}
  `;
}

/**
 * Lo que se lee abajo del gráfico cuando se toca un punto: **cuándo es y cuánto
 * valía cada línea ahí**. Es el pedido central del usuario.
 *
 * Sin punto elegido no queda en blanco: dice qué hacer. Un espacio vacío debajo
 * de un gráfico se lee como que algo no cargó.
 */
export function dibujarLectura(serie, seleccion, base) {
  if (seleccion === null || seleccion === undefined || !serie.puntos[seleccion]) {
    return '<span class="suave">Tocá el gráfico para ver los valores de ese momento.</span>';
  }

  const punto = serie.puntos[seleccion];
  const valores = serie.series.map((s, n) => `
    <span class="valor-serie">
      <span class="marca-serie ${escapar(s.clase)}" aria-hidden="true"></span>
      ${escapar(s.nombre)}: <strong>${escapar(formatearEuros(punto.valores[n], base))}</strong>
    </span>`).join('');

  return `<strong class="cuando">${escapar(punto.cuando ?? punto.etiqueta)}</strong>${valores}`;
}

/**
 * El gráfico entero: título, controles, dibujo y lectura.
 *
 * Los controles son **botones y no solo gestos**. El pellizco para acercar está
 * (lo agrega `series-interaccion.js`), pero un gesto que el teléfono del usuario
 * no interprete deja el gráfico sin salida, y este proyecto ya pagó esa lección
 * con el `<datalist>` que su Android no dibujaba (L-021). Los botones siempre
 * están y se pueden probar.
 */
export function dibujarSerie(serie) {
  if (serie.puntos.length < MINIMO_VISIBLE) return '';
  const valores = serie.puntos.flatMap((p) => p.valores);
  if (Math.max(...valores) === Math.min(...valores)) return '';

  const ventana = { desde: 0, hasta: serie.puntos.length - 1 };
  const leyenda = serie.series.map((s) => `
    <span class="valor-serie">
      <span class="marca-serie ${escapar(s.clase)}" aria-hidden="true"></span>${escapar(s.nombre)}
    </span>`).join('');

  return `
    <section class="tarjeta grafico" data-serie="${escapar(serie.id)}"
             data-puntos="${escapar(JSON.stringify(serie))}">
      <h2>${escapar(serie.titulo)}</h2>
      <p class="suave nota">${serie.nota}</p>
      <p class="leyenda">${leyenda}</p>

      <!-- El viewBox abre 52 px a la izquierda: es donde van los importes del
           eje. Sin ese margen se dibujan igual, fuera del recorte, y no se ven. -->
      <svg class="linea-acumulado" viewBox="-52 -10 ${ANCHO + 72} ${ALTO + 36}" role="img"
           aria-label="${escapar(serie.titulo)}, de ${escapar(serie.puntos[0].etiqueta)} a ${escapar(serie.puntos.at(-1).etiqueta)}"
           data-dibujo>${interiorDeSerie(serie, ventana)}</svg>

      <p class="lectura" data-lectura role="status">${dibujarLectura(serie, null, serie.base)}</p>

      <div class="controles-grafico">
        <button type="button" class="secundario chico" data-accion="grafico-alejar"
                aria-label="Alejar">−</button>
        <button type="button" class="secundario chico" data-accion="grafico-acercar"
                aria-label="Acercar">+</button>
        <button type="button" class="secundario chico" data-accion="grafico-todo">Ver todo</button>
      </div>
      <p class="suave nota">También se puede pellizcar para acercar y arrastrar para
      moverse.</p>
    </section>
  `;
}
