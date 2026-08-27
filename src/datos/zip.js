// Un ZIP escrito a mano — la mitad de abajo del `.xlsx` (T-906).
//
// Un `.xlsx` es un ZIP con archivos XML adentro. Para escribir uno hace falta
// armar el ZIP, y el navegador **no trae** ninguna función para eso: trae
// `DecompressionStream` para leer, pero armar el contenedor es cuenta propia.
//
// Son unas cien líneas y no cambian nunca: el formato ZIP está congelado desde
// 1989. Es menos código que la línea de `<script src>` que haría falta para
// traer una librería — y esa línea rompería la promesa de la app (RN-06).
//
// ── Por qué NO se comprime ───────────────────────────────────────────────────
//
// El ZIP permite guardar cada archivo tal cual ("stored", método 0) o
// comprimido. Acá se guarda tal cual, por tres razones:
//
//   1. Comprimir en el navegador es asíncrono (`CompressionStream`), y eso
//      convierte toda la exportación en asíncrona por una ganancia de tamaño
//      que no le importa a nadie.
//   2. Un ZIP sin comprimir es un ZIP válido. Excel, LibreOffice y Google
//      Sheets lo abren igual: no es un atajo ni un formato degradado.
//   3. Es una dependencia menos de una API del navegador que podría no estar.
//
// Lo que cuesta: el archivo pesa más. Para un año de gastos son unos cientos de
// kilobytes, que en 2026 no es un problema para nadie.

/**
 * La tabla de CRC-32 que el formato ZIP exige por cada entrada.
 *
 * Se calcula una sola vez: son 256 entradas y el cálculo es el mismo siempre.
 */
const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[i] = c;
  }
  return tabla;
})();

/** El CRC-32 de unos bytes. Es la suma de control que el ZIP guarda por entrada. */
export function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Arma un ZIP con las entradas dadas. Devuelve los bytes.
 *
 * `entradas` es `[{ nombre, contenido }]`, donde el contenido es texto. Los
 * nombres llevan barras normales aunque sean carpetas: el ZIP no tiene
 * carpetas de verdad, solo nombres con barras adentro.
 */
export function crearZip(entradas) {
  const codificador = new TextEncoder();
  const locales = [];
  const central = [];
  let desplazamiento = 0;

  for (const entrada of entradas) {
    const nombre = codificador.encode(entrada.nombre);
    const datos = codificador.encode(entrada.contenido);
    const suma = crc32(datos);

    // Encabezado local: va pegado a los datos de cada archivo.
    const encabezado = nuevoBuffer(30 + nombre.length);
    encabezado.escribir32(0, 0x04034b50);   // firma
    encabezado.escribir16(4, 20);           // versión mínima para extraer
    encabezado.escribir16(6, 0);            // sin banderas
    encabezado.escribir16(8, 0);            // método 0: guardado sin comprimir
    encabezado.escribir16(10, 0);           // hora: 0. La app no guarda horas
    encabezado.escribir16(12, 0x2821);      // fecha: 2000-01-01, fija a propósito
    encabezado.escribir32(14, suma);
    encabezado.escribir32(18, datos.length); // tamaño comprimido = tamaño real
    encabezado.escribir32(22, datos.length);
    encabezado.escribir16(26, nombre.length);
    encabezado.escribir16(28, 0);           // sin campos extra
    encabezado.copiar(30, nombre);

    locales.push(encabezado.bytes, datos);

    // Entrada del directorio central: el índice que va al final del archivo.
    const indice = nuevoBuffer(46 + nombre.length);
    indice.escribir32(0, 0x02014b50);
    indice.escribir16(4, 20);               // versión con la que se creó
    indice.escribir16(6, 20);
    indice.escribir16(8, 0);
    indice.escribir16(10, 0);
    indice.escribir16(12, 0);
    indice.escribir16(14, 0x2821);
    indice.escribir32(16, suma);
    indice.escribir32(20, datos.length);
    indice.escribir32(24, datos.length);
    indice.escribir16(28, nombre.length);
    indice.escribir16(30, 0);
    indice.escribir16(32, 0);               // sin comentario
    indice.escribir16(34, 0);               // disco 0
    indice.escribir16(36, 0);
    indice.escribir32(38, 0);
    indice.escribir32(42, desplazamiento);  // dónde empieza su encabezado local
    indice.copiar(46, nombre);

    central.push(indice.bytes);
    desplazamiento += encabezado.bytes.length + datos.length;
  }

  const tamanoCentral = central.reduce((total, b) => total + b.length, 0);

  // El cierre: le dice al lector dónde está el índice. Se lee de atrás hacia
  // adelante, que es por lo que un ZIP se puede leer sin recorrerlo entero.
  const cierre = nuevoBuffer(22);
  cierre.escribir32(0, 0x06054b50);
  cierre.escribir16(4, 0);
  cierre.escribir16(6, 0);
  cierre.escribir16(8, entradas.length);
  cierre.escribir16(10, entradas.length);
  cierre.escribir32(12, tamanoCentral);
  cierre.escribir32(16, desplazamiento);
  cierre.escribir16(20, 0);

  return unir([...locales, ...central, cierre.bytes]);
}

/** Un pedazo de memoria con las tres escrituras que el ZIP necesita. */
function nuevoBuffer(tamano) {
  const bytes = new Uint8Array(tamano);
  const vista = new DataView(bytes.buffer);
  return {
    bytes,
    // El ZIP guarda los números al revés (byte menos significativo primero).
    // Es una decisión de 1989 y hay que respetarla tal cual.
    escribir16: (donde, valor) => vista.setUint16(donde, valor, true),
    escribir32: (donde, valor) => vista.setUint32(donde, valor, true),
    copiar: (donde, otros) => bytes.set(otros, donde),
  };
}

function unir(partes) {
  const total = partes.reduce((suma, p) => suma + p.length, 0);
  const juntos = new Uint8Array(total);
  let donde = 0;
  for (const parte of partes) {
    juntos.set(parte, donde);
    donde += parte.length;
  }
  return juntos;
}
