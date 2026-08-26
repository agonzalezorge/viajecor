# Plan de implementación — Viajecor

> **Este documento es la fuente de verdad del trabajo.** Cuando no hay una
> instrucción específica del usuario, lo que sigue es lo que dice este archivo.
> No hay una segunda lista en otro lado.
>
> Última actualización: 2026-08-19

---

## Cómo elegir la próxima tarea

Sin instrucciones específicas, se aplica este orden, sin saltearse pasos:

1. **¿Hay algo roto?** Si `node --test` falla o `node tools/build.mjs` no
   corre, arreglar eso es la tarea. Nada más avanza con el árbol roto.
2. **¿Hay una tarea `En curso` abandonada?** Si el trabajo está a medias y sin
   nadie encima, terminarla antes de empezar otra. Media tarea no sirve a nadie.
3. **Tomar la tarea `Lista` de menor número.** Una tarea está `Lista` cuando
   **todas** sus dependencias están en `Hecha`.
4. **Si varios agentes trabajan a la vez**, cada uno toma una tarea `Lista`
   distinta cuyo bloque *Toca* no se pise con el de otra tarea en curso. Ver
   `docs/AGENTES.md`.
5. **Si no queda ninguna tarea `Lista`**, tomar una de la sección
   *Independientes* — no dependen de nada y se pueden hacer siempre.
6. **Si una tarea está marcada `Necesita decisión`, no se adivina: se pregunta.**
   Hay una decisión de producto que le corresponde al usuario.

### Reglas al trabajar una tarea

- **Una tarea, un commit** (o unos pocos), con mensaje que explique el *por qué*.
- **Antes de marcar `Hecha`**: los tests pasan, la app construye, y lo que la
  tarea dice en *Terminada cuando* está efectivamente comprobado — no supuesto.
- **Actualizar los documentos en el mismo commit**: si la tarea completa un caso
  de uso, marcarlo `Hecho` en `docs/PRODUCTO.md`. Si tomó una decisión técnica no
  trivial, anotarla en `docs/DECISIONES.md`. Si reveló una trampa, anotarla en
  `docs/LECCIONES.md`.
- **Actualizar el estado en este archivo** al empezar y al terminar.

---

## Estados

| Estado | Significa |
|---|---|
| `Pendiente` | Tiene dependencias sin terminar. Todavía no se puede empezar. |
| `Lista` | Todas sus dependencias están hechas. Se puede tomar ya. |
| `En curso` | Alguien la está haciendo. Se anota quién y desde cuándo. |
| `Hecha` | Terminada y verificada según su criterio. |
| `Necesita decisión` | Frenada esperando una respuesta del usuario. |

---

## Tablero

| ID | Tarea | Estado | Depende de |
|---|---|---|---|
| **Etapa 0 — Cimientos** ||||
| T-001 | Esqueleto del proyecto y construcción | **Hecha** | — |
| T-002 | Aritmética de dinero (`core/dinero.js`) | **Hecha** | T-001 |
| T-003 | Modelo y validación del movimiento | **Hecha** | T-002 |
| T-004 | Almacenamiento local | **Hecha** | T-003 |
| T-005 | Tipos de cambio y conversión a euros | **Hecha** | T-002, T-008 |
| T-006 | Formateo de montos y fechas | **Hecha** | T-002 |
| T-007 | Guardia automática de privacidad | **Hecha** | T-001 |
| T-008 | Catálogo de monedas | **Hecha** | T-002 |
| T-009 | Planilla de ejemplo para probar el importador | **Hecha** | — |
| **Etapa 1 — v0.1: registrar, ver y exportar** ||||
| T-010 | Armazón de la interfaz | **Hecha** | T-001 |
| T-011 | Pantalla de carga de movimiento | **Hecha** | T-003, T-004, T-010 |
| T-012 | Pedir el tipo de cambio al vuelo | **Hecha** | T-005, T-011 |
| T-013 | Cálculos del mes | **Hecha** | T-003, T-005 |
| T-014 | Pantalla de resumen del mes | En curso (claude, 2026-08-19) | T-013, T-010, T-006 |
| T-015 | Lista de movimientos, editar y borrar | **Lista** | T-011 |
| T-016 | Exportar a JSON | **Lista** | T-004 |
| T-017 | Importar un respaldo JSON | Pendiente | T-016 |
| T-018 | Exportar a CSV | Pendiente | T-005, T-016 |
| T-019 | Verificación real sin conexión | Pendiente | T-011…T-018 |
| **Etapa 2 — Análisis** ||||
| T-020 | Gasto día por día del mes | **Lista** | T-013 |
| T-021 | Evolución mes a mes | **Lista** | T-013 |
| T-022 | Promedio de gastos fijos | **Lista** | T-013 |
| T-023 | Gasto por viaje | Necesita decisión | T-013 |
| T-024 | Pantalla de monedas | **Lista** | T-008, T-010 |
| **Etapa 3 — Traer el historial del Excel** ||||
| T-030 | Definir el mapeo Excel → modelo | Pendiente | T-003, T-009 |
| T-031 | Lector de `.xlsx` sin librerías | Pendiente | T-009 |
| T-032 | Importador con informe de filas no interpretadas | Pendiente | T-030, T-031, T-017 |
| **Etapa 4 — Ahorros conjuntos** ||||
| T-040 | Modelo de ahorros multimoneda | Pendiente | T-004 |
| T-041 | Pantalla de ahorros conjuntos | Pendiente | T-040, T-010 |
| **Independientes** ||||
| T-900 | README de uso | Lista | — |
| T-901 | Versionado y CHANGELOG | Lista | — |
| T-902 | Uso cómodo en celular | Lista (empezada en T-010) | T-010 |
| T-903 | Recordatorio de respaldo | Pendiente | T-016 |
| T-904 | Modo oscuro | **Hecha** (venía de T-001) | T-010 |
| T-905 | Respaldo cómodo a la nube, sin red | Pendiente | T-016 |
| T-907 | Decimales sugeridos por moneda (ISO 4217) | Lista | T-008 |
| T-908 | Reescalar los montos al corregir los decimales | Lista | T-008 |
| T-906 | Exportar a `.xlsx` con la forma de la planilla | Pendiente | T-016, T-018 |

**Hito v0.1:** T-001 a T-019, más T-008 y T-024 que la multimoneda necesita.
En ese punto la app ya reemplaza al Excel para
cargar gastos y ver cómo viene el mes, y los datos se pueden sacar.

---

## Etapa 0 — Cimientos

Nada de la interfaz tiene sentido antes de que la lógica de dinero esté bien.
Un error de redondeo acá se propaga a todos los números de la app.

### T-001 · Esqueleto del proyecto y construcción
**Estado:** Hecha (2026-08-18) · **Depende de:** —
**Toca:** `src/plantilla.html`, `src/estilos.css`, `src/ui/app.js`, `tools/build.mjs`, `dist/viajecor.html`

Armar la estructura de carpetas de `docs/ARQUITECTURA.md` §4 y el script que pega
`src/` en un único `dist/viajecor.html`.

**Terminada cuando:**
- [x] `node tools/build.mjs` genera `dist/viajecor.html` (4,4 kB).
- [x] Ese archivo, abierto desde el disco con toda la red bloqueada, dibuja la app:
      **0 intentos de red, 0 errores de consola**. Verificado con un navegador real
      controlado por Playwright, no deducido.
- [x] El HTML generado no tiene ninguna referencia a una URL externa.

**Falta verificar en un dispositivo real:** todo lo anterior se comprobó en un
navegador de escritorio automatizado. El recorrido en un celular con modo avión es
parte de T-019.

---

### T-002 · Aritmética de dinero
**Estado:** Hecha (2026-08-18) · **Depende de:** T-001
**Toca:** `src/core/dinero.js`, `test/dinero.test.js`, `tools/build.mjs`

Montos como enteros en unidad mínima (`docs/ARQUITECTURA.md` §5.1). Interpretar lo
que escribe el usuario, sumar, convertir con un tipo de cambio, promediar, y
redondear una sola vez al final.

**Cuántos decimales tiene cada moneda no lo decide este módulo:** lo recibe como
parámetro, porque la lista de monedas la maneja el usuario (RN-04b, ADR-011). Una
tabla acá se desactualizaría en cuanto se agregue una moneda nueva.

**Terminada cuando:**
- [x] 35 tests propios, todos pasando. Cubren el redondeo hacia arriba y hacia
      abajo, `0.1 + 0.2`, una moneda sin decimales, y montos negativos rechazados.
- [x] Los cálculos se comprobaron **dentro de `dist/viajecor.html`**, no solo en
      el código fuente: el build quita los `export` y pega todo en un ámbito
      único, y esa transformación podría romper algo que los tests de Node no ven.

**Lo que salió de hacerla:** la regla para interpretar el separador decimal leía
`"12,345"` como 12.345 € en vez de rechazarlo — un error de mil veces, en
silencio. Lo encontró un test escrito para otra cosa. Ver ADR-012 y L-008.

---

### T-003 · Modelo y validación del movimiento
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/modelo.js`, `test/modelo.test.js`, `tools/build.mjs`

Crear un movimiento válido, normalizar textos (RN-03), validar fecha (RN-01) y
la correspondencia tipo↔rubro (RN-02). Las listas de rubros viven acá, tal como
están en `docs/PRODUCTO.md` §4.

**Terminada cuando:**
- [x] Hay tests para `VIAJES`/`viajes`/` Viajes ` como el mismo rubro, para un
      rubro de ingreso rechazado en un gasto, y para monto cero o negativo
      rechazado. Son 43 tests nuevos; los 81 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el código a propósito en tres
      puntos (sin `normalize('NFC')`, sin comprobar que el día exista, con
      identificadores de 4 bytes). Cada rotura hizo fallar tests.
- [x] El modelo se ejercitó **dentro de `dist/viajecor.html`**, no solo en el
      código fuente: el build borra los `import`/`export` y pega todo en un
      ámbito único, y esa transformación podría romper algo que los tests de Node
      no ven.

**Lo que salió de hacerla:**
- Dos textos idénticos en pantalla pueden ser distintos para la máquina, sin
  ningún síntoma visible. Ver L-009.
- El comentario se guarda como se escribió y se agrupa por una clave aparte, para
  que la app pueda mostrar `Roma` y no `roma`. Ver ADR-013.
- Crear un movimiento e interpretar uno ya guardado son dos puertas separadas,
  porque `1250` significa cosas distintas en cada una. Ver ADR-014.
- El identificador usa 16 dígitos hexadecimales y no 8: con 8, la probabilidad de
  que dos movimientos compartan identificador ronda el 10% a los 30.000
  movimientos. Se corrigió el ejemplo de `docs/ARQUITECTURA.md` §5.

---

### T-004 · Almacenamiento local
**Estado:** Hecha (2026-08-19) · **Depende de:** T-003
**Toca:** `src/datos/almacenamiento.js`, `test/almacenamiento.test.js`, `tools/build.mjs`

Leer y escribir el estado completo bajo `viajecor:datos:v1`, con el número de
esquema y un lugar previsto para migrar si cambia.

**Terminada cuando:**
- [x] Hay tests con un `localStorage` simulado que cubren primer arranque sin
      datos, ida y vuelta de guardar y leer, y datos corruptos que no tumban la
      app. Son 25 tests; los 106 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo a propósito en los
      cuatro puntos peligrosos (pisar lo ilegible, descartar registros rotos en
      silencio, no reconocer el almacenamiento lleno, leer datos de una versión
      más nueva). Cada rotura hizo fallar tests.
- [x] El recorrido real —cargar un gasto, guardarlo, volver a leerlo— se ejercitó
      **dentro de `dist/viajecor.html`**, con un `localStorage` simulado.

**Lo que salió de hacerla:** tres decisiones sobre qué hacer cuando los datos no
se entienden, que es donde este módulo se puede llevar puestos meses de registro.
Ver ADR-015 (lo ilegible se aparta, nunca se pisa), ADR-016 (leer se degrada,
guardar grita) y ADR-017 (un registro roto no invalida a los demás).

**Lo que este módulo NO hace, a propósito:** el estado inicial viene con la lista
de monedas **vacía**. Las cuatro precargadas (RN-04b) las define `core/monedas.js`
en T-008; tenerlas también acá serían dos listas que se desincronizan. Quien arme
el estado inicial le pasa la lista.

---

### T-005 · Tipos de cambio y conversión a euros
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002, T-008
**Toca:** `src/core/cambio.js`, `test/cambio.test.js`, `tools/build.mjs`

Guardar y buscar el tipo de cambio por `(moneda, mes)`, convertir un movimiento a
euros (RN-04, RN-05), y responder "¿falta el tipo de cambio para esto?".

**Terminada cuando:**
- [x] Hay tests para euro sin conversión, para una moneda con dos meses de tipos
      distintos, para tipo de cambio faltante, y para el cálculo inverso
      ("cuántos colones es un euro" → guardado como euros por colón). Son 26
      tests; los 156 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en cuatro puntos
      —contar como cero lo que no se puede convertir, ignorar el mes, no invertir
      el cálculo inverso, duplicar en vez de reemplazar—. Cada rotura hizo fallar
      tests.
- [x] El recorrido de un viaje a Costa Rica —cargar en colones, que la app pida
      el tipo de cambio, escribirlo como "un euro son 630 colones", y ver el
      total en euros— se ejercitó **dentro de `dist/viajecor.html`**.

**Lo que salió de hacerla:** ADR-020, sobre en qué momento se redondea al sumar
monedas distintas. El total es la suma de lo que se ve en pantalla, aunque el
otro camino sea aritméticamente más exacto.

**Decisiones que ya estaban y este módulo hace cumplir:**
- Un movimiento sin tipo de cambio **no se cuenta como cero**: tira. Un
  movimiento que vale cero desaparece de un total sin dejar rastro.
- El importe en euros **no se guarda**, se deriva (RN-05). Por eso corregir un
  tipo de cambio arregla el mes entero, y por eso hay que avisar cuántos
  movimientos toca antes de aplicarlo.

---

### T-006 · Formateo de montos y fechas
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/formato.js`, `test/formato.test.js`, `tools/build.mjs`

Mostrar `1250` como `12,50 €` en formato español, y las fechas de forma legible.
Sin librerías: `Intl` viene en el navegador.

**Terminada cuando:**
- [x] Montos, fechas, meses, días de la semana y tipos de cambio se muestran en
      español. Son 19 tests; los 175 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en tres puntos —no
      cuidar la zona horaria, dejar que `Intl` decida los decimales, mostrar el
      tipo de cambio siempre con dos decimales—. Cada rotura hizo fallar tests.
- [x] Se ejercitó **dentro de `dist/viajecor.html`**: `14/03/2026 · 12.500,00 CRC
      · 19,84 € · 1 EUR = 630,00 CRC`.

**Lo que salió de hacerla:** L-011, la zona horaria corriendo una fecha de día.
En Montevideo, el 14 de marzo se mostraba como 13 de marzo.

**Tres cosas que quedaron decididas y conviene no deshacer:**
- Los decimales de un monto los manda el catálogo del usuario, **no `Intl`**, que
  tiene su propia idea para cada moneda. Si `Intl` decidiera, una moneda que el
  usuario configuró distinto se mostraría con otros decimales de los que se
  guardó: el número correcto por dentro y la pantalla mintiendo.
- Los números de cuatro cifras van **sin** punto de miles (`1234,56 €`) y a partir
  de cinco lo llevan (`12.345,67 €`). Es la norma del español, no un olvido.
- El espacio entre el importe y el símbolo es un **espacio duro** (U+00A0), para
  que no queden en renglones distintos. Se ve igual que un espacio común y no lo
  es — L-009 otra vez, ahora del lado de la presentación.

---

### T-007 · Guardia automática de privacidad
**Estado:** Hecha (2026-08-18) · **Depende de:** T-001
**Toca:** `test/privacidad.test.js`, `tools/build.mjs`

Un test que revisa `dist/viajecor.html` y **falla** si encuentra `http://`,
`https://`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`navigator.sendBeacon`, `import(`, un `<script src>`, un `<link rel=stylesheet>`,
una imagen externa o un formulario con `action`.

*Por qué existe:* RN-06 es la promesa central del producto. Una promesa que
depende de que nadie se olvide no es una promesa. Este test la vuelve verificable
en cada cambio.

**Terminada cuando:**
- [x] El test corre y pasa sobre el archivo construido.
- [x] La misma comprobación está también en `tools/build.mjs`, así que la
      construcción **falla antes de escribir el archivo**. Comprobado agregando a
      propósito una fuente de Google: la construcción se cayó con el mensaje
      correcto y no generó el archivo.

---

### T-008 · Catálogo de monedas — CU-15
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/monedas.js`, `test/monedas.test.js`, `tools/build.mjs`

La lista de monedas vive en los datos, no en el código (RN-04b, ADR-011). Este
módulo la maneja: las cuatro precargadas (`EUR`, `UYU`, `USD`, `CRC`), agregar una
nueva con código, nombre y decimales, validar, y ocultar en vez de borrar cuando
ya tiene movimientos.

**Terminada cuando:**
- [x] Hay tests para código repetido rechazado, para el euro que no se puede
      borrar ni cambiar de decimales, para una moneda de 0 decimales, y para el
      rechazo de borrar una moneda con movimientos. Son 24 tests; los 130 del
      proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo a propósito en cinco
      puntos. Cada rotura hizo fallar tests.
- [x] El recorrido de un gasto en una moneda nueva se ejercitó **dentro de
      `dist/viajecor.html`**.

**Lo que salió de hacerla:** preguntar los decimales de una moneda que no está en
la lista **tira**, no supone 2. Ver ADR-018.

**Lo que este módulo NO hace:** guardar. Recibe la lista y devuelve una lista
nueva, sin modificar la que recibe; quien persiste es `datos/almacenamiento.js`.

---

### T-009 · Planilla de ejemplo para probar el importador
**Estado:** Hecha (2026-08-18) · **Depende de:** —
**Toca:** `tools/generar-planilla-ejemplo.mjs`, `test/ejemplo/planilla-ejemplo.xlsx`

Los gastos reales del usuario son confidenciales y no van a un repositorio, pero
el importador necesita algo contra qué construirse. Este generador produce una
planilla con **montos inventados** y **la misma estructura y las mismas rarezas**
que la original: bloques mensuales, día y mes en columnas separadas, mayúsculas
inconsistentes en rubro y tipo, fechas como número de serie de Excel.

Es un generador y no un `.xlsx` commiteado a mano porque un binario en el
repositorio no se puede leer ni revisar; el script, además, documenta en código
cómo está armada la planilla original. Usa una semilla fija, así que produce
siempre el mismo archivo y un test que dependa de él no cambia entre corridas.

**Terminada cuando:**
- [x] `node tools/generar-planilla-ejemplo.mjs` genera el archivo (288 movimientos,
      4 meses, 10,7 kB).
- [x] Un lector de Excel real (openpyxl) lo abre y devuelve las fechas como fechas.
- [x] El navegador lo lee con el método de ADR-010: 1614 celdas, sin librerías.

---

## Etapa 1 — v0.1: registrar, ver y exportar

### T-010 · Armazón de la interfaz
**Estado:** Hecha (2026-08-19) · **Depende de:** T-001
**Toca:** `src/ui/app.js`, `src/estilos.css`, `src/core/modelo.js`, `test/app.test.js`

Navegación entre pantallas, encabezado con el mes visible y la versión, y los
estilos base pensados para celular.

**Terminada cuando:**
- [x] Tres pantallas registradas (Mes, Movimientos, Datos) con marcadores que
      dicen qué van a tener y qué tarea las trae, más el botón de cargar. 22
      tests; los 202 del proyecto pasan.
- [x] El mes se cambia con flechas desde el encabezado, y el selector **no** se
      dibuja en las pantallas que no son de un mes.
- [x] Los avisos que produce `almacenamiento.js` al leer se muestran arriba de
      todo. Que ese cuidado llegue a la pantalla era la mitad de su sentido.
- [x] **Comprobado en un navegador real**, no deducido: `dist/viajecor.html`
      abierto desde el disco en Chromium, pantalla de celular (390×844), zona
      horaria de Montevideo. Navegación entre las tres pantallas y cambio de mes
      funcionando, **0 peticiones a internet y 0 errores de consola**.

**Lo que salió de hacerla:**
- ADR-022: la interfaz se parte en funciones puras que devuelven texto y una sola
  función que toca el documento.
- La aritmética de meses (`mesAnterior`/`mesSiguiente`) se hace con números y no
  moviendo un `Date`: a un `Date` del 31 de marzo restarle un mes da el **3 de
  marzo**, porque febrero no tiene 31 días. Comprobado, y hay un test que lo
  documenta.
- El modo oscuro ya funcionaba desde T-001 (`prefers-color-scheme`), así que
  T-904 queda hecha sin trabajo propio.

**Lo que T-011 se va a topar:** el armazón redibuja todo con `innerHTML` en cada
cambio. Para un formulario a medio llenar eso borraría lo escrito, así que la
pantalla de carga va a tener que dibujar solo el trozo que cambia. Está anotado
en ADR-022.

---

### T-011 · Pantalla de carga de movimiento — CU-01, CU-02
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-003, T-004, T-010
**Toca:** `src/ui/pantallas/movimiento.js`, `src/ui/app.js`, `src/estilos.css`, `test/movimiento.test.js`, `tools/build.mjs`

Formulario con fecha (hoy por defecto), tipo, monto, moneda (la última usada),
rubro, comentario y detalle. Guarda y vuelve a la lista.

**Enchufado que le toca a esta tarea:** el estado de un primer arranque sale de
`estadoInicial()` (T-004) con la lista de `monedasIniciales()` (T-008) — el
almacenamiento no la trae solo, a propósito. Y los decimales que necesita
`crearMovimiento()` salen de `decimalesDe(monedas, codigo)`, nunca de un 2
escrito a mano.

**Terminada cuando:**
- [x] Se puede cargar un gasto y un ingreso, quedan guardados **después de
      recargar la página**, y los errores de validación se muestran claros.
      **Comprobado en un navegador real**, no deducido: se cargaron un gasto y un
      ingreso en Chromium desde el disco, se recargó la página y los dos
      seguían ahí, con los montos guardados como enteros (1250 y 210000).
      0 peticiones a internet, 0 errores de consola. 27 tests; 230 en total.
- [x] Un error de validación **no borra lo escrito**. Comprobado en el navegador:
      tras rechazar `"1.234"`, el comentario y el monto seguían en su lugar.
- [x] Un movimiento en moneda extranjera sin tipo de cambio no se guarda, y el
      mensaje dice de qué moneda y de qué mes, en español.

**Lo que salió de hacerla:** L-012 (un formulario que borra lo escrito al fallar
enseña a no usarlo) y ADR-023 (lo escrito vive en el documento, no en el estado).

**Lo que NO hace, y le toca a otra tarea:**
- Cuando falta el tipo de cambio, avisa pero **no lo pide**: eso es T-012.
- Muestra los últimos cinco cargados solo para confirmar que entraron. La lista
  de verdad, con editar y borrar, es T-015.

**Sin comprobar en un dispositivo real:** el campo de fecha usa `input type=date`,
que cada navegador dibuja a su manera. En el Chromium de prueba salió en formato
americano (`08/25/2026`) porque el navegador estaba en inglés; en un celular en
español debería salir `25/08/2026`, pero **eso hay que verlo en el celular**, no
deducirlo. Es parte de T-019.

---

### T-012 · Pedir el tipo de cambio al vuelo — CU-03
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-005, T-011
**Toca:** `src/ui/pantallas/cambio.js`, `src/ui/pantallas/movimiento.js`, `src/ui/app.js`, `src/estilos.css`, `test/pantalla-cambio.test.js`, `tools/build.mjs`

Al guardar un movimiento en una moneda sin tipo de cambio para ese mes, pedirlo
antes de guardar, aceptando el valor en cualquiera de los dos sentidos. Más una
pantalla para ver y corregir tipos de cambio, que avisa cuántos movimientos
afecta una corrección.

**Terminada cuando:**
- [x] Al cargar el primer gasto en una moneda nueva, la app interrumpe, pide el
      tipo de cambio y **el gasto se guarda solo** al cargarlo. 25 tests; 257 en
      total.
- [x] El valor se escribe como se conoce ("1 EUR son 630 CRC") y se guarda
      invertido, con el sentido escrito al lado del campo. Los tests muerden:
      guardarlo sin invertir hace fallar 6 tests.
- [x] Corregir uno ya usado avisa **a cuántos movimientos afecta y en cuánto
      cambia el total del mes**, antes de aplicarlo (RN-05).
- [x] **Recorrido completo en un navegador real**, terminando con una recarga:
      12.500 colones cargados con la app pidiendo el cambio, un segundo gasto que
      ya no interrumpe, y una corrección de 630 a 500 que sobrevivió a recargar.
      0 peticiones a internet, 0 errores de consola.

**Lo que salió de hacerla, y es lo más valioso:** el recorrido en el navegador
encontró **dos errores que los 257 tests no veían**, los dos en el enganche. Ver
L-014. Uno mostraba siempre un aviso pobre sin los números; el otro **perdía en
silencio** la corrección de un tipo de cambio cuando no había ningún gasto
esperando — la pantalla decía que se aplicó y al recargar volvía el valor viejo.

---

### T-013 · Cálculos del mes — CU-04
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-003, T-005
**Toca:** `src/core/calculos.js`, `test/calculos.test.js`, `src/ui/pantallas/movimiento.js`, `tools/build.mjs`

Funciones puras: total de gastos, de ingresos y saldo de un mes; desglose por
rubro; serie por día. Todo en euros.

**Terminada cuando:**
- [x] Hay tests con movimientos en más de una moneda y en más de un mes,
      comprobando que ninguno se cuenta en el mes equivocado — con los bordes,
      que es donde falla: el día 1 y el último día. 29 tests; 286 en total.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en cinco puntos,
      incluido copiarle al Excel su tope de 1027 filas. Cada rotura hizo fallar
      tests.
- [x] Un test suma **2000 movimientos**, a propósito por encima de la fila donde
      la planilla original empieza a dar de menos (L-001).
- [x] Los números **cierran entre sí**: el desglose por rubro suma exactamente el
      total de gastos, y el día por día también. Si no cerraran, el usuario vería
      dos números distintos sin forma de saber cuál creer.
- [x] Comprobado **dentro de `dist/viajecor.html`** y además cargando un mes real
      por la pantalla: 122,24 € de gastos, que da igual hecho a mano, y el gasto
      de abril no se coló en marzo.

**Lo que salió de hacerla:**
- Un movimiento que **no se puede convertir a euros** (falta su tipo de cambio)
  no se cuenta como cero ni se descarta: sale aparte en `sinConvertir`, para que
  la pantalla pueda decir que el total está incompleto. Un total al que le falta
  un gasto y que no lo dice es peor que no mostrar ningún total. **T-014 tiene
  que mostrarlo.**
- El promedio por día divide por los **días transcurridos**, no por los del mes.
  A mitad de mes, dividir por 31 da un promedio artificialmente bajo.
- `movimientosDelMes()` estaba duplicado en la pantalla de carga y se movió acá:
  filtrar por mes es un cálculo, y dos copias de la misma regla terminan diciendo
  cosas distintas (L-005 aplicada al código).

---

### T-014 · Pantalla de resumen del mes — CU-04
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-013, T-010, T-006
**Toca:** `src/ui/pantallas/resumen.js`, `src/ui/app.js`, `src/estilos.css`, `test/resumen.test.js`, `tools/build.mjs`

---

### T-015 · Lista de movimientos, editar y borrar — CU-06
**Estado:** Lista · **Depende de:** T-011
**Toca:** `src/ui/pantallas/lista.js`

Con confirmación y deshacer al borrar. Borrar sin red de contención es la forma
más fácil de perder datos que el usuario no puede recuperar.

---

### T-016 · Exportar a JSON — CU-07
**Estado:** Lista · **Depende de:** T-004
**Toca:** `src/datos/exportar.js`, `test/exportar.test.js`, `src/ui/pantallas/datos.js`

**Prioridad alta pese al número:** hasta que esto exista, los datos del usuario
solo viven en un navegador y un borrado accidental los pierde para siempre.

---

### T-017 · Importar un respaldo JSON — CU-08
**Estado:** Pendiente · **Depende de:** T-016
**Toca:** `src/datos/importar.js`, `test/importar.test.js`

Con la elección explícita entre *reemplazar todo* y *agregar*, y con exportación
sugerida antes de importar.

---

### T-018 · Exportar a CSV — CU-07
**Estado:** Pendiente · **Depende de:** T-005, T-016
**Toca:** `src/datos/exportar.js`

Con monto original, moneda, tipo de cambio aplicado e importe en euros. UTF-8 con
BOM (sin BOM, Excel rompe los acentos).

---

### T-019 · Verificación real sin conexión — CU-09
**Estado:** Pendiente · **Depende de:** T-011 a T-018
**Toca:** `docs/PRODUCTO.md` (marcar casos de uso hechos), `CHANGELOG.md`, `VERSION`

Recorrido completo con el modo avión activado, sobre `dist/viajecor.html` abierto
desde el disco, en un celular real. Se anota qué se probó y qué falló.

**No se marca `Hecha` por deducción.** Se marca cuando alguien lo hizo.

---

## Etapa 2 — Análisis

Las cuatro son independientes entre sí: cuatro agentes pueden tomar una cada uno.

### T-020 · Gasto día por día del mes — CU-05
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/dias.js`

### T-021 · Evolución mes a mes — CU-10
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/evolucion.js`, `src/core/calculos.js`

Matriz mes × rubro con fila de total y de promedio, como `Analisis1`.

### T-022 · Promedio de gastos fijos — CU-12
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/fijos.js`

Agrupado por comentario: cuántas veces, total y promedio por pago.

### T-024 · Pantalla de monedas — CU-15
**Depende de:** T-008, T-010 · **Toca:** `src/ui/pantallas/monedas.js`

Ver las monedas, agregar una nueva (código, nombre, decimales) y ocultar las que
ya no se usan. Accesible también desde el formulario de carga, para cuando la
moneda que hace falta no está en la lista.

### T-023 · Gasto por viaje — CU-11
**Estado:** Necesita decisión · **Depende de:** T-013

**Preguntas abiertas para el usuario, antes de construir:**
1. ¿El viaje se elige de una lista que la app mantiene, o se sigue escribiendo a
   mano? Escribirlo a mano es lo que hoy hace que un typo saque gastos del total
   sin avisar.
2. ¿Cómo se cargan los vuelos y el alojamiento pagados antes del viaje? En el
   Excel están sumados a mano dentro de la fórmula (`=96+SUMIFS(...)` en París,
   `=850+...` en Costa Rica) y no hay registro de qué son.
3. ¿La duración del viaje se escribe, o se deduce de la primera y la última fecha
   con gastos de ese viaje?

---

## Etapa 3 — Traer el historial del Excel

### T-030 · Definir el mapeo Excel → modelo — CU-13
**Estado:** Pendiente · **Depende de:** T-003, T-009
**Toca:** `docs/MAPEO-EXCEL.md`

Escribir cómo se traduce cada columna de la planilla al modelo de la app, y qué se
hace con cada caso raro. Se trabaja contra `test/ejemplo/planilla-ejemplo.xlsx`,
que tiene la estructura real con montos inventados (T-009).

**Casos que el mapeo tiene que resolver, ya identificados:**
- Día (`C`) y mes (`D`) en columnas separadas → una sola fecha (RN-01).
- Rubro y tipo con mayúsculas inconsistentes → normalizar (RN-03).
- Filas sin monto: ¿se descartan o se importan en cero? Hay muchas en el original.
- Los bloques mensuales se repiten con encabezados en el medio: hay que saltearlos
  sin confundirlos con datos.
- Fechas como número de serie de Excel (`45931` = 2025-10-01), incluido el error
  histórico de que Excel considera 1900 bisiesto.
- El comentario (`B`) mezcla nombres de viaje y de gastos fijos recurrentes.

### T-031 · Lector de `.xlsx` sin librerías — CU-13
**Depende de:** T-009 · *Paralelizable con T-030*
**Toca:** `src/datos/xlsx.js`, `test/xlsx.test.js`

Leer un `.xlsx` en el navegador sin ninguna librería: abrir el ZIP a mano y
parsear el XML con `DOMParser`. Ver ADR-010 — está comprobado que se puede, sobre
la planilla real del usuario.

**Terminada cuando:** lee `test/ejemplo/planilla-ejemplo.xlsx` y devuelve las
celdas con su valor, distinguiendo texto, número y fecha.

### T-032 · Importador con informe de filas no interpretadas — CU-13
**Depende de:** T-030, T-031, T-017 · **Toca:** `src/datos/importar.js`

Fila por fila, qué no se pudo leer y por qué. Importar mal en silencio es peor
que no importar.

**También acepta CSV**, que es el formato de exportación de la app y sirve para
traer datos de otras fuentes.

---

## Etapa 4 — Ahorros conjuntos

### T-040 · Modelo de ahorros multimoneda — CU-14
**Depende de:** T-004 · **Toca:** `src/core/ahorros.js`, `test/ahorros.test.js`

Registro aparte: comentario, fecha, detalle, moneda, monto, persona (ALE/IRE),
tipo. **No se convierte a euros** — un plazo fijo en pesos uruguayos es en pesos
uruguayos.

### T-041 · Pantalla de ahorros conjuntos
**Depende de:** T-040, T-010 · **Toca:** `src/ui/pantallas/ahorros.js`

Total por moneda y total por persona y moneda.

---

## Independientes

Se pueden tomar en cualquier momento, no bloquean ni son bloqueadas.

- **T-900 · README de uso** — cómo descargar el HTML, guardarlo en el celular y
  usarlo sin conexión. Escrito para el usuario, no para un programador.
- **T-901 · Versionado y CHANGELOG** — el archivo `VERSION`, el `CHANGELOG.md` y
  la regla de `docs/PRODUCTO.md` §9 aplicada de verdad en cada publicación.
- **T-902 · Uso cómodo en celular** — botones grandes, teclado numérico al cargar
  montos, nada de texto de 11 píxeles. *(Depende de T-010.)*
- **T-903 · Recordatorio semanal de respaldo** — la app avisa si hace **más de
  una semana** que no se exporta (decidido por el usuario, 2026-08-19). Es la
  contramedida al riesgo más grave de la arquitectura: los datos viven en un solo
  navegador. El aviso se muestra dentro de la app, no como notificación del
  sistema — una notificación exigiría permisos y un servicio, y la app no tiene
  ni puede tener servidor. *(Depende de T-016.)*
- **T-904 · Modo oscuro** — *(Depende de T-010.)*
- **T-905 · Respaldo cómodo a la nube, sin red** — que exportar termine en un
  botón "compartir" que ofrezca OneDrive, Drive o correo, usando el propio
  sistema operativo. La app no hace ninguna petición: le entrega el archivo al
  teléfono y el teléfono hace el resto, así que RN-06 queda intacta.
  **Sin comprobar todavía:** que el compartir del navegador funcione con un HTML
  abierto desde el disco (`file://`) en iOS y en Android. Hay que probarlo en un
  celular real antes de prometerlo; si no anda, la salida es la descarga normal
  más subir el archivo a mano. *(Depende de T-016. Pregunta abierta 4.)*
- **T-907 · Decimales sugeridos por moneda** — al agregar una moneda, que la app
  proponga sola los decimales correctos según el estándar ISO 4217 (`JPY` → 0,
  `CLP` → 0, `KRW` → 0, `EUR` → 2…), con las veinte o treinta más usadas. Sigue
  siendo una **sugerencia**: el usuario la puede cambiar, y la lista de monedas la
  sigue manejando él (ADR-011). Pedido por el usuario el 2026-08-19.
  *(Depende de T-008. Se muestra en T-024.)*
- **T-908 · Reescalar los montos al corregir los decimales de una moneda** —
  decidido por el usuario el 2026-08-19. Hoy `cambiarDecimalesDe()` deja los
  montos como están y por lo tanto los **reinterpreta**: 1500 yenes cargados con
  2 decimales pasan a ser 150.000 yenes si se corrige a 0 (ADR-019). Tiene que
  ajustarlos para que sigan valiendo lo mismo.

  **El caso feo que hay que resolver, no esquivar:** bajar de 2 decimales a 0
  puede **perder información**. Un monto de 1500,50 no tiene forma de existir en
  una moneda sin decimales: hay que redondear, y eso cambia el importe. La app
  tiene que decir **cuántos movimientos pierden decimales y cuánto** antes de
  aplicar el cambio, no después. Subir de 0 a 2 decimales, en cambio, es exacto y
  no pierde nada.
  *(Depende de T-008. Se muestra en T-024.)*
- **T-906 · Exportar a `.xlsx` con la forma de la planilla** — una planilla de
  verdad, con fechas como fechas, además del CSV de T-018.
  *(Depende de T-016, T-018.)*

  **Qué reproduce de la planilla actual**, decidido con el usuario (2026-08-19):
  los bloques mensuales con su título (`OCTUBRE 2025`), los mismos encabezados de
  columna (`Comentarios`, `DÍA`, `MES`, `DETALLES`, `RUBRO`, `MONTO`, `I/G`), los
  bloques `GASTOS POR TIPO`, `INGRESOS POR TIPO`, `TOTALES` y `GASTO POR DÍA`, y
  una hoja de análisis con la matriz mes × rubro.

  **Qué NO reproduce, a propósito:** las fórmulas con rangos escritos a mano
  (`SUMIFS($G$8:$G$1027, …)`). Son exactamente el error que esta app existe para
  eliminar: el día que el registro pase esa fila, los totales dan de menos sin
  ningún aviso (L-001). El `.xlsx` exportado lleva **los números ya calculados**,
  no fórmulas. Si alguna vez se quieren fórmulas vivas para seguir trabajando en
  Excel, tienen que cubrir la columna entera (`G:G`) y no un rango con final
  escrito a mano — y eso es una decisión aparte, no un detalle de implementación.

  **Qué hay que resolver antes de escribir una línea:** el formato obliga a
  escribir espacios de nombres XML que son direcciones `http://…`, y la guardia de
  privacidad (T-007) rechaza cualquier `http://` en el archivo construido. No es
  una petición de red —nadie visita esa dirección, es un identificador— pero la
  guardia no puede distinguirlos hoy. La salida NO es debilitar la guardia con una
  excepción genérica: hay que declarar esos identificadores en un solo lugar,
  documentado, y que la guardia acepte esa lista y nada más.

  **Comprobado, no supuesto:** se generó un `.xlsx` con encabezados en negrita,
  fechas, textos y números armando el ZIP a mano —sin librerías y sin comprimir,
  porque el formato ZIP admite entradas *stored*— y lo abrió openpyxl, un lector
  de Excel real, devolviendo las fechas como fechas.

---

## Preguntas abiertas para el usuario

Se responden cuando el usuario quiera; hasta entonces las tareas que dependen de
ellas quedan `Necesita decisión`.

1. **Tipos de cambio históricos (RN-05).** Cambiar un tipo de cambio recalcula
   totales de meses ya cerrados. ¿Está bien así, o preferís que un movimiento
   quede congelado al tipo de cambio del momento en que lo cargaste?
2. **Viajes (T-023).** Las tres preguntas de esa tarea.
3. **Tildes al agrupar (ADR-013).** Hoy `Perú` y `Peru` son dos comentarios
   distintos, así que dos gastos del mismo viaje escritos con y sin tilde no se
   suman juntos. Ignorar las tildes lo arreglaría, pero también juntaría palabras
   que quizá quieras separadas. ¿Cómo lo preferís?

4. ~~**Respaldo periódico a GitHub o a OneDrive.**~~ **Respondida (2026-08-19):**
   se hace **sin red** — la app entrega el archivo al sistema operativo y el
   usuario elige dónde va (T-905) — **más un recordatorio semanal** de que hay
   que respaldar (T-903). La app no habla con ninguna nube: RN-06 queda intacta.
   Lo que sigue abajo es el razonamiento que llevó a esa decisión.

   **Contexto original.** El usuario quiere
   subir sus datos a la nube cada semana o cada quince días, de forma cómoda.
   Hay dos formas y **no son equivalentes**:

   - **Compartir el archivo exportado** desde el propio celular: la app genera el
     respaldo y lo entrega al sistema operativo, que muestra OneDrive, Drive,
     correo, lo que haya. **La app no hace ninguna petición de red**, así que
     RN-06 queda intacta. Requiere que el usuario toque "compartir" cada vez.
   - **Subir sola a una nube**: la app tendría que hablar con la API de OneDrive
     o de GitHub. Eso es **una petición de red**, rompe RN-06, rompe la guardia
     de privacidad de T-007, y obliga a guardar una credencial dentro del
     archivo. Deja de ser cierto que "abrís el HTML y ves que no le habla a
     nadie".

   Hasta que se decida, se construye la primera. Ver T-905.

6. ~~**Corregir los decimales de una moneda: ¿reinterpreta o reescala?**~~
   **Respondida (2026-08-19): reescalar.** Al corregir los decimales de una
   moneda, los montos ya cargados se ajustan para que sigan valiendo lo mismo:
   tus 1500 yenes siguen siendo 1500 yenes. Corregir un dato de la moneda no
   cambia el valor de ningún gasto. → T-908.

   El usuario planteó también la alternativa de **no dejar cambiar los decimales
   nunca** una vez elegidos. Es más simple y más segura, pero deja sin salida a
   quien se equivoca al agregar una moneda, así que se prefiere reescalar. Si
   T-908 resultara más frágil de lo previsto, prohibir el cambio es el plan B —
   y con T-907 (decimales sugeridos) el error se vuelve raro de entrada.

   Contexto original:
   Hoy, si cargaste 1500 yenes con la moneda configurada en 2 decimales y después
   la corregís a 0, esos movimientos pasan a valer 150.000 yenes — el número
   guardado se lee con otra escala (ADR-019). La app avisa cuántos movimientos
   afecta, pero no los toca.
   La alternativa es **reescalar**: al corregir los decimales, ajustar los montos
   guardados para que sigan valiendo lo mismo, y que tus 1500 yenes sigan siendo
   1500 yenes.
   *Lo que yo recomendaría:* reescalar, porque corregir un dato de la moneda no
   debería cambiar el valor de ningún gasto. Pero cambia lo que pasa con datos ya
   cargados, así que lo decidís vos.

5. ~~**Exportar a un Excel de verdad.**~~ **Respondida (2026-08-19):** sí, un
   `.xlsx` que además **reproduzca la forma de la planilla actual** (T-906).
   Lo que sigue abajo es el contexto.

   **Contexto original.** El usuario
   quiere abrir sus datos en una planilla parecida a la que usa hoy. T-018 solo
   prevé CSV, que Excel abre pero sin fechas ni formato.

   **Comprobado, no supuesto:** se puede generar un `.xlsx` de verdad sin ninguna
   librería. Un `.xlsx` es un ZIP con XML adentro, y el formato ZIP admite
   entradas **sin comprimir**, así que ni siquiera hace falta comprimir: alcanza
   con armar el ZIP a mano y calcular un CRC-32 (unas veinte líneas). Se probó
   generando una planilla con encabezados en negrita, fechas, textos y números, y
   abriéndola con un lector de Excel real (openpyxl), que devolvió **las fechas
   como fechas**. Ver T-906.

   **Lo que hay que resolver antes:** el formato obliga a escribir espacios de
   nombres XML que son direcciones `http://…`, y la guardia de privacidad (T-007)
   rechaza cualquier `http://` en el archivo construido. No es una petición de
   red —es un identificador—, pero la guardia no puede distinguirlos hoy.

### Respondidas

- ~~**Monedas.**~~ (2026-08-18) Euro, peso uruguayo, dólar y colón costarricense,
  **y la lista tiene que poder ampliarse desde la app en cualquier momento**.
  → RN-04b, ADR-011, T-008, T-024.
- ~~**Historial.**~~ (2026-08-18) Los montos reales son confidenciales y no van al
  repositorio. Se trabaja contra una planilla de ejemplo con la misma estructura y
  montos inventados. → T-009.
- ~~**Formato de importación.**~~ (2026-08-18) Se lee el `.xlsx` directo, sin
  convertir a CSV. → ADR-010.
