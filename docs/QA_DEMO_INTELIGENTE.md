# QA de demo: sincronización y motor inteligente

## Estado general

La demo local se ha probado con flujos reales de usuario y datos temporales. En las pruebas se crea información nueva, se valida en varias pantallas y después se restaura el estado anterior para no ensuciar la demo.

Resultado general: **apta para enseñar en local**.

## Pruebas realizadas

### 1. Motor inteligente por tipo de servicio

Casos probados:

- Cristales en comunidad residencial de Madrid.
- Desinfección sanitaria en clínica.
- Limpieza hotelera en Alicante.

Resultado:

| Caso | Recomendación esperada | Resultado |
|---|---|---|
| Cristales / comunidad | Nadia Ramos | Correcto |
| Sanitario / clínica | Miguel Prieto | Correcto |
| Hotel / Alicante | Irene Costa | Correcto |

El motor entiende el tipo de servicio, zona, habilidades y disponibilidad.

### 2. Aprendizaje y autoasignación

Flujo probado:

1. Crear reserva de cristales.
2. Confirmar manualmente a Nadia Ramos.
3. Crear una segunda reserva similar.
4. Verificar que el sistema la marca como `Lista para autoasignar`.
5. Verificar que la segunda queda `Autoasignado` con Nadia Ramos.

Resultado: **correcto**.

Esto demuestra que el sistema no solo recomienda, también aprende de decisiones aceptadas.

### 3. Caso negativo controlado

Caso probado:

- Solicitud nocturna a las 23:30.

Resultado:

- No autoasigna.
- Deja `Equipo por asignar`.
- Muestra avisos de horario fuera de disponibilidad.

Resultado: **correcto**.

Esto es importante: el motor no fuerza una mala asignación.

### 4. Sincronización reserva → CRM → servicios → calendario

Flujo probado:

1. Crear reserva pública.
2. Confirmar que se crea solicitud web.
3. Confirmar que se crea lead.
4. Confirmar que se crea servicio.
5. Confirmar que aparece cliente en CRM.
6. Confirmar que aparece en calendario.
7. Cambiar estado a `Completado`.
8. Verificar que el lead pasa a `Ganado`.

Resultado: **correcto**.

### 5. Login local

Flujo probado:

- Entrar desde `/login` con datos demo precargados.

Resultado: redirige a `/dashboard` correctamente.

### 6. Facturación y pagos

Flujo probado:

1. Crear factura desde Facturación.
2. Verificar que aparece en estado local.
3. Ir a Pagos.
4. Verificar que aparece en historial de cobros y suma pendiente.

Resultado: **correcto**.

### 7. Responsive y consola

Páginas revisadas en desktop y móvil:

- `/dashboard`
- `/services`
- `/crm`
- `/calendar`
- `/employees`
- `/invoices`
- `/payments`
- `/portal`
- `/reserva`
- `/empleado`

Resultado:

- Sin overflow horizontal de página.
- Tablas con scroll interno en móvil.
- Sin errores de consola tras reinicio limpio.

## Fallos encontrados y corregidos

### 1. Empleado asignado que no existía

Había un servicio asignado a `Irene Costa`, pero Irene no existía en el listado de empleados.

Corrección:

- Se añadió `Irene Costa` a los datos demo.
- Se ajustó la carga de estado local para incorporar nuevos empleados semilla aunque exista `localStorage` antiguo.

### 2. Selects de formularios no enlazados al label

Los selectores de algunos diálogos funcionaban visualmente, pero no estaban bien conectados al `label`.

Corrección:

- `DemoNativeSelect` ahora propaga `id`, `aria-*` y el resto de props al `<select>`.

### 3. Hydration mismatch por hot reload

Después de añadir Irene, el servidor de desarrollo seguía sirviendo HTML anterior mientras el cliente ya tenía el bundle nuevo.

Corrección:

- Se reinició el servidor local.
- Tras reinicio limpio, no hay errores de consola.

## Validación técnica

Comandos ejecutados:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Resultado: todos correctos.

## Nota para la demo

Antes de enseñar al cliente, conviene abrir directamente:

```text
http://127.0.0.1:3000/dashboard
```

Y tener preparada esta historia:

1. Enseñar dashboard.
2. Ir a `/reserva` y crear una solicitud.
3. Volver a Servicios y enseñar recomendación inteligente.
4. Asignar recomendada.
5. Enseñar CRM, calendario y empleado.
6. Repetir una solicitud similar para enseñar autoasignación por aprendizaje.

## Aclaración de aprendizaje - 15 de junio de 2026

En la ronda adicional de QA se probó el aprendizaje con servicios recurrentes de
oficinas en días laborables comparables.

Resultado observado:

| Paso | Comportamiento |
|---|---|
| Primera solicitud | El motor recomienda a Laura Méndez, pero deja la asignación pendiente para confirmación. |
| Primera confirmación del responsable | Se registra una decisión `manager-confirmed`. |
| Segunda solicitud similar | El motor mantiene `Recomendación alta` y muestra señales aprendidas. |
| Segunda confirmación del responsable | Se registra una segunda decisión similar aceptada. |
| Tercera solicitud similar en día laborable | El motor pasa a `Lista para autoasignar` y crea el servicio como `Autoasignada`. |

Esto es intencionado: la demo no debe prometer que una sola acción ya convierte
al motor en automático para todo. El comportamiento profesional es:

- si hay buena recomendación pero poco historial, pide confirmación;
- si hay riesgo operativo, horario incompatible o servicio sensible, pide revisión;
- si hay historial repetido y no hay avisos, autoasigna.

Lenguaje recomendado para enseñar al cliente:

> "El sistema aprende de las decisiones del responsable. Primero recomienda; si
> el patrón se repite y las condiciones son seguras, empieza a autoasignar."

Evitar decir porcentajes internos o frases como "94 % de confianza". En la demo
conviene usar estados claros: `Recomendación alta`, `Revisar antes de asignar` y
`Lista para autoasignar`.
