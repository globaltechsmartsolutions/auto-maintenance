# QA manual de la demo local

Fecha: 29 de mayo de 2026.

Rama probada: `feature/demo-polish`.

Entorno probado:

- URL local: `http://127.0.0.1:3000`
- Modo demo: activo.
- Viewport escritorio: `1440 x 1000`.
- Viewport móvil navegador: `390 x 844`.

## Resultado general

La demo local queda apta para enseñar al cliente.

Se han probado rutas, navegación, formularios de autenticación, CRM, ficha de
cliente, calendario, servicios, automatizaciones, pagos demo, menú móvil, APIs
demo y responsive. El pase final no mostró errores ni warnings de consola.

## Rutas probadas

Todas las rutas cargaron con estado 200, título visible y sin desbordamiento
horizontal en escritorio y móvil.

| Ruta | Resultado |
| --- | --- |
| `/login` | Correcto |
| `/register` | Correcto |
| `/reset-password` | Correcto |
| `/dashboard` | Correcto |
| `/crm` | Correcto |
| `/crm/cust-atrium` | Correcto |
| `/services` | Correcto |
| `/calendar` | Correcto |
| `/employees` | Correcto |
| `/invoices` | Correcto |
| `/payments` | Correcto |
| `/automations` | Correcto |
| `/portal` | Correcto |
| `/admin` | Correcto |

Total comprobado: 28 cargas de ruta, contando escritorio y móvil.

## Interacciones probadas

| Flujo | Resultado |
| --- | --- |
| Login demo con usuario precargado | Correcto |
| Registro demo | Correcto |
| Recuperación de contraseña demo | Correcto |
| CRM: pestaña clientes | Correcto |
| CRM: abrir ficha `Atrium Labs` | Correcto |
| Ficha cliente: pestaña servicios | Correcto |
| Ficha cliente: pestaña facturas | Correcto |
| CRM: segmentos comerciales | Correcto |
| Servicios: selector de estado | Correcto |
| Calendario: drag and drop local | Correcto |
| Automatizaciones: switch de activación | Correcto |
| Pagos: checkout demo de Stripe | Correcto |
| Menú móvil: abrir, navegar y cerrar | Correcto |

## APIs demo probadas

| Endpoint | Método | Resultado |
| --- | --- | --- |
| `/api/leads` | GET | 200 |
| `/api/leads` | POST | 201 |
| `/api/services` | GET | 200 |
| `/api/services` | POST | 201 |
| `/api/invoices` | GET | 200 |
| `/api/invoices` | POST | 201 |
| `/api/automations/reminders` | GET | 200 |
| `/api/stripe/portal` | POST | 200 |

## Correcciones realizadas durante la QA

1. Se cambió el título de las pantallas de autenticación para que renderice como
   `h1`, mejorando accesibilidad y validación visual.
2. Se corrigió el drag and drop del calendario para usar `dataTransfer` y hacer
   fiable el movimiento de visitas entre columnas.
3. Se añadió descripción accesible al menú móvil para eliminar el warning de
   `DialogContent`.
4. El menú móvil ahora se cierra al navegar a una sección.

## Comprobaciones técnicas

Ejecutadas correctamente:

```bash
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev
```

Resultado:

- Lint correcto.
- Prisma schema válido.
- Build de producción correcto.
- Auditoría de producción sin vulnerabilidades.

## Estado local final

Después de ejecutar `npm run build`, se reinició el servidor local de desarrollo
porque el proceso anterior quedó devolviendo 500. La demo vuelve a responder
correctamente en:

```text
http://127.0.0.1:3000/dashboard
```

## Observaciones para la demo

- El checkout de Stripe funciona en modo demo y redirige a la pantalla de pagos
  con `checkout=demo`.
- El calendario mueve visitas en cliente, pero la persistencia real queda para
  preproducción.
- Las APIs responden en modo demo sin base de datos real.
- No se detectaron errores ni warnings de consola en el pase final.
