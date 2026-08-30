# Viajecor

App de gastos personales que **funciona sin conexión** y guarda todo **en tu
dispositivo**. Es un solo archivo HTML: lo guardás, lo abrís y listo. No hay
servidor, no hay cuenta, no hay ninguna petición a internet.

> **Estado: v0.1.0 — en uso.** Reemplaza a la planilla para cargar gastos, ver
> cómo viene el mes, comparar los meses entre sí y sacar los datos. Se probó en
> un Android real y con los once meses de historial importados desde el Excel.
> Lo que falta está en [`docs/PLAN.md`](docs/PLAN.md).

## Cómo usarla

**La guía completa está en [`docs/USO.md`](docs/USO.md).** El resumen:

0. **En un iPhone, por la web:** `https://viajecor.vercel.app`. Chrome en iOS no
   abre archivos locales, así que bajar el archivo no sirve. El ícono se agrega
   desde **Safari** → *Compartir → Añadir a pantalla de inicio*. (Los pasos para
   publicarla están en `docs/USO.md §1b`.)
1. Descargar `dist/viajecor.html` y guardarlo en `Descargas`.
2. **En Android, abrirlo escribiendo la dirección en Chrome**, no tocándolo desde
   *Archivos*: `file:///sdcard/Download/viajecor.html`. Abierto desde *Archivos*,
   Android le da al navegador un permiso temporal en vez de una ubicación, cada
   apertura es un sitio distinto **y los datos no sobreviven a cerrar Chrome**.
   La app se da cuenta y te avisa.
3. Funciona con el modo avión activado.
4. **Respaldar seguido.** Los datos viven solo en el navegador de tu dispositivo:
   si borrás los datos de navegación, se pierden. La app te avisa sola cuando
   hace más de una semana que no respaldás.

## Qué hace

Reemplaza una planilla de Excel de gastos personales:

- Registrar gastos e ingresos con fecha, rubro, monto, detalle y comentario, y
  corregirlos o borrarlos después.
- **Multimoneda**: cargás en la moneda en que gastaste, y la app convierte todo a
  euros con un tipo de cambio que definís por moneda y por mes. Podés agregar
  monedas que no vienen de fábrica.
- **Resumen del mes**: total de gastos, de ingresos, saldo, la torta del reparto
  por rubro con su lista al lado, y la línea del acumulado día a día.
- **Evolución mes a mes**: la matriz mes × rubro con su total y su promedio, y
  cuánto sale cada gasto fijo.
- **Traer el historial del Excel** de una vez, leyendo el `.xlsx` directamente.
- **Exportar todo** cuando quieras: respaldo JSON, planilla `.xlsx` o CSV.

Lo que todavía no está —gasto por viaje, limpiar las etiquetas ya usadas, tocar
un rubro para ver qué contiene— está en [`docs/PLAN.md`](docs/PLAN.md).

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
node tools/build.mjs   # genera dist/viajecor.html e index.html
node --test            # corre los tests
```

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/USO.md`](docs/USO.md) | **Cómo usarla.** Escrito para quien la usa, no para quien la programa. |
| [`docs/PLAN.md`](docs/PLAN.md) | **Qué se hace después.** Tareas, dependencias y estado. |
| [`docs/PRODUCTO.md`](docs/PRODUCTO.md) | Qué hace la app, casos de uso y reglas de negocio. |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está armada y cómo se guardan los datos. |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Cada decisión técnica, con su porqué. |
| [`docs/LECCIONES.md`](docs/LECCIONES.md) | Las trampas en las que este proyecto ya cayó. |
| [`docs/AGENTES.md`](docs/AGENTES.md) | Cómo trabajan varios agentes de IA sin pisarse. |
| [`CLAUDE.md`](CLAUDE.md) | Puerta de entrada para un agente de IA. |
| [`docs/HISTORIAL-INICIAL.md`](docs/HISTORIAL-INICIAL.md) | El porqué de los seis primeros commits, que la subida por la web aplastó en uno. |
