# Análisis del motor inteligente de asignación de empleados

## Idea principal

El sistema inteligente no debe ser simplemente:

> “Si el servicio es cristales, asigna a Nadia”.

Eso sería una automatización básica. Lo que necesitamos es un motor de decisión que seleccione empleados con criterios reales:

- disponibilidad;
- habilidades;
- distancia;
- carga de trabajo;
- duración estimada;
- historial con el cliente;
- rendimiento;
- incidencias;
- coste operativo;
- confianza de la recomendación.

La IA generativa debe ayudar a entender la solicitud, conversar con el cliente y explicar la decisión. La asignación debe basarse en datos y restricciones.

## Qué problema estamos resolviendo

Cuando entra una reserva desde la web, el dueño normalmente tendría que:

1. Leer la solicitud.
2. Entender qué tipo de servicio es.
3. Mirar quién está disponible.
4. Mirar quién sabe hacer ese servicio.
5. Revisar si alguien está cerca.
6. Evitar sobrecargar a la misma persona.
7. Asignar empleado.
8. Actualizar calendario.
9. Avisar al cliente o al empleado.

La aplicación debe hacer casi todo eso y dejar al dueño solo la decisión final:

> “Recomendado: Nadia Ramos. Confianza alta. Motivo: especialista en cristales, disponible en Madrid, carga baja ese día.”

## Motor de selección propuesto

### Paso 1: Interpretar la solicitud

La reserva puede venir estructurada o con texto libre. El sistema debe convertirla a algo así:

```json
{
  "serviceType": "cristales",
  "city": "Madrid",
  "address": "Calle Alcalá 120",
  "preferredDate": "2026-06-18",
  "preferredTime": "10:00",
  "estimatedDurationMinutes": 120,
  "requiredSkills": ["cristales"],
  "urgency": "normal",
  "needsQuote": true
}
```

Aquí sí entra un LLM con salida estructurada, porque es bueno interpretando texto del cliente:

- “Necesito limpiar cristales exteriores y portal antes del viernes”.
- “Es una comunidad de vecinos”.
- “Tiene que ser por la mañana”.

Pero el LLM solo extrae datos. No asigna por intuición.

### Paso 2: Aplicar restricciones duras

Un empleado queda descartado si incumple algo obligatorio:

- No está activo.
- Está de vacaciones.
- No trabaja ese día.
- Ya tiene otro servicio que se solapa.
- No tiene la habilidad obligatoria.
- Está fuera de zona si la empresa lo configura así.
- Supera horas máximas o carga diaria.

Ejemplo:

```ts
if (!employee.skills.includes("cristales")) reject();
if (!isAvailable(employee, date, time, duration)) reject();
if (employee.status === "Vacaciones") reject();
```

Esto debe ser determinista, no IA generativa.

### Paso 3: Puntuar candidatos

Los empleados que pasan el filtro reciben una puntuación.

Propuesta inicial:

| Factor | Peso |
|---|---:|
| Habilidad exacta para el servicio | 25 |
| Disponibilidad en la franja solicitada | 20 |
| Cercanía / tiempo de desplazamiento | 15 |
| Carga de trabajo del día | 15 |
| Rendimiento histórico | 10 |
| Afinidad con cliente o tipo de cliente | 10 |
| Coste operativo / margen | 5 |

Penalizaciones:

- incidencia reciente: -10;
- llega justo desde otro servicio: -8;
- demasiados servicios asignados esa semana: -8;
- baja confianza en datos de dirección: -5;
- cliente premium y empleado junior: -5.

Ejemplo:

```ts
score =
  skillScore * 0.25 +
  availabilityScore * 0.20 +
  distanceScore * 0.15 +
  workloadScore * 0.15 +
  performanceScore * 0.10 +
  customerAffinityScore * 0.10 +
  marginScore * 0.05 -
  penalties;
```

Salida interna:

```json
{
  "recommendedEmployee": "Nadia Ramos",
  "score": 91,
  "confidence": "Alta",
  "reasons": [
    "Especialista en cristales",
    "Disponible el 18 jun a las 10:00",
    "Tiene baja carga de trabajo ese día",
    "Trabaja habitualmente en Madrid"
  ],
  "alternatives": [
    {
      "employee": "Laura Méndez",
      "score": 78,
      "reason": "Disponible, pero menor especialización en cristales"
    }
  ]
}
```

En la interfaz comercial no conviene enseñar porcentajes ni puntuaciones técnicas. El usuario debe ver lenguaje claro:

```txt
Recomendación alta
Lista para asignar
Revisar antes de asignar
No recomendable
```

La puntuación queda por dentro para ordenar candidatos y auditar decisiones. Hacia fuera mostramos motivos entendibles.

## Tres niveles de inteligencia

### Nivel 1: Recomendador explicable

Para una reserva individual:

1. Filtra empleados.
2. Calcula puntuación.
3. Devuelve recomendación.
4. El dueño confirma.

Esto es el MVP perfecto para demo.

### Nivel 2: Optimización del día completo

Cuando hay varias reservas para el mismo día, no conviene asignar una por una de forma aislada. Puede que Nadia sea la mejor para una reserva, pero si tiene tres servicios lejos entre sí, otra combinación es mejor.

Aquí entra optimización:

- variables: empleado X realiza servicio Y;
- restricciones: disponibilidad, habilidades, solapes, horas máximas;
- objetivo: minimizar tiempo muerto, desplazamientos y sobrecarga.

Esto encaja con OR-Tools CP-SAT y problemas de asignación.

### Nivel 3: Rutas y ventanas horarias

Cuando importa mucho la localización:

- varias limpiezas en distintas direcciones;
- ventanas horarias;
- empleados como “vehículos”;
- tiempo de desplazamiento;
- hora de inicio y fin.

Aquí encaja un Vehicle Routing Problem with Time Windows.

En limpieza puede ser muy potente:

> “Organízame los servicios de mañana minimizando desplazamientos y respetando ventanas horarias”.

## Datos necesarios

### Empleado

```ts
Employee {
  id;
  name;
  city;
  zones;
  skills;
  availability;
  vacations;
  maxJobsPerDay;
  maxHoursPerDay;
  currentWeekLoad;
  performanceScore;
  incidentRate;
  hourlyCost;
}
```

### Servicio

```ts
Service {
  id;
  type;
  address;
  city;
  coordinates;
  preferredDate;
  preferredTime;
  estimatedDurationMinutes;
  requiredSkills;
  priority;
  customerType;
}
```

### Historial

```ts
AssignmentHistory {
  employeeId;
  serviceType;
  customerId;
  completedAt;
  rating;
  incident;
  realDurationMinutes;
}
```

## Qué papel juega la IA

### Sí debe hacer

- Entender texto libre del cliente.
- Preguntar datos que falten.
- Clasificar tipo de servicio.
- Estimar duración orientativa.
- Explicar por qué se recomienda un empleado.
- Crear un resumen para el dueño.
- Responder dudas del cliente.

### No debe hacer sola

- Asignar empleados sin comprobar disponibilidad.
- Inventar precios.
- Inventar disponibilidad.
- Saltarse restricciones.
- Confirmar al cliente algo que la empresa no ha validado.

## Asistente para cliente

En `/reserva`, el cliente podría tener un chat:

> “Hola, dime qué necesitas limpiar y te ayudo a pedirlo.”

Ejemplo:

Cliente:

> “Necesito limpiar cristales exteriores de una comunidad en Madrid antes del viernes.”

IA:

> “Perfecto. Para preparar la solicitud necesito dirección, persona de contacto y franja horaria preferida.”

Cuando tiene datos suficientes:

> “Voy a enviar una solicitud de limpieza de cristales para Comunidad X. La empresa confirmará disponibilidad. ¿La envío?”

Solo al confirmar, llama a:

```txt
POST /api/public/bookings
```

## Asistente para dueño

Dentro del CRM:

- “¿Qué reservas web están pendientes?”
- “Asígnalas de forma óptima.”
- “¿Por qué recomiendas a Nadia?”
- “¿Quién puede cubrir una baja mañana?”
- “Reordena el calendario para minimizar desplazamientos.”

Este asistente sí puede usar herramientas internas:

- `getPendingBookings`
- `suggestAssignments`
- `confirmAssignment`
- `rescheduleService`
- `notifyEmployee`

## Aprendizaje progresivo del sistema

Sí, el sistema puede ir aprendiendo para que cada vez asigne mejor y, cuando tenga señales suficientes, llegue a autoasignar ciertos servicios sin intervención manual.

La idea correcta no es que un LLM decida solo. La idea es construir un ciclo de aprendizaje con datos reales:

1. El motor recomienda un empleado.
2. El dueño acepta, cambia o rechaza la recomendación.
3. El servicio se ejecuta.
4. El sistema mide el resultado.
5. La próxima recomendación usa ese historial.

### Qué datos debe aprender

Cada asignación debería guardar:

```ts
AssignmentDecision {
  bookingId;
  recommendedEmployeeId;
  selectedEmployeeId;
  recommendationScore;
  wasAcceptedByManager;
  managerOverrideReason;
  completedOnTime;
  customerRating;
  employeeRating;
  incidentCount;
  realDurationMinutes;
  estimatedDurationMinutes;
  travelMinutes;
  margin;
}
```

Con esto el producto puede detectar patrones reales:

- “Nadia suele completar cristales antes de lo estimado”.
- “Miguel funciona mejor en servicios sanitarios, pero no en comunidades”.
- “Laura tiene mejores valoraciones con clientes residenciales”.
- “Los viernes por la tarde hay más retrasos en Madrid centro”.
- “Este tipo de servicio suele durar 150 minutos, no 90”.

### Fases de aprendizaje

#### Fase 1: Reglas y scoring explicable

Es la primera versión y la más importante para la demo.

El sistema recomienda con una fórmula clara y el dueño confirma:

```txt
Recomendado: Nadia Ramos
Estado: Recomendación alta
Motivos:
- Especialista en cristales
- Disponible en la franja solicitada
- Baja carga de trabajo hoy
- Buen historial con comunidades
```

Cada confirmación o cambio del dueño se guarda como feedback.

#### Fase 2: Ajuste automático de pesos

Cuando haya historial, el sistema puede ajustar pesos:

- si los dueños siempre cambian recomendaciones por distancia, sube el peso de distancia;
- si la calidad baja cuando se asigna por cercanía, sube el peso de habilidad;
- si un empleado acumula incidencias en un tipo de servicio, baja su score para ese tipo.

Esto se puede hacer al principio con estadísticas simples, sin entrenar un modelo complejo.

#### Fase 3: Modelo de recomendación

Cuando haya suficientes datos, se puede entrenar un modelo de ranking.

Entrada:

- tipo de servicio;
- zona;
- duración estimada;
- empleado;
- habilidades;
- carga actual;
- distancia;
- histórico;
- cliente;
- hora y día.

Salida:

```txt
Nivel interno de seguridad operativa para ordenar recomendaciones.
```

Modelos posibles:

- regresión logística para empezar;
- gradient boosting para mejor precisión;
- learning-to-rank si hay mucho histórico;
- embeddings para entender notas y descripciones de servicios.

La recomendación final sería:

```txt
Empleado recomendado = candidato válido con mejores señales operativas.
```

### Autoasignación segura

El sistema no debería autoasignar todo desde el principio.

Regla recomendada:

```txt
Autoasignar solo si:
- el sistema marca "Lista para autoasignar";
- no hay conflictos de calendario;
- el cliente no es crítico o premium;
- el servicio no requiere presupuesto manual;
- el empleado recomendado tiene historial positivo en ese tipo de servicio;
- no hay alertas de distancia, sobrecarga o margen.
```

Si no cumple eso, queda como:

```txt
Pendiente de revisión
```

### Ejemplo de evolución

Al principio:

```txt
Sistema: Recomiendo a Nadia.
Dueño: Aceptar.
```

Después de varias semanas:

```txt
Sistema: Recomiendo a Nadia. Lista para autoasignar.
Motivo: ha completado muchos servicios similares, tiene muy buenas valoraciones y no arrastra incidencias recientes.
Acción: Autoasignado.
```

Si algo sale mal:

```txt
Sistema: La asignación automática generó retraso.
Aprendizaje: bajar peso de cercanía y subir peso de duración real para servicios de cristales exteriores.
```

### Human-in-the-loop

Para venderlo bien y hacerlo robusto, la demo debería decir:

> “El sistema aprende de las decisiones del responsable. Primero recomienda, luego automatiza solo cuando tiene confianza suficiente.”

Eso transmite seguridad y valor. No parece magia peligrosa, parece un copiloto operativo serio.

## Arquitectura recomendada

### APIs

```txt
POST /api/public/bookings
POST /api/ai/booking-intake
POST /api/assignments/suggest
POST /api/assignments/confirm
POST /api/assignments/optimize-day
POST /api/ai/customer-chat
POST /api/ai/owner-assistant
```

### Motor de asignación

Primero en TypeScript:

```txt
src/lib/assignment/suggest-assignee.ts
src/lib/assignment/scoring.ts
src/lib/assignment/constraints.ts
```

Después, si necesitamos optimización avanzada:

- microservicio Python con OR-Tools;
- o worker separado;
- o endpoint interno que reciba servicios y empleados y devuelva la asignación óptima.

## MVP que deberíamos construir primero

### En `Reservas web pendientes de asignar`

Cambiar esto:

> selector manual de empleado

Por esto:

```txt
Recomendado: Nadia Ramos
Confianza: Alta
Motivos:
- Especialista en cristales
- Disponible en Madrid a las 10:00
- Carga baja hoy

[Asignar recomendada] [Elegir otra]
```

Esto ya parece inteligente y es defendible.

## Implementado en la demo local

Se ha implementado la primera versión del motor inteligente dentro de la demo local.

La arquitectura robusta para evolucionar esta demo hacia producción queda documentada en:

```txt
docs/ARQUITECTURA_SISTEMA_ROBUSTO_IA_ASIGNACION.md
```

### Archivos principales

- `src/lib/assignment/demo-assignment.ts`: motor de recomendación.
- `src/components/demo/demo-provider.tsx`: estado local, creación de reservas, aprendizaje y asignaciones.
- `src/components/demo/demo-widgets.tsx`: panel visual de reservas web pendientes.

### Qué hace ahora

Cuando un cliente envía una reserva desde `/reserva`, el CRM:

1. crea el lead;
2. crea el servicio en calendario;
3. clasifica el tipo de servicio;
4. calcula el empleado recomendado;
5. guarda los motivos de la recomendación;
6. muestra la reserva en `Servicios`;
7. permite asignar la recomendación con un botón;
8. guarda la decisión como aprendizaje.

### Cómo aprende

Cada asignación guarda una decisión operativa:

```txt
servicio recomendado;
empleado recomendado;
empleado elegido;
si el responsable aceptó o corrigió;
tipo de servicio;
cliente;
ciudad;
motivos usados.
```

Si el responsable acepta la recomendación, el sistema refuerza ese patrón. Si el responsable elige otra persona, el sistema guarda la corrección y la usa en recomendaciones futuras.

### Lenguaje visible para cliente

No se muestran porcentajes ni puntuaciones técnicas. La interfaz usa estados claros:

```txt
Recomendación alta
Lista para autoasignar
Revisar antes de asignar
No recomendable
```

### Flujo de demo recomendado

1. Abrir `/reserva`.
2. Enviar una solicitud de limpieza de cristales.
3. Ir a `/services`.
4. Enseñar el panel `Reservas web pendientes de asignar`.
5. Explicar por qué recomienda a Nadia Ramos.
6. Pulsar `Asignar recomendada`.
7. Mostrar que el servicio pasa a `Programado` y aparece con Nadia en el listado.
8. Enseñar que una reserva similar posterior queda como `Lista para autoasignar`.

### Datos mock necesarios para demo

Añadir a empleados:

```ts
skills: ["cristales", "oficinas", "comunidades"]
zones: ["Madrid centro", "Salamanca", "Retiro"]
maxJobsPerDay: 4
todayLoad: 1
incidentRate: 0.02
```

Añadir a servicios:

```ts
requiredSkills: ["cristales"]
estimatedDurationMinutes: 120
priority: "normal"
```

## Fórmula demo inicial

Para que sea creíble:

```txt
Nadia Ramos
Score 91
+25 habilidad exacta en cristales
+18 disponibilidad total
+13 zona Madrid compatible
+14 baja carga de trabajo
+9 buen rendimiento
+8 experiencia en comunidades
-0 sin incidencias recientes
```

Laura Méndez:

```txt
Score 78
+18 disponibilidad
+13 zona Madrid
+14 baja carga
-8 menor especialización en cristales
```

Miguel Prieto:

```txt
Descartado
Motivo: especializado en sanitario y agenda ocupada en esa franja
```

## Fuentes consultadas

- OR-Tools Assignment Problem: https://developers.google.com/optimization/assignment/assignment_example
- OR-Tools Employee Scheduling: https://developers.google.com/optimization/scheduling/employee_scheduling
- OR-Tools Vehicle Routing: https://developers.google.com/optimization/routing
- OR-Tools Vehicle Routing with Time Windows: https://developers.google.com/optimization/routing/vrptw
- Google Routes API Compute Route Matrix: https://developers.google.com/maps/documentation/routes/compute-route-matrix-over
- Google Calendar API Freebusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents
