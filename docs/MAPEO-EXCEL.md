# Cómo se traduce la planilla a la app

**Qué es esto.** La decisión, escrita antes de programar, de qué hace el
importador con cada columna y con cada caso raro de la planilla del usuario
(T-030, CU-13). Todo lo que está acá se decidió mirando la planilla real o su
copia de estructura, no imaginando.

**Por qué existe.** El importador se corre **una sola vez**, sobre once meses de
datos que no están en ningún otro lado. Si se equivoca, se equivoca en silencio
sobre todo el historial: los totales quedan mal y nadie tiene con qué compararlos
—porque el único lugar donde estaban bien es la planilla que se acaba de
reemplazar—. Un importador improvisado es la forma más rápida de perder un año de
registro sin enterarse.

---

## 1. Lo que hay adentro de la planilla

Una sola hoja (`Gastos`) con **un bloque por mes**, uno debajo del otro. Cada
bloque tiene:

```
(fila vacía)
AGOSTO 2026                                    ← banda amarilla, solo columna A
(fila vacía)
INGRESOS Y GASTOS          GASTOS POR TIPO     ← bandas de título
G/Acum./Mes  Comentarios  DÍA  MES  DETALLES  RUBRO  MONTO  I/G
   300,0 €                  1   08/26  alquiler  gastos fijos  300,0 €   g
   406,3 €    psicóloga     1   08/26  psicóloga gastos fijos  106,3 €   g
   …
```

A la derecha, desde la columna J, están los resúmenes y los gráficos. **Nada de
eso se lee**: son cálculos, no datos, y la app los rehace.

---

## 2. Qué es una fila de datos

**Una fila se importa si tiene día y rubro.** Nada más.

```
DÍA (C) es un número entre 1 y 31   Y   RUBRO (F) no está vacío
```

**Por qué así y no reconociendo los títulos.** La tentación es saltear las filas
cuyo texto sea `AGOSTO 2026` o `G/Acum./Mes`. Eso obliga a **acertar la lista
completa de textos que hay que ignorar**, y basta con que un mes tenga el título
escrito distinto para que un encabezado entre como si fuera un gasto. Es una
lista blanca que hay que acordarse de mantener, y este proyecto ya se quemó dos
veces con eso (L-015, L-017).

Preguntar qué **sí** es un dato, en cambio, no necesita mantenimiento: un título
no tiene día, una banda no tiene rubro, una celda suelta de referencia tampoco.

**Comprobado sobre la copia de estructura:** 288 filas de datos, 4 títulos de mes,
8 filas de encabezado y 11 vacías. La regla separa las 288 sin nombrar ninguna.

---

## 3. Columna por columna

| Col | En la planilla | En la app | Qué se hace |
|---|---|---|---|
| A | `G/Acum./Mes` | — | **Se ignora.** Es un acumulado calculado, no un dato. La app lo rehace, y guardarlo sería tener el mismo número en dos lugares (L-005). Ver §6: sirve para *comprobar* la importación. |
| B | `Comentarios` | `comentario` | Texto tal cual, normalizado (RN-03). Es lo que agrupa los viajes. |
| C | `DÍA` | parte de `fecha` | Número del 1 al 31. |
| D | `MES` | parte de `fecha` | Fecha con el día 1 del mes; se usan **solo su año y su mes**. |
| E | `DETALLES` | `detalle` | Texto tal cual, normalizado. |
| F | `RUBRO` | `rubro` | Normalizado a minúsculas (§5). |
| G | `MONTO` | `monto` | En euros, a céntimos enteros (§4). |
| H | `I/G` | `tipo` | `G`/`g` → gasto, `I`/`i` → ingreso. |
| — | — | `moneda` | Siempre `EUR`. **Decidido con el usuario (2026-08-28):** todos los importes de su planilla ya están en euros, convertidos a mano por él. No hace falta ningún tipo de cambio histórico. |
| J+ | resúmenes y gráficos | — | **Se ignoran por completo.** |

---

## 4. El día y el mes son una sola fecha

En la planilla son dos columnas independientes y **nada obliga a que digan lo
mismo**: es L-005, la trampa original de este proyecto. En la app son una sola
fecha (RN-01).

Se arma con el **año y el mes de la columna D** y el **día de la columna C**, y se
valida contra el calendario:

- `31` + `abril 2026` → **no existe**. La fila se descarta y se lista, con la
  fecha que decía. No se ajusta al 30 ni se pasa al 1 de mayo: inventar una fecha
  que el usuario no escribió es peor que no importar la fila.
- Un día fuera de 1–31 no cumple la regla de §2, así que no llega hasta acá.

**Sobre las fechas de Excel.** Excel guarda las fechas como el número de días
desde el 1900-01-01, y **cree que 1900 fue bisiesto**, cosa que no fue. El error
está en el formato desde 1985 por compatibilidad con Lotus 1-2-3 y no se puede
arreglar sin romper todas las planillas del mundo. La conversión ya lo tiene en
cuenta (el desplazamiento de 25569 días desde la época de Unix), y hay un test
que lo fija con tres fechas conocidas.

---

## 5. El rubro

Se normaliza antes de comparar (RN-03): minúsculas, sin espacios de más, en forma
Unicode NFC (L-009). La planilla tiene las mayúsculas inconsistentes de haberse
escrito a mano durante meses.

**Comprobado sobre la copia de estructura:** aparecen 16 escrituras distintas
—`ENTRETENIMIENTO`, `entretenimiento`, `SUPERMERCADO`, `supermercado`…— que se
reducen a los 12 rubros de la app sin perder ninguna fila.

**`otros` está en las dos listas** —«otros gastos» y «otros ingresos»— y son cosas
distintas que no se mezclan nunca en un total. Lo que las separa es la columna
`I/G`, no el nombre.

**Un rubro que no esté en las listas de la app** se descarta y se lista con su
texto. No se manda a `otros`: meterlo ahí lo haría desaparecer dentro de un total
que ya existe, que es la peor forma de perder un dato — se ve bien y está mal.

**Un rubro que existe pero en la otra lista** —`supermercado` con `I/G = I`— se
descarta con un motivo propio: *«supermercado no es un rubro de ingreso»*. Decir
solo «rubro desconocido» mandaría a buscar un error de escritura que no está: lo
que está mal es la combinación, no el rubro.

**Si el tipo no se pudo leer, no se juzga el rubro.** No se sabe contra cuál de
las dos listas compararlo, así que decir «rubro desconocido» sería inventar un
segundo problema a partir del primero. El informe nombra **la causa**, no sus
consecuencias: dos motivos donde hay uno mandan a arreglar algo que no está roto.
*(Esto salió de aplicar las reglas de este documento a 22 filas raras antes de
programar nada: la combinación «tipo vacío» daba dos motivos.)*

---

## 6. Los montos

- Se leen como número y se pasan a **céntimos enteros** (ADR-005).
- **Vacío → se descarta y se lista.** Decidido con el usuario (2026-08-28).
- **Cero explícito → se importa.** Un gasto de 0 € es raro pero es un dato que
  alguien escribió; una celda vacía es la ausencia de un dato. No son lo mismo y
  no se tratan igual.
- **No numérico → se descarta y se lista**, con lo que decía la celda.
- **Negativo → se descarta y se lista.** Podría ser una devolución o un error de
  tipeo, y **no hay forma de saber cuál**. El modelo exige montos no negativos, y
  adivinar el signo de una operación de dinero es exactamente lo que no se hace.

**Una comprobación que la planilla se hace a sí misma.** La columna A tiene el
acumulado de gastos del mes que el usuario venía llevando. Al terminar de
importar un mes, el importador puede comparar **el último acumulado de esa
columna** con la suma de los gastos que efectivamente importó. Si no coinciden,
falta o sobra algo, y se avisa con la diferencia.

No es una validación cualquiera: es el único momento en que se puede contrastar
el resultado contra un número que **calculó otra herramienta**. Después de
importar, la planilla se archiva y no queda con qué comparar. → se implementa en
T-032.

---

## 7. El tipo (`I/G`)

- `G`, `g` → gasto. `I`, `i` → ingreso. **Comprobado:** en la copia de estructura
  hay las cuatro escrituras, 288 filas, todas reconocidas.
- **Vacío o cualquier otra cosa → se descarta y se lista.** No se supone «gasto»
  por ser lo más frecuente: el 8 % de las filas son ingresos, y un ingreso
  importado como gasto **resta dos veces** —no aparece donde suma y aparece donde
  no debería—, así que el saldo del mes se va por el doble del importe.

---

## 8. Importar dos veces no puede duplicar

Es el riesgo más grande de toda la etapa. Alguien importa, algo no le convence,
vuelve a importar: si cada pasada crea movimientos nuevos, el historial queda
duplicado y **todos los totales dan el doble**, sin ningún error.

**Solución: el identificador de cada movimiento importado se deriva de la propia
fila** —de su contenido y de su posición en la hoja—, no se sortea. La misma fila
de la misma planilla da siempre el mismo identificador.

Con eso, el mecanismo que ya existe alcanza: **T-017 no agrega un movimiento cuyo
identificador ya está**. Importar dos veces la misma planilla deja lo mismo que
importarla una vez, sin código nuevo que lo vigile.

**Lo que cuesta:** si el usuario corrige una fila en la planilla y vuelve a
importar, entra como un movimiento **nuevo** —cambió el contenido, cambió el
identificador— y queda el viejo también. Es un caso raro (la planilla se archiva
después de importar) y es el lado seguro del error: quedan dos filas visibles en
vez de una modificación silenciosa.

---

## 9. Nada se pierde en silencio

Todo lo que se descarta se informa **fila por fila, con su número de fila en la
planilla, lo que decía y por qué no entró**. Esa lista es la parte más importante
del importador, no un adorno:

> Fila 1043: no se importó porque el monto está vacío. Decía «alfajores minas»,
> rubro supermercado, día 24.

Con el número de fila, el usuario puede abrir su planilla, mirar esa fila y
decidir. Sin él, el informe dice «hubo 14 problemas» y no sirve para nada.

**La regla, que es la misma de todo el proyecto:** importar mal en silencio es
peor que no importar. El Excel original miente sin avisar (L-001) y esta app
existe por eso; un importador que hiciera lo mismo empezaría el reemplazo
repitiendo el error que vino a arreglar.

---

## 10. Cómo se comprobó este documento

Las reglas de acá se aplicaron, **antes de escribir una línea del importador**, a
dos cosas:

1. **La copia de estructura de la planilla** (`test/ejemplo/planilla-ejemplo.xlsx`,
   T-009): separa las **288 filas de datos** de los 4 títulos de mes, las 8 filas
   de encabezado y las 11 vacías, sin nombrar ninguna y sin que se cuele nada.
2. **22 filas raras construidas a propósito**, que es lo que de verdad importa:
   una regla que solo se prueba contra datos limpios no se distingue de una regla
   que acepta todo. Las 22 dieron el resultado esperado — el título del mes, la
   banda de bloque y la celda suelta de referencia quedan afuera; el monto vacío,
   el texto donde va un número, el negativo, el 31 de abril y el 29 de febrero de
   2026 se descartan con su motivo; el 30 de abril y el 29 de febrero de 2024
   entran.

**Y encontró dos defectos del mapeo**, que ya están corregidos arriba: los dos
motivos que se generaban a partir de uno solo (§5), y el mensaje engañoso de un
rubro que existe pero en la otra lista (§5). Escribir el documento y no probarlo
habría dejado los dos adentro del código.

---

## 11. Lo que este documento NO decide

- **Cómo se lee el `.xlsx`** (abrir el ZIP, parsear el XML). Es T-031.
- **Cómo se ve el informe** en la pantalla. Es T-032.
- **Qué pasa con los tildes al agrupar** (`Perú` y `Peru`): sigue abierta, es la
  pregunta 3 del plan. No bloquea: hoy son dos comentarios distintos, y si se
  decide unificarlos después, se aplica a lo importado igual que a lo cargado a
  mano.
