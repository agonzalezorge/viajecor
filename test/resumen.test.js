// T-014 — Tests de la pantalla de resumen del mes.
//
// Es la pantalla que responde "¿cómo vengo este mes?", así que lo que se
// comprueba acá no es que dibuje bonito sino que **no muestre un número que
// engañe**: un total incompleto que parece completo, un saldo negativo que se
// lee como positivo, o un desglose que no cierra con su total.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dibujarResumen,
  dibujarTotales,
  dibujarDesglose,
  dibujarIncompleto,
  dibujarMesVacio,
  dibujarPromedio,
} from '../src/ui/pantallas/resumen.js';

import { totalesDelMes } from '../src/core/calculos.js';
import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO, hoy, mesDe } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

const DURO = ' ';
const MES = '2026-03';

let contador = 0;
function mov({ monto, rubro = 'supermercado', fecha = '2026-03-14', tipo = TIPO_GASTO, moneda = 'EUR', comentario = '' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: '2026-03-14' }
  );
}

const CAMBIO = crearCambio(
  { moneda: 'CRC', mes: MES, euros_por_unidad: desdeUnidadesPorEuro(630) },
  { creado: '2026-03-14' }
);

function estadoCon(movimientos, cambios = [CAMBIO]) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios };
}

// ── Los tres números ─────────────────────────────────────────────────────────

test('muestra gastos, ingresos y saldo del mes', () => {
  const estado = estadoCon([
    mov({ monto: '12,50' }),
    mov({ monto: '2100', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const html = dibujarResumen({ estado, mes: MES });

  assert.ok(html.includes('Gastos'));
  assert.ok(html.includes(`12,50${DURO}€`));
  assert.ok(html.includes('Ingresos'));
  assert.ok(html.includes(`2100,00${DURO}€`));
  assert.ok(html.includes('Saldo'));
  assert.ok(html.includes(`2087,50${DURO}€`));
});

test('un saldo negativo se lee como negativo, no solo por el color', () => {
  // Quien no distingue el verde del rojo tiene que poder leer si el mes cerró
  // en más o en menos.
  const estado = estadoCon([
    mov({ monto: '500' }),
    mov({ monto: '300', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const html = dibujarTotales(totalesDelMes(estado, MES));

  assert.ok(html.includes('-200,00'), 'el signo tiene que estar en el número');
  assert.ok(html.includes('cifra gasto'), 'y además se pinta');
});

test('un saldo positivo y uno negativo se pintan distinto', () => {
  const positivo = dibujarTotales({ gastos: 100, ingresos: 500, saldo: 400, cuantos: 2, sinConvertir: [] });
  const negativo = dibujarTotales({ gastos: 500, ingresos: 100, saldo: -400, cuantos: 2, sinConvertir: [] });

  assert.ok(positivo.includes('<span class="cifra ingreso">'));
  assert.ok(negativo.includes('<span class="cifra gasto">'));
});

// ── Que no muestre un total que engaña ───────────────────────────────────────

test('si falta un tipo de cambio, la pantalla DICE que el total está incompleto', () => {
  // calculos.js aparta esos movimientos en vez de contarlos como cero (T-013).
  // Si la pantalla no lo dijera, todo ese cuidado no serviría de nada.
  const estado = estadoCon([mov({ monto: '12,50' }), mov({ monto: '5000', moneda: 'USD' })]);
  const html = dibujarResumen({ estado, mes: MES });

  assert.ok(html.includes('Este total está incompleto'));
  assert.ok(html.includes('USD'));
  assert.ok(html.includes('role="alert"'));
  // Y ofrece la salida, no solo el problema.
  assert.ok(html.includes('data-pantalla="cambios"'));
});

test('el aviso dice cuántos movimientos faltan, y concuerda en número', () => {
  const uno = estadoCon([mov({ monto: '10', moneda: 'USD' })]);
  const dos = estadoCon([mov({ monto: '10', moneda: 'USD' }), mov({ monto: '20', moneda: 'UYU' })]);

  assert.ok(dibujarIncompleto(uno, totalesDelMes(uno, MES)).includes('Un movimiento no está contado'));
  assert.ok(dibujarIncompleto(dos, totalesDelMes(dos, MES)).includes('2 movimientos no están contados'));
});

test('sin nada que avisar, no se dibuja ningún aviso', () => {
  const estado = estadoCon([mov({ monto: '10' })]);
  assert.equal(dibujarIncompleto(estado, totalesDelMes(estado, MES)), '');
  assert.equal(dibujarResumen({ estado, mes: MES }).includes('incompleto'), false);
});

// ── El desglose por rubro ────────────────────────────────────────────────────

test('el desglose va de mayor a menor y muestra el porcentaje', () => {
  const estado = estadoCon([
    mov({ monto: '25', rubro: 'transporte' }),
    mov({ monto: '75', rubro: 'supermercado' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  assert.ok(html.indexOf('supermercado') < html.indexOf('transporte'));
  assert.ok(html.includes('75 %'));
  assert.ok(html.includes('25 %'));
});

test('todas las barras son del mismo color, no una escala por tamaño', () => {
  // Pintar más oscuro al rubro más grande codifica dos veces lo mismo —el largo
  // ya lo dice— y le pone colores distintos a categorías que no significan nada
  // distinto.
  const estado = estadoCon([
    mov({ monto: '90', rubro: 'viajes' }),
    mov({ monto: '30', rubro: 'salud' }),
    mov({ monto: '10', rubro: 'transporte' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);
  const clases = html.match(/class="barra [^"]*"/g) ?? [];

  assert.equal(clases.length, 3);
  assert.equal(new Set(clases).size, 1, 'las tres barras tienen la misma clase');
});

test('la barra más larga es la del rubro más grande, y llena el ancho', () => {
  const estado = estadoCon([
    mov({ monto: '100', rubro: 'viajes' }),
    mov({ monto: '25', rubro: 'salud' }),
  ]);
  const anchos = [...dibujarDesglose(estado, MES, TIPO_GASTO).matchAll(/width: ([\d.]+)%/g)].map((m) => Number(m[1]));

  assert.deepEqual(anchos, [100, 25]);
});

test('gastos e ingresos se muestran por separado, con títulos distintos', () => {
  const estado = estadoCon([
    mov({ monto: '10' }),
    mov({ monto: '2100', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const html = dibujarResumen({ estado, mes: MES });

  assert.ok(html.includes('En qué se fue'));
  assert.ok(html.includes('De dónde vino'));
  assert.ok(html.includes('supermercado'));
  assert.ok(html.includes('trabajo'));
});

test('un mes sin ingresos no dibuja una sección de ingresos vacía', () => {
  const estado = estadoCon([mov({ monto: '10' })]);
  const html = dibujarResumen({ estado, mes: MES });

  assert.ok(html.includes('En qué se fue'));
  assert.equal(html.includes('De dónde vino'), false);
});

test('el conteo de movimientos por rubro concuerda en número', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'salud' }),
    mov({ monto: '10', rubro: 'viajes' }),
    mov({ monto: '10', rubro: 'viajes' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  assert.ok(html.includes('1 movimiento<'));
  assert.ok(html.includes('2 movimientos<'));
});

test('con un solo rubro no se dibuja una barra llena ni un 100 %', () => {
  // Una barra siempre llena y un "100 %" siempre igual son dos adornos que
  // ocupan lugar y no dicen nada: no hay nada con qué comparar.
  const estado = estadoCon([mov({ monto: '2100', tipo: TIPO_INGRESO, rubro: 'trabajo' })]);
  const html = dibujarDesglose(estado, MES, TIPO_INGRESO);

  assert.ok(html.includes('trabajo'));
  assert.ok(html.includes(`2100,00${DURO}€`));
  assert.equal(html.includes('class="barra'), false);
  assert.equal(html.includes('100 %'), false);
});

test('con dos rubros o más sí se dibujan las barras', () => {
  const estado = estadoCon([mov({ monto: '10', rubro: 'salud' }), mov({ monto: '20', rubro: 'viajes' })]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);
  assert.ok(html.includes('class="barra'));
});

// ── Que los números de la pantalla cierren entre sí ──────────────────────────

test('los importes del desglose suman el total que muestra arriba', () => {
  // Si no cerraran, el usuario vería dos números distintos en la misma pantalla
  // y no tendría forma de saber cuál creer.
  const estado = estadoCon([
    mov({ monto: '12,53', rubro: 'supermercado' }),
    mov({ monto: '7,47', rubro: 'transporte' }),
    mov({ monto: '10000', moneda: 'CRC', rubro: 'viajes' }),
  ]);
  const html = dibujarResumen({ estado, mes: MES });
  const totales = totalesDelMes(estado, MES);

  // El total aparece tal cual arriba…
  assert.ok(html.includes(`${(totales.gastos / 100).toFixed(2).replace('.', ',')}${DURO}€`));
  // …y los porcentajes del desglose suman 100.
  const porcentajes = [...html.matchAll(/>(\d+) %</g)].map((m) => Number(m[1]));
  assert.equal(porcentajes.reduce((t, p) => t + p, 0), 100);
});

// ── El mes vacío ─────────────────────────────────────────────────────────────

test('un mes sin movimientos no parece una pantalla rota', () => {
  const html = dibujarResumen({ estado: estadoCon([]), mes: '2026-03' });

  assert.ok(html.includes('marzo de 2026'));
  assert.ok(html.includes('No cargaste nada en este mes'));
  assert.ok(html.includes('data-pantalla="nuevo"'), 'ofrece lo único que tiene sentido hacer');
  assert.equal(html.includes('Gastos'), false, 'no muestra tres ceros');
});

test('un mes que todavía no llegó lo dice distinto', () => {
  // "No cargaste nada" en un mes futuro suena a reproche por algo imposible.
  const futuro = dibujarMesVacio('2099-01');
  assert.ok(futuro.includes('todavía no llegó'));
  assert.equal(futuro.includes('No cargaste nada'), false);
});

// ── El promedio por día ──────────────────────────────────────────────────────

test('el promedio del mes en curso cuenta los días transcurridos', () => {
  const mesActual = mesDe(hoy());
  const dia = Number(hoy().slice(8));
  const estado = estadoCon([mov({ monto: '100', fecha: hoy() })], []);
  const html = dibujarPromedio(estado, mesActual);

  assert.ok(html.includes(`en los ${dia} días que van del mes`));
});

test('el promedio de un mes terminado se dice de otra forma', () => {
  const estado = estadoCon([mov({ monto: '310' })]);
  const html = dibujarPromedio(estado, MES);

  assert.ok(html.includes('por día en todo el mes'));
  // Y sin repetir "por día", que es lo que se veía al mirar la pantalla.
  assert.equal(/por día por día/.test(html), false);
  assert.ok(html.includes(`10,00${DURO}€`), '310 € en 31 días son 10 € por día');
});

test('sin gastos no se dibuja ningún promedio', () => {
  const estado = estadoCon([mov({ monto: '100', tipo: TIPO_INGRESO, rubro: 'trabajo' })]);
  assert.equal(dibujarPromedio(estado, MES), '');
});

// ── Nada de lo que se dibuja rompe la página ─────────────────────────────────

test('el resumen no contiene ninguna dirección de internet (RN-06)', () => {
  const estado = estadoCon([mov({ monto: '10' })]);
  assert.equal(/https?:\/\//.test(dibujarResumen({ estado, mes: MES })), false);
});
