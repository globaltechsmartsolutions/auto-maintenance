# Setup de preproducción

Fecha: 29 de mayo de 2026.

Este documento explica cómo levantar una preproducción real del CRM sin romper
el modo demo local.

## Objetivo

Dejar una URL de Vercel conectada a:

- PostgreSQL real, recomendado Supabase Postgres.
- Prisma ORM.
- Supabase Auth.
- Stripe en modo test.
- Datos demo cargados con `npm run db:seed`.

## Rama de trabajo

La rama técnica recomendada es:

```bash
feature/preproduccion-infra
```

`main` debe quedar como versión estable de demo.

## Variables de entorno

En local puedes seguir usando `.env.local` con modo demo.

En Vercel preproducción configura:

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
STRIPE_PRICE_PRO
STRIPE_PRICE_SCALE
NEXT_PUBLIC_DEMO_MODE=false
DEMO_MODE=false
```

No subas valores reales al repositorio.

## Base de datos

1. Crear proyecto en Supabase.
2. Copiar la cadena de conexión PostgreSQL.
3. Configurar `DATABASE_URL` en Vercel.
4. Ejecutar en entorno controlado:

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

Para producción formal, se recomienda generar migraciones versionadas antes de
vender el producto:

```bash
npm run db:migrate
npm run db:migrate:deploy
```

## Seed de datos

El seed está en:

```text
prisma/seed.mjs
```

Carga:

- 1 empresa demo.
- Usuarios con roles `ADMIN`, `MANAGER` y `EMPLOYEE`.
- 4 perfiles de empleados.
- 5 clientes.
- 8 leads.
- 8 servicios.
- 3 presupuestos.
- 5 facturas.
- 1 pago.
- 3 automatizaciones.
- 1 integración preparada para Google Calendar.

Comando:

```bash
npm run db:seed
```

## Supabase Auth

El middleware ya protege rutas privadas cuando Supabase está configurado y el
modo demo está desactivado.

Rutas públicas:

```text
/login
/register
/reset-password
```

Rutas privadas:

```text
/
/dashboard
/crm
/services
/calendar
/employees
/invoices
/payments
/automations
/portal
/admin
```

Las APIs principales usan una primera protección por rol cuando Supabase está
configurado.

Roles aplicados:

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

## APIs protegidas

En modo demo o sin base de datos, las APIs siguen respondiendo con datos demo.

En preproducción con Supabase configurado:

- `/api/leads`: `SUPER_ADMIN`, `ADMIN`, `MANAGER`.
- `/api/services` GET: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `EMPLOYEE`.
- `/api/services` POST: `SUPER_ADMIN`, `ADMIN`, `MANAGER`.
- `/api/invoices`: `SUPER_ADMIN`, `ADMIN`, `MANAGER`.
- `/api/automations/reminders`: `SUPER_ADMIN`, `ADMIN`, `MANAGER`.

Las consultas se acotan por `companyId`, salvo `SUPER_ADMIN`.

## Stripe test mode

1. Crear productos y precios en Stripe test.
2. Configurar:

```text
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_GROWTH
STRIPE_PRICE_SCALE
```

3. Configurar webhook hacia:

```text
https://TU_PREPRODUCCION.vercel.app/api/webhooks/stripe
```

Eventos recomendados:

```text
checkout.session.completed
customer.subscription.deleted
invoice.payment_failed
```

## Verificación

Antes de entregar:

```bash
npm run preprod:verify
```

Ejecuta la verificación con el servidor local parado. Si antes has tenido
`npm run dev` levantado, detén el proceso para evitar conflictos con la carpeta
generada `.next`.

También puedes ejecutar paso a paso:

```bash
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev
```

## Mantener demo local

Para demo local sin credenciales:

```text
NEXT_PUBLIC_DEMO_MODE=true
DEMO_MODE=true
```

Con eso la app sigue navegable sin Supabase, PostgreSQL ni Stripe.
