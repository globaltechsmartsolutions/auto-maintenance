# Roadmap de revisión de cumplimiento

Fecha de revisión: 29 de mayo de 2026.

Este roadmap sirve para comprobar, punto por punto, que la plataforma SaaS CRM
para empresas de limpieza en España cumple el objetivo inicial y queda preparada
para evolucionar hacia una versión comercial.

## Criterio de estados

- Cumplido: existe implementación funcional o estructura verificable en código.
- Preparado: existe base técnica y rutas, pero requiere credenciales, datos reales
  o conexión externa para cerrar producción.
- Pendiente: falta una implementación productiva completa.

## Fase 1. Base técnica

| Objetivo | Estado | Evidencia | Próxima acción |
| --- | --- | --- | --- |
| Next.js 15 | Cumplido | `package.json`, `src/app` | Mantener parches de seguridad al día. |
| TypeScript | Cumplido | `tsconfig.json`, componentes `.tsx` | Activar reglas adicionales si el equipo lo pide. |
| Tailwind CSS | Cumplido | `src/app/globals.css` | Consolidar tokens de diseño si se crea marca final. |
| shadcn/ui | Cumplido | `components.json`, `src/components/ui` | Añadir componentes según flujos nuevos. |
| Supabase | Preparado | `src/lib/supabase`, auth actions | Configurar proyecto real, RLS y políticas. |
| PostgreSQL | Cumplido | `prisma/schema.prisma` | Crear migración inicial contra Supabase. |
| Prisma ORM | Cumplido | `prisma.config.ts`, `src/lib/prisma.ts` | Añadir seeds y migraciones versionadas. |
| Stripe subscriptions | Preparado | `src/app/api/stripe`, webhook | Crear productos/precios reales y probar webhooks. |
| Vercel deployment ready | Cumplido | `vercel.json`, README | Añadir variables en Vercel y desplegar preview. |

## Fase 2. Producto principal

| Módulo | Estado | Evidencia | Revisión pendiente |
| --- | --- | --- | --- |
| Autenticación | Preparado | `/login`, `/register`, `/reset-password`, `src/app/actions/auth.ts` | Probar con Supabase real y bloquear rutas por sesión. |
| Roles | Preparado | `src/lib/auth/roles.ts`, enum `UserRole` | Aplicar permisos en Server Components y API routes. |
| Dashboard | Cumplido | `/dashboard`, gráficos, KPIs | Sustituir mock data por consultas reales. |
| CRM | Cumplido | `/crm`, `/crm/[customerId]`, pipeline | Conectar formularios de alta y notas a base de datos. |
| Servicios | Cumplido | `/services`, API `/api/services` | Añadir edición, cancelación y workflow operativo real. |
| Calendario | Cumplido | `/calendar`, drag and drop local | Persistir cambios y conectar Google Calendar. |
| Empleados | Cumplido | `/employees`, modelo `Employee` | Añadir alta, disponibilidad real y control de permisos. |
| Presupuestos y facturas | Preparado | `/invoices`, API `/api/invoices`, modelos `Quote` e `Invoice` | Generar PDF real y numeración fiscal robusta. |
| Pagos | Preparado | `/payments`, checkout, portal, webhook | Probar ciclo completo con Stripe test mode. |
| Automatizaciones | Preparado | `/automations`, API reminders, modelo `AutomationRule` | Integrar proveedor de email/SMS y colas. |
| Portal cliente | Cumplido como UI | `/portal` | Separar login de cliente y permisos por cliente. |
| Panel SaaS admin | Cumplido como UI | `/admin`, modelos `Company` y `SubscriptionStatus` | Conectar métricas reales de MRR, churn y empresas. |
| Responsive móvil | Cumplido | `AppShell`, revisión en 390 x 844 | Probar flujos completos en móvil real. |
| Dark mode | Cumplido | `ThemeProvider`, tokens `.dark` | Ajustar identidad visual final. |

## Fase 3. Revisión de arquitectura productiva

1. Autenticación y seguridad.
   Revisar sesiones Supabase, políticas RLS, middleware, autorización en API
   routes y separación entre `SUPER_ADMIN`, `ADMIN`, `MANAGER` y `EMPLOYEE`.

2. Modelo de datos.
   Revisar cardinalidades, índices, trazabilidad fiscal, auditoría y campos
   obligatorios para España: CIF/NIF, IVA, numeración de facturas y datos de
   empresa emisora.

3. Operaciones.
   Validar el ciclo lead -> cliente -> presupuesto -> servicio -> factura ->
   cobro -> reseña.

4. Integraciones.
   Cerrar Stripe, Supabase, Google Calendar, correo transaccional, SMS y sistema
   de PDF.

5. Calidad.
   Añadir pruebas unitarias de utilidades, pruebas de API routes, pruebas e2e de
   flujos críticos y pruebas de responsive.

6. Despliegue.
   Preparar preview en Vercel, variables de entorno, migraciones, logging,
   backups, dominio y observabilidad.

## Roadmap de cierre hacia producción

| Prioridad | Trabajo | Resultado esperado |
| --- | --- | --- |
| P0 | Configurar Supabase real y ejecutar migración inicial | Base de datos operativa con RLS. |
| P0 | Proteger rutas y API por sesión/rol | Seguridad mínima para SaaS real. |
| P0 | Sustituir mock data por queries Prisma | Dashboard y módulos con datos reales. |
| P0 | Probar Stripe test mode end-to-end | Suscripciones y webhooks fiables. |
| P1 | Crear CRUD completo para clientes, leads, servicios y empleados | Operación diaria editable. |
| P1 | Generar PDF de facturas y presupuestos | Documentación fiscal descargable. |
| P1 | Persistir calendario y asignaciones | Planificación real de equipos. |
| P1 | Implementar automatizaciones con proveedor de email/SMS | Recordatorios y follow-ups reales. |
| P2 | Integrar Google Calendar | Sincronización externa. |
| P2 | Añadir tests e2e y CI | Entrega estable antes de vender. |
| P2 | Observabilidad y métricas SaaS | Seguimiento de MRR, churn y errores. |

## Checklist final de aceptación

- La app compila con `npm run build`.
- El lint pasa con `npm run lint`.
- Prisma valida el esquema con `npx prisma validate`.
- `npm audit --omit=dev` no reporta vulnerabilidades.
- `/dashboard` carga sin errores de consola en desktop.
- `/dashboard` carga sin errores de consola en móvil.
- Existe documentación de arquitectura y despliegue.
- Existe `.env.example` con las variables necesarias.
- El repositorio queda preparado para primer commit y despliegue preview.
