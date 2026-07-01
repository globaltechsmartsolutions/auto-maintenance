# Reporte de demo local funcional

Fecha: 13 de junio de 2026.

## Objetivo

Dejar la demo del CRM funcional en local para enseñarla desde navegador, sin
depender de Supabase, PostgreSQL ni Stripe reales.

## Implementado

- Store local persistente en navegador con `localStorage`.
- Formularios demo para leads, servicios, empleados, presupuestos, facturas,
  solicitudes de portal, notas y automatizaciones.
- Feedback visual con notificaciones locales.
- Descarga de PDF local para documentos de facturación.
- Exportación CSV desde Dashboard.
- Conversión de presupuesto a servicio.
- Simulación de checkout Stripe y portal de facturación.
- Estados editables en servicios.
- Edición y borrado individual de servicios.
- Edición, borrado y cambio de fase de leads.
- Edición, borrado y cambio de estado de empleados.
- Edición y borrado de reservas web, tanto pendientes como autoasignadas.
- Panel `Control de datos demo` para limpiar reservas web, servicios, leads,
  empleados, notas o reiniciar toda la demo.
- Automatizaciones activables y pausables.
- Navegación móvil validada con menú responsive.
- Botón para reiniciar la demo desde el menú de usuario y desde el panel de
  control de datos.

## Pruebas manuales realizadas

- Login demo desde `/login`.
- Crear servicio desde Dashboard y comprobar que aparece en la tabla.
- Crear lead desde `/crm` y comprobar que aparece en el pipeline.
- Filtrar servicios por estado en `/services`.
- Crear factura en `/invoices`.
- Descargar PDF de factura.
- Convertir presupuesto en servicio.
- Pausar automatización en `/automations`.
- Crear solicitud desde `/portal`.
- Crear reserva pública desde `/reserva` y comprobar que entra como servicio y
  lead en el CRM.
- Editar el servicio generado, validar que no crea duplicados y que actualiza el
  importe.
- Mover un lead entre fases, editarlo y borrarlo con confirmación.
- Borrar un servicio con confirmación.
- Limpiar reservas web de forma colectiva y comprobar que desaparecen sus datos
  vinculados.
- Cambiar estado de un empleado y abrir su edición con datos reales.
- Reiniciar toda la demo y comprobar que vuelve a datos base.
- Guardar nota en `/crm/cust-atrium`.
- Simular checkout de plan en `/payments`.
- Probar navegación móvil en viewport `390 x 844`.
- Revisar consola del navegador sin errores ni warnings.

## Verificación técnica

```bash
npm run lint
npm run build
```

Resultado:

- Lint correcto.
- Build correcto.
- Servidor local levantado en `http://127.0.0.1:3000`.
- Consola de navegador revisada: 0 errores y 0 warnings.

## Cómo probar ahora

Abre:

```text
http://127.0.0.1:3000/login
```

Pulsa `Entrar` y recorre el guion de `docs/DEMO_LOCAL.md`.

Si quieres arrancarlo de nuevo para demo:

```bash
npm run build
npm run demo:start
```

Si prefieres desarrollo con recarga automática y el puerto está ocupado:

```bash
npm run dev -- --port 3001
```
