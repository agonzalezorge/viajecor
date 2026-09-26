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
// Con un orden fijo, los vecinos son siempre los mismos y se pueden comprobar.
//
// **Cuál es ese orden fijo: el de la lista de rubros del usuario** (T-068, a
// pedido suyo). Era el de la paleta, que venía siendo lo mismo porque el color
// salía de la posición. Dejó de serlo cuando los rubros se pudieron reordenar
// (T-067): ahí los colores se congelan y la torta quedaba en un orden que ya no
// se correspondía con ninguna lista visible.
//
// Lo que la regla de arriba pide sigue cumpliéndose: el orden **no depende de
// los montos**, así que cargar un gasto no reordena nada. Solo cambia cuando el
// usuario mueve un rubro en Ajustes, que es cuando él decide que cambie.

import { escapar } from '../app.js';
import { formatearEuros, formatearFecha, formatearFechaLarga, formatearMes,
  formatearMesCorto, formatearRubro } from '../../core/formato.js';
import { dibujarSerie } from './series.js';
import { franjaDeRubro } from '../colores.js';
import { rubrosDe, normalizarClave } from '../../core/modelo.js';

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
export function dibujarTorta(filas, tipo, base, catalogo) {
  if (filas.length < 2) return '';

  const total = filas.reduce((suma, fila) => suma + fila.total, 0);
  if (total <= 0) return '';

  // El orden de dibujo es el de la lista de rubros, no el de los montos. Ver
  // arriba. Un rubro que no esté en la lista —un dato viejo, un huérfano— va al
  // final en vez de romper el dibujo.
  const lista = rubrosDe(tipo, catalogo);
  const lugar = (rubro) => {
    // `String()` hace falta: `normalizarClave` TIRA si no le llega texto, y una
    // excepción acá mata el repintado de toda la pantalla (L-033). El `?? ''`
    // que venía al lado, en cambio, no: 'null' tampoco está en la lista, así
    // que cae al final igual. Lo sacó una mutación que sobrevivió.
    const posicion = lista.indexOf(normalizarClave(String(rubro)));
    return posicion === -1 ? lista.length : posicion;
  };
  const enOrden = [...filas].sort((a, b) => lugar(a.rubro) - lugar(b.rubro));

  let desde = 0;
  const porciones = enOrden.map((fila) => {
    // El ángulo sale del importe, NO del porcentaje redondeado: ocho números
    // redondeados no suman 360 y la última porción queda con un hueco o pisada.
    const angulo = (fila.total / total) * 360;
    const hasta = desde + angulo;
    const [x1, y1] = punto(desde, RADIO);
    const [x2, y2] = punto(hasta, RADIO);
    const grande = angulo > 180 ? 1 : 0;
    const franja = franjaDeRubro(tipo, fila.rubro, catalogo);
    const porcentaje = (fila.total / total) * 100;
    const [rx, ry] = punto(desde + angulo / 2, RADIO * 0.62);
    desde = hasta;

    const rotulo = porcentaje >= MINIMO_PARA_ROTULO
      // El rótulo lleva la franja de su porción para que el CSS pueda elegir la
      // tinta: sobre los tonos oscuros de la paleta el negro no se lee (T-049).
      ? `<text class="rotulo-porcion rubro-${franja}" x="${rx}" y="${ry}">${Math.round(porcentaje)} %</text>`
      : '';

    return `
      <g>
        <path class="porcion rubro-${franja}"
              d="M 0 0 L ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${grande} 1 ${x2} ${y2} Z">
          <title>${escapar(formatearRubro(fila.rubro))}: ${escapar(formatearEuros(fila.total, base))} (${Math.round(porcentaje)} %)</title>
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
 * El acumulado del mes, recorrible — T-075, a pedido del usuario.
 *
 * ── Por qué es el mismo componente que el gráfico de la evolución ───────────
 *
 * Lo pidió así: *"que al hacer clic en un determinado punto de la línea te
 * aparezca abajo la etiqueta con los valores de ingresos y gastos a esa altura
 * del mes, como funciona actualmente… en el comparativo de todos los meses"*.
 *
 * Eso ya existía, entero, en `dibujarSerie()`: la lectura de abajo, el toque, el
 * zoom y el pellizco. Dibujar acá una segunda versión de lo mismo habría sido
 * tener dos gráficos con dos mecánicas —y el día que una aprenda algo, la otra
 * no—. Así que este gráfico **pasó a ser una serie más** y lo que había, una
 * línea que solo se miraba, se borró.
 *
 * Lo único suyo es qué son los puntos: acá son **días de un mes** y no meses de
 * un historial. En el mes en curso llega hasta hoy y no hasta fin de mes (ver
 * `diasHasta()`): una línea plana en un acumulado se lee como "dejó de gastar",
 * y esos días todavía no pasaron.
 */
export function dibujarAcumulado(dias, opciones = {}) {
  const visibles = diasHasta(dias, opciones.hasta);

  return dibujarSerie({
    id: 'acumulado-del-mes',
    titulo: 'Cómo se fue acumulando',
    nota: `Día por día. Lo que se busca acá no es la altura —el total ya está
      arriba— sino <strong>cuándo una línea cruza a la otra</strong>.`,
    base: opciones.base,
    series: [
      { clase: 'ingreso', nombre: 'Ingresos' },
      { clase: 'gasto', nombre: 'Gastos' },
    ],
    puntos: visibles.map((d) => ({
      // En el eje va el número del día, que es lo único que entra; al tocar el
      // punto se lee la fecha completa, igual que en el acumulado histórico.
      etiqueta: String(d.dia),
      cuando: formatearFechaLarga(d.fecha),
      valores: [d.ingresoAcumulado, d.gastoAcumulado],
    })),
  });
}

/**
 * El acumulado de TODO el historial — T-940, ahora recorrible (T-942).
 *
 * Contesta lo que ninguna otra pantalla contesta: **si la distancia entre lo que
 * entra y lo que sale se está abriendo o cerrando**. Con el zoom se puede además
 * mirar un tramo corto, que era imposible con trescientos días en 300 píxeles.
 */
export function dibujarAcumuladoHistorico(dias, base) {
  return dibujarSerie({
    id: 'acumulado-historico',
    // Sin esto, la lectura de abajo dice "€" aunque la base sea el peso: es
    // L-035 por tercera vez, y la encontró T-075 al mirar este mismo mecanismo.
    base,
    titulo: 'Todo lo que llevás gastado y cobrado',
    nota: `Día por día desde el primer movimiento. Lo que importa acá no es la
      altura sino <strong>si las dos líneas se separan o se juntan</strong>.`,
    series: [
      { clase: 'ingreso', nombre: 'Ingresos' },
      { clase: 'gasto', nombre: 'Gastos' },
    ],
    puntos: dias.map((d) => ({
      etiqueta: formatearMesCorto(d.mes),
      // Lo que se lee al tocar un punto lleva el día completo: la etiqueta del
      // eje dice el mes porque no entra más, pero el punto es de un día.
      cuando: formatearFechaLarga(d.fecha),
      valores: [d.ingresoAcumulado, d.gastoAcumulado],
    })),
  });
}

/**
 * Ingresos, gastos y saldo mes a mes — T-940, ahora recorrible (T-942).
 *
 * **Tres series en un solo eje.** Son la misma unidad, así que comparten
 * escala: dos escalas en un mismo dibujo es la forma más común de mentir con un
 * gráfico. El saldo va punteado y en color de texto porque es un resultado de
 * los otros dos, no una cosa más, y cuando alguno es negativo se dibuja la línea
 * del cero: sin ella, −200 y +200 se ven como dos puntos cualesquiera.
 */
export function dibujarMesAMes(filas, base) {
  return dibujarSerie({
    id: 'mes-a-mes',
    base,
    titulo: 'Mes a mes',
    nota: `Lo que entró, lo que salió y lo que quedó, mes por mes. Bajo el saldo
    se pinta <strong>verde lo que sobró y rojo lo que faltó</strong>.`,
    // Curva monótona, no líneas rectas ni escalones (T-057). El relleno va bajo
    // el saldo.
    forma: 'curva',
    rellenar: 'saldo',
    series: [
      { clase: 'ingreso', nombre: 'Ingresos' },
      { clase: 'gasto', nombre: 'Gastos' },
      { clase: 'saldo', nombre: 'Saldo' },
    ],
    puntos: filas.map((f) => ({
      etiqueta: formatearMesCorto(f.mes),
      cuando: formatearMes(f.mes),
      valores: [f.ingresos, f.gastos, f.saldo],
    })),
  });
}

