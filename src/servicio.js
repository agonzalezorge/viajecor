// El trabajador de servicio: lo que hace que la app abra sin conexión — T-950.
//
// ── Qué problema resuelve ────────────────────────────────────────────────────
//
// Como archivo, Viajecor abría con el modo avión activado: estaba en el disco.
// Publicada en la web, la primera carga necesita red — y una app de gastos que
// no abre en un avión, justo cuando estás gastando en otro país, es un chiste
// malo. Esto guarda una copia de la página en el navegador y la sirve cuando no
// hay red.
//
// ── Por qué es un archivo aparte, si la regla es "un solo archivo" ───────────
//
// Porque el navegador lo exige: un trabajador de servicio tiene que venir de su
// propia dirección. Solo existe en la versión **publicada**; el archivo que se
// baja (`dist/viajecor.html`) sigue siendo uno solo y no lo necesita, porque
// desde el disco ya funciona sin conexión.
//
// ── La estrategia, y por qué esta y no otra ──────────────────────────────────
//
// **Primero la red, y la copia guardada como respaldo.** Con hay red se pide la
// página como siempre y se guarda una copia fresca; sin red, se responde con la
// última copia.
//
// La alternativa —servir siempre la copia y actualizar por atrás— hace que la
// app abra más rápido, y a cambio te deja **una versión vieja pegada**: cargás
// gastos en una app que ya no es la que se publicó, y no hay forma de que te
// enteres. En una app que uno abre dos veces por día, medio segundo de arranque
// no vale ese riesgo.
//
// ── Lo que NO hace, a propósito ──────────────────────────────────────────────
//
// No toca nada que no sea **esta misma dirección**. No hay lista de recursos
// que cachear, ni nada de otro origen: la app es una sola página y todo lo
// demás está adentro. La política de seguridad del sitio, además, no lo dejaría.

const CACHE = 'viajecor-{{VERSION}}';

self.addEventListener('install', (evento) => {
  // Guardar la página ya, para que la primera vez sin red también funcione.
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('/')).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  // Las copias de versiones anteriores se tiran: si no, cada publicación deja
  // un archivo de medio megabyte olvidado en el teléfono del usuario.
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;

  // Solo la navegación a esta app. Cualquier otra cosa se deja pasar tal cual:
  // este trabajador no está para interceptar la web, está para que esta página
  // abra sin red.
  if (pedido.method !== 'GET' || pedido.mode !== 'navigate') return;

  evento.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        // Solo se guarda lo que salió bien: cachear un error 500 sería servirle
        // ese error al usuario cada vez que se quede sin conexión.
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copia));
        }
        return respuesta;
      })
      .catch(() => caches.open(CACHE)
        .then((cache) => cache.match('/'))
        .then((guardada) => guardada ?? Response.error()))
  );
});
