# Auditoría QA visual y funcional

Fecha: 30 de mayo de 2026.

Entorno probado:

- URL local: `http://127.0.0.1:3000`
- Modo: build de producción local con `npm run demo:start`
- Viewports revisados: escritorio `1440 x 900` y móvil `390 x 844`
- Persistencia demo: `localStorage`

## Resumen ejecutivo

La app está en buen estado para una demo comercial local. Las rutas principales
cargan, no hay errores de consola, las pestañas funcionan y los flujos clave
crean datos visibles en el CRM.

Durante la auditoría apareció un fallo visual importante: los gráficos del
dashboard estaban vacíos. Se ha corregido y verificado. También se añadieron
encabezados accesibles en `/reserva` y `/empleado`.

## Correcciones aplicadas

1. Dashboard: gráficos vacíos

- Estado anterior: las tarjetas `Ingresos y servicios` y `Mix de servicios`
  quedaban en blanco.
- Causa: el `ResizeObserver` se inicializaba antes de que el `ref` estuviera en
  el contenedor real del gráfico.
- Corrección: el contenedor con `ref` se renderiza siempre y muestra placeholder
  solo mientras no tiene ancho medido.
- Archivo: `src/components/dashboard/dashboard-charts.tsx`
- Verificación: ambos gráficos renderizan SVG con ejes, líneas y barras.

2. Encabezados de vistas externas

- `/reserva` ya tiene `h1`: `Solicitar limpieza`.
- `/empleado` ya tiene `h1` accesible: `Área empleado`.
- Archivos:
  - `src/components/demo/customer-booking-demo.tsx`
  - `src/components/demo/employee-field-demo.tsx`

## Rutas revisadas

Todas cargan correctamente en escritorio y móvil, sin errores de consola:

- `/login`
- `/register`
- `/reset-password`
- `/dashboard`
- `/crm`
- `/crm/cust-atrium`
- `/services`
- `/calendar`
- `/employees`
- `/invoices`
- `/payments`
- `/automations`
- `/portal`
- `/admin`
- `/reserva`
- `/empleado`

## Pestañas revisadas

Funcionan correctamente:

- CRM: `Pipeline`, `Clientes`, `Segmentos`
- Ficha cliente: `Historial`, `Servicios`, `Facturas`
- Calendario: `Semana`, `Mes`
- Pagos: `Cobros de clientes`, `Suscripción SaaS`

## Flujos funcionales probados

Correctos:

- Login demo entra en `/dashboard`.
- Registro demo entra en `/dashboard` al rellenar campos.
- Reset de contraseña redirige a `/login?message=reset-sent`.
- Crear lead desde CRM.
- Crear servicio desde Servicios.
- Crear empleado desde Empleados.
- Crear presupuesto desde Facturación.
- Crear factura desde Facturación.
- Descargar PDF local de factura.
- Convertir presupuesto en servicio.
- Crear solicitud desde Portal cliente.
- Crear automatización.
- Activar/pausar automatización.
- Exportar CSV desde dashboard.
- Crear reserva pública desde `/reserva`.
- Ver esa reserva como lead en `/crm`.
- Ver esa reserva como servicio pendiente en `/services`.
- Ver esa reserva como solicitud en `/portal`.
- Iniciar servicio desde `/empleado` y persistir el estado `En curso`.

## Coherencia de datos

Validado:

- Facturas demo: `subtotal + IVA = total`.
- IVA de facturas: 21 %.
- Portal cliente:
  - muestra `3` facturas cuando hay 3 facturas en el estado demo.
  - muestra `4` servicios cuando hay 4 servicios en el estado demo inicial.
  - muestra `0 solicitudes registradas` con estado limpio.
- Admin SaaS:
  - MRR mostrado: `656 €`.
  - Empresas: `4`.
  - Usuarios: `78`.
  - Churn: `2,1 %`.
- Reserva pública:
  - mismo cliente: `Residencial Prado`.
  - mismo servicio: `Limpieza extra de cristales`.
  - mismo estado inicial: `Pendiente`.
  - aparece en CRM, Servicios y Portal.
- Pagos:
  - la pestaña de suscripción separa correctamente planes SaaS de cobros de
    clientes.
  - el plan actual es `Growth`.
  - botones de planes alineados visualmente.

## Revisión visual

Correcto:

- Diseño premium oscuro consistente.
- Sidebar, header y navegación se ven estables.
- Pestañas y botones mantienen jerarquía visual.
- `/reserva` se ve bien como experiencia móvil de cliente.
- `/empleado` se ve bien como experiencia móvil de operario.
- En móvil no hay scroll horizontal global.
- Las tablas anchas quedan dentro de contenedores con scroll interno.

Observación:

- En páginas administrativas con tablas grandes, el formato móvil es usable,
  pero no tan cómodo como las vistas específicas `/reserva` y `/empleado`. Para
  demo con cliente, conviene enseñar móvil principalmente con esas dos rutas.

## Riesgos para la demo

1. KPI superiores del dashboard

Los KPIs superiores son métricas demo de negocio, no se recalculan todos en
tiempo real cuando creas un lead o servicio durante la demo. Las tablas y listas
sí reflejan las acciones locales. Recomendación: no vender esos KPIs como
contadores vivos hasta conectar métricas dinámicas.

2. Persistencia local

La demo guarda datos en `localStorage`. Funciona para enseñar, pero no es
persistencia compartida entre navegadores o equipos. Para preproducción debe ir
con Supabase/PostgreSQL.

3. Integraciones simuladas

Stripe, Supabase Auth, Google Calendar, email/SMS y webhooks están preparados en
arquitectura, pero simulados en local.

## Verificación técnica ejecutada

Comandos correctos:

```bash
npm run lint
npm run build
npm run demo:start
```

Resultado:

- Lint: correcto.
- Build: correcto.
- Servidor local: activo en `http://127.0.0.1:3000`.
- Consola navegador: sin errores durante la pasada QA.

## Veredicto

La demo local queda apta para enseñar. El producto transmite bien el concepto
SaaS CRM para empresas de limpieza, y los flujos cliente/empleado aportan una
historia funcional clara.

Antes de preproducción real, la prioridad debe ser conectar persistencia real,
auth real, Stripe test y métricas dinámicas del dashboard.

## Ronda adicional de QA - 15 de junio de 2026

Objetivo de esta ronda: no asumir que la demo estaba perfecta. Se repitieron
pruebas funcionales y visuales con navegador real, datos temporales y
restauración de `localStorage` después de cada caso destructivo.

### Pruebas adicionales ejecutadas

- Inventario de rutas principales: `/login`, `/dashboard`, `/crm`, `/services`,
  `/calendar`, `/employees`, `/invoices`, `/payments`, `/automations`,
  `/admin`, `/portal`, `/reserva` y `/empleado`.
- Pestañas: calendario `Semana/Mes`, CRM `Pipeline/Clientes/Segmentos` y pagos
  `Cobros de clientes/Suscripción SaaS`.
- Modales: nuevo lead, crear servicio, nueva visita, nuevo empleado,
  presupuesto, factura, automatización y nueva solicitud del portal.
- Flujo público `/reserva`:
  - crea solicitud web;
  - crea lead;
  - crea servicio;
  - aparece en CRM;
  - aparece en Servicios;
  - aparece en Calendario semanal y mensual.
- Flujo manual de asignación:
  - solicitud fuera de horario queda pendiente;
  - muestra avisos de disponibilidad;
  - el responsable puede asignar un empleado desde Servicios;
  - Calendario se actualiza con el empleado asignado.
- Aprendizaje del motor:
  - primera solicitud similar: recomendación alta;
  - el responsable confirma la recomendación;
  - segunda solicitud similar: el motor incorpora señales aprendidas;
  - tercera solicitud laboral comparable: queda `Autoasignada` cuando ya hay dos
    decisiones similares aceptadas y no hay avisos operativos.
- Borrado en cascada:
  - borrar una reserva web elimina solicitud, lead, servicio de calendario y
    nota vinculada.
- Facturación:
  - crear factura calcula IVA 21 %;
  - aparece en Facturación;
  - aparece también en Pagos.
- Vista empleado:
  - `Iniciar` cambia el servicio a `En curso`;
  - `Completar` lo cambia a `Completado`;
  - Servicios refleja el cambio.
- Descargas:
  - `Exportar` genera `limpiapro-export-demo.csv`;
  - descargar factura genera `F-2026-0142.pdf`.
- Responsive:
  - escritorio `1440 x 900`;
  - móvil `390 x 844`;
  - menú móvil abre, navega a Servicios y se cierra.

### Fallos reales encontrados en esta ronda

1. Etiqueta accesible de automatizaciones

- Problema: el interruptor de automatización usaba siempre `Activar ...`, aunque
  la regla estuviera activa y la acción real fuera pausarla.
- Corrección: ahora muestra `Activar ...` o `Pausar ...` según el estado real.
- Archivo: `src/components/demo/demo-widgets.tsx`.

2. Notas huérfanas al borrar reservas

- Problema: al borrar una reserva web se eliminaban solicitud, lead y servicio,
  pero podía quedar una nota interna asociada al cliente borrado.
- Corrección: el borrado de lead, servicio o reserva limpia también las notas
  vinculadas al mismo cliente. La limpieza por bloque de demo también evita
  restos incoherentes.
- Archivo: `src/components/demo/demo-provider.tsx`.

### Resultado técnico de esta ronda

Comandos ejecutados:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Resultado: correctos.

Nota de entorno: `next build` mostró aviso de filesystem lento porque el repo
está dentro de OneDrive. Esto explica parte de la lentitud local. Después del
build, el servidor `next dev` quedó en 500 y fue reiniciado; tras reinicio,
`/dashboard`, `/services`, `/payments` y `/reserva` respondieron 200 sin errores
de consola.

URL local activa tras la ronda:

```text
http://127.0.0.1:3000/dashboard
```
