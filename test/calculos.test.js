// T-013 — Tests de los cálculos del mes.
//
// Estos son los números que la app va a mostrar como verdad. El Excel que
// reemplaza tiene dos formas conocidas de mentir, y los tests de acá existen
// sobre todo para comprobar que ninguna se repite:
//
//   L-001 — sumar hasta una fila escrita a mano, y dar de menos sin avisar
//           cuando el registro la pasa.
//   L-005 — cruzar día y mes por separado, y contar un gasto en el mes que no es.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  movimientosDelMes,
  mesesConMovimientos,
  diasDelMes,
  separarConvertibles,
  totalesDelMes,
  porRubro,
  rubrosSinUsar,
  porDia,
  promedioPorDia,
  porComentario,
  comentariosUsados,
  detallesUsados,
  sugerenciasPara,
} from '../src/core/calculos.js';

import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';

const MES = '2026-03';

let contador = 0;
function mov({ monto = '10', rubro = 'supermercado', fecha = '2026-03-14', tipo = TIPO_GASTO, moneda = 'EUR', comentario = '', decimales = 2 }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales, id: `mov_${String(contador).padStart(16, '0')}`, creado: '2026-03-14' }
  );
}

// 1 EUR = 630 CRC, para marzo. Los números de abajo salen de ahí.
const CAMBIO_MARZO = crearCambio(
  { moneda: 'CRC', mes: MES, euros_por_unidad: desdeUnidadesPorEuro(630) },
  { creado: '2026-03-14' }
);

function estadoCon(movimientos, cambios = [CAMBIO_MARZO]) {
  return { ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: cambios };
}

// ── Que ningún movimiento se cuente en el mes equivocado (L-005) ─────────────

test('cada movimiento cae en el mes de su fecha, y en ninguno más', () => {
  const estado = estadoCon([
    mov({ monto: '10', fecha: '2026-02-28' }),
    mov({ monto: '20', fecha: '2026-03-01' }),
    mov({ monto: '30', fecha: '2026-03-31' }),
    mov({ monto: '40', fecha: '2026-04-01' }),
  ]);

  assert.equal(movimientosDelMes(estado.movimientos, '2026-02').length, 1);
  assert.equal(movimientosDelMes(estado.movimientos, MES).length, 2);
  assert.equal(movimientosDelMes(estado.movimientos, '2026-04').length, 1);

  // Los bordes son lo que importa: el 1 y el último día.
  assert.equal(totalesDelMes(estado, MES).gastos, 2000 + 3000);
  assert.equal(totalesDelMes(estado, '2026-02').gastos, 1000);
  assert.equal(totalesDelMes(estado, '2026-04').gastos, 4000);
});

test('un mes sin movimientos da cero, no un error', () => {
  const totales = totalesDelMes(estadoCon([mov({ monto: '10' })]), '2025-01');
  assert.deepEqual({ ...totales, sinConvertir: [] }, { gastos: 0, ingresos: 0, saldo: 0, cuantos: 0, sinConvertir: [] });
});

test('los meses con movimientos salen del más nuevo al más viejo', () => {
  const estado = estadoCon([
    mov({ monto: '10', fecha: '2026-01-05' }),
    mov({ monto: '10', fecha: '2026-03-05' }),
    mov({ monto: '10', fecha: '2026-03-20' }),
    mov({ monto: '10', fecha: '2025-12-31' }),
  ]);
  assert.deepEqual(mesesConMovimientos(estado.movimientos), ['2026-03', '2026-01', '2025-12']);
});

// ── Que ningún cálculo tenga un tope de filas (L-001) ────────────────────────

test('dos mil movimientos se suman enteros, sin ningún tope escrito a mano', () => {
  // El Excel original suma hasta la fila 1027. Este test pasa esa marca a
  // propósito: es exactamente el punto donde la planilla empieza a mentir.
  const movimientos = Array.from({ length: 2000 }, () => mov({ monto: '1,00' }));
  const estado = estadoCon(movimientos);

  assert.equal(totalesDelMes(estado, MES).gastos, 2000 * 100);
  assert.equal(totalesDelMes(estado, MES).cuantos, 2000);
  assert.equal(porRubro(estado, MES, TIPO_GASTO)[0].cuantos, 2000);
});

// ── Los tres números del mes (CU-04) ─────────────────────────────────────────

test('gastos, ingresos y saldo', () => {
  const estado = estadoCon([
    mov({ monto: '12,50' }),
    mov({ monto: '48,90', rubro: 'gastos fijos' }),
    mov({ monto: '2100', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const { gastos, ingresos, saldo } = totalesDelMes(estado, MES);

  assert.equal(gastos, 6140);
  assert.equal(ingresos, 210000);
  assert.equal(saldo, 210000 - 6140);
});

test('el saldo puede ser negativo, que es cuando importa mirarlo', () => {
  const estado = estadoCon([
    mov({ monto: '500' }),
    mov({ monto: '300', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  assert.equal(totalesDelMes(estado, MES).saldo, -20000);
});

test('los ingresos no se restan de los gastos ni al revés', () => {
  // Son dos totales distintos: mezclarlos haría que un mes con mucho ingreso
  // pareciera un mes sin gastos.
  const estado = estadoCon([
    mov({ monto: '100' }),
    mov({ monto: '1000', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const { gastos, ingresos } = totalesDelMes(estado, MES);
  assert.equal(gastos, 10000);
  assert.equal(ingresos, 100000);
});

// ── Varias monedas en el mismo mes ───────────────────────────────────────────

test('se suman monedas distintas, todo en euros (RN-04)', () => {
  // 12.500 colones a 630 por euro son 19,84 €. Más 12,50 € son 32,34 €.
  const estado = estadoCon([
    mov({ monto: '12,50' }),
    mov({ monto: '12500', moneda: 'CRC' }),
  ]);
  assert.equal(totalesDelMes(estado, MES).gastos, 1250 + 1984);
});

test('cada mes usa SU tipo de cambio, no el de otro mes', () => {
  const estado = estadoCon(
    [
      mov({ monto: '10000', moneda: 'CRC', fecha: '2026-03-10' }),
      mov({ monto: '10000', moneda: 'CRC', fecha: '2026-04-10' }),
    ],
    [
      CAMBIO_MARZO,
      crearCambio({ moneda: 'CRC', mes: '2026-04', euros_por_unidad: desdeUnidadesPorEuro(500) }, { creado: '2026-04-01' }),
    ]
  );

  assert.equal(totalesDelMes(estado, '2026-03').gastos, 1587);
  assert.equal(totalesDelMes(estado, '2026-04').gastos, 2000);
});

// ── Un movimiento que no se puede convertir ──────────────────────────────────

test('un movimiento sin tipo de cambio NO se cuenta como cero ni se descarta callado', () => {
  // Un total al que le falta un gasto y que no lo dice es peor que no mostrar
  // ningún total: parece completo. Sale aparte para que la pantalla lo diga.
  const sinCambio = mov({ monto: '10000', moneda: 'USD' });
  const estado = estadoCon([mov({ monto: '12,50' }), sinCambio]);

  const { gastos, sinConvertir, cuantos } = totalesDelMes(estado, MES);
  assert.equal(gastos, 1250);
  assert.equal(cuantos, 2, 'el conteo incluye los que no se pudieron convertir');
  assert.equal(sinConvertir.length, 1);
  assert.equal(sinConvertir[0].id, sinCambio.id);
});

test('separarConvertibles reparte sin perder ninguno', () => {
  const movimientos = [
    mov({ monto: '10' }),
    mov({ monto: '10', moneda: 'CRC' }),
    mov({ monto: '10', moneda: 'USD' }),
  ];
  const { convertibles, sinConvertir } = separarConvertibles(movimientos, [CAMBIO_MARZO]);

  assert.equal(convertibles.length, 2);
  assert.equal(sinConvertir.length, 1);
  assert.equal(convertibles.length + sinConvertir.length, movimientos.length);
});

test('los cálculos no explotan cuando falta un tipo de cambio', () => {
  // La pantalla del mes tiene que poder dibujarse igual.
  const estado = estadoCon([mov({ monto: '10', moneda: 'USD' })]);
  assert.doesNotThrow(() => totalesDelMes(estado, MES));
  assert.doesNotThrow(() => porRubro(estado, MES, TIPO_GASTO));
  assert.doesNotThrow(() => porDia(estado, MES));
});

// ── Desglose por rubro (CU-04) ───────────────────────────────────────────────

test('el desglose va de mayor a menor', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'transporte' }),
    mov({ monto: '100', rubro: 'gastos fijos' }),
    mov({ monto: '50', rubro: 'supermercado' }),
    mov({ monto: '25', rubro: 'transporte' }),
  ]);
  const filas = porRubro(estado, MES, TIPO_GASTO);

  assert.deepEqual(filas.map((f) => f.rubro), ['gastos fijos', 'supermercado', 'transporte']);
  assert.deepEqual(filas.map((f) => f.total), [10000, 5000, 3500]);
  assert.deepEqual(filas.map((f) => f.cuantos), [1, 1, 2]);
});

test('los porcentajes son sobre el total de ese tipo y suman 100', () => {
  const estado = estadoCon([
    mov({ monto: '75', rubro: 'supermercado' }),
    mov({ monto: '25', rubro: 'transporte' }),
  ]);
  const filas = porRubro(estado, MES, TIPO_GASTO);

  assert.equal(filas[0].porcentaje, 75);
  assert.equal(filas[1].porcentaje, 25);
  assert.equal(filas.reduce((t, f) => t + f.porcentaje, 0), 100);
});

test('solo aparecen los rubros usados, no una fila en cero por cada uno', () => {
  const estado = estadoCon([mov({ monto: '10', rubro: 'salud' })]);
  assert.deepEqual(porRubro(estado, MES, TIPO_GASTO).map((f) => f.rubro), ['salud']);
  assert.ok(rubrosSinUsar(estado, MES, TIPO_GASTO).includes('supermercado'));
  assert.equal(rubrosSinUsar(estado, MES, TIPO_GASTO).includes('salud'), false);
});

test('"otros" de gasto y "otros" de ingreso no se mezclan', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'otros' }),
    mov({ monto: '90', rubro: 'otros', tipo: TIPO_INGRESO }),
  ]);

  assert.equal(porRubro(estado, MES, TIPO_GASTO)[0].total, 1000);
  assert.equal(porRubro(estado, MES, TIPO_INGRESO)[0].total, 9000);
});

test('el desglose por rubro no cuenta movimientos de otro mes', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'viajes', fecha: '2026-03-05' }),
    mov({ monto: '99', rubro: 'viajes', fecha: '2026-04-05' }),
  ]);
  assert.equal(porRubro(estado, MES, TIPO_GASTO)[0].total, 1000);
});

test('un mes sin nada da un desglose vacío', () => {
  assert.deepEqual(porRubro(estadoCon([]), MES, TIPO_GASTO), []);
});

// ── Día por día (CU-05) ──────────────────────────────────────────────────────

test('cuántos días tiene cada mes, incluido febrero bisiesto', () => {
  assert.equal(diasDelMes('2026-03'), 31);
  assert.equal(diasDelMes('2026-04'), 30);
  assert.equal(diasDelMes('2026-02'), 28);
  assert.equal(diasDelMes('2024-02'), 29);
  assert.equal(diasDelMes('2028-02'), 29);
});

test('están TODOS los días del mes, también los que no tienen nada', () => {
  // El acumulado se lee como una línea: un día faltante en el medio se lee como
  // si ese día no hubiera existido.
  const dias = porDia(estadoCon([mov({ monto: '10', fecha: '2026-03-14' })]), MES);

  assert.equal(dias.length, 31);
  assert.equal(dias[0].dia, 1);
  assert.equal(dias[0].gasto, 0);
  assert.equal(dias.at(-1).dia, 31);
});

test('el acumulado crece y termina en el total del mes', () => {
  const estado = estadoCon([
    mov({ monto: '10', fecha: '2026-03-01' }),
    mov({ monto: '20', fecha: '2026-03-14' }),
    mov({ monto: '30', fecha: '2026-03-31' }),
    mov({ monto: '500', fecha: '2026-03-05', tipo: TIPO_INGRESO, rubro: 'trabajo' }),
  ]);
  const dias = porDia(estado, MES);

  assert.equal(dias[0].gasto, 1000);
  assert.equal(dias[0].gastoAcumulado, 1000);
  assert.equal(dias[13].gasto, 2000);
  assert.equal(dias[13].gastoAcumulado, 3000);
  assert.equal(dias[30].gastoAcumulado, 6000);
  assert.equal(dias.at(-1).gastoAcumulado, totalesDelMes(estado, MES).gastos);
  assert.equal(dias.at(-1).ingresoAcumulado, totalesDelMes(estado, MES).ingresos);
});

test('dos gastos del mismo día se suman en ese día', () => {
  const estado = estadoCon([
    mov({ monto: '10', fecha: '2026-03-14' }),
    mov({ monto: '15', fecha: '2026-03-14' }),
  ]);
  assert.equal(porDia(estado, MES)[13].gasto, 2500);
});

test('el promedio por día divide por los días transcurridos, no por los del mes', () => {
  // A mitad de mes, dividir por 31 da un promedio artificialmente bajo y hace
  // creer que se está gastando menos de lo real.
  const estado = estadoCon([mov({ monto: '150', fecha: '2026-03-10' })]);

  // 150 € en 10 días son 15,00 € por día.
  assert.equal(promedioPorDia(estado, MES, 10), 1500);
  // Los mismos 150 € repartidos en los 31 días de marzo son 4,84 € por día —
  // tres veces menos, y sería el número equivocado a mitad de mes.
  assert.equal(promedioPorDia(estado, MES), 484);
  assert.equal(promedioPorDia(estado, MES, 0), 0);
  // Y no se puede pedir un promedio sobre más días de los que tiene el mes.
  assert.equal(promedioPorDia(estado, MES, 99), 484);
});

// ── Por comentario: viajes y gastos fijos (CU-11, CU-12) ─────────────────────

test('el comentario agrupa sin distinguir mayúsculas (RN-03, L-003)', () => {
  // Es el error que en el Excel hace desaparecer gastos de un viaje: un "Roma "
  // con un espacio de más no entra en el total de Roma.
  const estado = estadoCon([
    mov({ monto: '10', comentario: 'Roma' }),
    mov({ monto: '20', comentario: 'roma' }),
    mov({ monto: '30', comentario: ' ROMA ' }),
  ]);
  const filas = porComentario(estado, MES);

  assert.equal(filas.length, 1, 'las tres escrituras son el mismo viaje');
  assert.equal(filas[0].total, 6000);
  assert.equal(filas[0].cuantos, 3);
  assert.equal(filas[0].comentario, 'Roma', 'se muestra como se escribió la primera vez');
});

test('el promedio por pago sirve para los gastos fijos (CU-12)', () => {
  const estado = estadoCon([
    mov({ monto: '40', comentario: 'Luz', rubro: 'gastos fijos', fecha: '2026-01-10' }),
    mov({ monto: '60', comentario: 'Luz', rubro: 'gastos fijos', fecha: '2026-02-10' }),
    mov({ monto: '50', comentario: 'Luz', rubro: 'gastos fijos', fecha: '2026-03-10' }),
  ]);
  // Sin mes: mira todo el historial, que es lo que un promedio necesita.
  const luz = porComentario(estado).find((c) => c.clave === 'luz');

  assert.equal(luz.cuantos, 3);
  assert.equal(luz.total, 15000);
  assert.equal(luz.promedio, 5000);
});

test('los movimientos sin comentario no forman un grupo vacío', () => {
  const estado = estadoCon([mov({ monto: '10' }), mov({ monto: '20', comentario: 'Roma' })]);
  assert.deepEqual(porComentario(estado, MES).map((c) => c.clave), ['roma']);
});

test('los comentarios se ordenan por total, de mayor a menor', () => {
  const estado = estadoCon([
    mov({ monto: '10', comentario: 'Luz' }),
    mov({ monto: '90', comentario: 'Roma' }),
    mov({ monto: '50', comentario: 'Gas' }),
  ]);
  assert.deepEqual(porComentario(estado, MES).map((c) => c.clave), ['roma', 'gas', 'luz']);
});

// ── Que los números cierren entre sí ─────────────────────────────────────────

test('el desglose por rubro suma exactamente el total de gastos', () => {
  // Si no cerraran, el usuario vería un total y una lista que no coinciden — y
  // no tendría forma de saber cuál de los dos creer.
  const estado = estadoCon([
    mov({ monto: '12,53', rubro: 'supermercado' }),
    mov({ monto: '7,47', rubro: 'transporte' }),
    mov({ monto: '10000', moneda: 'CRC', rubro: 'viajes' }),
    mov({ monto: '3333', moneda: 'CRC', rubro: 'comida hecha' }),
  ]);

  const totalRubros = porRubro(estado, MES, TIPO_GASTO).reduce((t, r) => t + r.total, 0);
  assert.equal(totalRubros, totalesDelMes(estado, MES).gastos);
});

test('el día por día suma exactamente el total del mes', () => {
  const estado = estadoCon([
    mov({ monto: '12,53', fecha: '2026-03-01' }),
    mov({ monto: '7,47', fecha: '2026-03-15' }),
    mov({ monto: '10000', moneda: 'CRC', fecha: '2026-03-31' }),
  ]);

  const totalDias = porDia(estado, MES).reduce((t, d) => t + d.gasto, 0);
  assert.equal(totalDias, totalesDelMes(estado, MES).gastos);
});

// ── Comentarios ya usados (T-912) ────────────────────────────────────────────

test('los comentarios usados vienen del más reciente al más viejo', () => {
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: 'Luz' }),
    mov({ fecha: '2026-03-20', comentario: 'Barcelona26' }),
    mov({ fecha: '2026-03-10', comentario: 'Gas' }),
  ]);

  assert.deepEqual(comentariosUsados(estado.movimientos), ['Barcelona26', 'Gas', 'Luz']);
});

test('un comentario escrito de dos formas aparece una sola vez', () => {
  // RN-03: lo que agrupa se normaliza antes de comparar. Ofrecer las dos
  // escrituras sería enseñarle al usuario a separar un viaje en dos.
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: 'Barcelona26' }),
    mov({ fecha: '2026-03-05', comentario: '  barcelona26 ' }),
  ]);

  assert.deepEqual(comentariosUsados(estado.movimientos), ['Barcelona26']);
});

test('se muestra la primera escritura, no la última', () => {
  // Es el mismo criterio que `porComentario`. Dos criterios distintos para
  // elegir cómo se escribe un grupo mostrarían dos nombres para la misma cosa.
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: 'Barcelona26' }),
    mov({ fecha: '2026-03-20', comentario: 'BARCELONA26' }),
  ]);

  assert.deepEqual(comentariosUsados(estado.movimientos), ['Barcelona26']);
});

test('pero el orden usa el uso MÁS reciente de cada comentario', () => {
  // Si ordenara por la primera vez que apareció, un viaje viejo que seguís
  // usando quedaría al fondo, que es lo contrario de lo útil.
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: 'Luz' }),
    mov({ fecha: '2026-03-05', comentario: 'Roma' }),
    mov({ fecha: '2026-03-25', comentario: 'Luz' }),
  ]);

  assert.deepEqual(comentariosUsados(estado.movimientos), ['Luz', 'Roma']);
});

test('los movimientos sin comentario no ensucian la lista', () => {
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: '' }),
    mov({ fecha: '2026-03-02', comentario: '   ' }),
    mov({ fecha: '2026-03-03', comentario: 'Roma' }),
  ]);

  assert.deepEqual(comentariosUsados(estado.movimientos), ['Roma']);
});

test('sin movimientos, o con basura, devuelve una lista vacía', () => {
  assert.deepEqual(comentariosUsados([]), []);
  assert.deepEqual(comentariosUsados(null), []);
  assert.deepEqual(comentariosUsados('no soy una lista'), []);
});

test('no hay ningún tope de movimientos al juntar comentarios', () => {
  // L-001: ningún cálculo tiene un límite escrito a mano. El que recorta a 50 es
  // lo que se MUESTRA, no lo que se calcula.
  const muchos = Array.from({ length: 1200 }, (_, i) =>
    mov({ fecha: '2026-03-01', comentario: `viaje ${i}` }));

  assert.equal(comentariosUsados(muchos).length, 1200);
});

// ── Sugerencias (T-920) ──────────────────────────────────────────────────────

test('con el campo vacío no se sugiere nada', () => {
  assert.deepEqual(sugerenciasPara('', ['Roma', 'Barcelona26']), []);
  assert.deepEqual(sugerenciasPara('   ', ['Roma']), []);
});

test('se sugiere lo que empieza con lo escrito', () => {
  assert.deepEqual(sugerenciasPara('Barce', ['Roma', 'Barcelona26']), ['Barcelona26']);
});

test('sin importar mayúsculas ni espacios de más', () => {
  // Si hubiera que acertar las mayúsculas, el autocompletado no serviría para lo
  // único que sirve (RN-03).
  assert.deepEqual(sugerenciasPara('barce', ['Barcelona26']), ['Barcelona26']);
  assert.deepEqual(sugerenciasPara('  BARCE ', ['Barcelona26']), ['Barcelona26']);
});

test('lo que empieza va antes que lo que contiene', () => {
  // Escribir "Roma" y ver "Aeropuerto de Roma" antes que "Roma" sería
  // contraintuitivo.
  assert.deepEqual(
    sugerenciasPara('roma', ['Aeropuerto de Roma', 'Roma sur', 'Roma']),
    ['Roma sur', 'Roma', 'Aeropuerto de Roma']
  );
});

test('lo ya escrito entero no se sugiere a sí mismo', () => {
  assert.deepEqual(sugerenciasPara('Roma', ['Roma']), []);
});

test('se sugieren pocas: una lista larga tapa el formulario en un celular', () => {
  const muchos = Array.from({ length: 40 }, (_, i) => `viaje ${i}`);

  assert.equal(sugerenciasPara('viaje', muchos).length, 5);
  assert.equal(sugerenciasPara('viaje', muchos, 3).length, 3);
});

test('los detalles usados salen igual que los comentarios', () => {
  const estado = estadoCon([
    mov({ fecha: '2026-03-01', comentario: 'Roma' }),
    mov({ fecha: '2026-03-05', comentario: 'Roma' }),
  ]);
  estado.movimientos[0].detalle = 'alquiler';
  estado.movimientos[1].detalle = 'luz';

  assert.deepEqual(detallesUsados(estado.movimientos), ['luz', 'alquiler']);
});
