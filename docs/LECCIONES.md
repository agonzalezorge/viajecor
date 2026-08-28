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

---

## L-010 · Explicar una consecuencia sin probarla es inventarla con voz de experto

**De dónde salió:** de este proyecto, explicándole a su dueño una decisión que yo
mismo había tomado (ADR-018).

Escribí que elegir 2 decimales para el yen dejaría "todos los importes de esa
moneda cien veces más chicos". Sonaba obvio: el yen no tiene decimales, poner 2
tiene que desplazar la coma. La frase pasó por un ADR, por un mensaje de commit y
por dos explicaciones al usuario sin que nadie —yo incluido— la comprobara.

El usuario preguntó: *"si pongo 2 y siempre escribo 1500 sin decimales, ¿no se
guarda igual 1500?"*. Cinco líneas de código después: **sí, se guarda bien, se
muestra bien y se convierte a euros bien.** Una escala equivocada pero consistente
no produce ningún error, porque la app entra y sale siempre por la misma escala.

Lo grave no es que la conclusión fuera falsa. Es que la decisión que apoyaba era
**correcta** —hay que preguntar los decimales, no adivinarlos— pero por otro
motivo, y ese motivo verdadero es más preciso y más útil: el número se corrompe
solo cuando la escala **cambia** entre que se escribe y que se lee. Con la
justificación falsa, cualquiera que leyera el ADR mañana habría buscado el peligro
en el lugar equivocado.

**El patrón:** *L-007 dijo que una decisión apoyada en una premisa no comprobada
se ve igual que una correcta. Esto es lo mismo un escalón más abajo: una
**consecuencia** narrada sin comprobar se ve igual que una medida.* Y es más fácil
que se cuele, porque una consecuencia suena a razonamiento y no a dato — nadie
siente que haya nada que verificar.

**Qué hacemos:** cuando una explicación diga "si pasa X, entonces Y", **Y se
prueba**, con el mismo criterio que se prueba el código. Vale para los ADR, para
los mensajes de commit y para lo que se le dice al usuario. Si no se probó, se
escribe "creo que" con todas las letras.

**Y una lección sobre quién encuentra los errores:** este no lo encontró un test
ni una revisión. Lo encontró el usuario, que no programa, preguntando por qué algo
no le cerraba. La pregunta ingenua sobre una explicación que no cierra es un
método de detección de errores, y hay que tratarla como tal en vez de volver a
explicar lo mismo con más palabras.

---

## L-011 · La zona horaria convierte una fecha sin hora en un día distinto

**De dónde salió:** de escribir el formateo de fechas (T-006), comprobando cómo
se comporta `Intl` antes de usarlo.

La fecha de un movimiento es un día del calendario: `2026-03-14`. No tiene hora ni
zona horaria, porque un gasto pasó el 14 y punto. Pero para mostrarla hay que
convertirla a un `Date`, y ahí aparece el problema:

```
new Date('2026-03-14')  →  la MEDIANOCHE del 14, en UTC
```

Mostrada en el dispositivo, el navegador la traduce a la zona horaria de donde
esté la persona. En Montevideo (UTC−3), la medianoche UTC del 14 son **las 21:00
del día 13**:

```
America/Montevideo  →  13/3/2026     ← el gasto aparece el día anterior
Europe/Madrid       →  14/3/2026
```

No es un caso de laboratorio: este usuario tiene gastos y ahorros en pesos
uruguayos. Y el síntoma es de los peores, porque **es indistinguible de un error
de carga**: la persona ve un gasto el día 13, piensa que se equivocó al anotarlo,
y "lo corrige". Además ensucia el gasto por día (CU-05) y puede mandar un
movimiento al mes anterior si cae un día 1.

**El patrón:** *un dato sin hora convertido a un instante adquiere una hora que
nadie eligió, y esa hora lo puede correr de día.* La conversión parece inocua
porque no se pierde información —el `Date` "contiene" la fecha— pero al mostrarlo
se le aplica una zona que el dato nunca tuvo.

**Qué hacemos en la app:** `core/formato.js` construye la fecha al **mediodía
UTC** y la formatea con `timeZone: 'UTC'`. Al mediodía, ninguna zona del mundo
—de UTC−12 a UTC+14— la corre de día. Hay un test que formatea la misma fecha en
cinco zonas horarias, en procesos aparte, y exige que las cinco den `14/03/2026`;
y otro que comprueba que **la forma ingenua sí se corre**, para que el día que
deje de correrse sepamos que el cuidado dejó de hacer falta.

**Y una lección sobre cómo se encontró:** no apareció por un error, apareció por
probar `Intl` antes de usarlo. La primera prueba dio bien —el contenedor corre en
UTC— y eso **no probaba nada**. Solo al repetirla con una zona horaria real salió
el fallo. Una prueba que corre en el entorno más favorable puede ser peor que
ninguna: da confianza sin dar información.

---

## L-012 · Un formulario que borra lo escrito al fallar enseña a no usarlo

**De dónde salió:** de decidir qué hace la pantalla de carga (T-011) cuando la
validación rechaza un movimiento.

La app rechaza cosas a propósito y con motivo: un monto ambiguo (ADR-012), un
rubro que no corresponde al tipo (RN-02), una fecha que no existe (RN-01), una
moneda sin tipo de cambio (RN-04). Cada uno de esos rechazos evita un número mal.

Pero hay una forma fácil de escribir esa pantalla —redibujarla entera con el
formulario limpio— que convierte cada rechazo en **dos castigos**: no se guardó,
y además hay que volver a escribir todo. Y el segundo castigo cae sobre alguien
que ya hizo bien nueve de los diez campos.

El resultado no es que la persona escriba mejor la próxima vez. El resultado es
que deja de cargar gastos en el momento, que es exactamente el problema que la
app venía a resolver.

**El patrón:** *una validación estricta y un formulario que se vacía se
combinan para castigar al usuario por un error que la app ya detectó.* Cada una
por separado es razonable; juntas hacen que la app se vuelva incómoda justo
cuando más está trabajando bien.

**Qué hacemos en la app:** ante un error, `intentarGuardar()` devuelve el
borrador **tal cual llegó**, y la pantalla lo vuelve a dibujar con todo lo
escrito. El error se muestra arriba del formulario, no abajo: en un celular, un
mensaje abajo obliga a desplazarse para enterarse de por qué no se guardó. Y hay
un test que rompe a propósito la carga para comprobar que lo escrito sobrevive.

**La otra cara:** cuando la carga sí funciona, el formulario se vacía **pero
conserva la fecha**. Cargar tres gastos del sábado no puede obligar a poner la
fecha tres veces. La regla general que queda: *después de un error se conserva
todo; después de un acierto se conserva lo que probablemente se repita.*

---

## L-013 · Un control que dibuja el sistema no habla necesariamente tu idioma

**De dónde salió:** de mirar la pantalla de carga (T-011) en un navegador real y
ver la fecha escrita `08/25/2026`.

`<input type="date">` no lo dibuja la app: lo dibuja el navegador, y elige el
formato según **su propio idioma**, no el de la página. La app puede estar
enteramente en español, con `Intl` configurado en `es-ES`, y ese control seguir
mostrando el mes primero. Comprobado: forzando el idioma del navegador a español
el formato **no cambió**.

El problema no es estético. `08/25/2026` es leíble —no existe el mes 25— pero
`08/09/2026` es genuinamente ambiguo: puede ser el 8 de septiembre o el 9 de
agosto. Alguien que revisa sus gastos no tiene forma de saber cuál.

**El patrón:** *un control nativo se ve como parte de la app y no lo es.* Todo lo
que la app dibuja se puede controlar y testear; lo que dibuja el sistema
—calendarios, selectores, teclados, menús de compartir— responde a la
configuración del dispositivo, y desde el código no hay forma de decidirlo ni,
muchas veces, de averiguarlo.

**Qué hacemos en la app:** no se pelea con el control, se lo vuelve irrelevante.
Debajo del campo, la app escribe la fecha en palabras —*jueves, 31 de diciembre
de 2026*— con su propio formateo, que sí controla y sí está testeado. Comprobado
con el navegador en inglés: el control muestra `12/31/2026` y la línea de abajo
dice la fecha correcta en español.

**La forma general de la solución, que sirve para los otros casos:** cuando algo
depende del entorno y no se puede controlar, **agregar al lado un dato que sí se
controle**, en vez de intentar forzar el entorno o de suponer que va a portarse
bien. Es más barato y no depende de averiguar nada.

---

## L-014 · Una función con tests puede estar muerta en la app de verdad

**De dónde salió:** de recorrer T-012 en un navegador, con los 257 tests en
verde. Aparecieron dos errores que ningún test veía, y los dos estaban en la
misma frontera.

**El primero, y es el que más enseña.** `dibujarAvisoCorreccion()` muestra la
consecuencia de corregir un tipo de cambio: *"afecta a 2 movimientos; el total de
ese mes sube de 24,60 € a 31,00 €"*. Tenía tests, pasaban, y el texto que
producía era correcto.

En la app mostraba siempre la versión pobre: *"este tipo de cambio lo usan 2
movimientos"*, sin ningún número. El motivo: la pantalla se dibuja una vez, con
el campo vacío, y **no se vuelve a dibujar mientras el usuario escribe**. La
función se llamaba siempre con el valor vacío. Los números —lo único que hacía
valiosa esa función— no se veían nunca.

Los tests la llamaban directamente, con un valor escrito. Probaban que la función
está bien. No probaban que la app la use bien, que es otra cosa.

**El segundo, más grave.** Corregir un tipo de cambio **sin ningún gasto
esperando** no se guardaba. La pantalla mostraba el valor nuevo aplicado; al
recargar volvía el viejo. El código guardaba el tipo de cambio recién después de
reintentar el movimiento pendiente, y si no había ninguno, ese reintento fallaba
y se salía antes de escribir. Un dato perdido en silencio, con la pantalla
diciendo que todo salió bien.

**El patrón:** *los tests de una capa pura prueban que la pieza es correcta, no
que la app la use.* Todo lo que vive en el enganche —cuándo se redibuja, en qué
orden se guarda, qué pasa cuando el caso es el otro— es invisible para ellos. Y
es donde caen los errores más caros, porque son los que el usuario ve como "la
app perdió mi dato".

**Qué hacemos:** ADR-022 ya decía que la capa de enganche se prueba abriendo la
app. Esto la convierte en una obligación, no en una buena costumbre: **toda tarea
que agregue una pantalla tiene que recorrerse en un navegador antes de darse por
hecha**, y el recorrido tiene que terminar recargando la página para comprobar
qué sobrevivió de verdad. Los dos errores de arriba los encontró exactamente eso.

**Y una regla que sale del segundo:** cuando una acción del usuario produce dos
efectos —guardar el tipo de cambio y guardar el movimiento— **se persiste el
primero antes de intentar el segundo**. Si el segundo falla, el primero ya está a
salvo. Encadenarlos hace que el fallo de uno se lleve puesto al otro.

---

## L-015 · Una lista blanca que hay que acordarse de actualizar falla hacia el lado que parece funcionar

**De dónde salió:** de exportar el respaldo (T-016). La app guardaba el día del
último respaldo, la pantalla decía *"Respaldaste hoy"*, y al recargar volvía a
decir *"Nunca respaldaste"*.

`datos/almacenamiento.js` lee las preferencias guardadas **una por una**, a
propósito: un respaldo editado a mano puede traer cualquier cosa ahí adentro, y
copiar el objeto entero metería esa basura en los datos. La decisión es correcta.

El problema es cómo falla cuando alguien agrega una preferencia y se olvida de
esa lista. No hay error, no hay aviso, y —esto es lo importante— **funciona
perfectamente mientras la app está abierta**: el dato está en memoria, la
pantalla lo muestra, todo se ve bien. Desaparece al recargar, que es justo cuando
nadie está mirando la pantalla.

**El patrón:** *una lista blanca que hay que mantener a mano no falla al
escribir, falla al leer — y por eso falla tarde, en otra sesión, lejos del cambio
que la causó.* La forma equivocada se ve exactamente igual que la correcta
durante todo el rato en que uno está probando.

**Qué hacemos:**
- La lista lleva un aviso escrito arriba, nombrando el síntoma: *agregar una
  preferencia y olvidarse acá la hace desaparecer al recargar*.
- Hay un test que guarda **todas** las preferencias y exige que vuelvan todas.
  No comprueba una en particular: compara el objeto entero, así que la próxima
  que se agregue sin actualizar la lista lo rompe.
- Y la regla de método, que ya venía de L-014 y esto confirma: **el recorrido en
  el navegador termina recargando la página.** Sin esa recarga, este error habría
  llegado al celular del usuario intacto.

**Y un detalle de paso.** Al validar la fecha del respaldo escribí primero una
expresión regular de la forma `\d{4}-\d{2}-\d{2}`. `2026-13-01` la pasa, y el mes
13 no existe. Comprobar la forma no es comprobar la fecha: hay que usar
`validarFecha()`, que mira el calendario. Es L-005 otra vez, del lado de un
ajuste en vez de un movimiento — las lecciones vuelven disfrazadas.

---

## L-016 · Un botón que no puede hacer nada es peor que ninguno

**Qué pasó.** Al recorrer la importación en el navegador, pegué el mismo respaldo
dos veces. La segunda, la app dijo *"Entran 0 movimientos nuevos y se saltean 3
que ya tenías"* y ofreció igual el botón **Agregar**. Apretarlo guardaba el
estado sin cambiar nada y contestaba *"Entraron 0 movimientos"*. En la misma
pantalla, la advertencia de reemplazo decía *"Se borrarían 1 movimiento"*.

**Por qué ningún test lo vio.** Los 384 tests comprobaban los **números** —que
agregar no duplica, que `sePierden` cuenta bien— y todos daban bien. Ninguno leía
la frase completa ni preguntaba si la acción ofrecida tenía sentido. Los tests
verificaban que la app *calcula* bien; el recorrido verificó que *se entiende*.
Es L-014 otra vez, del lado de la redacción: una función con tests puede estar
diciendo una tontería.

**Por qué importa más de lo que parece.** Esta pantalla es la de recuperar datos.
El usuario que la está usando acaba de perder el teléfono y está buscando señales
de que la recuperación salió bien. Un botón que no hace nada, o un número
escrito con el verbo mal conjugado, le enseña a desconfiar justo del número que
tiene que leer con atención: cuántos movimientos se van a borrar.

**Lo que se hizo.**

- Cuando no entra ningún movimiento, la app lo dice en castellano —*"No entra
  ninguno: los 3 movimientos del archivo ya los tenías"*— y el botón va
  `disabled`. No se ofrece una acción imposible.
- Se arregló la concordancia en singular, y hay tests que leen la frase entera y
  que **rechazan la versión rota** (`'Se borrarían 1'` tiene que no aparecer).
- La regla de método: en un recorrido, **apretar los botones que no tienen
  sentido**. El camino feliz ya lo cubren los tests; lo que el navegador aporta
  es el camino tonto.

---

## L-017 · El constructor no comprobaba su propia lista

**Qué pasó.** Al agregar `src/ui/compartir.js` y usarlo desde `app.js`, los 401
tests siguieron en verde, `node tools/build.mjs` dijo *"185.8 kB — 16
módulo(s)"* sin una sola queja… y el `dist/viajecor.html` resultante **no tenía
el módulo adentro**. La app construida se habría roto al abrirla, con un
`ReferenceError` sobre una función que en el código fuente existe.

**Por qué.** `tools/build.mjs` concatena los archivos de una lista escrita a
mano, `MODULOS`. Los tests corren sobre `src/` con `import` de verdad, así que
para ellos el módulo existe. La lista era el único lugar donde había que
acordarse, y nada comprobaba que estuviera completa.

**Es L-015 otra vez, en otro archivo.** Ahí era una lista blanca de preferencias
que había que acordarse de actualizar; acá es una lista de módulos. El patrón
es el mismo y la forma de fallar también: **falla hacia el lado que parece
funcionar**. Todo verde, y el error aparece en el celular del usuario.

**Lo que se hizo.** El constructor ahora lee los `import` de cada módulo y
**falla si alguno apunta a un archivo que no está en la lista**:

```
src/ui/app.js importa src/ui/compartir.js, que no está en MODULOS. Al concatenar,
ese archivo no entraría y la app fallaría recién al abrirla. Agregalo a la lista.
```

Comprobado sacando el módulo de la lista a propósito y viendo el error aparecer.

**La regla general que deja.** Cuando una lista escrita a mano tiene que estar
sincronizada con algo que el código ya sabe, **la comprobación la escribe el
código, no la memoria de quien edita**. Si no se puede comprobar, el olvido es
cuestión de tiempo — y estas dos lecciones son la prueba de que en este proyecto
ya pasó dos veces.


**Postdata (T-903, el mismo día).** La comprobación nueva atrapó el mismo olvido
una tarea después —`app.js` importaba `recordatorio.js` y la lista no lo tenía—,
y de paso una segunda cosa: dos módulos declaraban una función `enDias` idéntica.
El constructor la rechazó por nombre repetido, lo que obligó a mirarla y a
descubrir que era **la misma resta de fechas escrita dos veces**. Ahora vive una
sola vez, en `core/modelo.js` como `diasEntre()`. La comprobación se pagó sola
dos veces en veinticuatro horas.

---

## L-018 · Un test puede ser circular y no poder fallar nunca

**Qué pasó.** Al pasar la planilla de Excel a una rejilla, escribí un test para
comprobar que el bloque de resumen de un mes no se escribiera encima del mes
siguiente. Decía, más o menos: *"la fila donde empieza abril tiene que ser mayor
que la última fila de marzo"*, y calculaba «la última fila de marzo» como **la
mayor de las filas que están entre marzo y abril**.

Pasaba. Y seguía pasando cuando rompí el código a propósito para que abril se
metiera en el medio de marzo: al meterse, las filas pisadas quedaban *después*
de abril, dejaban de contar como «filas de marzo», y la comparación seguía dando
bien. El test no podía fallar.

**Lo detectó la mutación, no la lectura.** Leído, el test parecía razonable —yo
lo escribí creyendo que probaba algo—. Lo que lo delató fue romper el código y
ver que seguía en verde. Es el argumento entero a favor de romper el código a
propósito: **un test que pasa no dice nada hasta que se lo ve fallar.**

**El patrón, para reconocerlo la próxima.** El test definía lo que iba a medir
*usando* el resultado que quería comprobar. «Las filas de marzo son las que están
antes de abril» ya da por cierto que marzo está antes de abril, que es
exactamente lo que había que probar. Cuando una definición del test menciona lo
que el test quiere demostrar, el test es una tautología con forma de
comprobación.

**Cómo quedó.** Se reemplazó por uno que cuenta cosas que existen
independientemente del orden: que haya **dos** calendarios de gasto por día, que
uno tenga sus 31 días de marzo y el otro los 30 de abril **completos y en orden**,
y que los dos títulos de mes sigan existiendo. Si un bloque pisa al otro,
desaparecen celdas, y eso se ve sin preguntarle al orden.

**Y una segunda cosa de la misma tarea.** La rejilla guarda una celda por
posición: la última en escribirse gana, **sin ningún aviso**. El primer rubro del
resumen caía en la misma fila que su encabezado `RUBRO` y lo borraba en silencio.
Una estructura que resuelve los choques sola es cómoda, y por eso mismo los
esconde: donde antes había un error visible, ahora hay un dato menos.

---

## L-019 · `typeof` no protege de una variable que tira al nombrarse

**Qué pasó.** El almacenamiento de la app empezaba así:

```js
if (typeof localStorage === 'undefined') throw new Error('No hay dónde guardar…');
return localStorage;
```

Parece la comprobación defensiva de manual. No lo es. Hay navegadores donde
`localStorage` **no falta**: existe, y **tira una excepción con solo nombrarlo**
—una ventana privada, o el almacenamiento de sitios bloqueado—. `typeof` evalúa
la variable, así que tira también. El error subía hasta `iniciar()` y la app
quedaba **en blanco**, sin una sola palabra en la pantalla.

Lo más incómodo: era **exactamente el escenario que ese mismo código decía
manejar**. El comentario decía "suele pasar en ventanas privadas de algunos
navegadores", y en ventanas privadas de algunos navegadores la app no abría.

**Cómo apareció.** No lo encontró ningún test: en Node no hay `localStorage`, así
que la rama que se ejercitaba era la benigna. Lo encontró el recorrido en el
navegador, bloqueando `localStorage` a propósito para probar **otra cosa** — el
aviso de T-950 —. El bug que se cruzó en el camino era más grave que el que se
iba a probar.

**La regla.** `typeof x === 'undefined'` protege de que `x` **no exista**. No
protege de que existir sea lo que falla. Para cualquier cosa que el navegador
expone como propiedad global —`localStorage`, `sessionStorage`, `indexedDB`,
`navigator.…`— la única comprobación que sirve es **usarla dentro de un
`try`**.

**Y la decisión de diseño que salió de ahí.** Cuando no hay dónde guardar, la app
ya no tira: usa un almacén de mentira que **se lee como vacío y falla con un
motivo entendible al escribir**. Así la app abre, se puede recorrer, avisa que
nada se guarda, y **se niega a aceptar un movimiento que no puede guardar**
(ADR-016). Una app que no abre no puede explicar por qué no abre.

---

## L-020 · Una simulación que no simula nada da un verde falso

**Qué pasó.** Para probar en el navegador el caso `content://` —el que le hizo
perder los datos al usuario— escribí esto antes de cargar la página:

```js
Object.defineProperty(window.location, 'protocol', { get: () => 'content:' });
```

El aviso apareció. Di por buena la prueba. **Y la simulación no había funcionado
nunca**: Chromium no deja redefinir `location` así. El aviso que veía era un
**falso positivo distinto** —el del bug de L-019, que hacía saltar el aviso
siempre—, y cuando arreglé ese bug, el "sí, aparece" se convirtió en "no
aparece" y quedó al descubierto que la simulación no simulaba nada.

**Lo que enseña.** Una prueba tiene que fallar cuando la cosa está rota, **y
también** hay que comprobar que la condición que se cree estar creando existe de
verdad. La simulación nunca afirmó "el protocolo ahora es content:"; yo lo di
por hecho porque el resultado esperado apareció. Es el mismo error que L-018 con
otra cara: **el resultado correcto por el motivo equivocado se ve idéntico al
resultado correcto.**

**Cómo quedó.** El caso `content://` lo cubren los tests, que llaman a la función
pura y no necesitan navegador. El recorrido prueba el otro caso —`localStorage`
bloqueado—, que **sí se puede provocar de verdad**, y de paso destapó L-019.
Cuando algo no se puede simular con honestidad, se prueba en el nivel donde sí
se puede, y se dice cuál es cuál.

---

## L-021 · Un control que dibuja el sistema puede no dibujar nada

Es L-013 otra vez —«un control que dibuja el sistema no habla necesariamente tu
idioma»— pero un escalón más abajo, y peor.

**Qué pasó.** El autocompletado del comentario (T-912) se hizo con `<datalist>`,
que es la forma estándar y la más barata: se escribe una lista de opciones y el
navegador se encarga de mostrarlas. En el Android del usuario **no muestra
nada**. No falla, no avisa, no hay error en ninguna consola: el campo se comporta
como un campo de texto común y la funcionalidad simplemente no existe.

**Por qué no lo vio nadie.** Los tests comprobaban que el `<datalist>` estuviera
en el HTML con sus `<option>` adentro — y estaba, perfectamente formado—. El
recorrido en Chromium de escritorio lo mostraba. Todo verde en los dos lados. Lo
único que no se podía comprobar era lo único que importaba: que el navegador del
usuario **decidiera dibujarlo**.

**La diferencia con L-013.** Allá el control del sistema hacía algo distinto de
lo esperado —mostraba la fecha en otro formato—, y se resolvió escribiendo la
fecha en palabras al lado. Se podía compensar porque el problema **se veía**.
Acá el control no hace nada, y no hay nada que compensar: la única salida es no
usarlo.

**La regla que queda.** Cuando algo se le delega al navegador, hay que
preguntarse: *si no lo hace, ¿me entero?*

- Si la respuesta es **sí** —el calendario de la fecha, que se ve— se puede
  delegar y compensar.
- Si es **no** —una lista que aparece o no aparece, y nadie del lado del código
  puede saber cuál de las dos— hay que escribirlo, aunque cueste más. Un control
  propio son treinta líneas de más y se puede ver, tocar y comprobar. Uno cedido
  son tres líneas y una promesa.

**Y una tercera cosa, sobre cómo se encontró.** No lo encontró un test ni un
recorrido: lo encontró **el usuario en su teléfono**. Las dos primeras veces que
lo reportó, la causa fue otra —una vez tenía el archivo viejo, otra la
instrucción de prueba que le di era imposible de cumplir—. Recién a la tercera
quedó claro que el problema era real. La lección de método: **cuando alguien
reporta lo mismo tres veces, dejar de pedirle que lo pruebe distinto y cambiar el
código**. Cada vuelta le cuesta a él una prueba, y a esa altura ya salía más
barato construir la versión que no puede fallar.

---

## L-022 · Un dato que ya está no se vuelve a interpretar

**Qué pasó.** El usuario importó su planilla real por primera vez. El informe
rechazó **127 de 742 filas**, todas con este mensaje o parecido:

> `"80.13149784261351"` no es un monto: los separadores de miles tienen que
> agrupar de a tres dígitos.

Ninguna de esas filas tenía nada malo. `80.13149784261351` son **ochenta euros
con trece**, el resultado de una fórmula de conversión de moneda en su Excel.

**El error, que es de una línea.** El importador tomaba el número de la celda,
lo convertía a texto con `String(monto)`, y se lo daba a `aMinimas()` — que es
el lector de importes de la app, hecho para **lo que escribe una persona**. Y
para una persona que escribe en castellano, el punto separa los miles. Leído con
esas reglas, `80.13149784261351` está mal escrito, y `aMinimas()` lo rechazaba
con toda la razón.

`aMinimas()` **ya aceptaba números** y los redondeaba bien. La conversión a texto
no agregaba nada: metía un traductor entre dos que ya se entendían, y el
traductor hablaba otro idioma.

**Por qué ningún test lo encontró.** La copia de estructura de la planilla
(T-009) generaba todos los montos con `Math.round(monto * 100) / 100`: siempre
dos decimales, siempre limpios. Se había construido copiando **la forma** de la
planilla real —los bloques, las mayúsculas inconsistentes, las columnas
separadas— pero no sus **valores**, y el problema estaba en los valores.

Una copia de estructura que solo copia lo prolijo no sirve para probar un
importador. Ahora el generador produce las tres formas que tiene la planilla
real: redondeados, con los decimales largos de una conversión de moneda, y
escritos a mano como texto con coma.

**Lo que enseña, más allá de este caso.** Cada vez que un dato cruza una frontera
—de una celda a un modelo, de un formulario a un cálculo, de un archivo a una
pantalla— hay que preguntarse **qué reglas de interpretación se le están
aplicando del otro lado**, y si son las que corresponden a de dónde viene ese
dato. Un número que ya es un número no necesita que lo lean: necesita que lo
dejen pasar. Convertirlo a texto en el medio no es neutral, es **elegir un
idioma** — y acá se eligió el de un humano escribiendo para un dato que ninguna
persona escribió.

**Y una cosa sobre el método, que es la que más vale.** Esto no lo encontró un
test, ni un recorrido, ni una revisión del código: lo encontró **el informe de la
importación**, leído por el usuario antes de aceptar. El importador se negó a
importar 127 filas y explicó cada una con su número y su motivo. Si hubiera
importado en silencio lo que entendía y descartado el resto sin decir nada
—como hace el Excel original, L-001—, el usuario habría cargado 615 movimientos,
habría visto totales creíbles, y **el error se habría descubierto meses después
o nunca**. El informe no fue una cortesía: fue lo que hizo que el error durara
veinte minutos en vez de para siempre.

---

## L-023 · La app encontró un error en el Excel que vino a reemplazar

**Qué pasó.** Después de arreglar L-022, el usuario volvió a importar su planilla.
Un solo mes no coincidía:

> 2025-10: la planilla dice 1.484,78 € y se leyeron 1.499,03 €

La diferencia es **14,25 €**, y ese número ya había aparecido: era la fila 11 del
informe anterior, la única del mes con el monto escrito como **texto** en vez de
como número (`"14,25"`, un supermercado del 2 de octubre).

**La app tenía razón y la planilla estaba mal.** En Excel, `SUMA()` **ignora el
texto en silencio**: no da error, no marca la celda, simplemente no la cuenta.
Durante diez meses ese octubre dijo 1.484,78 € y eran 1.499,03 €.

**Es L-001 con otra cara.** La lección estaba escrita desde el primer día del
proyecto —*«ningún cálculo tiene un límite de filas escrito a mano: así es como
el Excel original miente en silencio»*— y era sobre un rango de fórmula que se
queda corto. Resultó que la misma planilla tenía **otra** forma de mentir, que
nadie había anticipado: una celda que parece un número, se lee como un número, y
no suma. Las dos comparten la forma que importa: **el total se ve perfectamente
creíble y está mal.**

**Lo que lo encontró.** No un test: la comprobación contra el acumulado de la
propia planilla (§6 del mapeo), que corre **una sola vez** porque después la
planilla se archiva. Se había puesto con un argumento defensivo —«es la única
oportunidad de contrastar contra un número calculado por otra herramienta»— y
terminó sirviendo para lo contrario de lo que se esperaba: no para desconfiar de
la app, sino para **descubrir un error de diez meses en el original**.

**Lo que se cambió a partir de esto.** El aviso decía «un mes no cuadra» y
listaba los dos números. Ahora **separa leer de más de leer de menos**, porque
son problemas distintos y el usuario no tiene por qué deducirlo:

- **De más** → lo más probable es un gasto que la planilla no sumaba. Se explica
  el caso del monto escrito como texto y cómo reconocerlo (queda pegado a la
  izquierda de la celda).
- **De menos** → hay que mirar la lista de filas que no entraron.

Un «no cuadra» a secas hace pensar que la app se equivocó. En el caso más
frecuente es al revés, y decirlo mal desperdicia el hallazgo.

**La moraleja de método.** Cuando dos sistemas dan números distintos, la pregunta
no es «¿dónde me equivoqué?» sino «¿cuál de los dos está mal?». Dar por sentado
que el sistema viejo tiene razón porque es el que estaba primero es la forma más
elegante de importar sus errores.

---

## L-024 · Buscar un valor en todo el archivo encuentra el que no era

**Cuándo:** 2026-08-28, cambiando la paleta (T-922).

El test que impide que el CSS y `core/paleta.js` se separen buscaba cada color
suelto en todo el archivo: `--rubro-5:\s*#a552b7\s*;`. Parece razonable, y estaba
en verde.

Se le rompió a propósito el `--rubro-5` del **fondo claro**. El test **no falló**.
El motivo: el archivo declara los ocho rubros dos veces —una para el fondo claro
y otra para el oscuro—, y el violeta es uno de los dos colores que valen lo mismo
en los dos modos. La búsqueda global lo encontró en el bloque oscuro y dio por
buena una declaración clara que ya no existía. Peor todavía, la lista de colores
del modo oscuro no la comprobaba **nadie**: era un comentario ejecutable.

**La regla:** cuando un archivo declara la misma cosa más de una vez, un test que
la busca en todo el archivo comprueba "existe en algún lado", no "está donde
tiene que estar". Hay que leer las declaraciones **en orden y por bloque**, y
exigir cuántas son. Ahora el test junta las dieciséis, exige que sean dieciséis,
que estén en orden 1…8 dos veces, y compara cada mitad contra su lista.

**Cómo apareció:** no la encontró nadie leyendo. La encontró una mutación —cambiar
un color a mano y ver si algún test se quejaba—, que es exactamente para lo que
sirven. Un test que no falla cuando rompés el código a propósito no está
probando nada.
