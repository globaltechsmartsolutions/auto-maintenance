# Plan de conexión a backend real

## Objetivo

La demo debe servir como base del producto real. La transición correcta no es
rehacer pantallas, sino sustituir la persistencia local por Supabase,
PostgreSQL, Prisma y Stripe manteniendo el mismo contrato funcional.

## Principio de arquitectura

Las pantallas no deben hablar directamente con `localStorage`, Prisma ni
Supabase. Deben hablar con una fachada de datos.

Actualmente esa fachada es:

```text
src/components/demo/demo-provider.tsx
```

Las páginas y componentes consumen `useDemo()` y acciones como:

- `createBookingRequest`
- `assignServiceTeam`
- `updateServiceStatus`
- `updateLeadStatus`
- `deleteService`
- `deleteLead`
- `deleteEmployee`
- `deletePortalRequest`
- `clearDemoScope`

Para producción, se debe mantener ese contrato y cambiar la implementación por
llamadas reales a API/Prisma. Así no hay que rediseñar Dashboard, CRM,
Servicios, Calendario, Empleados ni Portal.

## Qué ya está preparado

- Prisma configurado en `prisma/schema.prisma`.
- Cliente Prisma lazy en `src/lib/prisma.ts`.
- Supabase server/client en `src/lib/supabase`.
- Control de modo demo en `src/lib/demo-mode.ts`.
- Rutas API iniciales para leads, servicios, facturas, Stripe y automatizaciones.
- Variables en `.env.example`.
- Modelos reales para empresas, usuarios, empleados, clientes, leads, servicios,
  presupuestos, facturas, pagos y automatizaciones.
- Modelos añadidos para la evolución real de la demo:
  - `BookingRequest`: reserva web/solicitud del cliente.
  - `AssignmentDecision`: histórico de decisiones del motor inteligente.
  - `EmployeeFieldStatus` y campos operativos en `Employee`.

## Mapeo demo a base real

| Demo local | Backend real |
|---|---|
| `DemoLead` | `Lead` |
| `DemoService` | `Service` + `ServiceAssignment` |
| `DemoEmployee` | `Employee` + `User` |
| `DemoPortalRequest` | `BookingRequest` |
| `DemoAssignmentDecision` | `AssignmentDecision` |
| `DemoInvoice` | `Invoice` + `InvoiceItem` |
| `DemoQuote` | `Quote` + `QuoteLineItem` |
| `DemoAutomation` | `AutomationRule` |

## Cómo debe hacerse el cambio

1. Crear proyecto Supabase.
2. Configurar variables reales:

```env
DEMO_MODE="false"
NEXT_PUBLIC_DEMO_MODE="false"
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
STRIPE_SECRET_KEY="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
```

3. Ejecutar migraciones:

```bash
npm run prisma:generate
npm run db:migrate:deploy
```

4. Crear seed real de preproducción:

```bash
npm run db:seed
```

5. Sustituir la implementación interna de `DemoProvider` por un adaptador real.
   Las pantallas deben seguir llamando al mismo contrato.

Estructura recomendada:

```text
src/lib/data/local-crm-repository.ts
src/lib/data/api-crm-repository.ts
src/lib/data/crm-repository-contract.ts
```

El provider elegiría implementación según entorno:

```ts
const repository = isDemoMode()
  ? createLocalCrmRepository()
  : createApiCrmRepository();
```

6. Completar endpoints que faltan para CRUD real:

```text
PATCH /api/leads/[leadId]
DELETE /api/leads/[leadId]
PATCH /api/services/[serviceId]
DELETE /api/services/[serviceId]
GET /api/employees
POST /api/employees
PATCH /api/employees/[employeeId]
DELETE /api/employees/[employeeId]
GET /api/booking-requests
POST /api/booking-requests
PATCH /api/booking-requests/[requestId]
DELETE /api/booking-requests/[requestId]
POST /api/services/[serviceId]/assign
```

7. Mantener mutaciones optimistas en frontend: la app responde rápido y después
   confirma con backend.

8. Activar Stripe real en test mode y validar:

- Checkout de suscripción.
- Portal de facturación.
- Webhook de pagos.
- Estados `PAST_DUE`, `ACTIVE`, `CANCELED`.

## Motor inteligente real

El motor de asignación ya tiene la lógica base en:

```text
src/lib/assignment/demo-assignment.ts
```

Para producción debe leer:

- empleados disponibles desde `Employee`;
- servicios existentes desde `Service`;
- reservas entrantes desde `BookingRequest`;
- aprendizaje histórico desde `AssignmentDecision`.

El patrón real debe ser:

1. El cliente crea una reserva pública.
2. Se guarda `BookingRequest`.
3. Se crea o actualiza `Lead`.
4. Se crea `Service` pendiente o programado.
5. El motor recomienda empleado.
6. Si la confianza operativa es suficiente, se autoasigna.
7. Si no, el manager confirma manualmente.
8. La decisión se guarda en `AssignmentDecision`.
9. Las próximas recomendaciones usan ese historial.

## Qué no debe tocarse en el paso a real

- Layout principal.
- Dashboard visual.
- CRM visual.
- Servicios visual.
- Calendario visual.
- Empleados visual.
- Portal cliente.
- Formulario público `/reserva`.
- Componentes de tablas, cards, botones y modales.

## Qué sí falta antes de producción real

- Adaptador `api-crm-repository`.
- Endpoints `PATCH` y `DELETE`.
- Endpoints de empleados y reservas web.
- Seed real de empresa, usuarios y empleados.
- Autenticación Supabase completa con roles.
- Middleware/protección por sesión en producción.
- Migraciones aplicadas a Supabase.
- Stripe test mode validado con webhooks.
- Auditoría de permisos por `companyId`.

## Conclusión

La demo no debe tirarse. La UI y el flujo funcional son reutilizables. El paso a
real debe concentrarse en persistencia, autenticación, permisos y endpoints,
manteniendo el contrato actual de acciones del CRM.
