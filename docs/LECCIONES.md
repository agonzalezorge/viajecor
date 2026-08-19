# Lecciones aprendidas

> Cada vez que aparece un error real, la pregunta no es solo "¿cómo lo arreglo?"
> sino **"¿qué patrón general lo hizo posible?"**. Acá quedan esos patrones.
> Se lee **antes** de escribir código nuevo.
>
> **Solo se agrega al final.** No se reescribe lo que ya está.

---

## L-001 · Un rango fijo en una fórmula es una bomba de tiempo silenciosa

**De dónde salió:** del Excel original, antes de escribir una línea de la app.

Las fórmulas de la planilla suman rangos con el final escrito a mano, y **no
coinciden entre sí**. En una misma fila del mismo bloque mensual conviven:

- `SUMIFS($G$8:$G$9721, ...)` — gastos por tipo
- `SUMIFS($G$8:$G$9421, ...)` — gasto por día
- `SUMIFS($G8:$G10121, ...)` — ingresos por tipo
- `SUMIFS(Gastos!$G$8:$G$1027, ...)` — la hoja `Analisis1`

Hoy el registro llega a la fila 370, así que todos los rangos alcanzan y todo
cierra. **El día que el registro pase la fila 1027, la hoja `Analisis1` va a
empezar a dar totales de menos.** No va a haber ningún error, ninguna celda roja,
ningún aviso: los números simplemente van a estar mal. Y como van a estar apenas
mal, es probable que nadie lo note.

**El patrón:** *un cálculo cuyo alcance está escrito a mano y no crece con los
datos falla en silencio.* No falla: miente.

**Qué hacemos en la app:** ningún cálculo recibe un rango. Las funciones de
`src/core/calculos.js` reciben **la lista completa de movimientos** y filtran
adentro. No hay un número máximo de filas en ninguna parte del código. Si alguna
vez aparece un límite escrito a mano en un cálculo, es un error, no una
optimización.

---

## L-002 · Que dos textos "sean iguales" depende de quién los compare

**De dónde salió:** del Excel original.

En la planilla conviven `viajes` y `VIAJES` como rubro, `G` y `g` como tipo, y
`EUROS` y `euros` como moneda. Todo funciona igual de bien, porque `SUMIFS` de
Excel compara sin distinguir mayúsculas.

Una app que compare con `===` trataría `VIAJES` y `viajes` como dos rubros
distintos. Los totales por rubro darían mal **y la app no tendría forma de
saberlo**: no hay error, hay una categoría fantasma con parte del dinero adentro.

**El patrón:** *cuando se migra un cálculo de una herramienta a otra, las reglas
implícitas de la herramienta vieja se pierden.* Excel comparaba sin distinguir
mayúsculas y nadie lo pidió: venía de fábrica. Al reimplementarlo, esa regla hay
que escribirla a mano o desaparece.

**Qué hacemos en la app:** RN-03. Todo texto que sirva para agrupar se normaliza
—sin espacios sobrantes, sin distinguir mayúsculas— **antes** de compararse o
guardarse. Está en `src/core/modelo.js`, un solo lugar, con tests.

---

## L-003 · Un identificador escrito a mano hace desaparecer datos sin avisar

**De dónde salió:** del Excel original.

El nombre del viaje vive en la columna de comentarios, escrito a mano en cada
línea. La hoja `Analisis1` suma los gastos de `Roma` buscando exactamente esa
palabra. Un `Roma ` con un espacio de más, o `roma` en un teclado con mayúsculas
apagadas, no entra en el total del viaje.

No aparece en otro lado: **desaparece**. El gasto sigue contado en el total del
mes, pero el viaje sale más barato de lo que fue.

**El patrón:** *cuando el identificador de un grupo es texto libre, el error de
tipeo no produce un error: produce un dato que se pierde.*

**Qué hacemos:** está anotado como decisión abierta en T-023 de `docs/PLAN.md`.
Lo importante es que se decida a propósito y no por omisión.

---

## L-004 · Un número mágico dentro de una fórmula pierde su significado

**De dónde salió:** del Excel original.

En la tabla de gastos por viaje hay dos fórmulas con un número sumado a mano:

```
París:      =96+(SUMIFS(...))
Costa Rica: =850+(SUMIFS(...))
```

y una duración escrita como `=52-11`.

Casi con seguridad son vuelos y alojamiento pagados fuera del registro. Pero eso
no está escrito en ninguna parte: hay que deducirlo. Dentro de un año, nadie va a
poder decir si esos 850 eran el vuelo, el hotel, o las dos cosas — ni si ya están
contados también en alguna línea del registro.

**El patrón:** *un dato metido dentro de una fórmula es un dato sin nombre, sin
fecha y sin explicación.* Deja de ser información y pasa a ser un número.

**Qué hacemos en la app:** cualquier monto que forme parte de un total tiene que
ser **un movimiento con fecha, rubro y detalle**, nunca una constante dentro de un
cálculo. Si un vuelo se pagó en enero para un viaje de marzo, es un movimiento de
enero con el comentario del viaje. Los cálculos no tienen constantes.

---

## L-005 · Dos formas de decir la misma fecha se desincronizan

**De dónde salió:** del Excel original.

El registro tiene el día en una columna (`DÍA`) y el mes en otra (`MES`), como
dos datos independientes. Nada obliga a que sean coherentes ni con la realidad ni
entre sí, y hay filas donde el día no sigue el orden de las de alrededor. Puede
ser un movimiento cargado tarde, o puede ser un error de tipeo: **desde la
planilla no hay forma de distinguirlos.**

Y como los pivots de gasto diario cruzan día y mes por separado, un día mal
tipeado manda el gasto a otro día del mismo mes sin que ningún total general lo
delate.

**El patrón:** *guardar el mismo hecho en dos campos independientes garantiza que
tarde o temprano digan cosas distintas.* Un dato, un lugar; el resto se calcula.

**Qué hacemos en la app:** RN-01. Un movimiento tiene **una fecha**. El día, el
mes y el año se derivan de ella. No existe un campo "mes" que se pueda editar por
separado.

---

## L-006 · Dos totales sobre rangos distintos parecen consistentes y no lo son

**De dónde salió:** del Excel original.

En la hoja `Analisis1`, la fila de totales suma `D4:D14` y la fila de promedio
promedia `D4:D13`. Una incluye agosto de 2026 y la otra no.

Puede ser deliberado —tiene sentido excluir el mes en curso de un promedio—, pero
no está escrito en ningún lado. Quien lea la planilla dentro de un año va a ver un
total y un promedio que no se corresponden, y va a tener que decidir si fue a
propósito o fue un descuido.

**El patrón:** *una decisión sin explicación es indistinguible de un error.* Y lo
peor: la próxima persona (o el próximo agente) la va a "arreglar", cambiando el
comportamiento sin darse cuenta.

**Qué hacemos:** las reglas de este tipo van escritas en `docs/PRODUCTO.md` como
reglas de negocio, con su porqué. Si un promedio excluye el mes en curso, eso es
una regla, no un detalle de implementación, y la app lo dice en pantalla.

---

## L-007 · Una decisión tomada sobre una premisa no comprobada es una adivinanza con formato de decisión

**De dónde salió:** de este mismo proyecto, el primer día.

ADR-007 decidió que el importador leería CSV en vez de `.xlsx`, con este
razonamiento: *"leer un xlsx en el navegador requeriría una librería de
descompresión y otra de XML"*. Sonaba sensato, estaba bien argumentado, y quedó
escrito como decisión firme.

Era falso. El navegador trae `DecompressionStream` y `DOMParser` de fábrica. Se
comprobó en diez minutos, leyendo la planilla real dentro de Chromium sin una sola
librería. La decisión le habría costado al usuario un paso manual de conversión —
con todo lo que un CSV mal exportado puede romper— para siempre, por una premisa
que nadie verificó.

**El patrón:** *una decisión bien argumentada sobre una premisa técnica no
comprobada se ve exactamente igual que una decisión correcta.* El formato de ADR,
con su "por qué" prolijo, hace que suene aún más sólida. Nada en el documento
delata que el dato de base era una suposición.

Y hay un agravante: la decisión se documentó, así que la suposición quedó
consagrada. El siguiente que la leyera iba a confiar en ella sin volver a
preguntarse si era cierta.

**Qué hacemos:** cuando una decisión se apoya en *"esto no se puede hacer"* o
*"esto requeriría X"*, hay que comprobarlo antes de escribirla, y el ADR tiene que
decir **cómo se comprobó**. Si no se comprobó, se escribe *"suponemos que…"* con
todas las letras, para que el que venga sepa que ahí hay algo por verificar y no
una conclusión.

---

## L-008 · Una regla que resuelve una ambigüedad la esconde, no la elimina

**De dónde salió:** de un test que falló al escribir `core/dinero.js` (T-002).

Al interpretar montos escritos a mano hacía falta una regla para el separador
decimal, porque conviven `"12,50"`, `"12.50"` y `"1.234,56"`. La regla elegida
fue: *el último separador es decimal si lo siguen uno o dos dígitos; si no, es de
miles*. Resolvía todos los casos, se leía razonable, y quedó escrita.

El test que la iba a confirmar la desmintió: con esa regla, `"12,345"` —alguien
que quiso escribir `12,34` y se le escapó un dígito— se convierte en **12.345 €**
sin ningún error. Un factor de mil, en silencio, en el monto de una persona.

La regla no estaba mal formulada. El problema es que **la ambigüedad seguía ahí**:
`"1.234"` y `"12,345"` son indistinguibles. La regla no la resolvía, elegía una
lectura y dejaba de mostrar la duda.

**El patrón:** *cuando un dato admite dos lecturas, cualquier regla que devuelva
siempre un resultado está ocultando el problema, no resolviéndolo.* Y lo oculta
justo donde más duele: en el camino feliz, sin error, sin aviso.

**Qué hacemos:** si el dato es genuinamente ambiguo y las dos lecturas dan
resultados muy distintos, la app **rechaza y pregunta** (ADR-012). Un caso raro
que molesta es preferible a un número mal que nadie ve.

**Y una lección sobre los tests:** este error lo encontró un test escrito para
comprobar otra cosa. La regla parecía correcta al leerla; solo se cayó al
ejecutarla contra un caso concreto. Es exactamente por qué "lo probé y anda" y
"debería andar" se escriben distinto.

---

## L-009 · Dos textos idénticos en pantalla pueden ser distintos para la máquina

**De dónde salió:** de escribir la normalización de textos de `core/modelo.js`
(T-003), buscando en qué otras formas puede fallar la comparación de L-002.

En Unicode, `Perú` se puede escribir de dos maneras: con una `ú` de una sola
pieza (U+00FA) o con una `u` seguida de una tilde combinante (U+0075 U+0301). Se
dibujan **exactamente igual** en cualquier pantalla, y `===` dice que son
distintas. No es un caso de laboratorio: el teclado de iOS y el texto copiado
desde macOS producen a veces la segunda forma, y este proyecto se usa
principalmente desde un celular.

Sin normalizar, dos comentarios que el usuario ve iguales serían dos viajes
distintos. Y a diferencia de `Roma ` con un espacio de más (L-003), **acá no hay
nada que mirar**: se puede tener el dato en la pantalla, leerlo con atención, y
no ver ninguna diferencia. La única forma de descubrirlo es comparar los códigos
de los caracteres, que es algo que a nadie se le ocurre hacer.

**El patrón:** *"iguales" para una persona e "iguales" para la máquina no son la
misma relación, y la diferencia no siempre es visible.* L-002 era el caso
visible (mayúsculas, espacios); este es el mismo problema sin síntoma.

**Qué hacemos en la app:** `normalizarTextoVisible()` aplica `normalize('NFC')`
antes que nada, así que las dos formas se guardan y se comparan como una sola.
Está en `core/modelo.js`, en el mismo lugar donde se sacan los espacios y se
bajan las mayúsculas: un texto pasa por una función o por ninguna.

**Y una lección de método:** este error no lo encontró un test que falló. Se
encontró preguntando *"¿de qué otra forma pueden dos textos parecer iguales sin
serlo?"* después de leer L-002. Vale la pena hacerse esa pregunta cada vez que se
implementa la contramedida a una lección vieja: las lecciones describen una
categoría de error, no un caso.
