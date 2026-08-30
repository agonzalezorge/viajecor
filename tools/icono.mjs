// El ícono de la app, dibujado acá — T-948.
//
// ── Por qué se dibuja en vez de guardarse ────────────────────────────────────
//
// La app es UN archivo y no pide nada a internet (RN-06), así que el ícono no
// puede ser un `.png` al lado: tiene que ir adentro del HTML, como `data:`. Lo
// que sí se puede elegir es si ese bloque de base64 se pega a mano en la
// plantilla —donde nadie va a poder volver a tocarlo— o si lo escribe un
// programa que se lee. Esto es lo segundo: cambiar el color o el trazo es
// cambiar dos números acá abajo y reconstruir.
//
// ── Por qué hace falta ───────────────────────────────────────────────────────
//
// Dos motivos, y el segundo es el que importa:
//
//  1. Sin ícono, el navegador pide `/favicon.ico` al servidor y se come un 404
//     en cada visita. Se vio sirviendo la app por HTTP.
//  2. **En un iPhone, "Añadir a pantalla de inicio" usa `apple-touch-icon`.**
//     Sin eso, iOS pone una captura de la pantalla como ícono, que en una app
//     de gastos es una miniatura ilegible de una tabla de números.
//
// El PNG se arma a mano —cabecera, píxeles, CRC— porque el proyecto no tiene
// dependencias (ADR-003) y un PNG sin comprimir es un formato corto de escribir.

import { deflateSync } from 'node:zlib';

const LADO = 180;                       // lo que pide iOS para el ícono grande
const FONDO = [0x2f, 0x6f, 0x4e];       // --acento: el verde de la app
const TINTA = [0xfb, 0xfa, 0xf8];       // --fondo: el papel
const GROSOR = 15;

function crc32(datos) {
  let c = 0xffffffff;
  for (const byte of datos) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
}

/** Los píxeles: el fondo verde y una "V" de dos trazos. */
function dibujar() {
  const px = Array.from({ length: LADO }, () => Array.from({ length: LADO }, () => FONDO));

  const trazo = (x0, y0, x1, y1) => {
    const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3;
    for (let i = 0; i <= pasos; i += 1) {
      const t = i / pasos;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      for (let dy = -GROSOR; dy <= GROSOR; dy += 1) {
        for (let dx = -GROSOR; dx <= GROSOR; dx += 1) {
          // Redondo, no cuadrado: el trazo termina en punta y no en escalón.
          if (dx * dx + dy * dy > (GROSOR / 2) ** 2) continue;
          const x = Math.round(cx + dx);
          const y = Math.round(cy + dy);
          if (x >= 0 && x < LADO && y >= 0 && y < LADO) px[y][x] = TINTA;
        }
      }
    }
  };

  trazo(48, 52, 90, 130);
  trazo(132, 52, 90, 130);
  return px;
}

/** El ícono como `data:` URI, listo para meter en un `href`. */
export function iconoComoDataUri() {
  const px = dibujar();

  // Cada fila lleva adelante su byte de filtro; el 0 es "sin filtro".
  const crudo = Buffer.concat(px.map((fila) =>
    Buffer.concat([Buffer.from([0]), Buffer.from(fila.flat())])));

  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(LADO, 0);
  cabecera.writeUInt32BE(LADO, 4);
  cabecera[8] = 8;   // ocho bits por canal
  cabecera[9] = 2;   // color verdadero, sin canal alfa

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString('base64')}`;
}
