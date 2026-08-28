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
**Fecha:** 2026-08-18 · **Estado:** ❌ **Reemplazada por ADR-010** (2026-08-18)

**Decisión:** el importador del historial lee CSV. Para traer el Excel, se exporta
a CSV desde Excel primero.

**Por qué:** un `.xlsx` es un ZIP con XML adentro. Leerlo en el navegador
requeriría una librería de descompresión y otra de XML, que habría que meter
dentro del archivo entregable y mantener para siempre. Exportar a CSV es un paso
que el usuario hace una vez.

**Por qué se reemplazó:** la premisa era falsa y no la comprobé antes de decidir.
Ver ADR-010 y L-007.

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

---

## ADR-010 · Leer el `.xlsx` directamente en el navegador, sin librerías
**Fecha:** 2026-08-18 · **Estado:** Vigente · **Reemplaza a:** ADR-007

**Contexto:** ADR-007 decía que leer un `.xlsx` exigiría meter librerías dentro
del archivo entregable, y mandaba al usuario a exportar a CSV desde Excel. El
usuario preguntó qué implicaba eso, y al ir a comprobarlo resultó que la premisa
era falsa.

**Decisión:** el importador lee el `.xlsx` tal cual, sin conversión previa. El
usuario elige su planilla y la app la abre.

**Por qué:** un `.xlsx` es un ZIP con XML adentro, y el navegador moderno trae de
fábrica las dos piezas que hacen falta:

- `DecompressionStream('deflate-raw')` descomprime las entradas del ZIP.
- `DOMParser` parsea el XML.

Lo único que hay que escribir a mano es la lectura del directorio del ZIP, que
son unas cien líneas y no cambia nunca (el formato está congelado desde 1989).

**Comprobado, no supuesto:** se leyó la planilla real del usuario dentro de
Chromium con cero librerías, y devolvió sus encabezados correctos
(`OCTUBRE 2025`, `G/Acum./Mes`, `RUBRO`, `MONTO`, `I/G`) sobre 23.296 celdas.

**Lo que cuesta:** unas 150 líneas más de código propio en `datos/importar.js`, y
depender de una API que no existe en navegadores muy viejos. A cambio, el usuario
no tiene que convertir nada, y se evita el paso donde un CSV mal exportado
(separador, codificación, comas decimales) rompe la importación en silencio.

**Se sigue aceptando CSV además**, porque es el formato de exportación y sirve
para importar datos de otras fuentes.

---

## ADR-011 · La lista de monedas es un dato, no código
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** el usuario usa euro, peso uruguayo, dólar y colón costarricense, y
pidió explícitamente poder agregar monedas nuevas desde la app en cualquier
momento.

**Decisión:** las monedas viven en los datos guardados, no en el código. La app
arranca con cuatro precargadas y el usuario agrega las que quiera desde una
pantalla, indicando código, nombre y cuántos decimales usa.

**Por qué:** si la lista estuviera en el código, agregar una moneda para un viaje
imprevisto exigiría una versión nueva de la app. La persona estaría en otro país,
sin poder registrar sus gastos, esperando que alguien publique un archivo nuevo.

**Por qué el usuario elige los decimales:** el peso uruguayo y el dólar usan dos;
el yen y el peso chileno, ninguno. De ese número depende cómo se guarda el monto
en entero (ADR-005), así que equivocarlo desplaza todos los importes de esa moneda
por un factor de cien. La app propone 2 por defecto y explica qué significa.

**El euro es distinto:** es la moneda base (RN-04), viene fija y no se puede
borrar ni cambiar de decimales, porque todos los totales se expresan en euros.

---

## ADR-012 · Un monto ambiguo se rechaza, no se adivina
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** al interpretar lo que el usuario escribe, `"1.234"` y `"12,345"`
tienen exactamente la misma forma —un separador con tres dígitos detrás— y dos
lecturas posibles: mil doscientos treinta y cuatro, o doce coma treinta y cuatro
con un dígito de más.

**Decisión:** ese caso **no se interpreta**. La app rechaza el monto y pide que
se escriba sin separador de miles o con dos decimales, ofreciendo las dos
lecturas en el mensaje.

**Por qué:** las dos lecturas difieren por un factor de **mil**. Elegir una en
silencio significa que, cada tanto, un gasto entra mil veces más grande o más
chico de lo que fue, sin que nada lo delate — y una vez guardado, contamina el
total del mes, el del año y el del viaje. Preguntar molesta una vez; equivocarse
acá corrompe un número para siempre.

**Lo que cuesta:** alguien que pegue `"1.234"` desde su banco tiene que
reescribirlo. Es una molestia real, y la aceptamos: es el precio de que ningún
monto entre mal en silencio.

**Alternativa descartada:** deducir la convención por el resto de los datos ya
cargados. Suena más inteligente, pero convierte un error visible en uno que
depende del historial y aparece de forma intermitente — mucho más difícil de
notar y de explicar.

---

## ADR-013 · El comentario se guarda como se escribió y se agrupa por una clave
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** RN-03 dice que todo texto que agrupe se compara normalizado. El
rubro y el tipo salen de listas cerradas, así que guardarlos normalizados no
pierde nada: `supermercado` ya es su forma canónica. El **comentario** no: es lo
que el usuario escribe para nombrar un viaje, y si se guardara en minúsculas la
app mostraría `roma` para siempre.

**Decisión:**
- `rubro`, `tipo` y `moneda` se **guardan ya normalizados** (minúsculas el rubro,
  mayúsculas el código de moneda).
- `comentario` se **guarda tal como se escribió**, sin espacios de sobra, y todo
  cálculo que agrupe por comentario usa `claveDeComentario()`, que es la única
  función que decide cuándo dos comentarios son el mismo.

**Por qué:** separar "lo que se muestra" de "lo que agrupa" permite tener las dos
cosas. La alternativa —guardar minúsculas— cambia lo que el usuario ve por una
razón interna, y la otra —comparar exacto— es la trampa de L-002 y L-003.

**Lo que cuesta:** hay una regla que recordar: agrupar por comentario es agrupar
por su clave, nunca por el texto. Está en una sola función, con tests, y las
tareas que agrupan (T-013, T-021, T-022, T-023) tienen que usarla.

**Lo que esta clave NO hace: sacar las tildes.** `Perú` y `Peru` quedan como dos
grupos distintos. Sacarlas juntaría también palabras que el usuario quiso separar
y es una decisión de producto, no técnica: **queda como pregunta abierta** en
`docs/PLAN.md`. Se anota acá para que el que venga sepa que fue a propósito y no
un olvido (L-006).

---

## ADR-014 · Crear un movimiento y validar uno guardado son dos puertas distintas
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** un movimiento entra a la app por dos caminos: alguien lo escribe en
un formulario, o se lee de `localStorage` o de un respaldo. En el primer caso el
monto viene como lo tipeó una persona (`"12,50"`); en el segundo ya es un entero
de unidades mínimas (`1250`).

**Decisión:** dos funciones separadas. `crearMovimiento()` interpreta lo escrito y
necesita saber cuántos decimales usa la moneda; `validarMovimiento()` comprueba un
movimiento ya guardado y **no reinterpreta el monto**.

**Por qué:** una sola función tendría que adivinar qué significa `1250`, y las dos
lecturas —1250 € o 12,50 €— difieren por un factor de cien. Es exactamente la
clase de error que ADR-005 vino a evitar, y sería peor: aparecería solo al
reimportar un respaldo, meses después, sobre datos que ya se creían correctos.

**Lo que cuesta:** quien llama tiene que saber cuál usar. A cambio, la unidad del
monto nunca depende de una adivinanza: cada puerta la sabe por definición.

---

## ADR-015 · Un dato que no se entiende se aparta, nunca se pisa
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** `datos/almacenamiento.js` puede encontrarse con contenido que no
sabe leer: JSON cortado por una pestaña que se cerró a mitad de escritura, datos
de otra app bajo la misma clave, o un respaldo editado a mano. Hay que decidir
qué hace la app en ese momento.

**Decisión:** leer **nunca falla y nunca escribe encima**. Ante contenido
ilegible, la app arranca vacía para que se pueda usar, avisa con todas las
letras, y **copia lo ilegible a una clave aparte** (`viajecor:rescate:<fecha>`)
antes de seguir. La clave original tampoco se toca.

**Por qué:** acá vive la única copia de los gastos del usuario — no hay servidor,
ni papelera, ni historial (ARQUITECTURA §11). Las tres alternativas son peores:

- *Tirar un error y no abrir:* el usuario se queda sin ver ni lo que sí está bien,
  y sin ninguna forma de exportar lo que quedaba.
- *Arrancar vacío y guardar encima al primer cambio:* destruye para siempre un
  dato que quizá se podía rescatar a mano. Es el peor resultado posible y el más
  fácil de programar sin darse cuenta.
- *Arrancar vacío en silencio:* el usuario cree que perdió todo y no sabe que hay
  algo recuperable.

Un dato ilegible todavía se puede rescatar; uno sobrescrito, no. Esa asimetría es
la que manda.

**Lo que cuesta:** quedan claves de rescate ocupando lugar en el navegador hasta
que alguien las borre a mano, y `borrarEstado()` no las toca a propósito. Es
espacio a cambio de una segunda oportunidad.

---

## ADR-016 · Guardar mal tiene que doler; leer mal, no
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Decisión:** `leerEstado()` **nunca tira**: siempre devuelve algo usable más un
parte de incidencias. `guardarEstado()` **sí tira** cuando no pudo guardar.

**Por qué son opuestos:** son dos fallas con consecuencias distintas.

Si leer falla y la app no abre, el usuario pierde el acceso a todo, incluida la
posibilidad de exportar. Abrir con lo que se pudo rescatar siempre es mejor.

Si guardar falla —el almacenamiento del navegador está lleno, o el navegador está
en un modo que no deja escribir— y la app se lo traga para "no molestar", el
usuario sigue cargando gastos toda una tarde: los ve aparecer en pantalla, y
ninguno sobrevive a cerrar la app. Un error visible en el momento es
incomparablemente menos grave.

**La regla general:** una falla al leer se degrada; una falla al escribir se
grita. Vale para cualquier módulo que persista datos.

---

## ADR-017 · Un registro roto no se lleva puestos a los que están bien
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Decisión:** al leer los datos guardados, cada movimiento y cada tipo de cambio
se valida por separado. Los que no se entienden quedan afuera y se informan **uno
por uno, con su número y su motivo**; los demás se cargan normalmente.

**Por qué:** con 500 movimientos guardados y 3 rotos, descartar los 500 pierde
497 registros buenos, y aceptar los 3 en silencio cambia el total del mes sin que
nadie se entere — que es la falla que este proyecto entero trata de evitar
(L-001, L-008). Informar fila por fila es la misma regla que ya estaba escrita
para el importador de Excel (T-032): importar mal en silencio es peor que no
importar.

**Lo que cuesta:** la app tiene que mostrar esas incidencias en algún lado, y no
alcanza con un mensaje genérico. Un aviso que dice "algunos datos no se pudieron
leer" sin decir cuáles no sirve para nada.

---

## ADR-018 · Preguntar los decimales de una moneda que no está en la lista tira
**Fecha:** 2026-08-19 · **Estado:** Vigente · **Porqué corregido por:** ADR-019

> ⚠️ La decisión de abajo sigue en pie, pero **su justificación era falsa** y está
> corregida en ADR-019. No es cierto que elegir 2 decimales para el yen deje los
> importes cien veces más chicos: si la escala es consistente, los números salen
> bien. Leer ADR-019 antes que esto.

**Lo primero, porque se presta a confusión:** `decimales` **no dice cómo hay que
escribir un monto.** En euros podés escribir `15`, `15,0` o `15,00` y las tres
cosas se guardan igual, como 1500. `decimales` dice **cuántas subunidades tiene
la moneda**: el euro tiene céntimos, el yen no tiene nada más chico que el yen.
Es una propiedad de la moneda, no del movimiento.

**Y por eso tiene que ser una sola para toda la moneda:** el monto se guarda como
entero, y ese entero solo significa algo en relación a la escala de su moneda. Si
cada movimiento trajera su propia escala —uno guardado como `15` porque escribiste
"15", y otro como `1500` porque escribiste "15,00"— sumarlos daría 1515 en vez de
30,00 €. La escala uniforme es lo que permite que sumar sea sumar.

**Contexto:** `decimalesDe(monedas, codigo)` es lo que le dice al resto de la app
cómo interpretar un monto en una moneda. Si el código no está en la lista del
usuario, hay dos salidas: devolver 2 —que es lo que usan casi todas las monedas—
o negarse.

**Decisión:** se niega. Tira un error que nombra la moneda y dice qué hacer
("agregala antes de cargar el movimiento").

**Por qué:** el valor por omisión sería correcto casi siempre, y ese *casi* es el
problema. Cuando esté mal —el yen, el peso chileno, el guaraní: monedas sin
decimales— todos los importes de esa moneda quedan **cien veces más grandes o más
chicos**, sin ningún error, sin ninguna pantalla roja. Y no se nota en el momento:
se nota meses después, en un total del año que no cierra y que nadie sabe
explicar.

Es el mismo razonamiento de ADR-012 con los montos ambiguos: **un caso raro que
molesta hoy es preferible a un número mal que nadie ve nunca.** Un error visible
se arregla en diez segundos agregando la moneda; una suposición silenciosa
contamina un histórico entero.

**Lo que cuesta:** cada pantalla que cargue un movimiento tiene que tener el
catálogo a mano, y no puede improvisar. Es exactamente la disciplina que se
quiere.

---

## ADR-019 · Lo peligroso no es el valor de `decimales`, es que cambie
**Fecha:** 2026-08-19 · **Estado:** Vigente · **Corrige el porqué de:** ADR-018

**De dónde salió:** el usuario leyó ADR-018, no le cerró la justificación y
preguntó: *"si pongo 2 decimales al yen y después siempre escribo 1500 sin
decimales, ¿no se guarda igual 1500?"*. Tenía razón. La justificación que yo
había escrito era falsa.

**Lo que decía ADR-018 y es falso:** que elegir 2 decimales para el yen deja
"todos los importes de esa moneda cien veces más chicos".

**Lo comprobado, corriendo el código:**

| JPY configurado con | Escribís | Se guarda | Se muestra | En euros |
|---|---|---|---|---|
| 0 decimales | `1500` | `1500` | 1500 yenes | 9,30 € |
| 2 decimales | `1500` | `150000` | 1500 yenes | 9,30 € |

Nada se rompe. El entero guardado es distinto, pero **el valor es el mismo**,
porque la app siempre entra y sale por la misma escala. Una escala "equivocada"
pero **consistente** no produce ningún error.

**Dónde está el peligro de verdad, entonces:** en que la escala usada al
**escribir** y la usada al **leer** no coincidan. Eso pasa en dos situaciones:

1. **Cambiar los decimales de una moneda que ya tiene movimientos.** Un `150000`
   guardado con escala 2 (1500 yenes) leído con escala 0 son 150.000 yenes: cien
   veces más. Esto ya está previsto —`cambiarDecimalesDe()` obliga a avisar
   cuántos movimientos se reinterpretan— pero ahora se entiende que **es el único
   momento en que el número se corrompe**, no un riesgo difuso.
2. **Inventar una escala que no queda registrada en ningún lado.** Si el código
   supusiera 2 para una moneda que no está en la lista, esa suposición no se
   escribe en ninguna parte; el día que el usuario agregue esa moneda con 0
   decimales, todos esos movimientos cambian de significado. Es el caso 1
   disfrazado, y sin nadie que avise.

**La decisión de ADR-018 sigue en pie** —preguntar los decimales de una moneda
que no está en la lista tira, no supone 2— pero por este motivo, que es más
preciso: **no porque adivinar dé un número mal, sino porque adivinar deja una
escala sin registrar que después no coincide con la real.**

**Consecuencia práctica para el usuario:** elegir mal los decimales al agregar
una moneda es **mucho menos grave** de lo que decían PRODUCTO §RN-04b y CU-15.
Si te queda mal y lo dejás así, tus números están bien. Lo que hay que mirar con
cuidado es el momento de **corregirlos**.

---

## ADR-020 · El total es la suma de lo que se ve, no un número más exacto
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** al sumar en euros movimientos cargados en otra moneda hay dos
caminos, y dan resultados distintos:

1. Convertir cada movimiento, **redondear al céntimo**, y sumar los redondeados.
2. Convertir sin redondear, sumar, y redondear **una sola vez al final**.

El camino 2 es aritméticamente más exacto: arrastra menos error acumulado.

**Decisión:** el camino 1. Cada movimiento se redondea al céntimo antes de
sumarse.

**Por qué el menos exacto:** el céntimo es la unidad en que la app **muestra y
exporta** cada importe. Con el camino 2, alguien que sume a mano las filas de la
pantalla puede obtener un céntimo distinto del total que la app muestra abajo. Es
un error de un céntimo y no le cambia la vida a nadie — pero un total que no
coincide con la suma de lo que está en pantalla es un total que el usuario deja
de creer, y a partir de ahí deja de creer todos los demás números.

**No contradice ADR-005.** Ahí la regla es redondear una sola vez *por cálculo*,
para no acumular error dentro de una misma conversión: eso se sigue cumpliendo,
`convertirAEuros()` redondea una única vez. Lo de acá es otra cosa: cuál es el
valor de un movimiento **una vez expresado en euros**, y la respuesta es el que se
muestra.

**Lo que cuesta:** un total de mil movimientos convertidos puede diferir en unos
pocos céntimos del cálculo teóricamente perfecto. A cambio, todo lo que la app
muestra cierra consigo mismo.

---

## ADR-021 · La app no registra horas, solo días
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** al contarle al usuario el cuidado de zonas horarias del formateo de
fechas (L-011), su respuesta fue directa: *"no quiero que registremos el dato de
la hora del registro. Solo el día y chau, se acabó el problema."*

**Decisión:** ningún dato guardado lleva hora. La fecha de un movimiento ya era
un día (RN-01); `creado`, que era un instante completo
(`2026-03-14T20:11:03.000Z`), pasa a ser el día (`2026-03-14`). Lo mismo para los
tipos de cambio.

**Por qué es la decisión correcta y no solo una preferencia:** una hora obliga a
elegir una zona horaria para interpretarla, y esa elección es la que corre las
fechas de día (L-011). Sacar el dato saca la clase entera de errores, en vez de
defenderse de ellos caso por caso. La app no necesita la hora para nada: ningún
caso de uso de `PRODUCTO.md` la pide.

Además es un dato personal que deja de existir: sin horas, un respaldo exportado
no cuenta a qué hora de la noche alguien cargó sus gastos.

**Lo que cuesta:** dos movimientos cargados el mismo día no se pueden ordenar
entre sí por `creado`. No importa: la lista se ordena por la fecha del gasto, y
para desempatar está el orden en que están guardados.

**Se hace ahora porque es gratis ahora.** No hay ni un dato real cargado. El
mismo cambio con un año de historial encima obligaría a migrar el esquema.

**El cuidado de L-011 sigue siendo necesario**, aunque ya no haya horas guardadas:
mostrar `2026-03-14` sigue exigiendo construir un `Date`, y ahí la zona horaria
vuelve a aparecer. La diferencia es que ahora es un problema de una sola función
de presentación, con sus tests, y no algo que pueda contaminar un dato guardado.

---

## ADR-022 · La interfaz se parte en "qué se muestra" y "cómo se engancha"
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** `src/ui/` es la parte que toca el navegador, así que por definición
no se puede testear con `node --test`. Si toda la interfaz fuera código que
manipula el DOM, cada error de "el mes sale mal", "la pestaña marcada es la que no
es" o "el comentario del usuario rompe la página" solo aparecería abriendo la app
y mirando.

**Decisión:** cada pantalla se escribe como **funciones puras que reciben datos y
devuelven texto HTML**, más una única función (`iniciar()`) que las mete en el
documento y engancha los clics. La segunda capa se mantiene lo más chica posible.

**Por qué:** casi todos los errores de una interfaz son de la primera clase —qué
texto, qué número, qué está marcado— y esa clase entera se vuelve testeable sin
inventar un DOM falso ni arrancar un navegador. Queda del otro lado solo lo que
de verdad necesita un navegador para comprobarse.

Los 22 tests del armazón (T-010) son todos de la primera capa. Lo de la segunda
—que un clic en la flecha cambie el mes— se comprobó abriendo
`dist/viajecor.html` en un Chromium real, con pantalla de celular y zona horaria
de Montevideo: 0 peticiones de red, 0 errores de consola.

**Lo que cuesta:** armar HTML como texto obliga a escapar a mano todo lo que
venga de los datos (`escapar()`), y olvidarse una vez rompe la página con un `<`
en un comentario. A cambio, no entra ninguna librería de interfaz —que habría
que empaquetar dentro del entregable (ADR-003)— y el HTML resultante se puede
leer, que es parte de la garantía de privacidad.

**Cuándo revisar esto:** si una pantalla necesita conservar estado mientras se
edita (un formulario largo a medio llenar), redibujar todo con `innerHTML`
borraría lo escrito. Ahí habrá que dibujar solo el trozo que cambia — T-011 es la
primera que se va a topar con esto.

---

## ADR-023 · Lo escrito en el formulario vive en el documento, no en el estado
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** el armazón (T-010) redibuja la pantalla entera con `innerHTML` en
cada cambio. Un formulario a medio llenar se borraría. Había dos salidas:
redibujar solo el trozo que cambia, o guardar cada tecla en el estado de la app.

**Decisión:** ninguna de las dos. Lo escrito **se lee del documento en el momento
en que hace falta** —al guardar, o al cambiar de gasto a ingreso— y recién ahí
pasa al estado.

**Por qué no guardar cada tecla:** serían dos versiones del mismo dato, el
`<input>` y el estado, que hay que mantener en sincronía. Es la trampa de L-005
aplicada a un formulario: un dato, dos lugares, y tarde o temprano dicen cosas
distintas. Además obliga a redibujar en cada tecla, que en un celular viejo se
nota.

**Por qué no redibujar solo un trozo:** habría que decidir, para cada cambio, qué
parte de la pantalla se ve afectada. Esa decisión es donde aparecen los errores
de "cambié el tipo pero el rubro quedó del anterior".

**Cómo funciona:** hay un solo momento en que la pantalla se redibuja con datos
escritos —al pasar de gasto a ingreso, porque cambia la lista de rubros (RN-02)—
y ahí se lee el formulario primero y se vuelve a dibujar con esos valores. El
rubro sí se vacía, y tiene que vaciarse: el de antes ya no es válido.

**Lo que cuesta:** `ui/app.js` tiene una función que lee campos por nombre, y si
se agrega un campo al formulario hay que agregarlo también ahí. Es un punto de
olvido real. A cambio, no hay estado duplicado ni redibujado por tecla.

---

## ADR-024 · Importar un respaldo actualiza la fecha del último respaldo

**Contexto.** La pantalla de Datos avisa cuánto hace que no se respalda, leyendo
`preferencias.ultimo_respaldo`, que se anota al descargar. Al importar, ese dato
no existía en el dispositivo nuevo: el recorrido en el navegador mostró un
teléfono recién recuperado con un archivo **de hoy** diciendo *"Nunca
respaldaste"*.

**Decisión.** Después de importar, el último respaldo es **la fecha más reciente
entre la del dispositivo y la del archivo** (`exportado`), en los dos modos.

**Por qué.** El archivo *es* la prueba de que ese día hubo un respaldo: decir lo
contrario es falso y empuja a respaldar de nuevo algo que ya está a salvo. Y al
revés, un archivo viejo no puede atrasar la fecha: decir que el último respaldo
es más antiguo de lo que fue también es mentir. Se toma el máximo, que es la
única respuesta que no miente en ninguna de las dos direcciones.

**Lo que cuesta.** La fecha del archivo la escribe quien exportó, y un archivo
editado a mano podría traer cualquier cosa. Por eso pasa por `validarFecha()`, y
si no es una fecha del calendario se ignora en vez de romper la importación:
recuperar los gastos importa más que el aviso de respaldo.

**Alternativa descartada.** Anotar el día de la importación. Sería más simple,
pero diría que respaldaste hoy cuando lo que hiciste fue *restaurar* — y si el
archivo era de hace un mes, oculta que hace un mes que no respaldás, que es
exactamente lo que el aviso existe para no dejar pasar.

---

## ADR-025 · El respaldo llega a la nube por el sistema operativo, no por la app
**Fecha:** 2026-08-27 · **Estado:** Vigente · **Cierra:** pregunta abierta 4

**Contexto.** El usuario quiere subir sus datos a OneDrive cada semana o cada
quince días, cómodamente. Descargar el archivo y después buscarlo con un
explorador para subirlo son cuatro pasos, y **el respaldo que exige cuatro pasos
cada semana es el que no se hace**.

**Decisión.** La app le entrega el archivo al sistema operativo con el botón de
compartir del teléfono. El sistema muestra OneDrive, Drive, el correo, lo que
haya instalado, y el usuario elige. Cuando el teléfono sabe hacerlo, *Compartir*
es el botón principal y *Descargar* pasa a secundario.

**Por qué esto no rompe RN-06.** La app no hace ninguna petición de red: pasa un
archivo y termina su participación. Quien sube es OneDrive, con la sesión del
usuario, fuera de la app. Es lo mismo que descargar el archivo y arrastrarlo a
una carpeta sincronizada, sin los pasos del medio. La guardia de privacidad de
`tools/build.mjs` sigue en verde, y sigue siendo cierto que se puede abrir el
HTML y comprobar que no le habla a nadie.

**La alternativa que se rechazó** —que la app suba sola a la API de OneDrive o de
GitHub— es una petición de red: rompe RN-06, rompe la guardia de privacidad, y
obliga a guardar una credencial dentro del archivo que el usuario copia entre
teléfonos. Deja de ser verdad la única promesa que la app hace.

**Se pregunta con `canShare({files})`, no con `share`.** Hay navegadores que
comparten texto y direcciones pero no archivos; ahí `share({files})` falla
*después* de que el usuario apretó. En esta pantalla eso es especialmente caro:
el usuario se queda creyendo que respaldó. Si no se puede, el botón no está.

**No se manda `text` ni `url` junto al archivo.** Hay destinos que, si viene
texto, mandan el texto y se olvidan del archivo — se compartiría "algo" y el
respaldo no existiría.

**La fecha del respaldo se anota al volver, no al apretar.** Compartir es
asíncrono y el usuario puede cancelar. Anotar antes apagaría el aviso de "hace
tantos días que no respaldás" sin que hubiera salido ningún archivo, que es
exactamente el aviso que existe para que eso no pase.

**Lo que cuesta.** Depende de una API que no está en todos lados —y que no se
pudo probar en este entorno, porque Chromium de escritorio en Linux no la trae—.
Por eso el camino de descarga queda intacto y la comprobación en el celular real
del usuario es parte de T-019. Lo que sí se comprobó es que `file://` es
contexto seguro, que era el motivo más probable de que no funcionara.

---

## ADR-026 · El recordatorio cuenta movimientos sin respaldar, no días sin respaldar
**Fecha:** 2026-08-27 · **Estado:** Vigente

**Contexto.** El usuario pidió un recordatorio semanal de respaldo. La versión
obvia es "hace N días que no respaldás", que es lo que ya decía la pantalla de
Datos desde T-016.

**Decisión.** El aviso aparece cuando hay **movimientos sin respaldar** *y* pasó
el plazo. Las dos cosas: sin movimientos nuevos no aparece por más tiempo que
pase.

**Por qué.** Un año sin respaldar es irrelevante si no cargaste nada en ese año:
no hay nada que perder, y avisar igual es el aviso que enseña a ignorar avisos.
La falla cara de un recordatorio no es que no aparezca: es que aparezca cuando no
corresponde, porque el día que sí importa ya nadie lo lee.

Y por lo que dice: *"3 movimientos tuyos existen en un solo lugar"* es lo que
efectivamente se pierde. *"Hace 9 días que no respaldás"* es un reproche. Se
dicen los dos, pero el número que manda es el de los movimientos.

**Cómo se cuentan.** Por el día en que se cargaron (`creado`), no por la fecha
del gasto: cargar hoy un gasto de la semana pasada lo deja sin respaldar, por más
vieja que sea su fecha. Un movimiento creado **el mismo día** del último respaldo
cuenta como sin respaldar: la app no guarda horas (ADR-021), así que no se puede
saber si se cargó antes o después de exportar, y equivocarse hacia "ya está
respaldado" es equivocarse hacia perder datos.

**El aviso habla siempre en días**, también cuando nunca hubo un respaldo
(pedido del usuario, 2026-08-27). *"Nunca respaldaste"* es una etiqueta sobre la
persona; *"hace 12 días"* es un dato que se puede comparar con el de mañana. El
número significa lo mismo en los dos casos, porque **si nunca hubo un respaldo**
el plazo corre desde el movimiento más viejo, no desde siempre. Reclamarle un respaldo a quien cargó su primer gasto hace diez
minutos es la forma más rápida de que el aviso pierda todo su valor.

**Se pospone por el día, y eso se guarda.** Un aviso que no se puede sacar de la
pantalla se vuelve parte del decorado; uno que se apaga para siempre no sirve
para nada. "Ahora no" lo calla hasta mañana. Guardarlo es obligatorio: si no,
volvería en cada recarga, que es lo mismo que no poder sacarlo.

**Lo que cuesta.** Una preferencia más que persistir —`recordatorio_pospuesto`—,
con el riesgo de L-015 encima. Se agregó a la lista de `migrarEstado` en el mismo
commit, y el test que compara el objeto entero de preferencias la cubre.

---

## ADR-027 · Los espacios de nombres de XML son la única excepción de la guardia, y está acotada
**Fecha:** 2026-08-27 · **Estado:** Vigente

**Contexto.** Para exportar a `.xlsx` (T-906) hay que escribir XML, y el XML
identifica sus vocabularios con **espacios de nombres**: una etiqueta única que,
por una convención de los años 90, tiene forma de URL. Nadie se conecta ahí:
Excel abre un `.xlsx` sin conexión, y estas cadenas cumplen el mismo papel que el
número de serie de un electrodoméstico. Pero la guardia de privacidad rechaza
cualquier `http://`, así que la construcción fallaría.

**Decisión.** Se permite una lista **cerrada, explícita y acotada por dominio**
de espacios de nombres, y nada más. Tres condiciones se comprueban en cada
construcción:

1. Cada excepción tiene que estar bajo un dominio de esquemas conocido
   (`schemas.openxmlformats.org`, `schemas.microsoft.com`). Agregar
   `http://loquesea.com` a la lista **rompe la construcción**.
2. Cada excepción tiene que aparecer en el archivo **entre comillas**, como una
   cadena de texto. Una URL suelta en el código no pasa.
3. Sacando las excepciones, no puede quedar ninguna otra dirección.

**Lo que se rechazó, y por qué importa más que lo que se hizo.** La salida fácil
era partir la cadena en pedazos y volver a unirla en tiempo de ejecución. La
guardia no la vería y todo seguiría en verde — pero quedaría **en pie y ciega**,
y la próxima URL, una de verdad armada del mismo modo, pasaría igual. Una
comprobación que se puede esquivar es peor que ninguna, porque da confianza sin
darla. La otra salida fácil, apagar la guardia, al menos es honesta; esta no.

**Por qué la excepción no es una puerta.** Aunque estas cadenas estén en el
archivo, **no hay en todo el archivo una sola función capaz de usarlas**: los
otros patrones prohíben `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` y
`sendBeacon`. Una dirección sin nada que la marque es texto.

**Comprobado, no argumentado.** Se abrió `dist/viajecor.html` en Chromium con
**toda la red bloqueada e instrumentada**, y se recorrió la app entera —cargar,
corregir, cambiar de pantalla, exportar, descargar, importar, recargar—. Intentos
de salir a la red: **cero**. Es la diferencia entre "no debería hacer peticiones"
y "no hizo ninguna".

**De paso.** La lista de la guardia estaba escrita **dos veces**: una en
`tools/build.mjs` y otra en `test/privacidad.test.js`. Ahora vive una sola vez en
`tools/privacidad.mjs` y las dos la usan. Dos copias de una regla son dos reglas
que se separan, y la que se queda atrás es siempre la del test — que es la que se
mira para creer que todo está bien.

---

## ADR-028 · El XML del `.xlsx` se lee a mano, no con `DOMParser`
**Fecha:** 2026-08-28 · **Estado:** Vigente · **Corrige a:** ADR-010

**Contexto.** ADR-010 estableció que el `.xlsx` se lee directo en el navegador
—sin librerías, sin pedirle al usuario que convierta nada— usando
`DecompressionStream` para el ZIP y **`DOMParser` para el XML**. Al ir a
escribirlo, la segunda mitad de esa decisión no se sostuvo.

**El problema.** `DOMParser` es del navegador, y `datos/` no puede tocar el
navegador (ARQUITECTURA, regla 2 de `CLAUDE.md`). No es formalismo: significa que
**el importador no se podría probar con `node --test`**. Y el importador es lo
que va a tocar once meses de datos que no están en ningún otro lado — es
justamente el módulo que más falta que se pruebe hasta el último rincón.

Un módulo que solo se puede probar abriendo un navegador se prueba menos. Se
prueba a mano, se prueba una vez, y se deja de probar cuando cambia.

**Decisión.** Se escribe un lector de XML propio (`src/datos/xml.js`): unas 130
líneas que entienden **exactamente lo que un `.xlsx` usa** —etiquetas, atributos,
texto y las cinco entidades— y nada más. Sin espacios de nombres, sin DTD, sin
entidades definidas por el documento: un `.xlsx` no los tiene.

**Lo que se gana, además de poder probarlo.** No se construye un árbol: se
recorre el XML avisando de cada etiqueta. Una hoja de Excel con 30 000 celdas no
tiene por qué entrar entera en memoria dos veces —una como texto y otra como
árbol— para leer sus filas, y menos en un teléfono.

**Lo que cuesta.** Es código propio de un formato que no se inventó acá, y hay
que mantenerlo. Se acota escribiéndolo para lo que existe y no para lo que podría
existir, y probándolo contra los casos donde un lector ingenuo se rompe **en
silencio**: un `>` adentro de un valor de atributo, un texto partido en varios
trozos, un comentario con un `>` adentro, un archivo cortado a la mitad.

**Comprobado contra otro programa, no contra sí mismo.** Se leyó la copia de
estructura de la planilla del usuario con este lector y con **openpyxl**, y se
compararon las **1.614 celdas** una por una: cero diferencias, ni de valor ni de
posición ni de qué celdas existen. Un lector de formatos probado solo contra sus
propios archivos lee bien exactamente lo que él mismo escribe.

**Lo que sigue en pie de ADR-010:** el ZIP se abre con `DecompressionStream`, que
sí está en Node y en el navegador, y el usuario sigue sin tener que convertir su
planilla a nada.

---

## ADR-029 · Los colores de los rubros salen de la planilla del usuario, con el matiz conservado y la luz corregida

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-922

**El problema.** La app tenía una paleta categórica elegida por su legibilidad,
sin ninguna relación con la planilla que el usuario viene mirando desde octubre
de 2025. Ahí supermercado es naranja y viajes es verde desde hace once meses. Un
color es una etiqueta que se aprende una sola vez: cambiarla sin motivo obliga a
volver a leer los nombres, que es justo lo que el color evita.

**Lo que se descartó: copiar los pasteles tal cual.** Se midieron los ocho
colores de la planilla con el validador de la guía de visualización y dieron
**cuatro fallas**: quedan fuera de la banda de luz, seis de los ocho se leen como
gris por tener muy poco croma, `#FFCCCC` y `#FFCC99` se diferencian en **ΔE 6,6
con visión normal** —abajo del piso de 15— y el lila de salud está en el **mismo
matiz** que el violeta de entretenimiento (−53° contra −54°). Son colores
pensados para ser **fondo de celda con texto negro encima**, no para ser un punto
de 8 px o un pedazo de torta. Copiarlos habría sido fiel a la planilla y peor de
leer que lo que ya había.

**Lo que se hizo.** Se le sacó a cada color de la planilla su **matiz** —lo que
uno reconoce: "el rosa", "el naranja"— y se le asignó a ese rubro el paso ya
validado más cercano. Seis de los ocho se movieron **23° o menos**: siguen siendo
el mismo color con otro nombre técnico. Los dos que se movieron más son los dos
que estaban rotos: salud, porque su lila era indistinguible del violeta de
entretenimiento, y otros, porque su gris clarito no contrasta contra un fondo
blanco.

**Dónde sí van los pasteles, tal cual.** En los fondos de celda del `.xlsx`
(`FONDOS_RUBRO`), que es para lo que fueron elegidos y donde funcionan: ahí el
color es fondo de un texto negro, y se comprueba con la fórmula de contraste de
WCAG que ese texto se lea.

**Los ingresos también.** En la planilla trabajo es verde, inversiones celeste,
regalos rosa y otros gris. Antes la app los repartía por su posición en la lista.
Ahora `FRANJA_DE_INGRESO` los ata a los colores de la planilla, aunque eso
implique que un ingreso comparta color con un gasto: nunca aparecen en la misma
tabla, porque el desglose se dibuja por tipo. Los dos "otros" —gasto e ingreso—
comparten el gris por el mismo motivo, y eso da vuelta a propósito la decisión
que había tomado T-909.

**El límite que apareció.** Con ocho colores **ninguna** paleta pasa el validador
en `--pairs all` —todos contra todos—, ni la anterior. Se comprobó, no se
supuso. Por eso la torta de T-918 va a dibujar los rubros en **orden fijo**, no
por tamaño: así los pares que quedan pegados son siempre los mismos y se pueden
validar. Es la misma regla de siempre —el color sigue a la cosa, nunca a su
puesto en el ranking.

**Lo que quedó con aviso y no con falla.** Con fondo claro, dos pares dan ΔE 7,2
en visión con daltonismo y uno queda corto de contraste. La guía lo permite
cuando hay **rótulo directo**, y lo hay: cada fila dice su nombre y su importe, y
la torta va a llevar los nombres al lado. Con fondo oscuro la paleta pasa las
seis comprobaciones.

---

## ADR-030 · La torta reemplaza a las barras, y por eso la lista se queda

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-918

**Quién decidió qué.** El usuario pidió los dos gráficos que tiene en su
planilla —una torta por rubro y una línea de gasto acumulado— y decidió que la
torta **reemplace** a las barras de proporción, no que convivan.

**El costo, dicho antes de pagarlo.** Una torta se compara peor que una barra:
el ojo compara ángulos bastante peor que longitudes, y dos porciones de 23 % y
20 % se distinguen mucho menos que dos barras de esos largos. Lo que se gana es
el reparto **del todo** de un vistazo, y una forma que él ya reconoce.

**Cómo se paga el costo:** la lista de rubros ordenada de mayor a menor **no se
saca**. Ahí están el nombre, el importe y el porcentaje de cada uno, que es donde
se compara con precisión. La torta da la forma; la lista da los números. Sin la
lista, el cambio sí sería una pérdida neta, y esto deja de ser una decisión de
gusto.

**Las porciones se dibujan en el orden fijo de la paleta, no de mayor a menor.**
Con ocho colores ninguna paleta pasa el validador comparando todos contra todos
(ADR-029); sí pasan los pares que quedan **pegados**, siempre que sean siempre
los mismos. Dibujar por tamaño haría que cargar un gasto cambiara qué color toca
a qué color, y un par que hoy se distingue mañana no. Es la misma regla de
siempre: el color sigue a la cosa, nunca a su puesto en el ranking.

**El ángulo sale del importe, no del porcentaje redondeado.** Ocho números
redondeados no suman 360: la última porción quedaría con un hueco o pisando a la
primera.

**Solo las porciones grandes llevan su número adentro** (desde 8 %). Ocho
números en una torta de teléfono se pisan entre sí, y todos los porcentajes están
en la lista de abajo. Ese número es **el único texto de la app que no usa un
color de texto**: va encima de un color de rubro, así que se elige contra ese
fondo. El negro es el único que se lee sobre los ocho tonos en los dos modos —lo
peor es 4,2:1 sobre el verde—, y un test lo comprueba contra la paleta, para que
un cambio futuro de colores falle ahí y no lo descubra el usuario mirando un
"32 %" ilegible.

**La línea lleva las dos series, gasto e ingreso, en un solo eje.** El dato que
se busca ahí no es cuánto se gastó —eso ya está arriba en número grande— sino
**cuándo una cruza a la otra**. Son la misma unidad, así que comparten escala:
dos escalas en un mismo dibujo es la forma más común de mentir con un gráfico,
porque hace que la línea de abajo parezca alcanzar a la de arriba. Cada línea
dice cuál es **donde termina**, no en una referencia aparte.

**En el mes en curso la línea se corta en el día de hoy.** Si siguiera hasta el
31, quedaría plana desde hoy hasta fin de mes, y una meseta en un acumulado se
lee como "dejó de gastar". Esos días no pasaron todavía.

**Se dibuja en SVG escrito a mano.** No es purismo: una biblioteca de gráficos se
trae de un CDN y eso está prohibido (RN-06). Un sector de círculo y una polilínea
son dos fórmulas de trigonometría.
