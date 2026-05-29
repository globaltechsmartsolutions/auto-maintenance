# LimpiaPro CRM

Plataforma SaaS CRM para empresas de limpieza en España. Está construida con
Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase, PostgreSQL, Prisma ORM
y Stripe Subscriptions.

## Módulos

- Autenticación con Supabase: login, registro, recuperación y roles.
- Dashboard ejecutivo: ingresos, servicios, clientes, leads, facturas y equipo.
- CRM: pipeline, clientes, perfiles, historial, notas, etiquetas y seguimiento.
- Servicios: recurrentes, puntuales, estados y asignación de empleados.
- Calendario: vistas semana/mes y tablero drag and drop.
- Empleados: disponibilidad, trabajos asignados, métricas y notas internas.
- Presupuestos y facturas: IVA español, historial y descarga PDF preparada.
- Pagos: Stripe Checkout, Billing Portal, historial y alertas de pago fallido.
- Automatizaciones: recordatorios, confirmaciones, follow-up y reseñas.
- Portal cliente: servicios, facturas, solicitudes y documentos.
- Panel SaaS: empresas, suscripciones, MRR, churn, usuarios y analítica.

## Estructura

```text
src/app
  (auth)              Flujos de acceso
  (dashboard)         Plataforma interna
  api                 Route handlers
src/components
  auth                Formularios de autenticación
  calendar            Agenda drag and drop
  crm                 Pipeline comercial
  dashboard           KPIs y gráficos
  layout              Shell SaaS responsive
  payments            Acciones Stripe
  shared              Componentes comunes
src/lib
  auth                Roles y permisos
  supabase            Clientes Supabase
  prisma.ts           Prisma con adapter pg
  stripe.ts           Stripe lazy singleton
prisma/schema.prisma  Modelo PostgreSQL multiempresa
prisma.config.ts      Configuración Prisma 7
```

## Arranque local

Para demo local sin servicios externos ya existe `.env.local` con
`NEXT_PUBLIC_DEMO_MODE=true`.

```bash
npm install
npm run prisma:generate
npm run dev
```

La app queda disponible en `http://localhost:3000`.

Guía específica de demo: `docs/DEMO_LOCAL.md`.

## Base de datos

Configura `DATABASE_URL` con una instancia PostgreSQL de Supabase. Después:

```bash
npm run db:push
npm run db:studio
```

El esquema incluye empresas, usuarios, roles, clientes, leads, servicios,
empleados, presupuestos, facturas, pagos, automatizaciones, integraciones y
auditoría.

## Variables

```text
DATABASE_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_GROWTH
STRIPE_PRICE_SCALE
```

## Stripe

Endpoints incluidos:

- `POST /api/stripe/checkout`
- `POST /api/stripe/portal`
- `POST /api/webhooks/stripe`

El webhook verifica firma con `STRIPE_WEBHOOK_SECRET` y actualiza el estado de
suscripción de la empresa.

## Despliegue

El proyecto está preparado para Vercel. Añade las variables de entorno en el
proyecto, conecta Supabase y Stripe, ejecuta `npm run prisma:generate` durante el
build y despliega.
