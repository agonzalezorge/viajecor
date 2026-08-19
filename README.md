# Viajecor

App de gastos personales que **funciona sin conexión** y guarda todo **en tu
dispositivo**. Es un solo archivo HTML: lo guardás, lo abrís y listo. No hay
servidor, no hay cuenta, no hay ninguna petición a internet.

> 🚧 **Estado: v0.1.0 — esqueleto.** Todavía no se pueden cargar gastos. Lo que
> funciona hoy es la base: el archivo se construye, abre desde el disco sin
> conexión, y hay un test que verifica que no se le escapa ni un dato.
> Lo que sigue está en [`docs/PLAN.md`](docs/PLAN.md).

## Cómo usarla (cuando esté lista)

1. Descargar `dist/viajecor.html`.
2. Guardarlo en el celular o en la computadora.
3. Abrirlo. Funciona con el modo avión activado.
4. En el celular, desde el menú del navegador, *"Agregar a la pantalla de inicio"*
   para tenerlo a mano como cualquier app.

**Importante:** los datos viven solo en el navegador donde cargaste la app. Si
borrás los datos de navegación, se pierden. **Exportá seguido** — es tu única
copia de seguridad.

## Qué hace

Reemplaza una planilla de Excel de gastos personales:

- Registrar gastos e ingresos con fecha, rubro, monto y comentario.
- **Multimoneda**: cargás en la moneda en que gastaste, y la app convierte todo a
  euros con un tipo de cambio que definís por moneda y por mes.
- Resumen del mes: total de gastos, de ingresos, saldo y desglose por rubro.
- Gasto día por día, evolución mes a mes, gasto por viaje y promedio de los gastos
  fijos.
- **Exportar todo** cuando quieras, a JSON o a CSV.

## Privacidad

Es el motivo por el que la app está hecha así, no una característica más:

- Todos los datos se guardan en el navegador de tu dispositivo.
- La app **no hace ninguna petición de red**, nunca. Ni siquiera para cargar una
  tipografía.
- No hay analítica, ni telemetría, ni reporte de errores.
- Hay un test automático que **rompe la construcción** si alguien agrega algo que
  contacte a internet. La promesa no depende de que nadie se olvide.

Los detalles y los riesgos —incluido qué pasa si borrás los datos del navegador—
están en [`docs/PRODUCTO.md`](docs/PRODUCTO.md), sección 6.

## Para desarrollar

Sin dependencias. Solo hace falta Node instalado.

```bash
node tools/build.mjs   # genera dist/viajecor.html
node --test            # corre los tests
```

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | **Qué se hace después.** Tareas, dependencias y estado. |
| [`docs/PRODUCTO.md`](docs/PRODUCTO.md) | Qué hace la app, casos de uso y reglas de negocio. |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está armada y cómo se guardan los datos. |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Cada decisión técnica, con su porqué. |
| [`docs/LECCIONES.md`](docs/LECCIONES.md) | Las trampas en las que este proyecto ya cayó. |
| [`docs/AGENTES.md`](docs/AGENTES.md) | Cómo trabajan varios agentes de IA sin pisarse. |
| [`CLAUDE.md`](CLAUDE.md) | Puerta de entrada para un agente de IA. |
| [`docs/HISTORIAL-INICIAL.md`](docs/HISTORIAL-INICIAL.md) | El porqué de los seis primeros commits, que la subida por la web aplastó en uno. |
