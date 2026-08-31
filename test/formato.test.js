// T-006 — Tests del formateo de montos y fechas.
//
// Formatear parece cosmético y no lo es: un importe mostrado con los decimales
// equivocados, o una fecha corrida un día, el usuario los lee como datos, no
// como fallas de presentación. Y no los va a encontrar ningún test de negocio:
// se encuentran mirando la pantalla y desconfiando. Por eso están estos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  IDIOMA,
  formatearMonto,
  formatearEnSuMoneda,
  formatearEuros,
  formatearNumero,
  formatearFecha,
  formatearFechaLarga,
  formatearDiaSemana,
  formatearMes,
  formatearTipoDeCambio,
} from '../src/core/formato.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// El espacio que Intl pone entre el importe y el símbolo NO es un espacio normal:
// es un espacio duro (U+00A0), para que "12,50" y "€" no queden en renglones
// distintos. Se ve idéntico a un espacio común y `===` dice que no lo es — la
// misma trampa de L-009, ahora del lado de la presentación. Se escribe con su
// código para que el test diga la verdad sobre lo que compara.
const DURO = '\u00A0';

// ── Montos ───────────────────────────────────────────────────────────────────

test('un monto guardado se muestra en formato español', () => {
  assert.equal(formatearEuros(1250), `12,50${DURO}€`);
  assert.equal(formatearEuros(50), `0,50${DURO}€`);
  assert.equal(formatearEuros(0), `0,00${DURO}€`);
  assert.equal(formatearEuros(100000), `1000,00${DURO}€`);
});

test('los miles llevan punto a partir de cinco cifras, no de cuatro', () => {
  // No es un descuido: en español los números de cuatro cifras van SIN separador
  // (1234,56) y a partir de cinco lo llevan (12.345,67). Queda como test para que
  // nadie lo "arregle" creyendo que falta un punto.
  assert.equal(formatearEuros(123456), `1234,56${DURO}€`);
  assert.equal(formatearEuros(1234567), `12.345,67${DURO}€`);
});

test('los decimales los manda el catálogo, no Intl', () => {
  // Intl cree que el yen no tiene decimales. Si lo dejáramos decidir, una moneda
  // que el usuario configuró con dos se mostraría con cero: el número correcto
  // por dentro y la pantalla mintiendo.
  assert.equal(formatearMonto(1500, 0, 'JPY'), `1500${DURO}JPY`);
  assert.equal(formatearMonto(150000, 2, 'JPY'), `1500,00${DURO}JPY`);

  // Y al revés: una moneda con decimales no se recorta.
  assert.equal(formatearMonto(1234567, 2, 'CRC'), `12.345,67${DURO}CRC`);
});

test('un código de moneda inventado se muestra igual, no rompe', () => {
  // El usuario puede agregar la moneda que quiera (ADR-011), incluso una que no
  // exista en ningún estándar. Comprobado: Intl muestra el código tal cual.
  assert.equal(formatearMonto(1250, 2, 'XYZ'), `12,50${DURO}XYZ`);
  assert.equal(formatearMonto(1250, 2, 'xyz'), `12,50${DURO}XYZ`);
});

test('un código de moneda mal escrito se rechaza antes de llegar a Intl', () => {
  // Intl tira un error críptico ("Invalid currency code") con un código de dos
  // letras. Se valida antes, con un mensaje que se entiende.
  assert.throws(() => formatearMonto(1250, 2, 'EU'), /tres letras/);
  assert.throws(() => formatearMonto(1250, 2, 'EUROS'), /tres letras/);
});

test('formatearNumero deja el monto sin moneda, para las tablas', () => {
  assert.equal(formatearNumero(1234567, 2), '12.345,67');
  assert.equal(formatearNumero(1500, 0), '1500');
});

test('formatear no acepta un monto que no sea entero', () => {
  // Los montos se guardan en enteros (ADR-005). Un decimal acá significa que
  // alguien se saltó esa regla en algún lado.
  assert.throws(() => formatearEuros(12.5), /entero/);
  assert.throws(() => formatearMonto(12.5, 2, 'EUR'), /entero/);
});

// ── Fechas: el desfase de zona horaria ───────────────────────────────────────

test('la fecha NO se corre de día en una zona horaria negativa', () => {
  // Este es el test que justifica todo el manejo de fechas del módulo.
  //
  // new Date('2026-03-14') es la medianoche UTC. Mostrada en Montevideo (UTC−3)
  // son las 21:00 del día 13, así que la app diría 13/03/2026 — un día menos.
  // No es hipotético: el usuario tiene gastos y ahorros en pesos uruguayos.
  //
  // Se corre en un proceso aparte porque la zona horaria se fija al arrancar.
  const guion = `
    import { formatearFecha, formatearDiaSemana } from ${JSON.stringify(join(RAIZ, 'src/core/formato.js'))};
    console.log(JSON.stringify({
      ingenuo: new Intl.DateTimeFormat('es-ES').format(new Date('2026-03-14')),
      nuestro: formatearFecha('2026-03-14'),
      dia: formatearDiaSemana('2026-03-14'),
    }));
  `;

  for (const zona of ['America/Montevideo', 'Europe/Madrid', 'Pacific/Kiritimati', 'Pacific/Niue', 'UTC']) {
    const salida = execFileSync(process.execPath, ['--input-type=module', '--eval', guion], {
      env: { ...process.env, TZ: zona },
      encoding: 'utf8',
    });
    const { nuestro, dia } = JSON.parse(salida);
    assert.equal(nuestro, '14/03/2026', `la fecha se corrió en ${zona}`);
    assert.equal(dia, 'sábado', `el día de la semana se corrió en ${zona}`);
  }
});

test('y se comprueba que el peligro era real, no imaginado', () => {
  // Si esta comprobación dejara de fallar, sería porque Node cambió de
  // comportamiento — y entonces el cuidado del módulo habría dejado de tener
  // sentido, que también es algo que conviene enterarse.
  const guion = `console.log(new Intl.DateTimeFormat('es-ES').format(new Date('2026-03-14')));`;
  const ingenuo = execFileSync(process.execPath, ['--eval', guion], {
    env: { ...process.env, TZ: 'America/Montevideo' },
    encoding: 'utf8',
  }).trim();

  assert.equal(ingenuo, '13/3/2026', 'la forma ingenua ya no se corre de día');
});

// ── Fechas: formatos ─────────────────────────────────────────────────────────

test('la fecha corta lleva día y mes de dos dígitos', () => {
  // Ancho fijo: en una lista las fechas se leen en columna.
  assert.equal(formatearFecha('2026-03-14'), '14/03/2026');
  assert.equal(formatearFecha('2026-01-01'), '01/01/2026');
  assert.equal(formatearFecha('2025-12-31'), '31/12/2025');
});

test('la fecha larga se lee como se habla', () => {
  assert.equal(formatearFechaLarga('2026-03-14'), '14 de marzo de 2026');
  assert.equal(formatearFechaLarga('2026-01-01'), '1 de enero de 2026');
  assert.equal(formatearFechaLarga('2025-12-31'), '31 de diciembre de 2025');
});

test('el mes es el título de la pantalla del mes', () => {
  assert.equal(formatearMes('2026-03'), 'marzo de 2026');
  assert.equal(formatearMes('2025-10'), 'octubre de 2025');
  assert.equal(formatearMes('2026-12'), 'diciembre de 2026');
});

test('los doce meses están y en orden', () => {
  const nombres = Array.from({ length: 12 }, (unused, i) =>
    formatearMes(`2026-${String(i + 1).padStart(2, '0')}`).split(' de ')[0]
  );
  assert.deepEqual(nombres, [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]);
});

test('una fecha o un mes inválidos se rechazan, no se muestran torcidos', () => {
  for (const mala of ['2026-02-30', '14/03/2026', '2026-3-14', '', null]) {
    assert.throws(() => formatearFecha(mala));
    assert.throws(() => formatearFechaLarga(mala));
  }
  for (const malo of ['2026-13', 'marzo', '2026', '', null, '2026-00']) {
    assert.throws(() => formatearMes(malo), /mes/i);
  }
});

test('el día de la semana sale en español', () => {
  assert.equal(formatearDiaSemana('2026-03-14'), 'sábado');
  assert.equal(formatearDiaSemana('2026-03-16'), 'lunes');
});

// ── Tipo de cambio ───────────────────────────────────────────────────────────

test('el tipo de cambio se muestra como lo conoce el usuario', () => {
  // Por dentro se guarda como euros por unidad (0,001587), que en pantalla no le
  // dice nada a nadie. Se muestra al revés: el número de la casa de cambio.
  assert.equal(formatearTipoDeCambio(0.001587, 'CRC'), '1 EUR = 630,12 CRC');
});

test('un tipo de cambio cercano a uno muestra más decimales', () => {
  // Con dos decimales, 1,085 y 1,089 dólares por euro se verían iguales — y en
  // un mes de gastos esa diferencia son varios euros.
  assert.equal(formatearTipoDeCambio(0.92, 'USD'), '1 EUR = 1,0870 USD');
  assert.equal(formatearTipoDeCambio(0.0062, 'JPY'), '1 EUR = 161,29 JPY');
});

test('un tipo de cambio imposible se rechaza', () => {
  for (const malo of [0, -1, NaN, Infinity, 'mucho', null]) {
    assert.throws(() => formatearTipoDeCambio(malo, 'CRC'), /mayor que cero/);
  }
});

// ── El idioma ────────────────────────────────────────────────────────────────

test('todo se formatea en español de España', () => {
  assert.equal(IDIOMA, 'es-ES');
  // La coma decimal es lo que distingue: en inglés sería "12.50".
  assert.ok(formatearEuros(1250).includes(','));
});

// ── Cada importe en SU moneda (T-044) ────────────────────────────────────────

test('formatearEnSuMoneda usa los decimales de esa moneda, no siempre dos', () => {
  // El yen usa cero. Mostrar "¥1.500,00" es mostrar un número que no existe.
  const monedas = [
    { codigo: 'EUR', nombre: 'Euro', decimales: 2 },
    { codigo: 'JPY', nombre: 'Yen', decimales: 0 },
  ];

  // Con cuatro cifras el español no lleva separador de miles, así que se usan
  // cinco: si no, el test pasaría por el motivo equivocado.
  assert.match(formatearEnSuMoneda(1500050, 'EUR', monedas), /15\.000,50/);
  assert.match(formatearEnSuMoneda(15000, 'JPY', monedas), /15\.000/);
  assert.doesNotMatch(formatearEnSuMoneda(15000, 'JPY', monedas), /15\.000,00/);
});

test('una moneda que no está en el catálogo se muestra igual, con dos decimales', () => {
  // Puede pasar con un respaldo viejo o una moneda borrada. Una pantalla en
  // blanco es peor que un importe con dos decimales de más.
  assert.match(formatearEnSuMoneda(1500050, 'USD', []), /15\.000,50/);
  assert.match(formatearEnSuMoneda(1500050, 'USD', undefined), /15\.000,50/);
});
