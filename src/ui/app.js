// Arranque de la aplicación. Por ahora solo dibuja la pantalla inicial: su
// trabajo real es demostrar que el archivo construido abre sin conexión.
// Las pantallas de verdad llegan con T-011 en adelante (docs/PLAN.md).

// La versión la inyecta tools/build.mjs al construir, leyéndola del archivo
// VERSION. Fuera del archivo construido (por ejemplo en los tests) no hay
// versión publicada, y decirlo es más honesto que inventar un número.
export function versionApp() {
  return globalThis.__VIAJECOR_VERSION__ || 'sin construir';
}

export function pantallaInicial() {
  return `
    <header class="encabezado">
      <h1>Viajecor</h1>
      <span class="version">v${versionApp()}</span>
    </header>

    <section class="tarjeta">
      <h2>Todavía no hay nada que registrar</h2>
      <p class="suave">El esqueleto de la aplicación funciona: este archivo se abrió
      desde tu dispositivo, sin conexión y sin pedirle nada a internet.</p>
    </section>

    <section class="tarjeta">
      <h2>Qué sigue</h2>
      <ul class="pasos suave">
        <li>Aritmética de dinero y modelo del movimiento</li>
        <li>Cargar un gasto o un ingreso</li>
        <li>Tipo de cambio por moneda y por mes</li>
        <li>Resumen del mes</li>
        <li>Exportar tus datos</li>
      </ul>
      <p class="suave">El orden y el estado de cada paso están en
      <code>docs/PLAN.md</code>.</p>
    </section>

    <p class="estado"><span class="punto"></span>Tus datos se guardan solo en este
    dispositivo.</p>
  `;
}

export function iniciar(documento) {
  documento.getElementById('app').innerHTML = pantallaInicial();
}

if (typeof document !== 'undefined') {
  iniciar(document);
}
