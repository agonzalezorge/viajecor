// T-040/T-042 — Tests de los ahorros conjuntos (CU-14).
//
// La regla que hace distinto a este módulo es una sola y hay que sostenerla:
// **no se convierte nada a euros**. Un plazo fijo en pesos uruguayos es un plazo
// fijo en pesos uruguayos, y el total general que juntaría las monedas **no
// existe a propósito**. La mitad de estos tests están para que ese número no
// aparezca nunca.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  crearAhorro, totalPorMoneda, totalPorPersona, ahorrosOrdenados, aporteDe,
  monedaDeLaPlanilla, personaDeLaPlanilla, tipoDeLaPlanilla,
  PERSONAS, AHORRO_ENTRA, AHORRO_SALE,
} from '../src/core/ahorros.js';
import {
  esFilaDeAhorro, interpretarFilaDeAhorro, interpretarAhorros, idDeFilaDeAhorro,
  compararConLaPlanilla, HOJA_DE_AHORROS,
} from '../src/datos/importar-ahorros.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { contenidoDelRespaldo } from '../src/datos/exportar.js';
import { dibujarProblemas, dibujarQueEntra, NUEVOS_QUE_SE_MUESTRAN } from '../src/ui/pantallas/datos.js';

const MONEDAS = monedasIniciales();
let contador = 0;
const aho = ({ monto = '10', moneda = 'EUR', persona = 'ALE', tipo = 'I', fecha = '2026-05-01', comentario = '', detalle = '' }) => {
  contador += 1;
  return crearAhorro({ monto, moneda, persona, tipo, fecha, comentario, detalle },
    { decimales: 2, id: `aho_${contador}` });
};


// ── Qué es un movimiento de ahorro ───────────────────────────────────────────

test('la plata que entra suma y la que sale resta', () => {
  assert.equal(aporteDe(aho({ monto: '100', tipo: 'I' })), 10000);
  assert.equal(aporteDe(aho({ monto: '100', tipo: 'G' })), -10000);
});

test('el monto se guarda en unidades mínimas, como todo el dinero de la app', () => {
  // ADR-005: nunca decimales. 1500,50 dólares son 150050 centavos.
  assert.equal(aho({ monto: '1500,50', moneda: 'USD' }).monto, 150050);
});

test('sin saber los decimales de la moneda no se guarda nada', () => {
  // El mismo número escrito con dos decimales o con cero es cien veces otro.
  assert.throws(() => crearAhorro({ monto: '10', moneda: 'EUR', persona: 'ALE', tipo: 'I', fecha: '2026-05-01' }, {}),
    /decimales/);
});

test('un movimiento de cero no se guarda', () => {
  assert.throws(() => aho({ monto: '0' }), /cero no se guarda/);
});

test('la persona y el tipo se comparan normalizados', () => {
  // La planilla tiene "ALE", "ale" y hasta un "i" minúscula (fila 14).
  assert.equal(aho({ persona: 'ale' }).persona, 'ALE');
  assert.equal(aho({ persona: ' Ire ' }).persona, 'IRE');
  assert.equal(aho({ tipo: 'i' }).tipo, AHORRO_ENTRA);
  assert.equal(aho({ tipo: 'g' }).tipo, AHORRO_SALE);
});

test('una persona que no es de las dos no entra', () => {
  assert.throws(() => aho({ persona: 'JUAN' }), /no es una de las dos personas/);
  assert.deepEqual(PERSONAS, ['ALE', 'IRE']);
});

test('el detalle es texto libre y se guarda tal cual', () => {
  // El usuario fue explícito: "plazo fijo" es información suya para leer, no una
  // categoría que la app agrupe (2026-08-31).
  assert.equal(aho({ detalle: 'Plazo fijo, vence 28/08/26' }).detalle, 'Plazo fijo, vence 28/08/26');
});


// ── Los totales, y el que NO existe ──────────────────────────────────────────

const TRES_MONEDAS = () => ({ ahorros: [
  aho({ monto: '1500,50', moneda: 'USD', persona: 'ALE', tipo: 'I' }),
  aho({ monto: '800', moneda: 'EUR', persona: 'ALE', tipo: 'I' }),
  aho({ monto: '800', moneda: 'EUR', persona: 'IRE', tipo: 'I' }),
  aho({ monto: '320,25', moneda: 'EUR', persona: 'ALE', tipo: 'G' }),
  aho({ monto: '40000', moneda: 'UYU', persona: 'ALE', tipo: 'I' }),
  aho({ monto: '12000', moneda: 'UYU', persona: 'ALE', tipo: 'G' }),
]});

test('hay un total por moneda, de la que más tiene a la que menos', () => {
  assert.deepEqual(totalPorMoneda(TRES_MONEDAS()).map((m) => [m.moneda, m.total]),
    [['UYU', 2800000], ['USD', 150050], ['EUR', 127975]]);
});

test('NO hay ningún total que junte monedas, y eso es el resultado correcto', () => {
  // Sumar pesos con euros exige convertir, y convertir inventa un número que no
  // existe hasta que la plata se cambie de verdad. Si algún día alguien agrega
  // ese total, este test tiene que ponerse en rojo.
  const resultado = totalPorMoneda(TRES_MONEDAS());
  assert.ok(Array.isArray(resultado), 'devuelve una lista por moneda, no un objeto con un total');
  assert.equal(resultado.some((m) => m.moneda === 'TOTAL' || m.moneda === undefined), false);
});

test('las dos personas aparecen siempre, aunque una no tenga nada en esa moneda', () => {
  // Un cero dice "no tiene". Una fila que falta no dice nada.
  const porPersona = totalPorMoneda(TRES_MONEDAS()).length;
  const uyu = totalPorPersona(TRES_MONEDAS()).find((m) => m.moneda === 'UYU');

  assert.equal(porPersona, 3);
  assert.deepEqual(uyu.personas, [{ persona: 'ALE', total: 2800000 }, { persona: 'IRE', total: 0 }]);
});

test('lo de cada persona suma el total de esa moneda', () => {
  // Es la comprobación que la planilla del usuario NO puede hacer: sus tres
  // cuadros suman rangos distintos ($E4:$E89, $E4:$E93, $E4:$E97) y pasadas las
  // 89 filas dejan de cerrar entre sí sin decir nada (L-001).
  for (const { total, personas } of totalPorPersona(TRES_MONEDAS())) {
    assert.equal(personas.reduce((t, p) => t + p.total, 0), total);
  }
});

test('una moneda que quedó en cero sigue en la lista', () => {
  const estado = { ahorros: [
    aho({ monto: '100', moneda: 'USD', tipo: 'I' }),
    aho({ monto: '100', moneda: 'USD', tipo: 'G' }),
  ]};
  assert.deepEqual(totalPorMoneda(estado).map((m) => [m.moneda, m.total]), [['USD', 0]]);
});

test('sin ahorros, ninguna lista y ningún error', () => {
  assert.deepEqual(totalPorMoneda({}), []);
  assert.deepEqual(totalPorMoneda(undefined), []);
  assert.deepEqual(totalPorPersona({ ahorros: [] }), []);
});

test('el historial va del más nuevo al más viejo', () => {
  const estado = { ahorros: [
    aho({ monto: '1', fecha: '2025-08-27' }),
    aho({ monto: '2', fecha: '2026-05-15' }),
    aho({ monto: '3', fecha: '2025-10-20' }),
  ]};
  assert.deepEqual(ahorrosOrdenados(estado).map((a) => a.fecha),
    ['2026-05-15', '2025-10-20', '2025-08-27']);
});


// ── Traducir lo que dice la planilla ─────────────────────────────────────────

test('las monedas de la planilla se reconocen, con tilde y sin tilde', () => {
  // La hoja dice DÓLARES; el mapa dice dolares. Son la misma palabra, y hacerlo
  // con dos entradas en el mapa serían dos listas que un día se separan.
  assert.equal(monedaDeLaPlanilla('DÓLARES'), 'USD');
  assert.equal(monedaDeLaPlanilla('dolares'), 'USD');
  assert.equal(monedaDeLaPlanilla('EUROS'), 'EUR');
  assert.equal(monedaDeLaPlanilla('euros'), 'EUR');
  assert.equal(monedaDeLaPlanilla('PESOS UY'), 'UYU');
  assert.equal(monedaDeLaPlanilla('  pesos   uy '), 'UYU');
});

test('una moneda que no se reconoce devuelve null, no una moneda cualquiera', () => {
  // Meter plata en la moneda equivocada es peor que no importar la fila.
  assert.equal(monedaDeLaPlanilla('YENES'), null);
  assert.equal(monedaDeLaPlanilla(''), null);
  assert.equal(monedaDeLaPlanilla(undefined), null);
});

test('la persona y el I/G se traducen, y lo que no se entiende es null', () => {
  assert.equal(personaDeLaPlanilla('ale'), 'ALE');
  assert.equal(personaDeLaPlanilla('IRE'), 'IRE');
  assert.equal(personaDeLaPlanilla('otro'), null);
  assert.equal(tipoDeLaPlanilla('I'), AHORRO_ENTRA);
  assert.equal(tipoDeLaPlanilla('g'), AHORRO_SALE);
  assert.equal(tipoDeLaPlanilla('X'), null);
});


// ── Importar la hoja ─────────────────────────────────────────────────────────

const celdas = (valores) => new Map(Object.entries(valores).map(([c, v]) => [c, { valor: v }]));

// 45896 es el 27 de agosto de 2025 en el calendario de Excel.
const FILA_BUENA = () => celdas({
  A: 'Regalos de invitados. PF vence 28/08/26', B: 45896, C: '', D: 'DÓLARES',
  E: 1500.5, F: 'ALE', G: 'I',
});

test('la hoja se busca por su nombre, que es el de la pestaña', () => {
  assert.equal(HOJA_DE_AHORROS, 'Ahorros conjuntos');
});

test('una fila con fecha y persona es un movimiento', () => {
  assert.equal(esFilaDeAhorro(FILA_BUENA()), true);
});

test('el encabezado NO es una fila de datos, aunque tenga texto en todas partes', () => {
  // Es lo que lo delata: en la columna del día dice "DÍA", que no es una fecha.
  // La primera versión lo dejaba pasar y lo informaba como "moneda MONEDA".
  assert.equal(esFilaDeAhorro(celdas({
    A: 'Comentarios', B: 'DÍA', C: 'DETALLES', D: 'MONEDA', E: 'MONTO', F: 'ALE / IRE', G: 'I/G',
  })), false);
});

test('las filas en blanco del medio se saltean solas', () => {
  assert.equal(esFilaDeAhorro(celdas({ A: '', B: '', D: '' })), false);
  assert.equal(esFilaDeAhorro(undefined), false);
});

test('una fila buena se traduce entera', () => {
  const { ahorro, problema } = interpretarFilaDeAhorro(4, FILA_BUENA(), MONEDAS);

  assert.equal(problema, undefined);
  assert.equal(ahorro.fecha, '2025-08-27');
  assert.equal(ahorro.moneda, 'USD');
  assert.equal(ahorro.persona, 'ALE');
  assert.equal(ahorro.tipo, AHORRO_ENTRA);
  assert.equal(ahorro.monto, 150050);
  assert.match(ahorro.comentario, /Regalos de invitados/);
});

test('cada fila que no entra sale con su número, lo que decía y por qué', () => {
  // Se importa UNA VEZ, sobre datos que no están en ningún otro lado. Un
  // importador que se calla lo que descartó repite el error que la app vino a
  // arreglar (RN-05, L-001).
  const casos = [
    [celdas({ B: 45896, D: 'YENES', E: 50, F: 'ALE', G: 'I' }), /no se reconoce la moneda "YENES"/],
    [celdas({ B: 45896, D: 'EUROS', E: 10, F: '', G: 'I' }), /no dice de quién es/],
    [celdas({ B: 45896, D: 'EUROS', E: 10, F: 'ALE', G: 'X' }), /no es ni I ni G/],
    [celdas({ B: 45896, D: 'EUROS', E: '', F: 'ALE', G: 'I' }), /no tiene monto/],
  ];

  for (const [fila, esperado] of casos) {
    const { ahorro, problema } = interpretarFilaDeAhorro(7, fila, MONEDAS);
    assert.equal(ahorro, undefined);
    assert.equal(problema.fila, 7);
    assert.match(problema.motivo, esperado);
  }
});

test('dos filas iguales son dos movimientos distintos', () => {
  // Mismo día, misma persona, mismo importe: poner plata dos veces el mismo día
  // pasa. Sin el número de fila adentro del identificador, la segunda se
  // descartaría como repetida al importar.
  const crudo = { persona: 'ALE', moneda: 'EUROS', comentario: 'Para viajes' };
  assert.notEqual(idDeFilaDeAhorro(6, crudo, 800, '2025-08-31'),
    idDeFilaDeAhorro(7, crudo, 800, '2025-08-31'));
});

test('la misma fila da siempre el mismo identificador', () => {
  // Es lo que hace que importar dos veces la planilla no duplique la plata.
  const crudo = { persona: 'ALE', moneda: 'EUROS', comentario: 'Para viajes' };
  assert.equal(idDeFilaDeAhorro(6, crudo, 800, '2025-08-31'),
    idDeFilaDeAhorro(6, crudo, 800, '2025-08-31'));
});

test('la hoja entera: entran las buenas, se informan las otras', () => {
  const filas = new Map([
    [3, celdas({ A: 'Comentarios', B: 'DÍA', D: 'MONEDA', E: 'MONTO', F: 'ALE / IRE', G: 'I/G' })],
    [4, FILA_BUENA()],
    [5, celdas({ A: 'Para viajes', B: 45900, D: 'EUROS', E: 800, F: 'IRE', G: 'i' })],
    [6, celdas({ A: '', B: '', D: '' })],
    [7, celdas({ A: 'Regalo Ivo', B: 45900, D: 'YENES', E: 50, F: 'ALE', G: 'I' })],
  ]);

  const { ahorros, problemas } = interpretarAhorros(filas, MONEDAS);

  assert.deepEqual(ahorros.map((a) => a.moneda), ['USD', 'EUR']);
  assert.deepEqual(problemas.map((p) => p.fila), [7]);
});

test('se compara el total de cada moneda contra el cuadro de la planilla', () => {
  // La única oportunidad de contrastar con un número calculado por otra
  // herramienta: después la planilla se archiva y no queda con qué comparar.
  const filas = new Map([
    [3, celdas({ I: 'DÓLARES', J: 'EUROS', K: 'PESOS UY' })],
    [4, celdas({ I: 1500.5, J: 800, K: 0 })],
  ]);
  const ahorros = [
    aho({ monto: '1500,50', moneda: 'USD' }),
    aho({ monto: '790', moneda: 'EUR' }),
  ];

  const comprobaciones = compararConLaPlanilla(ahorros, filas);

  assert.deepEqual(comprobaciones.find((c) => c.moneda === 'USD'),
    { moneda: 'USD', nuestro: 150050, planilla: 150050, cuadra: true });
  assert.deepEqual(comprobaciones.find((c) => c.moneda === 'EUR'),
    { moneda: 'EUR', nuestro: 79000, planilla: 80000, cuadra: false });
});


// ── Que no se pierdan (L-031) ────────────────────────────────────────────────

test('los ahorros entran al respaldo', () => {
  const estado = { ...estadoInicial({ monedas: MONEDAS }), ahorros: [aho({ monto: '100' })] };
  const leido = JSON.parse(contenidoDelRespaldo(estado, { fecha: '2026-08-31' }));

  assert.equal(leido.ahorros.length, 1);
  assert.equal(leido.ahorros[0].monto, 10000);
});

test('sobreviven a guardar y volver a leer', () => {
  const estado = { ...estadoInicial({ monedas: MONEDAS }), ahorros: [aho({ monto: '100', persona: 'IRE' })] };
  const leido = migrarEstado(JSON.parse(JSON.stringify(estado)));

  assert.equal(leido.ahorros.length, 1);
  assert.equal(leido.ahorros[0].persona, 'IRE');
});

test('un ahorro roto se descarta solo y se dice, sin llevarse a los demás', () => {
  const incidencias = [];
  const leido = migrarEstado({
    esquema: 1,
    ahorros: [
      { id: 'a', fecha: '2026-05-01', persona: 'ALE', tipo: 'I', monto: 100, moneda: 'EUR' },
      { id: 'b', fecha: '2026-05-01', persona: 'NADIE', tipo: 'I', monto: 100, moneda: 'EUR' },
      { id: 'c', fecha: '2026-05-01', persona: 'IRE', tipo: 'I', monto: 0, moneda: 'EUR' },
    ],
  }, incidencias);

  assert.deepEqual(leido.ahorros.map((a) => a.id), ['a']);
  assert.equal(incidencias.length, 1);
  assert.match(incidencias[0], /ahorros/);
});

// ── El signo del monto: viene dos veces y hay que resolverlo (0.3.1) ─────────

test('una salida con el monto en negativo entra, con su valor absoluto', () => {
  // Es lo que tiene la planilla del usuario: las filas `G` llevan la G en su
  // columna Y el número en negativo. Las dos dicen lo mismo. La primera versión
  // las rechazaba las cuatro, con un mensaje pensado para los gastos.
  const { ahorro, problema } = interpretarFilaDeAhorro(9,
    celdas({ A: 'Vuelos Roma', B: 45950, D: 'PESOS UY', E: -12000, F: 'ALE', G: 'G' }), MONEDAS);

  assert.equal(problema, undefined);
  assert.equal(ahorro.monto, 1200000, 'el monto se guarda sin signo');
  assert.equal(ahorro.tipo, AHORRO_SALE);
  assert.equal(aporteDe(ahorro), -1200000, 'y resta, porque la G dice que salió');
});

test('lo mismo si el monto vino escrito como texto', () => {
  const { ahorro } = interpretarFilaDeAhorro(9,
    celdas({ B: 45950, D: 'EUROS', E: '-320,25', F: 'IRE', G: 'G' }), MONEDAS);

  assert.equal(ahorro.monto, 32025);
});

test('un negativo marcado como ENTRADA se contradice, y no se adivina', () => {
  // El número dice una cosa y la columna I/G la contraria. Elegir cualquiera de
  // las dos sería inventar el signo de una operación de dinero.
  const { ahorro, problema } = interpretarFilaDeAhorro(9,
    celdas({ B: 45950, D: 'EUROS', E: -100, F: 'ALE', G: 'I' }), MONEDAS);

  assert.equal(ahorro, undefined);
  assert.match(problema.motivo, /se contradicen/);
});

test('la contradicción se detecta también si el monto vino como texto', () => {
  // Hay celdas escritas a mano en la planilla, y ahí el signo llega como parte
  // del texto. Sin mirarlo, "-100" marcado como entrada se importaba sumando.
  const { ahorro, problema } = interpretarFilaDeAhorro(9,
    celdas({ B: 45950, D: 'EUROS', E: '-100', F: 'ALE', G: 'I' }), MONEDAS);

  assert.equal(ahorro, undefined);
  assert.match(problema.motivo, /se contradicen/);
});

test('cada fila que no entra dice QUÉ DECÍA, no solo por qué no entró', () => {
  // El informe mostraba "Decía: ." — un número de fila sin contexto obliga a
  // abrir la planilla para saber siquiera de qué fila están hablando.
  const { problema } = interpretarFilaDeAhorro(12,
    celdas({ A: 'Regalo Ivo', B: 45900, D: 'YENES', E: 50, F: 'ALE', G: 'I' }), MONEDAS);

  assert.match(problema.decia, /Regalo Ivo/);
  assert.match(problema.decia, /ALE/);
  assert.match(problema.decia, /YENES/);
  assert.match(problema.decia, /50/);
});

test('el informe no escribe dos puntos seguidos ni una frase vacía', () => {
  const html = dibujarProblemas([
    { fila: 9, motivo: 'Un monto no puede ser negativo.', decia: 'Vuelos Roma · ALE' },
    { fila: 10, motivo: 'la fila no tiene monto', decia: '' },
  ]);

  assert.doesNotMatch(html, /\.\./);
  assert.doesNotMatch(html, /Decía: \./);
  assert.match(html, /Vuelos Roma · ALE\./);
});

// ── Ver QUÉ va a entrar antes de importar (T-044) ────────────────────────────

test('la previa lista los movimientos que van a entrar, no solo cuántos', () => {
  // Lo pidió el usuario: la app le dijo "voy a traer 1 movimiento" y no tenía
  // forma de saber cuál. Pasa al reimportar, que es cuando la diferencia es de
  // uno o dos y el que aparece suele ser uno que él había borrado a mano.
  const html = dibujarQueEntra({
    nuevos: [{ fecha: '2026-05-15', rubro: 'salud', tipo: 'G', monto: 4500, moneda: 'EUR',
      comentario: 'Dentista', detalle: 'limpieza' }],
    ahorrosNuevos: [],
  }, { monedas: MONEDAS });

  assert.match(html, /Salud/);
  assert.match(html, /15\/05\/2026/);
  assert.match(html, /45,00/);
  assert.match(html, /Dentista · limpieza/);
  assert.match(html, /el que va a entrar/);
});

test('los ahorros también se listan, y se ve de quién son', () => {
  const html = dibujarQueEntra({
    nuevos: [],
    ahorrosNuevos: [aho({ monto: '12000', moneda: 'UYU', persona: 'ALE', tipo: 'G',
      fecha: '2025-10-20', comentario: 'Vuelos Roma' })],
  }, { monedas: MONEDAS });

  assert.match(html, /Ahorro · ALE/);
  assert.match(html, /Vuelos Roma/);
  assert.match(html, /−/, 'la G es plata que salió');
});

test('cada importe va en SU moneda, no en euros', () => {
  const html = dibujarQueEntra({
    nuevos: [],
    ahorrosNuevos: [aho({ monto: '1500,50', moneda: 'USD', tipo: 'I' })],
  }, { monedas: MONEDAS });

  assert.match(html, /US\$/);
  assert.doesNotMatch(html, /1500,50 €/);
});

test('con pocos, la lista viene abierta; con muchos, plegada', () => {
  // Al reimportar son uno o dos y hay que verlos sin tocar nada. En la primera
  // importación son cientos y abrirlos haría una pantalla inmanejable.
  const uno = { nuevos: [{ fecha: '2026-05-15', rubro: 'salud', tipo: 'G', monto: 100, moneda: 'EUR', comentario: '', detalle: '' }], ahorrosNuevos: [] };
  const muchos = { nuevos: Array.from({ length: 40 }, (_, i) => (
    { fecha: '2026-05-15', rubro: 'salud', tipo: 'G', monto: 100 + i, moneda: 'EUR', comentario: '', detalle: '' })), ahorrosNuevos: [] };

  assert.match(dibujarQueEntra(uno, { monedas: MONEDAS }), /<details class="que-entra" open>/);
  assert.doesNotMatch(dibujarQueEntra(muchos, { monedas: MONEDAS }), / open>/);
});

test('con muchos se muestran los primeros y se dice cuántos quedan', () => {
  const muchos = { nuevos: Array.from({ length: 40 }, (_, i) => (
    { fecha: '2026-05-15', rubro: 'salud', tipo: 'G', monto: 100 + i, moneda: 'EUR', comentario: '', detalle: '' })), ahorrosNuevos: [] };

  const html = dibujarQueEntra(muchos, { monedas: MONEDAS });
  assert.equal((html.match(/<li class="fila-rubro">/g) ?? []).length, NUEVOS_QUE_SE_MUESTRAN);
  assert.match(html, /Y 15 más/);
  assert.match(html, /los 40 que van a entrar/);
});

test('si no entra nada, no hay lista que mostrar', () => {
  assert.equal(dibujarQueEntra({ nuevos: [], ahorrosNuevos: [] }), '');
  assert.equal(dibujarQueEntra({}), '');
});

test('van del más nuevo al más viejo, mezclando gastos y ahorros', () => {
  const html = dibujarQueEntra({
    nuevos: [{ fecha: '2025-01-01', rubro: 'salud', tipo: 'G', monto: 100, moneda: 'EUR', comentario: 'Viejo', detalle: '' }],
    ahorrosNuevos: [aho({ monto: '10', fecha: '2026-06-01', comentario: 'Nuevo' })],
  }, { monedas: MONEDAS });

  assert.ok(html.indexOf('Nuevo') < html.indexOf('Viejo'));
});
