# Roadmap del socio: preproducción, backend e integraciones

Fecha: 29 de mayo de 2026.

Este documento está preparado para que el socio técnico trabaje en paralelo sobre
la parte de preproducción, backend e integraciones, sin pisar el trabajo de demo
visual y producto.

## Instrucciones para un agente que empieza desde cero

Si el agente del socio no tiene ningún contexto previo, debe empezar así:

1. Bajar el proyecto desde GitHub:

```bash
git clone https://github.com/globaltechsmartsolutions/auto-maintenance.git
```

2. Entrar en la carpeta del proyecto:

```bash
cd auto-maintenance
```

3. Comprobar que está en `main` y traer la última versión:

```bash
git status
git pull origin main
```

4. Crear una rama propia para el trabajo de preproducción:

```bash
git switch -c feature/preproduccion-infra
```

5. Instalar dependencias:

```bash
npm install
```

6. Verificar que el proyecto está sano antes de tocar nada:

```bash
npm run lint
npx prisma validate
npm run build
```

7. Trabajar siempre en `feature/preproduccion-infra`, nunca directamente en
   `main`.

8. Al terminar una tanda de trabajo:

```bash
npm run lint
npx prisma validate
npm run build
git status
git add .
git commit -m "Preparar entorno de preproducción"
git push -u origin feature/preproduccion-infra
```

Después debe abrir una Pull Request hacia `main` o avisar para que se revise e
integre.

## Objetivo principal

Dejar la aplicación funcionando en un entorno de preproducción estable, con:

- Deploy en Vercel.
- Base de datos PostgreSQL real.
- Prisma conectado con migraciones.
- Supabase Auth funcionando.
- Roles básicos aplicados.
- Stripe en modo test.
- Variables de entorno separadas de local.
- APIs principales conectadas a datos reales cuando sea posible.
- Modo demo local conservado para no romper la demo offline.

## Rama recomendada

Trabajar en rama propia:

```bash
git pull origin main
git switch -c feature/preproduccion-infra
```

No hacer push directo a `main`. Abrir Pull Request o coordinar merge cuando pase
las comprobaciones.

## Prompt para pegar al agente del socio

```text
Eres un agente técnico y empiezas sin contexto previo. Sigue estas instrucciones
paso a paso y no asumas que el proyecto ya está descargado.

Estamos trabajando en el repositorio:
https://github.com/globaltechsmartsolutions/auto-maintenance

Primero baja el proyecto:
git clone https://github.com/globaltechsmartsolutions/auto-maintenance.git

Entra en la carpeta:
cd auto-maintenance

Actualiza main:
git pull origin main

Trabaja siempre en esta rama:
feature/preproduccion-infra

Crea la rama con:
git switch -c feature/preproduccion-infra

Objetivo:
Preparar la aplicación Next.js 15 SaaS CRM para empresas de limpieza en España
para funcionar en preproducción. Ya existe una demo local funcional con mock data.
No rompas el modo demo local.

Stack:
- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL
- Prisma ORM
- Stripe subscriptions
- Vercel

Tu rama:
feature/preproduccion-infra

Reglas:
- No trabajar directamente en main.
- No hacer push directo a main.
- No subir secretos ni .env reales.
- Mantener .env.local fuera de git.
- Mantener NEXT_PUBLIC_DEMO_MODE/DEMO_MODE para demo local.
- Si conectas datos reales, conserva fallback demo cuando falten credenciales.
- Ejecutar npm run lint, npx prisma validate y npm run build antes de terminar.
- Antes de cambiar archivos grandes o sensibles, revisa el estado con git status.
- Si hay cambios que no has hecho tú, no los borres ni los reviertas.

Trabajo principal:
1. Configurar preproducción en Vercel.
2. Preparar variables de entorno en .env.example y Vercel.
3. Conectar PostgreSQL/Supabase a Prisma.
4. Crear migración inicial o preparar prisma db push según se acuerde.
5. Crear seed de datos demo realistas para preproducción.
6. Activar Supabase Auth para login, register y reset password.
7. Aplicar roles Admin, Manager y Employee.
8. Proteger rutas y APIs por sesión/rol.
9. Conectar APIs de leads, services e invoices a base de datos real.
10. Configurar Stripe en modo test: checkout, billing portal y webhook.
11. Verificar deploy preview en Vercel.

Archivos sensibles:
- prisma/schema.prisma
- prisma.config.ts
- src/lib/prisma.ts
- src/lib/supabase/*
- src/lib/stripe.ts
- src/app/actions/auth.ts
- src/app/api/**
- src/middleware.ts
- .env.example
- vercel.json
- package.json

Criterio de terminado:
- npm run lint pasa.
- npx prisma validate pasa.
- npm run build pasa.
- La app carga en Vercel preview.
- Login real funciona con Supabase en preproducción.
- La base de datos tiene datos demo.
- Stripe test crea una sesión de checkout.
- El webhook de Stripe está documentado o probado.
- El modo demo local sigue funcionando sin Supabase, PostgreSQL ni Stripe.

Al terminar, deja un reporte con:
- Qué se ha conectado.
- Qué variables de entorno hacen falta.
- Qué comandos se han ejecutado.
- Qué rutas se han probado.
- Qué queda pendiente para producción.

Comandos finales obligatorios antes de entregar:
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev

Cuando termines:
git status
git add .
git commit -m "Preparar entorno de preproducción"
git push -u origin feature/preproduccion-infra

No abras ni mezcles cambios en main sin revisión.
```

## Fase 1. Preparación del entorno

### Tareas

- Clonar o actualizar el repo.
- Crear rama `feature/preproduccion-infra`.
- Ejecutar instalación y comprobaciones iniciales.

```bash
npm install
npm run lint
npx prisma validate
npm run build
```

### Criterio de terminado

- El proyecto compila en local.
- El estado inicial está claro.
- No hay secretos en git.

## Fase 2. Variables de entorno

### Tareas

- Revisar `.env.example`.
- Definir variables necesarias para preproducción:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_PRO`
  - `STRIPE_PRICE_SCALE`
  - `DEMO_MODE`
  - `NEXT_PUBLIC_DEMO_MODE`
- Configurar esas variables en Vercel para preproducción.
- No guardar valores reales en el repositorio.

### Criterio de terminado

- `.env.example` documenta todo lo necesario.
- Vercel tiene variables para preview/preproducción.
- Local demo sigue funcionando sin credenciales reales.

## Fase 3. Base de datos y Prisma

### Tareas

- Configurar PostgreSQL real.
- Validar `prisma/schema.prisma`.
- Crear migración inicial o ejecutar `prisma db push` en entorno de prueba.
- Crear seed de datos demo.
- Comprobar que Prisma Client funciona en runtime.

### Datos demo mínimos

- 1 empresa SaaS.
- 3 usuarios internos.
- 5 clientes.
- 8 leads.
- 8 servicios.
- 4 empleados.
- 5 facturas.
- 3 presupuestos.
- 3 reglas de automatización.

### Criterio de terminado

- La base de datos está creada.
- Prisma puede leer y escribir.
- Hay datos suficientes para enseñar la demo en preproducción.

## Fase 4. Supabase Auth y roles

### Tareas

- Configurar Supabase Auth.
- Probar login, registro y reset password.
- Revisar `src/app/actions/auth.ts`.
- Revisar `src/middleware.ts`.
- Aplicar roles:
  - `ADMIN`
  - `MANAGER`
  - `EMPLOYEE`
  - `SUPER_ADMIN`
- Definir qué rutas ve cada rol.

### Criterio de terminado

- Un usuario puede iniciar sesión en preproducción.
- Las rutas privadas no quedan abiertas sin sesión.
- Los roles tienen una primera protección real.

## Fase 5. APIs con datos reales

### Tareas

- Conectar a base de datos:
  - `src/app/api/leads/route.ts`
  - `src/app/api/services/route.ts`
  - `src/app/api/invoices/route.ts`
  - `src/app/api/automations/reminders/route.ts`
- Mantener fallback demo si faltan credenciales o está activo `DEMO_MODE`.
- Añadir validaciones con `zod` donde corresponda.
- Añadir manejo de errores claro.

### Criterio de terminado

- Las APIs responden con datos reales en preproducción.
- En local demo siguen respondiendo con mock data.
- Los errores no exponen información sensible.

## Fase 6. Stripe test mode

### Tareas

- Crear productos y precios de test en Stripe.
- Configurar variables de precios.
- Probar checkout.
- Probar billing portal.
- Configurar webhook en Vercel.
- Revisar `src/app/api/webhooks/stripe/route.ts`.
- Guardar eventos importantes en base de datos si aplica.

### Criterio de terminado

- Se puede iniciar checkout en modo test.
- El portal de Stripe abre correctamente.
- El webhook valida firma.
- El estado de suscripción queda preparado para actualizarse.

## Fase 7. Deploy de preproducción

### Tareas

- Conectar repo a Vercel.
- Crear proyecto de preproducción.
- Configurar variables.
- Ejecutar deploy preview.
- Revisar logs de build.
- Probar rutas principales.

### Rutas a verificar

```text
/login
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

### Criterio de terminado

- Vercel build pasa.
- La URL de preview carga.
- Login funciona.
- No hay errores críticos en consola.
- El flujo principal de demo puede hacerse en preproducción.

## Fase 8. Reporte técnico

Crear o actualizar un reporte con:

- URL de preproducción.
- Variables de entorno necesarias.
- Base de datos usada.
- Estado de Supabase Auth.
- Estado de Stripe test.
- Comandos ejecutados.
- Rutas probadas.
- Errores encontrados y solución.
- Pendientes para producción.

## Comprobaciones obligatorias antes de entregar

```bash
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev
```

## No romper

Muy importante:

- No eliminar el modo demo local.
- No hacer obligatoria la base de datos para navegar en local.
- No subir `.env.local`.
- No subir claves de Supabase ni Stripe.
- No cambiar el diseño principal sin coordinar con Alejandro.
- No modificar mock data visual si Alejandro está trabajando sobre esa parte.

## Definición de preproducción lista

Preproducción está lista cuando:

- Existe una URL accesible en Vercel.
- La app compila y carga.
- Hay base de datos real con datos demo.
- Supabase Auth funciona.
- Stripe test funciona como mínimo hasta checkout.
- Las rutas principales se pueden enseñar.
- La demo local sigue funcionando sin depender de servicios externos.
