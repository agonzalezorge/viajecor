# Punto de partida — pegá esto como primer mensaje del chat nuevo

Todo lo que está debajo de la línea es para copiar y pegar tal cual.

---

Estoy construyendo **Viajecor**: una app de gastos personales en un solo archivo
HTML, que funciona sin conexión y guarda todo en mi dispositivo, sin ninguna
petición de red. Reemplaza una planilla de Excel que uso hace meses. Estoy
aprendiendo a construir software, así que el proceso me importa tanto como el
resultado.

El proyecto está en `agonzalezorge/viajecor`, rama
`claude/expense-tracker-offline-app-u7hgpl`.

**Antes de tocar nada, leé en este orden:**

1. `CLAUDE.md` — las cinco reglas que no se rompen.
2. `docs/PLAN.md` — **qué sigue. Sin una instrucción específica mía, este archivo
   manda.**
3. `docs/PRODUCTO.md` — casos de uso y reglas de negocio.
4. `docs/LECCIONES.md` — las trampas en las que este proyecto ya cayó.
5. `docs/AGENTES.md` — cómo tomar una tarea sin pisar a otro agente.
6. `docs/ARQUITECTURA.md` y `docs/DECISIONES.md` — cómo está armado y por qué.

**Cómo quiero que trabajemos:**

- Explicame **el porqué** de cada decisión técnica, no solo el qué.
- **No me digas que algo funciona sin haberlo probado.** "Debería andar" y "lo
  probé y anda" se escriben distinto.
- Las **decisiones de producto son mías**, no tuyas. Ante dos interpretaciones
  razonables, preguntame — o decime cuál elegiste y por qué.
- Avisame los **riesgos reales** antes de correrlos: borrar datos, tocar dinero,
  cambiar algo que no se puede deshacer.
- **No publiques nada** sin que te lo pida.
- Respondeme en **español**.

**Dónde quedamos:** T-001, T-002, T-007 y T-009 están hechas. Lo siguiente es
**T-003** (modelo del movimiento). En paralelo están libres T-006 (formateo),
T-008 (catálogo de monedas) y T-010 (armazón de la interfaz).

Empezá leyendo los documentos y decime qué vas a hacer antes de hacerlo.

---

## Contexto extra, por si el chat nuevo lo pide

### Lo que ya está hecho y verificado

- Documentación completa: 15 casos de uso, arquitectura, plan de tareas con
  dependencias, 12 decisiones registradas y 8 lecciones aprendidas.
- El proyecto se construye a un `dist/viajecor.html` autocontenido que abre desde
  el disco sin conexión — comprobado con 0 intentos de red y 0 errores de consola.
- Guardia de privacidad automática: la construcción **falla** si alguien mete algo
  que contacte a internet. Comprobado rompiéndola a propósito.
- `src/core/dinero.js`: aritmética de dinero en enteros, con 35 tests.
- Planilla de ejemplo con la estructura real de mi Excel y montos inventados, para
  construir el importador sin usar mis datos reales.

### Decisiones que conviene no deshacer sin leer el porqué

- El dinero se guarda en **enteros** (céntimos), nunca decimales — ADR-005.
- Un monto ambiguo como `"1.234"` se **rechaza**, no se adivina — ADR-012.
- El importador lee el `.xlsx` **directo, sin librerías** — ADR-010.
- La **lista de monedas la manejo yo** desde la app — ADR-011.
- **Ningún cálculo tiene un límite de filas escrito a mano** — L-001.
- Cero dependencias: no hay `npm install` — ADR-003.

### Preguntas mías que quedaron sin responder

1. Si cambio un tipo de cambio, se recalculan totales de meses ya cerrados
   (ADR-004). ¿Está bien así, o conviene que cada movimiento quede congelado al
   tipo de cambio del día en que lo cargué?
2. Gasto por viaje (T-023): ¿el viaje se elige de una lista o se escribe a mano?
   ¿Cómo cargo los vuelos y el alojamiento pagados antes del viaje? ¿La duración
   se escribe o se deduce de las fechas?

### Comandos

```bash
node tools/build.mjs   # genera dist/viajecor.html
node --test            # corre los tests
```
