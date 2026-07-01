# Sincronización de datos de la demo local

## Objetivo

La demo local funciona como un CRM único, no como pantallas aisladas. Cuando se crea, edita, borra o cambia el estado de una entidad operativa, las vistas relacionadas deben actualizarse desde la misma fuente de datos.

## Fuente de verdad local

La fuente de verdad está en `DemoProvider`, guardada en `localStorage` con la clave:

```text
limpiapro-demo-local-state-v2
```

Entidades principales:

- `leads`: oportunidades del CRM.
- `services`: servicios del calendario y operaciones.
- `employees`: equipo de campo.
- `invoices`: facturas y cobros.
- `quotes`: presupuestos.
- `portalRequests`: reservas web o solicitudes del cliente.
- `notes`: notas comerciales y operativas.
- `assignmentDecisions`: aprendizaje de asignación inteligente.

`customers` ya no es un bloque estático. Ahora se deriva automáticamente de leads, servicios, facturas, presupuestos, reservas y notas.

## Sincronización implementada

- Reserva pública (`/reserva`) crea a la vez:
  - solicitud web,
  - lead,
  - servicio en calendario,
  - cliente derivado en CRM,
  - recomendación/asignación de empleado.

- Servicios:
  - cambiar estado de servicio actualiza la reserva web vinculada;
  - si el servicio pasa a `Completado`, el lead vinculado pasa a `Ganado`;
  - editar un servicio vinculado actualiza cliente, lead, calendario y reserva.
  - borrar un servicio vinculado elimina también la reserva web, el lead, las
    decisiones de asignación y las notas del mismo cliente.

- Reservas web:
  - borrar una reserva web elimina la solicitud, el servicio de calendario, el
    lead comercial, las decisiones de asignación y las notas asociadas al
    cliente.

- Calendario:
  - asignar empleado actualiza servicio, reserva web, empleado y aprendizaje;
  - mover un servicio entre días reprograma el servicio real y la reserva vinculada.

- CRM:
  - la tabla de clientes sale del estado vivo;
  - la ficha `/crm/[customerId]` muestra servicios, facturas, historial y notas sincronizadas;
  - los segmentos se calculan desde clientes reales de la demo.

- Dashboard:
  - métricas, gráficas, servicios próximos, cobros y rendimiento salen del estado vivo.

- Pagos:
  - los importes cobrados, pendientes y vencidos se calculan desde `invoices`.

- Portal cliente:
  - el portal privado filtra datos por su cliente, evitando mezclar información de otros clientes.

## Prueba realizada

Flujo probado en navegador:

1. Crear una reserva desde `/reserva`.
2. Confirmar que aparece como solicitud, lead y servicio.
3. Confirmar que el cliente aparece en CRM.
4. Abrir la ficha del cliente y ver el servicio asociado.
5. Entrar en Servicios y marcar la reserva como `Completado`.
6. Verificar que:
   - la solicitud queda `Completado`,
   - el servicio queda `Completado`,
   - el lead queda `Ganado`,
   - calendario y dashboard siguen leyendo el mismo estado.
7. Crear una reserva temporal, borrarla desde Servicios y verificar que se
   eliminan solicitud, servicio, lead, nota y calendario.

Resultado: correcto.

## Preparado para backend real

La arquitectura queda preparada para sustituir `localStorage` por Supabase/PostgreSQL sin rediseñar las pantallas:

- las páginas consumen `useDemo`;
- las mutaciones están centralizadas;
- las vistas derivadas salen de las mismas entidades;
- el siguiente paso será cambiar la implementación interna del proveedor por llamadas API reales.
