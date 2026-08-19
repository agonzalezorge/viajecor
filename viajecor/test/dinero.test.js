// T-002 — Tests de la aritmética de dinero.
//
// Es el módulo del que dependen todos los números de la app: si acá hay un error
// de un céntimo, aparece multiplicado en cada total. Por eso los casos incluyen
// las trampas conocidas y no solo el camino feliz.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAXIMO,
  unidadMinima,
  redondear,
  validarMonto,
  aMinimas,
  aNumero,
  sumar,
  convertirAEuros,
  invertirCambio,
  promediar,
} from '../src/core/dinero.js';

// ── La razón de ser del módulo ───────────────────────────────────────────────

test('0,10 + 0,20 da exactamente 0,30 (con decimales no daría)', () => {
  // El problema que motiva guardar el dinero en enteros: en coma flotante,
  // 0.1 + 0.2 da 0.30000000000000004.
  assert.notEqual(0.1 + 0.2, 0.3);

  const diez = aMinimas('0,10', 2);
  const veinte = aMinimas('0,20', 2);
  assert.equal(sumar([diez, veinte]), 30);
  assert.equal(aNumero(30, 2), 0.3);
});

test('sumar muchos importes con céntimos cierra exacto', () => {
  // 1000 veces 0,01 tiene que dar 10,00 clavados.
  const centavos = Array(1000).fill(aMinimas('0,01', 2));
  assert.equal(sumar(centavos), 1000);
  assert.equal(aNumero(sumar(centavos), 2), 10);
});

// ── Redondeo ─────────────────────────────────────────────────────────────────

test('redondea hacia arriba y hacia abajo según corresponde', () => {
  assert.equal(redondear(2.4), 2);
  assert.equal(redondear(2.6), 3);
  assert.equal(redondear(2.5), 3);
});

test('el medio redondea igual para positivos y negativos', () => {
  // Math.round(-2.5) da -2, que rompería la simetría. Un saldo mensual puede
  // ser negativo, así que la regla no puede depender del signo.
  assert.equal(redondear(2.5), 3);
  assert.equal(redondear(-2.5), -3);
  assert.equal(Math.round(-2.5), -2, 'esto documenta por qué no usamos Math.round');
});

test('redondear rechaza lo que no es un número', () => {
  assert.throws(() => redondear(NaN), /No se puede redondear/);
  assert.throws(() => redondear(Infinity), /No se puede redondear/);
});

// ── Unidad mínima y decimales ────────────────────────────────────────────────

test('la unidad mínima sale de los decimales de la moneda', () => {
  assert.equal(unidadMinima(2), 100); // euro: céntimos
  assert.equal(unidadMinima(0), 1);   // yen: no tiene fracción
  assert.equal(unidadMinima(3), 1000);
});

test('unos decimales imposibles se rechazan', () => {
  assert.throws(() => unidadMinima(-1), /entero de 0 a 4/);
  assert.throws(() => unidadMinima(2.5), /entero de 0 a 4/);
  assert.throws(() => unidadMinima('2'), /entero de 0 a 4/);
});

// ── Monedas sin decimales ────────────────────────────────────────────────────

test('una moneda sin decimales guarda el importe tal cual', () => {
  assert.equal(aMinimas('1500', 0), 1500); // 1500 yenes son 1500 unidades
  assert.equal(aNumero(1500, 0), 1500);
});

test('escribir céntimos en una moneda que no los tiene se rechaza, no se redondea', () => {
  // Redondear en silencio le cambiaría el importe al usuario sin avisarle.
  assert.throws(() => aMinimas('1500,50', 0), /no usa decimales/);
});

test('convertir desde una moneda sin decimales da céntimos de euro', () => {
  // 1500 yenes a 0,0062 €/yen = 9,30 € = 930 céntimos.
  assert.equal(convertirAEuros(1500, 0, 0.0062), 930);
});

// ── Montos negativos ─────────────────────────────────────────────────────────

test('un monto negativo se rechaza', () => {
  // El signo lo da el tipo del movimiento (gasto o ingreso), no el número.
  assert.throws(() => validarMonto(-1), /no puede ser negativo/);
  assert.throws(() => aMinimas('-12,50', 2), /no puede ser negativo/);
  assert.throws(() => aMinimas(-3, 2), /no puede ser negativo/);
});

test('un monto que no es entero se rechaza como valor guardado', () => {
  assert.throws(() => validarMonto(12.5), /número entero/);
});

test('un monto absurdamente grande se rechaza', () => {
  assert.throws(() => validarMonto(MAXIMO + 10), /demasiado grande/);
});

// ── Interpretar lo que escribe el usuario ────────────────────────────────────

test('acepta coma y punto como separador decimal', () => {
  assert.equal(aMinimas('12,50', 2), 1250);
  assert.equal(aMinimas('12.50', 2), 1250);
  assert.equal(aMinimas('12,5', 2), 1250);
  assert.equal(aMinimas('12', 2), 1200);
});

test('interpreta los separadores de miles de las dos convenciones', () => {
  assert.equal(aMinimas('1.234,56', 2), 123456); // convención española
  assert.equal(aMinimas('1,234.56', 2), 123456); // convención inglesa
  assert.equal(aMinimas('1.234.567,89', 2), 123456789);
});

test('un separador solo con tres dígitos detrás es ambiguo y se rechaza', () => {
  // "1.234" y "12,345" tienen la misma forma y dos lecturas posibles. Elegir
  // una en silencio se equivoca por mil veces en el dinero de alguien. Ver
  // ADR-012: preguntar molesta una vez, equivocarse corrompe un total.
  assert.throws(() => aMinimas('1.234', 2), /dos formas/);
  assert.throws(() => aMinimas('12,345', 2), /dos formas/);
});

test('el mensaje de ambigüedad ofrece las dos lecturas', () => {
  // Un error que no dice qué hacer es casi tan malo como no avisar.
  assert.throws(() => aMinimas('1.234', 2), (e) => {
    assert.match(e.message, /1234 enteros/);
    assert.match(e.message, /dos decimales/);
    return true;
  });
});

test('con más de un separador ya no hay ambigüedad', () => {
  // Un número no puede tener dos separadores decimales, así que la duda se
  // disuelve sola.
  assert.equal(aMinimas('1.234.567', 2), 123456700);
  assert.equal(aMinimas('1.234,56', 2), 123456);
});

test('unos separadores de miles mal agrupados se rechazan', () => {
  assert.throws(() => aMinimas('1.2345', 2), /de a tres dígitos/);
  assert.throws(() => aMinimas('12.34.567', 2), /de a tres dígitos/);
});

test('acepta un importe sin parte entera', () => {
  assert.equal(aMinimas(',50', 2), 50);
  assert.equal(aMinimas('0,50', 2), 50);
});

test('rechaza lo que no es un monto', () => {
  assert.throws(() => aMinimas('', 2), /Falta el monto/);
  assert.throws(() => aMinimas('   ', 2), /Falta el monto/);
  assert.throws(() => aMinimas('doce euros', 2), /solo se aceptan números/);
  assert.throws(() => aMinimas('12€', 2), /solo se aceptan números/);
  assert.throws(() => aMinimas(null, 2), /No se puede leer/);
  assert.throws(() => aMinimas(NaN, 2), /no es un monto/);
});

test('rechaza más decimales de los que la moneda admite', () => {
  // Con una moneda de 2 decimales, "12,345" ya choca antes con la regla de
  // ambigüedad; este guard se alcanza cuando la moneda usa menos decimales que
  // los que el usuario escribió.
  assert.throws(() => aMinimas('12,34', 1), /usa 1 decimal,/);
  assert.equal(aMinimas('12,3', 1), 123);
});

test('ignora los espacios sobrantes', () => {
  assert.equal(aMinimas('  12,50  ', 2), 1250);
  assert.equal(aMinimas('1 234,56', 2), 123456);
});

// ── Conversión de moneda ─────────────────────────────────────────────────────

test('un importe en euros no cambia al convertirse', () => {
  assert.equal(convertirAEuros(1250, 2, 1), 1250);
});

test('convierte usando el tipo de cambio del mes', () => {
  // 10.000 colones a 0,00164 €/colón = 16,40 € = 1640 céntimos.
  assert.equal(convertirAEuros(1000000, 2, 0.00164), 1640);
});

test('el redondeo de la conversión ocurre una sola vez, al final', () => {
  // Tres importes que por separado redondearían a 3, 3 y 3 céntimos (9 en
  // total) pero cuya suma real es 3,33+3,33+3,33 = 9,99 → 10 céntimos.
  // Convertimos la suma, no las partes: es la única forma de no acumular error.
  const tasa = 0.0333;
  const unidades = 100; // 1,00 de la moneda extranjera
  const sumaConvertida = convertirAEuros(unidades * 3, 2, tasa);
  const convertidasPorSeparado = sumar([
    convertirAEuros(unidades, 2, tasa),
    convertirAEuros(unidades, 2, tasa),
    convertirAEuros(unidades, 2, tasa),
  ]);
  assert.equal(sumaConvertida, 10);
  assert.equal(convertidasPorSeparado, 9);
  assert.notEqual(sumaConvertida, convertidasPorSeparado);
});

test('un tipo de cambio inválido se rechaza', () => {
  assert.throws(() => convertirAEuros(1000, 2, 0), /mayor que cero/);
  assert.throws(() => convertirAEuros(1000, 2, -1), /mayor que cero/);
  assert.throws(() => convertirAEuros(1000, 2, NaN), /mayor que cero/);
});

test('invertir el tipo de cambio da el sentido que se guarda', () => {
  // El usuario sabe "1 euro son 610 colones"; se guarda "1 colón son X euros".
  const eurosPorColon = invertirCambio(610);
  assert.ok(Math.abs(eurosPorColon - 0.001639) < 0.000001);
  // 10.000 colones ≈ 16,39 €
  assert.equal(convertirAEuros(1000000, 2, eurosPorColon), 1639);
});

test('invertir un tipo de cambio inválido se rechaza', () => {
  assert.throws(() => invertirCambio(0), /mayor que cero/);
  assert.throws(() => invertirCambio(-5), /mayor que cero/);
});

// ── Sumar y promediar ────────────────────────────────────────────────────────

test('sumar una lista vacía da cero', () => {
  assert.equal(sumar([]), 0);
});

test('sumar no tiene ningún límite de cantidad de elementos', () => {
  // L-001: el Excel original miente cuando los datos pasan un rango escrito a
  // mano. Acá no hay rango: se pasa la lista entera.
  const muchos = Array(50000).fill(1);
  assert.equal(sumar(muchos), 50000);
});

test('sumar rechaza una lista con algo que no es entero', () => {
  assert.throws(() => sumar([100, 12.5]), /no es entero/);
  assert.throws(() => sumar('100'), /espera una lista/);
});

test('el promedio se redondea una sola vez', () => {
  // 10, 10 y 11 céntimos: promedio real 10,333… → 10
  assert.equal(promediar([10, 10, 11]), 10);
  // 10, 11 y 11: promedio real 10,666… → 11
  assert.equal(promediar([10, 11, 11]), 11);
});

test('el promedio de una lista vacía es cero', () => {
  assert.equal(promediar([]), 0);
});

// ── Ida y vuelta ─────────────────────────────────────────────────────────────

test('lo que se guarda es lo que se lee', () => {
  for (const escrito of ['0,01', '12,50', '1.234,56', '999.999,99']) {
    const guardado = aMinimas(escrito, 2);
    const leido = aNumero(guardado, 2);
    assert.equal(aMinimas(String(leido), 2), guardado, `falló con "${escrito}"`);
  }
});
