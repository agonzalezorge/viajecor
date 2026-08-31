// El manifiesto de la app publicada — T-950.
//
// Es lo que hace que, al agregarla a la pantalla de inicio de un Android, el
// ícono tenga el nombre y el color de la app en vez de un recorte de la página,
// y que se abra **sin la barra del navegador**, como cualquier otra app del
// teléfono.
//
// Tiene además un efecto que no se ve: Chrome le concede el almacenamiento
// permanente —el que evita que borre los datos para hacer lugar— sobre todo a
// los sitios que el usuario agregó a su pantalla de inicio.
//
// Se genera en vez de guardarse escrito porque lleva adentro la versión y los
// colores, que ya viven en otros archivos. Dos copias del verde de la app son
// dos verdes que un día dejan de ser el mismo.

/** El verde de `--acento`, el mismo que usa el ícono. */
export const COLOR = '#2f6f4e';

export function manifiesto(version) {
  return {
    name: 'Viajecor',
    short_name: 'Viajecor',
    description: 'Gastos personales, en tu dispositivo y sin conexión.',
    version,
    start_url: '/',
    scope: '/',
    // `standalone`: sin barra de direcciones. La app tiene su propia navegación
    // y una barra encima le come una fila de la tabla en un teléfono.
    display: 'standalone',
    orientation: 'portrait',
    background_color: COLOR,
    theme_color: COLOR,
    lang: 'es',
    icons: [
      {
        src: '/icono.png',
        sizes: '180x180',
        type: 'image/png',
        // `any maskable`: Android recorta el ícono con la forma que tenga el
        // teléfono —círculo, cuadrado redondeado—, y como el fondo es liso y la
        // "V" está centrada, recortarlo no le come nada.
        purpose: 'any maskable',
      },
    ],
  };
}
