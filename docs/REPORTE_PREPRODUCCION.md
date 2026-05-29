# Reporte de preparación de preproducción

Fecha: 29 de mayo de 2026.

Rama: `feature/preproduccion-infra`.

## Qué se ha preparado

Se ha avanzado la parte técnica que estaba asignada al socio, sin usar secretos
reales ni romper la demo local.

## Cambios realizados

### Base de datos

- Añadido seed idempotente en `prisma/seed.mjs`.
- Añadido script `npm run db:seed`.
- Añadido script `npm run db:migrate:deploy`.
- Añadido script `npm run preprod:verify`.

El seed carga datos suficientes para enseñar una demo en preproducción con
PostgreSQL real.

### Autenticación y seguridad

- El middleware protege rutas privadas cuando Supabase está configurado y
  `DEMO_MODE=false`.
- Las rutas públicas de auth siguen accesibles.
- Si hay sesión activa y el usuario entra en `/login`, se redirige a
  `/dashboard`.
- Si no hay sesión y se intenta entrar a una ruta privada, se redirige a
  `/login`.

### Roles en APIs

Se añadió protección inicial por rol para:

- Leads.
- Servicios.
- Facturas.
- Recordatorios de automatización.

En modo demo, las APIs siguen devolviendo datos mock para que la demo local no
se rompa.

### Variables de entorno

- `.env.example` documenta variables de PostgreSQL, Supabase y Stripe test.
- Se añadió `STRIPE_PRICE_PRO` como alias posible para preproducción.

### Documentación

Se añadió:

```text
docs/PREPRODUCCION_SETUP.md
```

Ese documento explica variables, comandos, seed, Supabase Auth, Stripe test y
verificación.

## Qué no se ha podido hacer sin credenciales

No se puede completar desde este entorno:

- Crear el proyecto real de Supabase.
- Configurar usuarios reales de Supabase Auth.
- Ejecutar `db:push` contra una base de datos real.
- Ejecutar `db:seed` contra preproducción real.
- Crear productos/precios reales en Stripe test.
- Configurar webhook real en Stripe.
- Crear o verificar una URL real de Vercel preview.

## Comandos de verificación

Ejecutados correctamente:

```bash
npm run preprod:verify
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev
node --check prisma/seed.mjs
```

Nota: `npm run preprod:verify` se ejecutó con el servidor local detenido para
evitar conflictos con los artefactos generados en `.next`.

## Siguiente paso operativo

1. Configurar proyecto Supabase.
2. Configurar variables en Vercel.
3. Ejecutar `npm run db:push`.
4. Ejecutar `npm run db:seed`.
5. Crear usuarios en Supabase Auth y asociar `supabaseUserId` con la tabla
   `User`.
6. Crear Stripe test products/prices.
7. Configurar webhook de Stripe.
8. Probar URL preview.
