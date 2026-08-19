# Cómo trabajan varios agentes en este repositorio

> Este proyecto se construye con varios agentes de IA trabajando, a veces en
> paralelo. Este documento es el acuerdo entre ellos. No es opcional: sin él, dos
> agentes editan el mismo archivo y el trabajo de uno se pierde.
>
> Última actualización: 2026-08-18

---

## 1. Lo primero que hace cualquier agente

1. Leer `docs/PLAN.md` — dice qué sigue.
2. Leer `docs/PRODUCTO.md` — dice qué reglas hay que respetar.
3. Leer `docs/LECCIONES.md` — dice en qué trampas ya cayó este proyecto.
4. Recién ahí, tocar código.

Si hay una instrucción específica del usuario, esa manda. Si no la hay,
`docs/PLAN.md` manda.

## 2. Tomar una tarea

Antes de escribir una sola línea:

1. Elegir una tarea `Lista` según el orden de `docs/PLAN.md` §*Cómo elegir la
   próxima tarea*.
2. **Comprobar que su bloque *Toca* no se pisa con ninguna tarea `En curso`.** Si
   se pisa, elegir otra. Esta es la regla que evita la mayoría de los conflictos.
3. Marcarla `En curso` en `docs/PLAN.md`, con quién y desde cuándo, y **hacer
   commit de ese cambio solo, primero**. Ese commit es el que reserva la tarea.

Ejemplo de la línea del tablero:

```
| T-002 | Aritmética de dinero | En curso (agente-a, 2026-08-18) | T-001 |
```

## 3. Propiedad de archivos

**Cada tarea declara qué archivos toca. Un agente edita solo esos.**

Si al hacer la tarea aparece la necesidad de tocar un archivo que no está en su
lista:

- Si el archivo **no lo tiene nadie más**, agregarlo al bloque *Toca* de la tarea
  en `docs/PLAN.md` y seguir.
- Si el archivo **lo tiene otra tarea en curso**, **no editarlo**. Anotar lo que
  hace falta como una tarea nueva en `docs/PLAN.md`, con la dependencia
  correspondiente, y seguir con lo propio.

### Archivos compartidos por todos

Estos los toca todo el mundo, así que hay reglas especiales:

| Archivo | Regla |
|---|---|
| `docs/PLAN.md` | Cada agente edita **solo las líneas de su tarea**. Nunca reordena ni reescribe el archivo entero. |
| `docs/PRODUCTO.md` | Solo la fila del caso de uso que la tarea completa, y las reglas de negocio que la tarea cambia. |
| `docs/DECISIONES.md`, `docs/LECCIONES.md` | Solo se **agrega al final**. No se reescribe lo que ya está. |
| `CHANGELOG.md` | Se agrega bajo el encabezado `Sin publicar`. |
| `dist/viajecor.html` | Generado. **No se edita a mano jamás.** Se regenera con `node tools/build.mjs`. |
| `VERSION` | Lo cambia solo la tarea que publica una versión. |

### La razón de que `src/` esté partido en archivos chicos

Es una decisión de arquitectura (`docs/ARQUITECTURA.md` §3) y también de
coordinación: con un archivo por pantalla y un archivo por módulo de lógica, dos
agentes que trabajan en cosas distintas casi nunca escriben en el mismo lugar.

## 4. Terminar una tarea

Una tarea se marca `Hecha` cuando **todas** estas cosas son ciertas:

- [ ] Se cumple lo que la tarea dice en *Terminada cuando*, comprobado, no supuesto.
- [ ] `node --test` pasa entero.
- [ ] `node tools/build.mjs` corre y `dist/viajecor.html` está actualizado y commiteado.
- [ ] Los documentos afectados están actualizados **en el mismo commit**:
      caso de uso en `PRODUCTO.md`, decisión no trivial en `DECISIONES.md`,
      trampa descubierta en `LECCIONES.md`.
- [ ] El estado en `docs/PLAN.md` dice `Hecha`.

**No se marca `Hecha` una tarea con los tests rojos, a medio hacer, o cuyo
criterio no se pudo comprobar.** En ese caso se deja `En curso` y se anota qué
falta.

## 5. Qué no hace un agente por su cuenta

Directo de `guiaprimeraapp.md`, que es el acuerdo con el usuario:

- **No decide cuestiones de producto.** Cómo se llama algo en el dominio, qué pasa
  en un caso raro, si algo se puede deshacer: eso lo decide el usuario. Si hay más
  de una interpretación razonable, se pregunta o se dice explícitamente cuál se
  eligió y por qué.
- **No dice que algo funciona sin haberlo probado.** "Debería andar" y "lo probé y
  anda" son afirmaciones distintas y se escriben distinto.
- **No publica nada** sin que se lo pidan.
- **No hace cambios grandes en silencio.** Se explica el porqué de cada decisión
  técnica, en una frase.
- **No borra ni reescribe trabajo de otro agente.** Ante un conflicto, se resuelve
  conservando las dos partes, no descartando una.

## 6. Ramas y commits

- Todo el trabajo va a la rama de desarrollo indicada por el usuario.
- **Un commit por cambio con sentido.** El mensaje explica *por qué*, no solo
  *qué*.
- El commit que completa una tarea la menciona por ID:
  `T-002: dinero en enteros para que los totales cierren al céntimo`.
- Antes de empezar, traer lo último de la rama. Si otro agente ya empujó,
  integrarlo antes de seguir.

## 7. Cuando algo se rompe

1. Encontrar **qué cambio** lo rompió, no solo dónde falla.
2. Arreglarlo con un test que falle antes y pase después.
3. Preguntarse: **¿qué patrón general hizo posible este error?** Si hay uno,
   anotarlo en `docs/LECCIONES.md`. El objetivo es que la próxima vez el error no
   vuelva disfrazado de otra cosa.
