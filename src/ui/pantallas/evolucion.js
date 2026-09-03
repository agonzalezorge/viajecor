// La evolución mes a mes — CU-10, T-021. Reemplaza la hoja `Analisis1` del
// Excel: una fila por mes, una columna por rubro, y abajo el total y el
// promedio.
//
// Es la pantalla que solo tiene sentido con historial adentro. Con tres gastos
// de prueba no dice nada; con los once meses que se importaron en la etapa 3 es
// la razón por la que la app existe.
//
// ── Por qué una tabla y no un gráfico ────────────────────────────────────────
//
// Acá la pregunta no es "cómo se reparte" —eso lo contesta la torta del mes—
// sino "cuánto gasté en supermercado en enero, y en febrero". Eso es leer un
// valor exacto en el cruce de dos cosas, y para eso la tabla es la forma. Un
// gráfico de once meses por ocho rubros en la pantalla de un teléfono son 88
// marcas de dos milímetros.
//
// ── Lo que se cuidó, porque una tabla ancha en un celular se rompe fácil ─────
//
//   1. La tabla se desliza a lo ancho **dentro de su propia caja**; la página no.
//   2. La columna del mes **queda fija** al deslizar: una fila de once números
//      sin su etiqueta a la vista no se puede leer.
//   3. Los importes van con cifras de ancho fijo y alineados a la derecha, que
//      es lo que permite comparar una columna sin leer cada número.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras que
// devuelven texto HTML.

import { escapar } from '../app.js';
import { matrizMesRubro, acumuladoHistorico } from '../../core/calculos.js';
import { DECIMALES_EURO } from '../../core/dinero.js';
import { monedaBaseDe } from '../../core/monedas.js';
import { formatearMesCorto, formatearNumero, formatearRubro } from '../../core/formato.js';
import { claseDeRubro } from '../colores.js';
import { dibujarGastosFijos } from './fijos.js';
import { dibujarAcumuladoHistorico, dibujarMesAMes } from './graficos.js';
import { TIPO_GASTO, TIPO_INGRESO, hoy, mesDe } from '../../core/modelo.js';

/**
 * Un importe de celda.
 *
 * **Sin el símbolo del euro**, y no por prolijidad: son noventa y nueve celdas
 * en la pantalla de un teléfono, y el símbolo repetido noventa y nueve veces se
 * come una columna entera de rubro. Toda la tabla está en euros y lo dice el pie
 * una vez. El cero se dibuja apagado: está —es una matriz, no puede faltar— pero
 * no compite con los números que sí dicen algo.
 */
function celdaDeImporte(importe, extra = '', toque = null) {
  const clase = importe === 0 ? 'importe vacio' : 'importe';
  const numero = escapar(formatearNumero(importe, DECIMALES_EURO));

  // Una celda con plata adentro lleva a los movimientos que la componen (T-026).
  // La de cero no: no hay nada que mostrar, y un botón que abre una lista vacía
  // es peor que una celda quieta.
  const contenido = toque === null || importe === 0
    ? numero
    : `<button type="button" class="celda-toque" data-accion="ver-celda"
               data-mes="${escapar(toque.mes)}" data-tipo="${escapar(toque.tipo ?? TIPO_GASTO)}"
               data-rubro="${escapar(toque.rubro)}">${numero}</button>`;

  return `<td class="${clase}${extra}">${contenido}</td>`;
}

/**
 * El encabezado de la tabla, en **dos niveles**: arriba de qué es cada bloque,
 * abajo la columna.
 *
 * El nivel de arriba no es decoración: `otros` está en los rubros de gasto y
 * también en los de ingreso, y son cosas distintas (RN-02). Dos columnas
 * llamadas "Otros" en la misma tabla, sin nada que las separe, son un número
 * que se lee en la columna equivocada. La banda dice cuál es cuál, y además la
 * paleta les da el mismo gris a los dos —viene de la planilla del usuario—, así
 * que el color no alcanzaba para distinguirlas.
 *
 * El punto de color es lo que ata esta pantalla al resumen del mes: la columna
 * que acá dice "Supermercado" es la porción ámbar de allá.
 */
export function dibujarEncabezadoMatriz(rubros, rubrosIngreso = []) {
  const columna = (tipo, rubro) => `
    <th scope="col">
      <span class="punto-rubro ${claseDeRubro(tipo, rubro)}" aria-hidden="true"></span>
      ${escapar(formatearRubro(rubro))}
    </th>`;

  const deGasto = rubros.map((rubro) => columna(TIPO_GASTO, rubro)).join('');
  // El primer rubro de ingreso abre el bloque, así que lleva la línea que lo
  // separa de los gastos. Sin esa línea, "Otros" de gasto y "Otros" de ingreso
  // quedan pegados y son dos columnas grises con el mismo nombre.
  const deIngreso = rubrosIngreso
    .map((rubro, i) => columna(TIPO_INGRESO, rubro).replace('<th scope="col">',
      i === 0 ? '<th scope="col" class="separada">' : '<th scope="col">'))
    .join('');

  return `
    <tr class="bandas">
      <td class="columna-mes"></td>
      <th scope="colgroup" colspan="${rubros.length}" class="banda">Rubros de gasto</th>
      <td class="separada"></td>
      <th scope="colgroup" colspan="${rubrosIngreso.length}" class="banda separada">Rubros de ingreso</th>
      <td class="separada"></td>
      <td class="separada"></td>
    </tr>
    <tr>
      <th scope="col" class="columna-mes">Mes</th>
      ${deGasto}
      <th scope="col" class="separada">Gastos</th>
      ${deIngreso}
      <th scope="col" class="separada">Ingresos</th>
      <th scope="col" class="separada">Saldo</th>
    </tr>
  `;
}

/** Una fila de mes. */
export function dibujarFilaMes(fila, rubros = [], rubrosIngreso = []) {
  const marca = fila.incompleto
    ? ' <abbr title="A este mes le falta un tipo de cambio: el total está incompleto">·</abbr>'
    : '';

  return `
    <tr>
      <th scope="row" class="columna-mes">
        <!-- El mes lleva a todos los movimientos de ese mes. -->
        <button type="button" class="celda-toque" data-accion="ver-mes"
                data-mes="${escapar(fila.mes)}">${escapar(formatearMesCorto(fila.mes))}</button>${marca}
      </th>
      ${fila.rubros.map((importe, i) => celdaDeImporte(importe, '',
        rubros[i] === undefined ? null : { mes: fila.mes, tipo: TIPO_GASTO, rubro: rubros[i] })).join('')}
      ${celdaDeImporte(fila.gastos, ' separada')}
      ${(fila.rubrosIngreso ?? []).map((importe, i) => celdaDeImporte(importe, '',
        rubrosIngreso[i] === undefined ? null : { mes: fila.mes, tipo: TIPO_INGRESO, rubro: rubrosIngreso[i] })).join('')}
      ${celdaDeImporte(fila.ingresos, ' separada')}
      <td class="importe separada ${fila.saldo < 0 ? 'gasto' : 'ingreso'}">${escapar(formatearNumero(fila.saldo, DECIMALES_EURO))}</td>
    </tr>
  `;
}

/** Las dos filas del pie: total y promedio. */
export function dibujarPieMatriz(matriz) {
  const fila = (nombre, valores) => `
    <tr>
      <th scope="row" class="columna-mes">${escapar(nombre)}</th>
      ${valores.rubros.map((importe) => celdaDeImporte(importe)).join('')}
      ${celdaDeImporte(valores.gastos, ' separada')}
      ${(valores.rubrosIngreso ?? []).map((importe) => celdaDeImporte(importe)).join('')}
      ${celdaDeImporte(valores.ingresos, ' separada')}
      ${celdaDeImporte(valores.saldo, ' separada')}
    </tr>
  `;

  return fila('Total', matriz.total) + fila('Promedio', matriz.promedio);
}

/**
 * La explicación del promedio.
 *
 * No es un adorno: en el Excel el total sumaba once meses y el promedio
 * promediaba diez, y no estaba escrito en ningún lado si era a propósito
 * (L-006). Una decisión sin explicación es indistinguible de un error, así que
 * acá la decisión se escribe abajo de la tabla, donde se lee el número.
 */
export function dibujarNotaDelPromedio(matriz) {
  const meses = matriz.mesesDelPromedio === 1 ? '1 mes' : `${matriz.mesesDelPromedio} meses`;

  if (matriz.dejaAfuera === null) {
    return `<p class="suave nota">El promedio es sobre ${escapar(meses)}.</p>`;
  }

  return `
    <p class="suave nota">
      El promedio es sobre los ${escapar(meses)} terminados: deja afuera
      ${escapar(formatearMesCorto(matriz.dejaAfuera))}, que todavía va por la
      mitad y tiraría el promedio para abajo. El total sí lo incluye.
    </p>
  `;
}

/** Lo que se ve cuando todavía no hay nada que comparar. */
export function dibujarSinHistorial() {
  return `
    <section class="tarjeta">
      <h2>Evolución mes a mes</h2>
      <p class="suave">Todavía no cargaste ningún movimiento, así que no hay meses
      que comparar.</p>
      <button type="button" class="principal" data-accion="ir" data-pantalla="nuevo">
        Cargar un movimiento
      </button>
    </section>
  `;
}

/**
 * `mesActual` es **el mes en el que estamos**, no el que se está mirando: es el
 * que queda afuera del promedio por estar empezado. Se puede pasar aparte
 * porque si no, la única forma de probar esa regla sería esperar a que cambie
 * el mes.
 */
export function dibujarEvolucion(vista, mesActual = mesDe(hoy())) {
  const base = monedaBaseDe(vista.estado);
  const matriz = matrizMesRubro(vista.estado, mesActual);
  if (matriz.filas.length === 0) return dibujarSinHistorial();

  const incompletos = matriz.filas.filter((f) => f.incompleto).length;
  const aviso = incompletos === 0 ? '' : `
    <p class="suave nota">
      ${incompletos === 1 ? 'Un mes está marcado con un punto' : `${incompletos} meses están marcados con un punto`}
      porque les falta un tipo de cambio: su total está incompleto.
    </p>`;

  // Del más viejo al más nuevo, y abajo el total y el promedio: es el orden de
  // `Analisis1` y el que el usuario pidió explícitamente (2026-08-28).
  //
  // Estaba al revés, con este argumento: "lo primero que se mira es el mes
  // pasado". El argumento no era malo y estaba equivocado igual — esta tabla no
  // se lee para mirar un mes, se lee para seguir una línea de tiempo, y una
  // línea de tiempo va para adelante. Además así **la pantalla y la hoja del
  // .xlsx cuentan lo mismo en el mismo orden**, que es lo que tendría que haber
  // pesado desde el principio.
  const filas = matriz.filas.map((f) => dibujarFilaMes(f, matriz.rubros, matriz.rubrosIngreso)).join('');

  return `
    <section class="tarjeta">
      <h2>Evolución mes a mes</h2>
      <div class="tabla-ancha" tabindex="0" role="region" aria-label="Gastos e ingresos por mes y por rubro">
        <table class="matriz">
          <thead>${dibujarEncabezadoMatriz(matriz.rubros, matriz.rubrosIngreso)}</thead>
          <tbody>${filas}</tbody>
          <tfoot>${dibujarPieMatriz(matriz)}</tfoot>
        </table>
      </div>
      <p class="suave nota deslizar">Deslizá la tabla para ver todos los rubros, los
      de gasto y los de ingreso. Los importes están en ${escapar(base)}, y tocando
      uno se ven los movimientos que lo componen.</p>
      ${dibujarNotaDelPromedio(matriz)}
      ${aviso}
    </section>
    ${dibujarMesAMes(matriz.filas)}
    ${dibujarAcumuladoHistorico(acumuladoHistorico(vista.estado))}
    ${dibujarGastosFijos(vista.estado)}
  `;
}
