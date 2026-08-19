// Aritmética de dinero.
//
// La regla que gobierna todo este archivo: el dinero se guarda como número
// ENTERO en la unidad mínima de su moneda. 12,50 € es 1250. Ver ADR-005.
//
// Por qué: en JavaScript 0.1 + 0.2 da 0.30000000000000004. Sumar cientos de
// gastos con decimales acumula error, y un total que no cierra por un céntimo
// destruye la confianza en todos los demás números. Con enteros, la suma es
// exacta y punto.
//
// Los decimales de cada moneda entran por parámetro: la lista de monedas la
// maneja el usuario (RN-04b, ADR-011), así que este módulo no puede tener una
// tabla propia que se desactualice.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

// Más allá de este valor JavaScript deja de contar enteros de a uno y empieza a
// saltearse números, que es justo lo que veníamos a evitar. Son unos 90 billones
// de euros en céntimos: si un monto lo supera, es un error de carga, no un gasto.
export const MAXIMO = Number.MAX_SAFE_INTEGER;

export const DECIMALES_EURO = 2;

/**
 * Cuántas unidades mínimas entran en una unidad de la moneda.
 * 2 decimales → 100 (céntimos por euro). 0 decimales → 1 (el yen no tiene).
 */
export function unidadMinima(decimales) {
  validarDecimales(decimales);
  return 10 ** decimales;
}

function validarDecimales(decimales) {
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > 4) {
    throw new Error(
      `Los decimales de una moneda tienen que ser un número entero de 0 a 4, y llegó ${JSON.stringify(decimales)}.`
    );
  }
}

/**
 * Redondea al entero más cercano, con el medio siempre hacia arriba en valor
 * absoluto: 2,5 → 3 y -2,5 → -3.
 *
 * Por qué no alcanza Math.round: Math.round(-2.5) da -2, porque redondea hacia
 * el infinito positivo. Eso rompe la simetría — el mismo importe redondearía
 * distinto según su signo. Acá casi todos los montos son positivos, pero un
 * saldo mensual sí puede ser negativo, y una regla que depende del signo es una
 * trampa esperando.
 */
export function redondear(numero) {
  if (!Number.isFinite(numero)) {
    throw new Error(`No se puede redondear ${JSON.stringify(numero)}.`);
  }
  return numero < 0 ? -Math.round(-numero) : Math.round(numero);
}

/**
 * Comprueba que un valor sirva como monto guardado: entero, no negativo y
 * dentro del rango en que JavaScript cuenta bien.
 */
export function validarMonto(minimas) {
  if (!Number.isInteger(minimas)) {
    throw new Error(
      `Un monto se guarda como número entero de unidades mínimas, y llegó ${JSON.stringify(minimas)}.`
    );
  }
  if (minimas < 0) {
    throw new Error(
      'Un monto no puede ser negativo. Si es un gasto, se registra como gasto; el signo lo da el tipo del movimiento, no el número.'
    );
  }
  if (minimas > MAXIMO) {
    throw new Error('El monto es demasiado grande: seguro es un error de carga.');
  }
  return minimas;
}

/**
 * Interpreta lo que el usuario escribió y lo convierte a unidades mínimas.
 *
 * El separador decimal es AMBIGUO en la práctica: en español la coma separa
 * decimales ("12,50") pero los teclados de celular meten punto, y al copiar de
 * un banco pueden venir miles ("1.234,56" o "1,234.56"). Las reglas:
 *
 *   1. El ÚLTIMO punto o coma es el separador decimal si lo siguen 1 o 2
 *      dígitos. Así "12,50", "12.50", "1.234,56" y "1,234.56" dan lo esperado.
 *   2. Los demás separadores son de miles, y tienen que agrupar de a tres.
 *   3. Un único separador seguido de EXACTAMENTE tres dígitos —"1.234",
 *      "12,345"— es genuinamente ambiguo y se RECHAZA pidiendo aclaración.
 *
 * La regla 3 es la importante. "1.234" puede ser mil doscientos treinta y
 * cuatro; "12,345" es casi seguro alguien que quiso escribir 12,34 y se le
 * escapó un dígito. Tienen la misma forma y no hay forma de distinguirlos.
 * Elegir cualquiera de las dos lecturas en silencio significa equivocarse por
 * un factor de mil en el monto de alguien, sin avisarle. Preguntar es molesto
 * una vez; equivocarse acá corrompe un total para siempre. Ver ADR-012.
 */
export function aMinimas(entrada, decimales) {
  validarDecimales(decimales);

  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) {
      throw new Error(`"${entrada}" no es un monto.`);
    }
    return validarMonto(redondear(entrada * unidadMinima(decimales)));
  }

  if (typeof entrada !== 'string') {
    throw new Error(`No se puede leer ${JSON.stringify(entrada)} como un monto.`);
  }

  const limpio = entrada.trim().replace(/\s/g, '');
  if (limpio === '') throw new Error('Falta el monto.');
  if (!/^-?[\d.,]+$/.test(limpio)) {
    throw new Error(`"${entrada}" no es un monto: solo se aceptan números, punto y coma.`);
  }

  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;

  const separadores = sinSigno.match(/[.,]/g) || [];
  const ultimoSeparador = Math.max(sinSigno.lastIndexOf('.'), sinSigno.lastIndexOf(','));
  const digitosDespues = ultimoSeparador === -1 ? -1 : sinSigno.length - ultimoSeparador - 1;
  const hayParteDecimal = digitosDespues === 1 || digitosDespues === 2;

  // Regla 3: un solo separador con tres dígitos detrás no se puede leer.
  if (!hayParteDecimal && separadores.length === 1 && digitosDespues === 3) {
    throw new Error(
      `"${entrada}" se puede leer de dos formas y no quiero adivinar con tu dinero: ` +
      `¿son ${sinSigno.replace(/[.,]/, '')} enteros, o querías escribir dos decimales? ` +
      `Escribilo sin separador de miles, o con dos decimales.`
    );
  }

  const entera = hayParteDecimal ? sinSigno.slice(0, ultimoSeparador) : sinSigno;
  const decimal = hayParteDecimal ? sinSigno.slice(ultimoSeparador + 1) : '';

  // Los separadores que quedan en la parte entera son de miles: tienen que
  // agrupar de a tres exactos. Si no, el número está mal escrito y decirlo es
  // mejor que inventar una lectura.
  if (/[.,]/.test(entera)) {
    const grupos = entera.split(/[.,]/);
    const primeroValido = /^\d{1,3}$/.test(grupos[0]);
    const restoValido = grupos.slice(1).every((g) => /^\d{3}$/.test(g));
    if (!primeroValido || !restoValido) {
      throw new Error(
        `"${entrada}" no es un monto: los separadores de miles tienen que agrupar de a tres dígitos.`
      );
    }
  }

  const soloDigitosEnteros = entera.replace(/[.,]/g, '');
  if (soloDigitosEnteros === '' && decimal === '') {
    throw new Error(`"${entrada}" no es un monto.`);
  }

  // Una moneda sin decimales con céntimos escritos es un error del usuario, no
  // algo que se pueda redondear en silencio: redondear le cambiaría el importe
  // sin decirle nada.
  if (decimal !== '' && decimales === 0) {
    throw new Error('Esta moneda no usa decimales, así que el monto tiene que ser un número entero.');
  }
  if (decimal.length > decimales) {
    const plural = decimales === 1 ? 'decimal' : 'decimales';
    throw new Error(
      `Esta moneda usa ${decimales} ${plural}, y "${entrada}" tiene ${decimal.length}.`
    );
  }

  // Se arma el entero pegando dígitos, sin pasar nunca por un número con coma
  // flotante: así "0,10" + "0,20" no puede dar 0.30000000000000004.
  const relleno = decimal.padEnd(decimales, '0');
  const minimas = Number(`${soloDigitosEnteros || '0'}${relleno}`);

  return validarMonto(negativo ? -minimas : minimas);
}

/**
 * De unidades mínimas al número con decimales. Solo para mostrar y para
 * exportar: nunca para seguir calculando encima.
 */
export function aNumero(minimas, decimales) {
  validarDecimales(decimales);
  if (!Number.isInteger(minimas)) {
    throw new Error(`Se esperaba un entero de unidades mínimas y llegó ${JSON.stringify(minimas)}.`);
  }
  return minimas / unidadMinima(decimales);
}

/**
 * Suma exacta. Recibe la lista completa: no hay ningún límite de cuántos
 * elementos acepta, porque así es como el Excel original empezó a mentir (L-001).
 */
export function sumar(minimas) {
  if (!Array.isArray(minimas)) {
    throw new Error('sumar() espera una lista de montos.');
  }
  let total = 0;
  for (const m of minimas) {
    if (!Number.isInteger(m)) {
      throw new Error(`La lista tiene un valor que no es entero: ${JSON.stringify(m)}.`);
    }
    total += m;
    if (!Number.isSafeInteger(total)) {
      throw new Error('La suma se pasó del rango en que JavaScript cuenta bien.');
    }
  }
  return total;
}

/**
 * Convierte un monto a céntimos de euro usando el tipo de cambio del mes
 * (RN-04): cuántos euros vale UNA unidad de esa moneda.
 *
 * El redondeo ocurre UNA SOLA VEZ, acá al final. Si se redondeara antes —por
 * ejemplo pasando primero a euros con decimales y después sumando— el error se
 * acumularía movimiento a movimiento.
 */
export function convertirAEuros(minimas, decimales, eurosPorUnidad) {
  validarDecimales(decimales);
  if (!Number.isInteger(minimas)) {
    throw new Error(`Se esperaba un entero de unidades mínimas y llegó ${JSON.stringify(minimas)}.`);
  }
  if (!Number.isFinite(eurosPorUnidad) || eurosPorUnidad <= 0) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }

  const enEuros = (minimas / unidadMinima(decimales)) * eurosPorUnidad;
  const centimos = redondear(enEuros * unidadMinima(DECIMALES_EURO));

  if (!Number.isSafeInteger(centimos)) {
    throw new Error('La conversión se pasó del rango en que JavaScript cuenta bien.');
  }
  return centimos;
}

/**
 * Invierte un tipo de cambio expresado al revés. El usuario suele conocerlo como
 * "cuántos colones es un euro" (CU-03), pero se guarda como euros por colón.
 */
export function invertirCambio(unidadesPorEuro) {
  if (!Number.isFinite(unidadesPorEuro) || unidadesPorEuro <= 0) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }
  return 1 / unidadesPorEuro;
}

/**
 * Promedio de una lista de montos, redondeado una sola vez al final.
 * Una lista vacía da 0: no hay nada que promediar, y devolver 0 evita que la
 * app tenga que manejar un "no hay dato" en cada pantalla que muestre promedios.
 */
export function promediar(minimas) {
  if (!Array.isArray(minimas)) {
    throw new Error('promediar() espera una lista de montos.');
  }
  if (minimas.length === 0) return 0;
  return redondear(sumar(minimas) / minimas.length);
}
