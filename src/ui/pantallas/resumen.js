// El resumen del mes — CU-04. Responde "¿cómo vengo este mes?" de un vistazo.
//
// Reemplaza los bloques `GASTOS POR TIPO`, `INGRESOS POR TIPO` y `TOTALES` del
// Excel. Tres decisiones de presentación, con su motivo:
//
//   1. Los tres números de arriba son **números destacados, no un gráfico**. Un
//      gráfico de tres barras para tres cifras que ya se leen en un vistazo
//      agrega trabajo visual y no agrega información.
//
//   2. El desglose por rubro es una **torta más una tabla** (T-918). La torta da
//      el reparto del todo de un vistazo; la tabla, ordenada de mayor a menor,
//      da el nombre, el importe y el porcentaje, que es donde se compara con
//      precisión. Hasta el 2026-08-28 la tabla llevaba barras de proporción: las
//      reemplazó la torta por pedido del usuario, que es la forma que reconoce
//      de su planilla. La tabla se quedó justamente porque la torta compara
//      peor, y sin ella el cambio sería una pérdida.
//
//      Cada rubro lleva **el color que tiene en todas las demás pantallas**
//      (T-909, T-922). El color identifica al rubro y **nunca a su tamaño**:
//      pintar más oscuro al más grande codificaría dos veces lo mismo y haría
//      que el color cambiara de significado cada vez que se carga un gasto.
//
//   3. Los importes de la tabla llevan cifras de ancho fijo, para poder
//      compararlos en columna. Los tres números grandes de arriba **no**: en un
//      número grande, el ancho fijo abre huecos entre los dígitos y se lee peor.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras que devuelven
// texto HTML.

import { escapar } from '../app.js';
import { totalesDelMes, porRubro, porDia, promedioPorDia } from '../../core/calculos.js';
import { formatearEuros, formatearMes, formatearRubro } from '../../core/formato.js';
import { claseDeRubro } from '../colores.js';
import { dibujarTorta, dibujarAcumulado } from './graficos.js';
import { TIPO_GASTO, TIPO_INGRESO, hoy, mesDe } from '../../core/modelo.js';

/** Un porcentaje para mostrar: sin decimales, que en un desglose no aportan. */
function porcentaje(valor) {
  return `${Math.round(valor)} %`;
}

/**
 * Los tres números del mes.
 *
 * El saldo lleva su signo en el propio número, no solo en el color: quien no
 * distingue el verde del rojo tiene que poder leer si el mes cerró en más o en
 * menos.
 */
export function dibujarTotales(totales) {
  const saldoPositivo = totales.saldo >= 0;

  return `
    <section class="tarjeta totales" aria-label="Totales del mes">
      <div class="total">
        <span class="etiqueta">Gastos</span>
        <span class="cifra gasto">${escapar(formatearEuros(totales.gastos))}</span>
      </div>
      <div class="total">
        <span class="etiqueta">Ingresos</span>
        <span class="cifra ingreso">${escapar(formatearEuros(totales.ingresos))}</span>
      </div>
      <div class="total saldo">
        <span class="etiqueta">Saldo</span>
        <span class="cifra ${saldoPositivo ? 'ingreso' : 'gasto'}">
          ${escapar(formatearEuros(totales.saldo))}
        </span>
      </div>
    </section>
  `;
}

/**
 * El aviso de que el total está incompleto.
 *
 * `calculos.js` se toma el trabajo de apartar los movimientos que no se pueden
 * convertir a euros en vez de contarlos como cero (T-013). Si la pantalla no lo
 * dijera, ese cuidado no serviría de nada: el usuario vería un total que parece
 * completo y no lo es.
 */
export function dibujarIncompleto(estado, totales) {
  if (totales.sinConvertir.length === 0) return '';

  const faltantes = [...new Set(totales.sinConvertir.map((m) => m.moneda))].join(', ');
  const cuantos = totales.sinConvertir.length === 1
    ? 'Un movimiento no está'
    : `${totales.sinConvertir.length} movimientos no están`;

  return `
    <section class="aviso importante" role="alert">
      <h2>Este total está incompleto</h2>
      <p>${cuantos} contado${totales.sinConvertir.length === 1 ? '' : 's'} acá porque falta
      el tipo de cambio de ${escapar(faltantes)} para este mes.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="cambios">
        Cargar el tipo de cambio
      </button>
    </section>
  `;
}

/**
 * El desglose de un tipo: la torta arriba, la lista de mayor a menor abajo.
 *
 * Las dos leen los mismos datos y las dos están siempre: el dibujo muestra el
 * reparto, la lista muestra los números. La torta se dibuja en el orden fijo de
 * la paleta, no en el de la lista — el motivo está en `graficos.js`.
 */
export function dibujarDesglose(estado, mes, tipo) {
  const filas = porRubro(estado, mes, tipo);
  if (filas.length === 0) return '';

  const titulo = tipo === TIPO_GASTO ? 'En qué se fue' : 'De dónde vino';

  // Con un solo rubro no hay nada que comparar: la barra estaría siempre llena y
  // el porcentaje sería siempre 100 %. Dos adornos que ocupan lugar y no dicen
  // nada. Se muestran el nombre y el importe, que es toda la información que hay.
  const hayComparacion = filas.length > 1;

  const cuerpo = filas
    .map((fila) => `
      <li class="fila-rubro">
        <div class="rubro-cabeza">
          <span class="nombre">
            <span class="punto-rubro ${claseDeRubro(tipo, fila.rubro)}" aria-hidden="true"></span>
            ${escapar(formatearRubro(fila.rubro))}
          </span>
          <span class="importe">${escapar(formatearEuros(fila.total))}</span>
        </div>
        <div class="rubro-pie suave">
          <span>${hayComparacion ? escapar(porcentaje(fila.porcentaje)) : ''}</span>
          <span>${fila.cuantos === 1 ? '1 movimiento' : `${fila.cuantos} movimientos`}</span>
        </div>
      </li>`)
    .join('');

  return `
    <section class="tarjeta">
      <h2>${titulo}</h2>
      ${dibujarTorta(filas, tipo)}
      <ul class="rubros">${cuerpo}</ul>
    </section>
  `;
}

/**
 * Lo que se muestra cuando el mes está vacío.
 *
 * Un mes sin nada no es un error ni una pantalla rota: puede ser un mes que
 * todavía no empezó a cargarse, o uno viejo. Se dice cuál de las dos cosas es y
 * se ofrece lo único que tiene sentido hacer.
 */
export function dibujarMesVacio(mes) {
  const esFuturo = mes > mesDe(hoy());
  const explicacion = esFuturo
    ? 'Este mes todavía no llegó.'
    : 'No cargaste nada en este mes.';

  return `
    <section class="tarjeta">
      <h2>${escapar(formatearMes(mes))}</h2>
      <p class="suave">${explicacion}</p>
      <button type="button" class="principal" data-accion="ir" data-pantalla="nuevo">
        Cargar un movimiento
      </button>
    </section>
  `;
}

/** El promedio por día, que a mitad de mes es el número que dice cómo vas. */
export function dibujarPromedio(estado, mes) {
  const { gastos, cuantos } = totalesDelMes(estado, mes);
  if (cuantos === 0 || gastos === 0) return '';

  const esteMes = mes === mesDe(hoy());
  const hasta = esteMes ? Number(hoy().slice(8)) : undefined;
  const promedio = promedioPorDia(estado, mes, hasta);

  const explicacion = esteMes
    ? `en los ${hasta} días que van del mes`
    : 'en todo el mes';

  return `
    <p class="promedio suave">
      <strong>${escapar(formatearEuros(promedio))}</strong> por día ${escapar(explicacion)}.
    </p>
  `;
}

/**
 * La puerta a la evolución mes a mes.
 *
 * Va al final del resumen porque es ahí donde nace la pregunta: se termina de
 * leer "620,00 € en gastos fijos" y lo siguiente que uno quiere saber es si eso
 * es mucho o poco comparado con los meses anteriores.
 */
export function dibujarIrAEvolucion() {
  return `
    <section class="tarjeta">
      <h2>¿Y comparado con los otros meses?</h2>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="evolucion">
        Ver la evolución y los gastos fijos
      </button>
    </section>
  `;
}

export function dibujarResumen(vista) {
  const { estado, mes } = vista;
  const totales = totalesDelMes(estado, mes);

  if (totales.cuantos === 0) return dibujarMesVacio(mes);

  return `
    ${dibujarIncompleto(estado, totales)}
    ${dibujarTotales(totales)}
    ${dibujarPromedio(estado, mes)}
    ${dibujarDesglose(estado, mes, TIPO_GASTO)}
    ${dibujarAcumulado(porDia(estado, mes), { hasta: mes === mesDe(hoy()) ? Number(hoy().slice(8)) : undefined })}
    ${dibujarDesglose(estado, mes, TIPO_INGRESO)}
    ${dibujarIrAEvolucion()}
  `;
}
