# Demo local para cliente

La aplicación queda preparada para funcionar en local sin conectar Supabase,
Stripe ni PostgreSQL. El modo demo usa datos de ejemplo y evita errores al
probar login, registro, pagos y APIs básicas.

## Arranque rápido

```bash
cd C:\Users\aleja\OneDrive\Documents\GLOBALTECH\auto-maintenance
npm install
npm run dev
```

Abre:

```text
http://127.0.0.1:3000/dashboard
```

## Probar formato móvil en el navegador

Para enseñarlo en formato móvil desde el mismo navegador:

1. Abre `http://127.0.0.1:3000/dashboard`.
2. Abre las herramientas de desarrollo del navegador.
3. Activa el modo responsive.
4. Usa un tamaño tipo móvil, por ejemplo `390 x 844`.

Rutas recomendadas para revisar en ese tamaño:

```text
/dashboard
/crm
/crm/cust-atrium
/services
/calendar
/employees
/invoices
/payments
/automations
/portal
/admin
```

También puedes abrir:

```text
http://127.0.0.1:3000/login
```

El formulario de login ya aparece rellenado con datos demo. Al enviar, entra al
dashboard sin depender de Supabase.

## Rutas recomendadas para enseñar

1. `/dashboard`: visión ejecutiva, ingresos, servicios, clientes, leads y equipo.
2. `/crm`: pipeline comercial y base de clientes.
3. `/crm/cust-atrium`: ficha de cliente con historial, notas, servicios y facturas.
4. `/services`: servicios recurrentes, puntuales, estados y equipos.
5. `/calendar`: calendario semanal con drag and drop local.
6. `/employees`: perfiles, disponibilidad y rendimiento.
7. `/invoices`: presupuestos, facturas e IVA.
8. `/payments`: planes, pagos y simulación de Stripe.
9. `/automations`: recordatorios, confirmaciones y reseñas.
10. `/portal`: portal cliente.
11. `/admin`: panel SaaS con MRR, churn y empresas.

## Qué está simulado

- Login, registro y reset de contraseña.
- Datos de clientes, servicios, empleados, facturas, leads y métricas.
- Checkout de Stripe: redirige a `/payments?checkout=demo`.
- Portal de Stripe: redirige a una URL local de demo.
- APIs de leads, servicios y facturas devuelven datos demo si no hay base real.

## Qué no necesitas para la demo

- No necesitas crear proyecto Supabase.
- No necesitas levantar PostgreSQL.
- No necesitas configurar Stripe.
- No necesitas variables secretas reales.

## Comprobación antes de enseñar

```bash
npm run lint
npm run build
npm audit --omit=dev
```

Después arranca `npm run dev` y revisa que `/dashboard` responda correctamente.
