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
import { claseDeRubro, franjaDeRubro } from '../src/ui/colores.js';
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

  assert.ok(html.indexOf('Supermercado') < html.indexOf('Transporte'));
  assert.ok(html.includes('75 %'));
  assert.ok(html.includes('25 %'));
});

test('cada rubro tiene su propio color, y son distintos entre sí', () => {
  const estado = estadoCon([
    mov({ monto: '90', rubro: 'viajes' }),
    mov({ monto: '30', rubro: 'salud' }),
    mov({ monto: '10', rubro: 'transporte' }),
  ]);
  const clases = dibujarDesglose(estado, MES, TIPO_GASTO).match(/class="barra ([^"]*)"/g) ?? [];

  assert.equal(clases.length, 3);
  assert.equal(new Set(clases).size, 3, 'tres rubros, tres colores');
});

test('el color de un rubro NO depende de su tamaño (T-909)', () => {
  // Es LA regla. Si el color dependiera del tamaño, cargar un gasto nuevo
  // repintaría media pantalla y el color dejaría de significar "salud" para
  // significar "el más grande de este mes" — que ya lo dice el largo de la barra.
  const pocos = estadoCon([mov({ monto: '10', rubro: 'salud' }), mov({ monto: '90', rubro: 'viajes' })]);
  const claseAntes = dibujarDesglose(pocos, MES, TIPO_GASTO).match(/Salud[\s\S]*?class="barra ([^"]*)"/)[1];

  // Ahora salud pasa a ser el rubro más grande del mes.
  const muchos = estadoCon([...pocos.movimientos, mov({ monto: '500', rubro: 'salud' })]);
  const claseDespues = dibujarDesglose(muchos, MES, TIPO_GASTO).match(/Salud[\s\S]*?class="barra ([^"]*)"/)[1];

  assert.equal(claseAntes, claseDespues, 'el color de salud no cambió al cambiar su tamaño');
  assert.equal(claseAntes, claseDeRubro(TIPO_GASTO, 'salud'));
});

test('el mismo rubro tiene el mismo color en todas las pantallas', () => {
  // Es para lo que sirve: reconocer "supermercado" sin leer su nombre.
  assert.equal(claseDeRubro(TIPO_GASTO, 'supermercado'), claseDeRubro(TIPO_GASTO, 'SUPERMERCADO'));
  assert.equal(claseDeRubro(TIPO_GASTO, 'supermercado'), claseDeRubro(TIPO_GASTO, ' Supermercado '));
});

test('cada rubro de gasto cae en una franja distinta, y son ocho', () => {
  const franjas = ['gastos fijos', 'supermercado', 'comida hecha', 'viajes',
    'entretenimiento', 'transporte', 'salud', 'otros'].map((r) => franjaDeRubro(TIPO_GASTO, r));

  assert.deepEqual(franjas, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(franjas).size, 8);
});

test('"otros" de gasto y "otros" de ingreso tienen colores distintos', () => {
  // Son cosas distintas (PRODUCTO §4), así que no pueden verse iguales.
  assert.notEqual(claseDeRubro(TIPO_GASTO, 'otros'), claseDeRubro(TIPO_INGRESO, 'otros'));
});

test('los rótulos se muestran con mayúscula inicial', () => {
  const estado = estadoCon([mov({ monto: '10', rubro: 'gastos fijos' })]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  assert.ok(html.includes('Gastos fijos'));
  assert.equal(html.includes('>gastos fijos'), false);
});

test('la barra más larga es la del rubro más grande', () => {
  // 100 y 25 sobre un total de 125 son 80 % y 20 %. Este test decía [100, 25]
  // hasta el 2026-08-27: la barra se dibujaba contra el rubro mayor, así que el
  // más grande siempre llenaba el ancho. Lo encontró el usuario en su celular,
  // con dos rubros que decían 50 % y tenían las dos barras completas (T-911).
  const estado = estadoCon([
    mov({ monto: '100', rubro: 'viajes' }),
    mov({ monto: '25', rubro: 'salud' }),
  ]);
  const anchos = [...dibujarDesglose(estado, MES, TIPO_GASTO).matchAll(/width: ([\d.]+)%/g)].map((m) => Number(m[1]));

  assert.deepEqual(anchos, [80, 20]);
});

test('gastos e ingresos se muestran por separado, con títulos distintos', () => {
  const estado = estadoCon([
    mov({ monto: '10' }),
    mov({ monto: '2100', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const html = dibujarResumen({ estado, mes: MES });

  assert.ok(html.includes('En qué se fue'));
  assert.ok(html.includes('De dónde vino'));
  assert.ok(html.includes('Supermercado'));
  assert.ok(html.includes('Trabajo'));
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

  assert.ok(html.includes('Trabajo'));
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

// ── El largo de las barras (T-911) ───────────────────────────────────────────

test('dos rubros iguales dan dos barras a la mitad, no dos llenas', () => {
  // El caso exacto que reportó el usuario (2026-08-27).
  const estado = estadoCon([
    mov({ monto: '50', rubro: 'viajes' }),
    mov({ monto: '50', rubro: 'salud' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  const anchos = [...html.matchAll(/width: ([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.deepEqual(anchos, [50, 50]);
});

test('el ancho de la barra y el porcentaje escrito dicen lo mismo', () => {
  // Es la regla, no un caso: si vuelven a separarse, el dibujo contradice al
  // número, y entre los dos el usuario le cree al número.
  const estado = estadoCon([
    mov({ monto: '60', rubro: 'viajes' }),
    mov({ monto: '30', rubro: 'salud' }),
    mov({ monto: '10', rubro: 'transporte' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  const anchos = [...html.matchAll(/width: ([\d.]+)%/g)].map((m) => Math.round(Number(m[1])));
  const escritos = [...html.matchAll(/>(\d+)\s*%</g)].map((m) => Number(m[1]));

  assert.deepEqual(anchos, [60, 30, 10]);
  assert.deepEqual(escritos, anchos);
});

test('las barras nunca suman más del 100 %', () => {
  const estado = estadoCon([
    mov({ monto: '33,33', rubro: 'viajes' }),
    mov({ monto: '66,67', rubro: 'salud' }),
  ]);
  const html = dibujarDesglose(estado, MES, TIPO_GASTO);

  const total = [...html.matchAll(/width: ([\d.]+)%/g)].reduce((suma, m) => suma + Number(m[1]), 0);
  assert.ok(total <= 100.01, `las barras suman ${total} %`);
});
