# Guion de demo para cliente

Fecha: 29 de mayo de 2026.

Este guion está pensado para enseñar el CRM SaaS a una empresa de limpieza en
una demo de 10 a 15 minutos. El objetivo no es explicar tecnología, sino enseñar
cómo una empresa puede controlar ventas, operaciones, equipos, facturación y
clientes desde una sola plataforma.

## Mensaje principal

LimpiaPro CRM centraliza la operación diaria de una empresa de limpieza:

- Capta y ordena leads.
- Convierte oportunidades en clientes.
- Programa servicios recurrentes y puntuales.
- Asigna equipos.
- Controla facturas, cobros e IVA.
- Automatiza recordatorios y seguimientos.
- Da al cliente final un portal para consultar servicios y documentos.
- Permite al administrador SaaS controlar empresas, planes y métricas.

## Preparación antes de enseñar

1. Arrancar la app en local en modo producción:

```bash
npm run build
npm run demo:start
```

2. Abrir:

```text
http://127.0.0.1:3000/login
```

3. Entrar con el login demo ya precargado.

4. Tener preparado el modo responsive del navegador si quieres enseñar móvil:

```text
390 x 844
```

Alternativa más limpia para cliente: abrir una ventana tipo app móvil, sin la
barra normal del navegador:

```bash
npm run demo:mobile:employee
npm run demo:mobile:booking
```

## Recorrido recomendado

### 1. Login

Ruta:

```text
/login
```

Qué contar:

- La plataforma está preparada para login, registro y recuperación de contraseña.
- En preproducción se conectará con Supabase Auth.
- Para la demo local, el acceso está simulado para poder enseñar sin depender de
  servicios externos.

No te entretengas demasiado aquí. El valor empieza en el dashboard.

### 2. Dashboard ejecutivo

Ruta:

```text
/dashboard
```

Qué enseñar:

- Ingresos del mes.
- Servicios activos.
- Clientes activos.
- Facturas pendientes.
- Leads nuevos.
- SLA de servicios completados.

Historia recomendada:

> "La dirección puede abrir la plataforma por la mañana y ver qué está pasando:
> cuánto se está facturando, qué servicios vienen, qué cobros son sensibles y qué
> acciones requieren atención hoy."

Puntos fuertes:

- Las tarjetas superiores dan visión rápida.
- Los gráficos muestran evolución mensual y mix de servicios.
- Las prioridades de hoy ayudan a decidir qué hacer primero.
- La tabla de servicios próximos conecta ventas con operación real.

### 3. Reserva de cliente final

Ruta:

```text
/reserva
```

Qué enseñar:

- Formulario público de solicitud de servicio.
- Datos de contacto, fecha, dirección, servicio y presupuesto estimado.
- Confirmación de reserva.
- Accesos directos para ver el lead, el servicio y la solicitud en el CRM.

Historia recomendada:

> "Aquí vemos cómo un cliente de la empresa de limpieza puede pedir un servicio
> desde el navegador. Al enviar la reserva, el CRM crea automáticamente la
> oportunidad comercial, la solicitud del portal y el servicio pendiente para
> operaciones."

Acciones para enseñar:

- Revisar los datos precargados.
- Pulsar `Enviar solicitud`.
- Entrar en `/crm` y enseñar el nuevo lead.
- Entrar en `/services` y enseñar el servicio pendiente.
- Entrar en `/portal` y enseñar la solicitud recibida.

### 4. CRM comercial

Ruta:

```text
/crm
```

Qué enseñar:

- Pipeline de leads.
- Base de clientes.
- Segmentos comerciales.

Historia recomendada:

> "Aquí el equipo comercial controla desde el primer contacto hasta el cierre:
> nuevos leads, presupuestos enviados, clientes ganados y segmentos para acciones
> comerciales."

Acciones para enseñar:

- Abrir la pestaña `Pipeline`.
- Cambiar a `Clientes`.
- Entrar en `Atrium Labs`.
- Enseñar `Segmentos` para explicar campañas y automatizaciones.

### 5. Ficha de cliente

Ruta:

```text
/crm/cust-atrium
```

Qué enseñar:

- Datos del cliente.
- Riesgo.
- Etiquetas.
- Valor histórico.
- Siguiente mejor acción.
- Historial.
- Servicios asociados.
- Facturas asociadas.

Historia recomendada:

> "Cada cliente tiene una ficha completa. No solo vemos datos de contacto:
> también sabemos qué servicio tiene, qué oportunidad comercial existe y cuál es
> la siguiente acción recomendada."

Punto clave:

- La sección `Siguiente mejor acción` ayuda a vender la idea de CRM inteligente,
  aunque ahora esté alimentada con datos demo.

### 6. Servicios

Ruta:

```text
/services
```

Qué enseñar:

- Servicios críticos.
- Equipos disponibles.
- Incidencias abiertas.
- Servicios recurrentes y puntuales.
- Estado de cada servicio.
- Equipo asignado.
- Total con IVA.

Historia recomendada:

> "La operación puede ver qué servicios hay, quién los ejecuta, qué estado tienen
> y qué incidencias pueden afectar a la calidad."

Punto fuerte:

- Este módulo conecta directamente con la realidad diaria de una empresa de
  limpieza: planificación, equipos, clientes y estados.

### 7. Calendario

Ruta:

```text
/calendar
```

Qué enseñar:

- Vista semanal.
- Asignación de equipos.
- Drag and drop local.
- Preparación para Google Calendar.

Historia recomendada:

> "El calendario permite organizar el trabajo de campo. La idea es que un manager
> pueda mover visitas, reasignar equipos y preparar rutas semanales."

Aviso honesto:

- En local, el drag and drop es visual.
- En preproducción, tu socio debe conectar persistencia real en base de datos.

### 8. Empleados

Ruta:

```text
/employees
```

Qué enseñar:

- Disponibilidad.
- Estado.
- Servicios realizados.
- Rendimiento.
- Ingresos asociados.
- Notas internas.

Historia recomendada:

> "La empresa puede saber quién está disponible, quién está asignado, qué
> rendimiento tiene cada empleado y dónde conviene reforzar equipos."

Ruta complementaria:

```text
/empleado
```

Acciones para enseñar:

- Abrir la vista de empleado.
- Pulsar `Iniciar` en un servicio.
- Volver a `/services` para enseñar el cambio de estado.
- Pulsar `Completar` o `Incidencia` para enseñar la interacción desde campo.

Historia recomendada:

> "El empleado no necesita ver todo el CRM. Puede entrar desde móvil, consultar
> sus trabajos, iniciar un servicio, completarlo o reportar una incidencia. Esa
> acción vuelve al panel de operaciones."

### 9. Facturación

Ruta:

```text
/invoices
```

Qué enseñar:

- Facturas.
- Presupuestos.
- Estados.
- IVA.
- Descarga PDF preparada.

Historia recomendada:

> "La parte fiscal está pensada para España: presupuestos, facturas, IVA,
> vencimientos e historial por cliente."

Aviso honesto:

- La generación real de PDF queda como siguiente fase técnica.
- La estructura ya está preparada en interfaz y modelo de datos.

### 10. Pagos

Ruta:

```text
/payments
```

Qué enseñar:

- Planes de suscripción.
- Plan actual.
- Alerta de pago fallido.
- Historial de pagos.
- Integración preparada con Stripe.

Historia recomendada:

> "Como producto SaaS, la plataforma puede venderse por planes mensuales y
> gestionarse con Stripe."

Aviso honesto:

- En local, Stripe está simulado.
- En preproducción, debe probarse con Stripe en modo test.

### 11. Automatizaciones

Ruta:

```text
/automations
```

Qué enseñar:

- Recordatorio 24 horas antes.
- Confirmación al cliente.
- Solicitud de reseña.
- Aviso de pago fallido.

Historia recomendada:

> "La plataforma reduce trabajo administrativo: confirma servicios, recuerda
> visitas, pide reseñas y ayuda a recuperar pagos fallidos."

### 12. Portal cliente

Ruta:

```text
/portal
```

Qué enseñar:

- Vista del cliente final.
- Servicios visibles.
- Facturas/documentos.
- Solicitud de nuevo servicio.

Historia recomendada:

> "El cliente final también puede entrar, ver qué servicios tiene, descargar
> documentos y pedir nuevos trabajos sin llamar ni mandar correos sueltos."

### 13. Panel SaaS admin

Ruta:

```text
/admin
```

Qué enseñar:

- Empresas.
- Planes.
- MRR.
- Usuarios.
- Churn.
- Estado de suscripciones.

Historia recomendada:

> "Si GlobalTech lo quiere vender como SaaS, desde aquí se controlan empresas,
> planes, usuarios, métricas y riesgo de baja."

## Demo en formato móvil

Abrir DevTools y usar:

```text
390 x 844
```

Rutas recomendadas para enseñar en móvil:

- `/dashboard`
- `/crm`
- `/crm/cust-atrium`
- `/services`
- `/calendar`
- `/empleado`
- `/portal`
- `/reserva`

Qué contar:

> "No es una app móvil nativa todavía, pero el producto está preparado para que
> managers y empleados puedan consultarlo desde navegador en formato móvil."

## Qué decir si preguntan si todo está terminado

Respuesta recomendada:

> "La demo ya enseña la arquitectura y la experiencia del producto. Para
> preproducción estamos conectando Supabase, PostgreSQL, Prisma y Stripe test.
> Algunas partes están simuladas en local para poder enseñar el flujo completo
> sin depender de credenciales externas."

## Qué está listo para enseñar

- Diseño general del SaaS.
- Navegación completa.
- Dashboard.
- CRM.
- Fichas de cliente.
- Reserva pública de cliente final.
- Servicios.
- Calendario visual.
- Empleados.
- Vista de empleado en formato móvil.
- Facturación.
- Pagos SaaS.
- Automatizaciones.
- Portal cliente.
- Panel admin.
- Responsive en navegador.

## Qué queda para la fase técnica de preproducción

- Supabase Auth real.
- PostgreSQL real con seed demo.
- Prisma conectado a datos reales.
- Stripe test completo.
- Webhooks.
- Generación PDF real.
- Persistencia del calendario.
- Permisos avanzados por rol.
- Emails/SMS reales.

## Cierre de la demo

Frase útil para cerrar:

> "La idea es que una empresa de limpieza deje de trabajar con hojas sueltas,
> WhatsApp, calendarios separados y facturas dispersas, y pase a gestionar toda
> la operación desde una plataforma única, escalable y preparada para venderse
> como SaaS."
