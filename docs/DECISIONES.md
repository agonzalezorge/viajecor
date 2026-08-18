# Decisiones

> Cada decisión que no es obvia, con su porqué. Sirve para que dentro de tres
> meses nadie —persona o IA— la deshaga sin querer creyendo que fue un descuido.
>
> **Solo se agrega al final.** Si una decisión se revierte, no se borra: se anota
> una nueva que la reemplace y se marca la vieja como *Reemplazada*.

---

## ADR-001 · Una aplicación web en un solo archivo HTML, no una app nativa
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** hay que registrar gastos desde el celular, sin conexión y sin que
los datos salgan del dispositivo.

**Decisión:** una página web autocontenida en un archivo `.html` que se guarda en
el dispositivo y se abre desde ahí.

**Por qué esta y no otra:**
- *App nativa (iOS/Android):* obligaría a publicar en una tienda, con cuenta de
  desarrollador y revisiones, para una app de un solo usuario. Desproporcionado.
- *App web con servidor:* los datos pasarían por un servidor. Contradice
  directamente el requisito de privacidad.
- *Un archivo HTML:* se guarda, se copia, se respalda como cualquier archivo. Sin
  instalación, sin cuenta, sin tienda, sin servidor.

**Lo que cuesta:** no hay ícono en la pantalla de inicio por defecto (se puede
agregar a mano desde el navegador), no hay notificaciones, y la sincronización
entre dispositivos hay que hacerla exportando e importando.

---

## ADR-002 · Código fuente partido en módulos, entregable en un archivo
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** el código vive en `src/` en muchos archivos; `tools/build.mjs`
genera un `dist/viajecor.html` único.

**Por qué:** los módulos de JavaScript no se pueden cargar desde `file://` (el
navegador lo bloquea), así que el entregable **tiene** que ser un solo archivo.
Pero programar y testear en un solo archivo gigante es peor en todos los sentidos,
y con varios agentes trabajando en paralelo, garantiza conflictos.

**Lo que cuesta:** hay un paso de construcción, y `dist/viajecor.html` se versiona
en git aunque sea generado. Se acepta: el usuario tiene que poder bajar el archivo
sin construir nada.

---

## ADR-003 · Cero dependencias externas
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** ninguna librería. Ni de interfaz, ni de fechas, ni de tests, ni de
construcción.

**Por qué:** cualquier librería habría que meterla dentro del HTML (lo agranda) o
traerla de internet (viola la regla de cero red). Además, la app tiene que seguir
funcionando dentro de cinco años desde un archivo guardado: cero dependencias es
cero cosas que se pudran. Para tests alcanza el ejecutor que ya trae Node.

**Lo que cuesta:** hay que escribir a mano cosas que una librería resolvería. Es
poco: el alcance es chico y el navegador moderno ya trae casi todo.

---

## ADR-004 · El importe en euros se calcula, no se guarda
**Fecha:** 2026-08-18 · **Estado:** Vigente, **a confirmar con el usuario**

**Contexto:** RN-04 define un tipo de cambio por moneda y por mes. Un movimiento
en moneda extranjera tiene un monto original y un equivalente en euros.

**Decisión:** se guarda el monto original y su moneda. El importe en euros se
recalcula siempre a partir del tipo de cambio vigente para (moneda, mes).

**Por qué:** si el tipo de cambio cargado estaba mal, corregirlo una vez arregla
el mes entero. Congelarlo obligaría a corregir movimiento por movimiento.

**Lo que cuesta:** cambiar un tipo de cambio **modifica totales de meses ya
vistos**. La app lo avisa antes de aplicarlo. Es un comportamiento que puede
resultar incómodo, así que **está anotado como pregunta abierta en
`docs/PLAN.md`**: si el usuario prefiere congelar, se cambia — es barato ahora y
caro más adelante.

---

## ADR-005 · El dinero se guarda en unidades enteras
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** `12,50 €` se guarda como el entero `1250`.

**Por qué:** en JavaScript `0.1 + 0.2` no da `0.3`. Sumar cientos de montos con
decimales acumula error, y un total que no cierra por un céntimo destruye la
confianza en todos los demás números de la app. Con enteros la suma es exacta.

**Lo que cuesta:** las conversiones de moneda y los promedios sí dan decimales, y
hay que redondear **una sola vez, al final** de cada cálculo. Está encapsulado en
`src/core/dinero.js` para que no se decida de nuevo en cada lugar.

---

## ADR-006 · `localStorage`, no IndexedDB
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** todo el estado bajo una sola clave de `localStorage`.

**Por qué:** es síncrono y directo. El límite de ~5 MB da para unos 30.000
movimientos; el Excel actual tiene alrededor de 1.000 en un año. IndexedDB sería
complejidad comprada para un problema que no existe.

**Cuándo revisarla:** si se agregan fotos de tickets, o si el volumen se acerca a
los 20.000 movimientos. `src/datos/almacenamiento.js` es la única puerta a la
persistencia, así que el cambio sería de un archivo.

---

## ADR-007 · Importar desde CSV, no leer `.xlsx` directamente
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** el importador del historial lee CSV. Para traer el Excel, se exporta
a CSV desde Excel primero.

**Por qué:** un `.xlsx` es un ZIP con XML adentro. Leerlo en el navegador
requeriría una librería de descompresión y otra de XML, que habría que meter
dentro del archivo entregable y mantener para siempre. Exportar a CSV es un paso
que el usuario hace una vez.

---

## ADR-008 · Los nombres del Excel se respetan tal cual
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** `rubro`, `comida hecha`, `gastos fijos`, `I/G`, `comentario` — los
nombres de la app son los de la planilla, aunque algunos no sean los que elegiría
alguien de cero.

**Por qué:** el usuario ya piensa en esos términos después de meses de uso.
Renombrarlos lo obligaría a traducir mentalmente cada vez, y al importar el
historial habría que mapear nombres viejos a nuevos: dos fuentes de error a cambio
de nada.

---

## ADR-009 · La privacidad se verifica con un test, no con buena voluntad
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** un test automático (T-007) falla si el HTML generado contiene
cualquier referencia a una URL externa o a una función de red.

**Por qué:** "no hacemos peticiones a internet" es la promesa central del
producto. Una promesa que depende de que ningún agente se olvide nunca no es una
promesa. Con el test, agregar accidentalmente una fuente de Google rompe la
construcción en vez de romper la privacidad en silencio.
