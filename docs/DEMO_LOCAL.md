# Demo local para cliente

La aplicación está preparada para funcionar en local sin conectar Supabase,
Stripe ni PostgreSQL. El modo demo usa datos de ejemplo, guarda las acciones en
`localStorage` del navegador y permite enseñar los flujos principales como si el
CRM estuviera operativo.

## Arranque rápido para enseñar la demo

Para la demo con cliente, usa modo producción local. Va bastante más rápido que
`npm run dev` porque no recompila ni vigila archivos.

```bash
cd C:\Users\aleja\OneDrive\Documents\GLOBALTECH\auto-maintenance
npm install
npm run build
npm run demo:start
```

Abre:

```text
http://127.0.0.1:3000/login
```

## Arranque para desarrollo

Usa `npm run dev` solo cuando estés cambiando código:

```bash
npm run dev
```

Si el puerto `3000` está ocupado:

```bash
npm run dev -- --port 3001
```

El login aparece rellenado con datos demo. Al pulsar `Entrar`, accede al
dashboard sin depender de Supabase.

Si la app va lenta, revisa que no tengas dos servidores abiertos a la vez en
`3000` y `3001`. En Windows con OneDrive, el modo desarrollo puede bloquear
archivos de `.next`; para presentar al cliente, usa siempre `npm run demo:start`
después de `npm run build`.

## Flujos funcionales en local

- Login, registro y recuperación de contraseña en modo demo.
- Crear leads y verlos aparecer en el pipeline del CRM.
- Crear servicios y verlos en Dashboard, Servicios y Portal cliente.
- Filtrar servicios por estado y cambiar el estado de un servicio.
- Crear empleados y verlos añadidos al equipo.
- Crear presupuestos y facturas.
- Convertir un presupuesto en servicio.
- Descargar PDF local de facturas y presupuestos.
- Simular checkout y portal de facturación de Stripe.
- Activar y pausar automatizaciones.
- Crear solicitudes desde el portal cliente.
- Crear una reserva pública desde `/reserva` y verla entrar como lead, solicitud
  y servicio pendiente en el CRM.
- Editar y borrar leads, servicios, empleados y reservas web desde sus tablas o
  tarjetas.
- Limpiar datos por bloques: reservas web, servicios, leads, empleados o notas.
- Actualizar trabajos desde la vista de empleado en `/empleado`.
- Guardar notas en la ficha de cliente.
- Usar calendario semanal con drag and drop local.
- Cambiar tema claro/oscuro.
- Abrir navegación móvil y moverse entre secciones.
- Reiniciar la demo desde el menú de usuario `Admin`.

## Rutas recomendadas para enseñar

Guion detallado: `docs/GUION_DEMO_CLIENTE.md`.

Plan para conectar esta demo a backend real sin rehacer pantallas:
`docs/PLAN_CONEXION_BACKEND_REAL.md`.

1. `/dashboard`: visión ejecutiva, ingresos, servicios, clientes, leads y equipo.
2. `/reserva`: formulario público para que un cliente pida un servicio.
3. `/crm`: pipeline comercial y base de clientes.
4. `/crm/cust-atrium`: ficha de cliente con historial, notas, servicios y facturas.
5. `/services`: servicios recurrentes, puntuales, estados y equipos.
6. `/calendar`: calendario semanal con drag and drop local.
7. `/employees`: perfiles, disponibilidad y rendimiento.
8. `/empleado`: vista móvil de operario para iniciar, completar o reportar incidencias.
9. `/invoices`: presupuestos, facturas, IVA, PDF y conversión a servicio.
10. `/payments`: planes, pagos y simulación de Stripe.
11. `/automations`: recordatorios, confirmaciones y reseñas.
12. `/portal`: portal cliente con solicitudes y documentos.
13. `/admin`: panel SaaS con MRR, churn y empresas.

## Gestión de datos durante la demo

El CRM incluye un panel llamado `Control de datos demo` en `/services`, `/crm` y
`/employees`. Sirve para probar sin miedo delante del cliente.

Acciones individuales:

- En `/services`, cada servicio tiene botón de editar, botón de borrar, selector
  de estado y selector de equipo.
- En `/crm`, cada lead del pipeline tiene botón de editar, botón de borrar y
  selector para moverlo de fase.
- En `/employees`, cada empleado tiene selector de estado, botón de editar y
  botón de borrar.
- En las reservas web, si una solicitud queda pendiente, aparece en
  `/services` con edición, borrado, cambio de estado y asignación de empleado.
- Si una reserva se autoasigna y ya no aparece como pendiente, se puede gestionar
  desde `/portal`, en `Solicitudes recientes`.

Acciones colectivas:

- `Reservas web`: borra solicitudes creadas desde `/reserva` y elimina también
  sus servicios y leads vinculados.
- `Servicios`: restaura el calendario/listado de servicios inicial y limpia
  reservas web asociadas.
- `Leads`: restaura el pipeline comercial inicial.
- `Empleados`: restaura la plantilla inicial de empleados.
- `Notas`: borra las notas creadas durante las pruebas.
- `Reiniciar todo`: devuelve toda la demo al estado inicial, incluido el
  aprendizaje local del motor de asignación.

Recomendación para enseñar: empieza con `Reiniciar todo`, crea una reserva en
`/reserva`, enséñala en `/services`, edítala, asígnala o bórrala, y termina
limpiando `Reservas web`.

## Probar formato móvil en el navegador

1. Abre `/dashboard`.
2. Abre las herramientas de desarrollo del navegador.
3. Activa el modo responsive.
4. Usa un tamaño tipo móvil, por ejemplo `390 x 844`.
5. Abre el menú móvil con el botón de navegación y entra en varias secciones.

Rutas recomendadas para revisar en móvil:

```text
/dashboard
/crm
/crm/cust-atrium
/services
/calendar
/employees
/empleado
/invoices
/payments
/automations
/portal
/reserva
/admin
```

## Enseñar formato móvil sin DevTools

También puedes abrir una ventana tipo app móvil desde el ordenador. No enseña la
barra normal del navegador y queda mejor para cliente.

Primero deja la demo arrancada:

```bash
npm run demo:start
```

Después abre la vista de empleado en formato móvil:

```bash
npm run demo:mobile:employee
```

O abre la reserva pública del cliente en formato móvil:

```bash
npm run demo:mobile:booking
```

La ventana se abre a `430 x 900`, suficiente para enseñar el producto como si
fuera una pantalla móvil. Si quieres enseñar otra ruta, puedes usar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/open-mobile-demo.ps1 -Route portal
```

## Qué está simulado

- Las acciones escriben en estado local del navegador, no en una base real.
- Stripe se simula si no hay credenciales reales configuradas.
- Supabase Auth se simula si no hay proyecto real configurado.
- Los PDF se generan en local como documentos de muestra.
- Google Calendar queda simulado como integración preparada.

## Comprobación antes de enseñar

```bash
npm run lint
npm run build
```

Después arranca `npm run dev` y revisa que `/login` y `/dashboard` cargan sin
errores de consola.
