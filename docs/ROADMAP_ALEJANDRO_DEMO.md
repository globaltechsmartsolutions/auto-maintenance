# Roadmap de Alejandro: demo, producto y experiencia cliente

Fecha: 29 de mayo de 2026.

Este roadmap define tu parte del trabajo para preparar una demo convincente del
CRM SaaS de limpieza. El objetivo es que el cliente vea un producto profesional,
entendible y estable, aunque algunas integraciones sigan en modo demo o test.

## Objetivo principal

Preparar la experiencia visible del producto:

- Que la demo cuente una historia clara.
- Que los datos parezcan reales y propios de empresas de limpieza en España.
- Que el recorrido comercial sea fluido.
- Que la interfaz se vea premium en escritorio y en formato móvil desde navegador.
- Que esté claro qué está funcionando en preproducción y qué queda para producción.

## Rama recomendada

Trabaja en una rama propia:

```bash
git pull origin main
git switch -c feature/demo-polish
```

Cuando termines una tanda:

```bash
npm run lint
npm run build
git add .
git commit -m "Pulir demo comercial"
git push -u origin feature/demo-polish
```

No trabajes directamente sobre `main`. `main` debe quedarse como versión estable
para enseñar.

## Archivos que puedes tocar con libertad

- `docs/DEMO_LOCAL.md`
- `docs/REPORTE_IMPLEMENTACION.md`
- `docs/ROADMAP_CUMPLIMIENTO.md`
- `src/lib/mock-data.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/crm/page.tsx`
- `src/app/(dashboard)/crm/[customerId]/page.tsx`
- `src/app/(dashboard)/services/page.tsx`
- `src/app/(dashboard)/calendar/page.tsx`
- `src/app/(dashboard)/employees/page.tsx`
- `src/app/(dashboard)/invoices/page.tsx`
- `src/app/(dashboard)/payments/page.tsx`
- `src/app/(dashboard)/portal/page.tsx`
- `src/app/(dashboard)/admin/page.tsx`
- Componentes visuales dentro de `src/components/`

## Archivos que debes coordinar con tu socio

- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `src/lib/supabase/*`
- `src/lib/stripe.ts`
- `src/app/actions/auth.ts`
- `src/app/api/**`
- `.env.example`
- `package.json`
- `vercel.json`

Si necesitas tocar alguno de esos archivos, avísale antes para evitar conflictos.

## Fase 1. Guion de demo

### Tareas

- Definir el recorrido exacto que enseñarás al cliente.
- Preparar una historia sencilla: una empresa de limpieza recibe leads, agenda
  servicios, asigna empleados, factura y gestiona clientes.
- Escribir el guion en `docs/DEMO_LOCAL.md` o en un nuevo documento específico.
- Marcar las rutas que se van a enseñar y el orden.

### Recorrido recomendado

1. Entrar en `/login`.
2. Acceder al `/dashboard`.
3. Revisar ingresos, clientes activos, servicios mensuales y facturas pendientes.
4. Abrir `/crm` para enseñar leads y clientes.
5. Entrar en `/crm/cust-atrium` para enseñar ficha de cliente.
6. Ir a `/services` para enseñar servicios recurrentes y puntuales.
7. Ir a `/calendar` para enseñar planificación semanal.
8. Ir a `/employees` para enseñar equipo y rendimiento.
9. Ir a `/invoices` para enseñar presupuestos, facturas e IVA.
10. Ir a `/portal` para enseñar la visión del cliente.
11. Cerrar en `/admin` para explicar el enfoque SaaS multiempresa.

### Criterio de terminado

- Existe un guion claro de 10-15 minutos.
- Sabes qué decir en cada pantalla.
- Sabes qué partes son demo, test o producción.

## Fase 2. Datos demo realistas

### Tareas

- Revisar `src/lib/mock-data.ts`.
- Añadir nombres de empresas y clientes realistas de España.
- Añadir servicios típicos:
  - Limpieza de oficinas.
  - Limpieza de comunidades.
  - Limpieza fin de obra.
  - Cristales.
  - Mantenimiento recurrente.
  - Limpieza industrial ligera.
- Añadir facturas con IVA español.
- Añadir empleados con zonas, disponibilidad y rendimiento.
- Añadir leads en distintos estados.

### Criterio de terminado

- La demo no parece vacía ni artificial.
- Cada módulo tiene información suficiente para enseñar.
- Los importes, fechas y estados tienen sentido.

## Fase 3. Pulido visual y comercial

### Tareas

- Revisar textos de tarjetas, tablas y botones.
- Quitar cualquier texto que parezca técnico o provisional.
- Mejorar títulos para que el cliente entienda el valor de cada pantalla.
- Revisar que el diseño parezca SaaS premium: limpio, profesional y ordenado.
- Evitar pantallas con demasiada densidad si el objetivo es explicar rápido.

### Pantallas prioritarias

- `/dashboard`
- `/crm`
- `/crm/cust-atrium`
- `/services`
- `/calendar`
- `/invoices`
- `/portal`
- `/admin`

### Criterio de terminado

- La primera impresión en `/dashboard` es potente.
- El CRM se entiende en menos de un minuto.
- Facturas y servicios parecen útiles para una empresa real.
- El portal cliente ayuda a vender el producto.

## Fase 4. Revisión responsive

### Tareas

- Abrir DevTools del navegador.
- Activar modo responsive.
- Probar tamaño `390 x 844`.
- Revisar que no haya desbordamientos horizontales.
- Revisar que los menús, tablas, tarjetas y botones sean usables.

### Rutas a probar

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
/login
```

### Criterio de terminado

- No hay texto cortado de forma fea.
- No hay botones montados encima de otros.
- Las tablas hacen scroll interno cuando haga falta.
- El menú móvil permite navegar sin perderse.

## Fase 5. Checklist antes de enseñar

Ejecuta:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

Después:

```bash
npm run dev
```

Y revisa:

- `/login` entra correctamente en modo demo.
- `/dashboard` carga sin errores visibles.
- El menú lateral funciona.
- El modo móvil se ve bien.
- El guion completo puede hacerse sin quedarse bloqueado.

## Entregables de tu parte

- Guion de demo cerrado.
- Datos demo realistas.
- Pantallas principales pulidas.
- Revisión responsive hecha.
- Lista clara de lo que se puede prometer y lo que queda para fase 2.

## Coordinación con tu socio

Al final de cada bloque de trabajo, dile:

```text
He tocado estas rutas/archivos:
- ...

Necesito que no toques de momento:
- ...

He probado:
- npm run lint
- npm run build
- ruta X en navegador

Pendiente para integración:
- ...
```

## Definición de demo lista

La demo está lista cuando:

- El producto se puede enseñar de principio a fin.
- No hay errores visibles en consola durante el recorrido principal.
- El cliente entiende el valor del CRM sin explicaciones técnicas largas.
- Preproducción funciona para los flujos acordados.
- Está claro qué funcionalidades son reales, cuáles están en test y cuáles están
  preparadas como arquitectura.
