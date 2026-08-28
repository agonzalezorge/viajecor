// Los dos gráficos del mes — T-918, pedidos por el usuario a partir de los que
// tiene en su planilla: una torta del reparto por rubro y una línea del gasto
// acumulado día a día.
//
// Se dibujan en SVG escrito a mano. No es purismo: una biblioteca de gráficos
// se trae de un CDN, y eso está prohibido (RN-06). Todo lo que hace falta acá
// —un sector de círculo y una polilínea— son dos fórmulas de trigonometría.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras que devuelven
// texto HTML. No tocan el documento.
//
// ── Por qué torta, sabiendo que se compara peor ──────────────────────────────
//
// El usuario la eligió por sobre las barras (2026-08-27). El costo es real: el
// ojo compara ángulos peor que longitudes, y dos porciones de 23 % y 20 % se
// distinguen mucho menos que dos barras de esos largos. Lo que se gana es el
// reparto del todo de un vistazo, que es lo que él mira, y la forma que ya
// reconoce de su planilla.
//
// **Por eso la lista de rubros de al lado no se saca**: ahí están el nombre, el
// importe y el porcentaje, que es donde se compara con precisión. La torta da la
// forma; la lista da los números. Sin la lista, el cambio sería una pérdida.
//
// ── El orden de las porciones es FIJO, no por tamaño ─────────────────────────
//
// Con ocho colores ninguna paleta pasa el validador comparando todos contra
// todos (se midió, ADR-029). Sí pasan los pares que quedan pegados, si son
// siempre los mismos. Dibujar de mayor a menor haría que cargar un gasto
// cambiara qué color toca a qué color, y un par que hoy se distingue mañana no.
// Con el orden fijo de la paleta, los vecinos son siempre los mismos y se
// pueden comprobar.

import { escapar } from '../app.js';
import { formatearEuros, formatearRubro } from '../../core/formato.js';
import { franjaDeRubro } from '../colores.js';

/** El radio de la torta y el medio del lienzo, en unidades del `viewBox`. */
const RADIO = 100;

/** Debajo de este porcentaje la porción no lleva su número escrito adentro. */
const MINIMO_PARA_ROTULO = 8;

/** Redondeo a dos decimales: alcanza para dibujar y hace el SVG comparable. */
function corto(numero) {
  return Math.round(numero * 100) / 100;
}

/**
 * Un punto del borde del círculo.
 *
 * Se resta 90° para que el 0 quede arriba: una torta que arranca a las 3 en
 * punto se lee mal porque nadie la lee así.
 */
function punto(grados, radio) {
  const radianes = ((grados - 90) * Math.PI) / 180;
  return [corto(radio * Math.cos(radianes)), corto(radio * Math.sin(radianes))];
}

/**
 * La torta de un tipo.
 *
 * Devuelve `''` si no hay nada que repartir: una torta de un solo color es un
 * círculo, y un círculo no dice nada que el importe no diga mejor.
 */
export function dibujarTorta(filas, tipo) {
  if (filas.length < 2) return '';

  const total = filas.reduce((suma, fila) => suma + fila.total, 0);
  if (total <= 0) return '';

  // El orden de dibujo es el de la paleta, no el de la lista. Ver arriba.
  const enOrden = [...filas].sort(
    (a, b) => franjaDeRubro(tipo, a.rubro) - franjaDeRubro(tipo, b.rubro),
  );

  let desde = 0;
  const porciones = enOrden.map((fila) => {
    // El ángulo sale del importe, NO del porcentaje redondeado: ocho números
    // redondeados no suman 360 y la última porción queda con un hueco o pisada.
    const angulo = (fila.total / total) * 360;
    const hasta = desde + angulo;
    const [x1, y1] = punto(desde, RADIO);
    const [x2, y2] = punto(hasta, RADIO);
    const grande = angulo > 180 ? 1 : 0;
    const franja = franjaDeRubro(tipo, fila.rubro);
    const porcentaje = (fila.total / total) * 100;
    const [rx, ry] = punto(desde + angulo / 2, RADIO * 0.62);
    desde = hasta;

    const rotulo = porcentaje >= MINIMO_PARA_ROTULO
      ? `<text class="rotulo-porcion" x="${rx}" y="${ry}">${Math.round(porcentaje)} %</text>`
      : '';

    return `
      <g>
        <path class="porcion rubro-${franja}"
              d="M 0 0 L ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${grande} 1 ${x2} ${y2} Z">
          <title>${escapar(formatearRubro(fila.rubro))}: ${escapar(formatearEuros(fila.total))} (${Math.round(porcentaje)} %)</title>
        </path>
        ${rotulo}
      </g>`;
  }).join('');

  // `role="img"` con su texto: quien no ve el dibujo escucha el reparto, y el
  // que sí lo ve tiene la lista de abajo. El color nunca es la única vía.
  const resumen = enOrden
    .map((f) => `${formatearRubro(f.rubro)} ${Math.round((f.total / total) * 100)} %`)
    .join(', ');

  return `
    <svg class="torta" viewBox="-110 -110 220 220" role="img"
         aria-label="Reparto por rubro: ${escapar(resumen)}">
      ${porciones}
    </svg>
  `;
}

/**
 * Hasta qué día tiene sentido dibujar el mes.
 *
 * En el mes en curso, seguir la línea hasta el día 31 la deja plana desde hoy
 * hasta fin de mes, y una línea plana en un acumulado se lee como "dejó de
 * gastar". Es mentira: esos días no pasaron todavía.
 */
export function diasHasta(dias, hasta) {
  if (hasta === undefined) return dias;
  return dias.filter((d) => d.dia <= hasta);
}

/**
 * La línea del acumulado del mes.
 *
 * Van las dos —gasto e ingreso— porque el dato que se busca acá no es cuánto se
 * gastó, que ya está arriba en número grande, sino **cuándo una cruza a la
 * otra**. Son la misma unidad, así que comparten un solo eje: dos escalas en un
 * mismo dibujo es la forma más común de mentir con un gráfico.
 */
export function dibujarLinea(dias, opciones = {}) {
  const visibles = diasHasta(dias, opciones.hasta);
  if (visibles.length < 2) return '';

  const techo = Math.max(
    ...visibles.map((d) => Math.max(d.gastoAcumulado, d.ingresoAcumulado)),
  );
  if (techo <= 0) return '';

  const ANCHO = 300;
  const ALTO = 140;
  const ultimo = visibles[visibles.length - 1];

  const x = (dia) => corto(((dia - 1) / Math.max(1, ultimo.dia - 1)) * ANCHO);
  const y = (valor) => corto(ALTO - (valor / techo) * ALTO);

  const linea = (campo) => visibles.map((d) => `${x(d.dia)},${y(d[campo])}`).join(' ');

  return `
    <svg class="linea-acumulado" viewBox="-4 -18 ${ANCHO + 60} ${ALTO + 40}" role="img"
         aria-label="Acumulado del mes hasta el día ${ultimo.dia}: gastos ${escapar(formatearEuros(ultimo.gastoAcumulado))}, ingresos ${escapar(formatearEuros(ultimo.ingresoAcumulado))}">
      <line class="eje" x1="0" y1="${ALTO}" x2="${ANCHO}" y2="${ALTO}" />
      <text class="marca-eje" x="0" y="-6">${escapar(formatearEuros(techo))}</text>
      <polyline class="traza ingreso" points="${linea('ingresoAcumulado')}" />
      <polyline class="traza gasto" points="${linea('gastoAcumulado')}" />
      <text class="rotulo-traza ingreso" x="${x(ultimo.dia) + 6}" y="${y(ultimo.ingresoAcumulado) + 4}">Ingresos</text>
      <text class="rotulo-traza gasto" x="${x(ultimo.dia) + 6}" y="${y(ultimo.gastoAcumulado) + 4}">Gastos</text>
      <text class="marca-eje" x="0" y="${ALTO + 16}">Día 1</text>
      <text class="marca-eje fin" x="${ANCHO}" y="${ALTO + 16}">Día ${ultimo.dia}</text>
    </svg>
  `;
}

/** La tarjeta entera de la línea, con su título. */
export function dibujarAcumulado(dias, opciones = {}) {
  const dibujo = dibujarLinea(dias, opciones);
  if (dibujo === '') return '';

  return `
    <section class="tarjeta">
      <h2>Cómo se fue acumulando</h2>
      ${dibujo}
    </section>
  `;
}
