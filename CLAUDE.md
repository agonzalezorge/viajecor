# Viajecor — instrucciones para agentes

App de gastos personales en un solo archivo HTML, offline, con los datos en el
dispositivo del usuario y sin ninguna petición de red.

## Antes de tocar código, leer en este orden

1. **`docs/PLAN.md`** — qué hay que hacer ahora. **Sin instrucción específica del
   usuario, este archivo manda.**
2. **`docs/PRODUCTO.md`** — qué hace la app, casos de uso y reglas de negocio.
3. **`docs/LECCIONES.md`** — las trampas en las que este proyecto ya cayó.
4. **`docs/AGENTES.md`** — cómo tomar una tarea sin pisar a otro agente.
5. `docs/ARQUITECTURA.md` y `docs/DECISIONES.md` — cómo está armado y por qué.

## Comandos

```bash
node tools/build.mjs      # genera dist/viajecor.html
node --test                # corre los tests
```

Sin `npm install`: el proyecto **no tiene dependencias** (ADR-003).

## Las cinco reglas que no se rompen

1. **Cero red.** Ni una petición a internet, ni una fuente de un CDN, ni un
   `fetch`. Es la razón de ser de la app. El test de `test/privacidad.test.js` lo
   verifica.
2. **`core/` no toca el navegador.** Si un archivo de `src/core/` menciona
   `document`, `window` o `localStorage`, está mal ubicado.
3. **El dinero se guarda en enteros** (céntimos). Nunca decimales. Ver ADR-005.
4. **Ningún cálculo tiene un límite de filas escrito a mano.** Ver L-001: así es
   como el Excel original miente en silencio.
5. **Todo texto que agrupe se normaliza** antes de comparar. Ver RN-03 y L-002.

## Al terminar una tarea

En el **mismo commit** que el código:

- Marcar el caso de uso como hecho en `docs/PRODUCTO.md`.
- Actualizar el estado de la tarea en `docs/PLAN.md`.
- Anotar la decisión no trivial en `docs/DECISIONES.md` (agregando al final).
- Anotar la trampa descubierta en `docs/LECCIONES.md` (agregando al final).
- Regenerar y commitear `dist/viajecor.html`.

Una tarea no está terminada si los documentos quedaron atrás.

## Cómo hablarle al usuario

El usuario está aprendiendo a construir software. El acuerdo, tomado de la guía
que compartió:

- **Explicar el porqué**, no solo el qué. Una decisión técnica sin una frase que
  la justifique es una oportunidad de aprendizaje perdida.
- **No decir que algo funciona sin probarlo.** "Debería andar" y "lo probé y anda"
  se escriben distinto.
- **Las decisiones de producto son del usuario**, no del agente. Ante dos
  interpretaciones razonables, preguntar — o decir cuál se eligió y por qué, para
  que pueda corregir.
- **Avisar los riesgos reales antes de correrlos**: borrar datos, tocar dinero,
  cambiar algo que no se puede deshacer.
- **No publicar nada** sin que lo pidan explícitamente.
- Responder en español.
