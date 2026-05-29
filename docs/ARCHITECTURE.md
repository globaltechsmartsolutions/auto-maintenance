# Arquitectura

## Principios

- Multiempresa desde el modelo de datos: todas las entidades operativas cuelgan
  de `Company`.
- Autenticación delegada en Supabase Auth y autorización por roles internos.
- Prisma ORM sobre PostgreSQL para mantener un dominio tipado y migrable.
- Stripe como sistema de suscripciones, portal de facturación y webhooks.
- UI SaaS modular, responsive y con dark mode por defecto.

## Roles

- `SUPER_ADMIN`: gestión de plataforma, MRR, churn, empresas y usuarios.
- `ADMIN`: administración completa de una empresa.
- `MANAGER`: gestión operativa y comercial.
- `EMPLOYEE`: acceso operativo a servicios asignados.

## Rutas principales

- `/dashboard`
- `/crm`
- `/crm/[customerId]`
- `/services`
- `/calendar`
- `/employees`
- `/invoices`
- `/payments`
- `/automations`
- `/portal`
- `/admin`

## Integraciones preparadas

- Supabase Auth y PostgreSQL.
- Google Calendar desde el módulo de calendario.
- Stripe Checkout, Billing Portal y webhooks.
- Automatizaciones por email/SMS mediante reglas persistidas.
