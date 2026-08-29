# Cómo usar Viajecor

Esta guía es para usar la app, no para programarla. Lo técnico está en el
`README.md` y en `docs/`.

---

## 0. Antes que nada: tener la versión que creés que tenés

**Empieza acá y no es un trámite.** El 27 de agosto de 2026 se hizo una ronda de
pruebas completa sobre un archivo viejo: tres cosas "no funcionaban" y las tres
eran cosas que todavía no existían en esa copia. Un informe de pruebas sobre el
archivo equivocado describe un programa que no existe (L-020 y la nota de T-919).

Así que, cada vez que bajes una versión nueva:

1. Bajá `dist/viajecor.html` del repositorio.
2. Guardalo **encima** del anterior, en `Descargas`.
3. Abrilo y mirá **el número de versión arriba a la derecha**. Tiene que ser el
   que esperabas.

Si vas a probar algo que te pedí que probara, hacé esos tres pasos primero.

---

## 1. Dónde guardar el archivo (esto sí importa)

**En Android, abrí la app desde el navegador escribiendo la dirección del
archivo**, no tocándolo desde *Archivos*.

En Chrome, en la barra de direcciones:

```
file:///sdcard/Download/viajecor.html
```

**Por qué.** Cuando Android le pasa el archivo al navegador desde *Archivos*, no
le pasa su ubicación sino un permiso temporal (`content://…`). Para el navegador,
cada apertura es **un sitio distinto**, y los datos que guardás en uno no existen
en el otro: cerrás Chrome, volvés a abrir, y no hay nada. Le pasó al usuario de
esta app y por eso está escrito acá (L-019, T-950).

La app se da cuenta y **te avisa** si no va a poder guardar. Si ves ese cartel,
no cargues nada: cerrá y abrila por la dirección.

**Para tenerla a mano en la pantalla de inicio** hay tres caminos, en este orden:

1. Chrome → menú de los tres puntos → *"Añadir a pantalla de inicio"*. Es lo más
   simple; puede no aparecer para archivos locales.
2. Una app de accesos directos (por ejemplo *Shortcut Maker*): crear un acceso de
   tipo *URL* con `file:///sdcard/Download/viajecor.html`, abriéndolo **con
   Chrome**.
3. Guardarla en favoritos y usar el widget de marcadores de Chrome.

> **Cuidado con esto:** el ícono tiene que abrir el archivo **en el mismo
> navegador donde están tus datos**. Si lo abre con otro, vas a ver la app
> vacía. No perdiste nada —tus datos siguen en el otro navegador—, pero **no
> cargues nada ahí**: cerrá y abrí como siempre.

---

## 2. Lo primero que hay que hacer: respaldar

Tus datos existen **en un solo lugar**: el navegador de tu teléfono. Si borrás
los datos de navegación, se pierden. No hay servidor del que recuperarlos, y esa
es la razón de ser de la app, no un descuido.

En la pestaña **Datos** hay tres descargas, y **solo una es un respaldo**:

- **Respaldo** → *"Descargar viajecor-AAAA-MM-DD.json"*. Es el único archivo que
  la app puede volver a leer. Guardalo en tu nube.
- **Planilla de Excel** → *"Descargar viajecor-AAAA-MM-DD.xlsx"*. Para mirar en
  Excel. **No es un respaldo**: no lleva los tipos de cambio ni tus monedas, así
  que no se puede volver a cargar. La app lo dice ahí mismo.
- **CSV** → para hacer cuentas en otro programa. Tampoco es un respaldo.

La app te avisa sola cuando hace más de una semana que no respaldás, y te dice
**hace cuántos días** y **cuántos movimientos** están sin copia.

**Respaldá ahora mismo si acabás de importar tu planilla vieja.**

---

## 3. Traer tu planilla de Excel — una sola vez

En **Datos → Traer tu planilla de Excel** elegís el `.xlsx` directamente, sin
convertirlo a nada.

La app **primero te muestra qué encontró** —cuántos movimientos entran, de qué
meses, y qué filas no pudo leer y por qué— y recién ahí confirmás. Antes de
confirmar no cambia nada.

Dos cosas que hace a propósito:

- **No descarta nada en silencio.** Si una fila no entra, te dice cuál y por qué.
- **Compara sus totales con los de tu planilla, mes por mes**, y te avisa si
  alguno no coincide. Puede pasar que la app tenga razón y la planilla no: si un
  monto está escrito como texto, `SUMA()` de Excel lo ignora sin avisar. Pasó de
  verdad, con 14,25 € (L-023).

Se puede volver a importar el mismo archivo sin miedo: los movimientos llevan un
identificador derivado de su fila, así que no se duplican. Te va a decir "entran
0 movimientos nuevos".

---

## 4. El día a día

**Cargar** es la primera pestaña porque es lo que más se hace, muchas veces
parado en la caja del supermercado.

- **Monto y moneda.** Si gastaste en otra moneda, la elegís acá. La app te va a
  pedir el tipo de cambio del mes la primera vez, y lo reusa para todos los
  gastos de ese mes.
- **Rubro.** El campo se pinta del color del rubro elegido: es la confirmación de
  que quedó puesto el que querías, sin tener que releerlo.
- **Detalle** — una nota para acordarte. No agrupa nada.
- **Etiqueta (agrupar por)** — **esto sí agrupa.** Es lo que junta los gastos de
  un viaje o de un gasto fijo. Por eso la app te ofrece las que ya usaste:
  `Barcelona26` y `barcelona 26` son **dos grupos distintos** en los totales, y
  elegir la que ya existe es la forma más barata de que no se te parta un total
  en dos.

**Mes** te responde "¿cómo vengo?": los tres números, la torta del reparto por
rubro con su lista al lado, y la línea del acumulado del mes.

En **Datos → Mirar el historial → Evolución** está la matriz mes × rubro, y
debajo los dos gráficos de tu `Analisis1`: **mes a mes** (ingresos, gastos y
saldo de cada mes) y **todo lo que llevás gastado y cobrado** (el acumulado día
por día desde el primer movimiento — ahí lo que se mira no es la altura sino si
las dos líneas se separan o se juntan).

**Los dos gráficos se recorren:**
- **Tocá un punto** y abajo te dice el momento exacto y cuánto valía cada línea
  ahí.
- **Acercá** con `+` o **pellizcando** con dos dedos; alejá con `−`.
- **Arrastrá** con un dedo para moverte por el tiempo.
- **Ver todo** vuelve al principio.

Al acercarte, la escala de arriba se recalcula sobre lo que estás mirando: por
eso el número del techo cambia. Y el zoom se pierde si cambiás de pantalla, a
propósito: es cómo estás mirando, no un dato tuyo. Al final está el
botón *"Ver la evolución y los gastos fijos"*, que lleva a la matriz mes × rubro
y a cuánto sale cada gasto fijo.

**Cualquier total se puede tocar y ver de qué se compone.** Una fila del
desglose, un gasto fijo, una celda de la matriz o un mes entero: te llevan a la
lista con solo esos movimientos, con el total repetido arriba para que veas que
cierra. La lista te dice en qué está filtrada y tiene *"Ver todo"* al lado.
Tocando la pestaña **Movimientos** volvés a la lista entera.

**Movimientos** es la lista, donde se corrige y se borra. Arriba tiene una
**lupa** que busca en **todos** los movimientos, no solo en el mes que estás
viendo, y mira **todos los campos**: la etiqueta, el detalle, el rubro, el
importe, la moneda y la fecha. No distingue mayúsculas ni tildes —`peru`
encuentra `Perú`—, pero la ñ sí cuenta: `ano` no encuentra `año`. Si escribís
varias palabras, tienen que estar todas.

**Datos** tiene los respaldos, la importación, los tipos de cambio y las monedas.

---

## 5. Las monedas

**Datos → Monedas → "Ver monedas"**, o desde el propio formulario de carga con
*"¿Falta una moneda?"*.

Agregás el código (`JPY`), el nombre y **cuántos decimales usa**. El yen usa
cero; casi todas usan dos.

**Los decimales importan y se pueden arreglar después, con cuidado.** Cambiarlos
no reescribe ningún monto: los **lee distinto**, así que todos los gastos ya
cargados en esa moneda pasan a valer cien veces más o cien veces menos. La app te
dice cuántos movimientos afecta y te muestra uno tuyo, antes y después, antes de
aplicar nada.

Una moneda con movimientos cargados **no se puede borrar** —dejaría gastos sin
forma de convertirse a euros— pero sí **ocultar**: desaparece de la lista al
cargar y sus movimientos siguen contando.

---

## 6. Arreglar una etiqueta mal escrita

**Datos → Etiquetas y detalles.**

Es la pantalla que arregla el problema más caro de este tipo de registro: si un
mes escribiste `Barcelona26` y otro `barcelona 26`, **son dos viajes distintos en
las cuentas** y ninguna pantalla te lo va a decir sola. Acá cada etiqueta dice
cuántos movimientos usa y **cuántas formas de escribirla hay** — eso último es lo
que delata el typo.

- **Renombrar** uno con el nombre de otro **los une**, y sus totales pasan a
  sumar juntos. La app te avisa antes de hacerlo.
- **Borrar** una etiqueta le saca ese texto a sus movimientos. **No borra ningún
  movimiento**: siguen ahí con su fecha, su rubro y su importe.

También sirve para juntar `Perú` y `Peru`, que la app deja separados a propósito:
sacar tildes automáticamente juntaría palabras que quisiste separar, así que la
decisión de unirlos es tuya.

---

## 7. Cuánto costó un viaje

**Datos → Mirar el historial → Gasto por viaje**, o desde el final del resumen
del mes.

**Un viaje es una etiqueta con al menos un gasto del rubro «viajes».** O sea:
cargá el pasaje o el hotel con rubro *viajes* y el nombre del viaje en la
etiqueta, y desde ahí **todo lo que lleve esa etiqueta se suma al viaje** — las
comidas, el transporte, el supermercado—, no solo lo del rubro «viajes».

**Escribís cuándo saliste y cuándo volviste; los días los cuenta la app**,
incluyendo el primero y el último. No los deduce de tus gastos: podés haber
salido dos días antes de anotar el primero, y ese número saldría más alto de lo
real sin avisarte. Mientras no escribas las fechas **no hay gasto por día**, y
*"No me acuerdo cuándo fue"* es una respuesta válida.

**Los viajes van ordenados por cuándo terminaron**, del más reciente arriba.

**Ojo con dos viajes viejos.** En tu planilla, París y Costa Rica sumaban a mano
el vuelo y el alojamiento adentro de la fórmula (`=96+SUMIFS(...)`,
`=850+...`). Esos importes **nunca fueron un movimiento**, así que acá esos dos
viajes van a dar 96 € y 850 € más bajos. Si querés que cierren, cargalos como lo
que son: un gasto con su fecha, su rubro y el comentario del viaje.

---

## 7b. Agrupar cualquier otra cosa: los otros grupos de gastos

**Datos → Mirar el historial → Otros grupos de gastos**, o desde el final del
resumen del mes.

La etiqueta no sirve solo para viajes y gastos fijos: **poniéndole la misma
etiqueta a varios gastos, se juntan solos**. Una mudanza, unos regalos, el
arreglo del auto. Esos grupos aparecen acá, del más caro al más barato, con su
total —**con todos los rubros adentro**, igual que un viaje—, cuántos gastos,
entre qué fechas y **en cuántos meses distintos** aparecen. Ese último dato es
el que separa una mudanza —una vez, muchos gastos— de algo que se repite todos
los meses sin ser del rubro «gastos fijos», como el gimnasio. Tocando uno se
abren sus gastos.

**Cada etiqueta va a una sola de las tres pantallas, y lo decide la app:**

1. Si **todo** lo que lleva esa etiqueta es del rubro «gastos fijos» → va a
   *gastos fijos*.
2. Si **algo** es del rubro «viajes» → va a *gasto por viaje*.
3. Si no → va acá.

Eso decide **dónde se agrupa entera** cada etiqueta. **Cómo etiquetás no cambia
nada de los rubros:** la tarjeta de gastos fijos te sigue mostrando todas las
etiquetas de ese rubro, sumando solo lo de ese rubro.

Ejemplo: si etiquetás como «Casa» el alquiler (rubro *gastos fijos*, 60 €) y
también un arreglo (rubro *otros*, 10 €), vas a ver **«Casa» en las dos
pantallas**: en gastos fijos con 60 € —lo que "Casa" gastó en ese rubro— y acá
con 70 € —«Casa» entera—. No es un error ni se cuenta dos veces: son dos
preguntas distintas, y **la fila de gastos fijos te lo aclara ahí mismo**.

---

## 8. Lo que todavía no está

Lo que se hace después está en [`PLAN.md`](PLAN.md), que es el archivo que manda.

---

## 9. Si algo no anda

**"No puedo compartir"** — compartir desde un archivo abierto con `file://` está
bloqueado por el navegador; no es un error de la app. Usá **Descargar**, que
deja el archivo en `Descargas`, y compartilo desde ahí. La app deja de ofrecer
compartir después del primer intento fallido, en vez de insistir con un botón
que no anda.

**La app aparece vacía** — casi seguro la abriste desde otro navegador o desde
*Archivos* en vez de por la dirección. Volvé al punto 1. **No cargues nada ahí.**

**Un total no cuadra** — fijate si algún mes está marcado porque le falta un tipo
de cambio: la app no cuenta como cero lo que no puede convertir, lo aparta y lo
dice.
