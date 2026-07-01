# Roadmap de IA y automatizaciones inteligentes

## Objetivo

Convertir el CRM en un sistema que quite carga real de trabajo a empresas de limpieza:

- El cliente solicita un servicio desde una entrada pública.
- El sistema entiende la solicitud, detecta datos incompletos y la clasifica.
- El CRM propone el mejor empleado o equipo.
- El dueño puede confirmar en un clic o activar asignación automática.
- Un asistente IA responde dudas del cliente y ayuda a completar reservas.

La clave no es que un LLM “decida todo”. La clave es combinar:

1. Reglas de negocio.
2. Disponibilidad y calendario.
3. Distancia, zona, carga de trabajo y habilidades.
4. Optimización matemática.
5. LLM para conversación, extracción de datos, explicación y soporte.

## Investigación resumida

- Google OR-Tools permite resolver problemas de rutas y asignación con restricciones como distancia, capacidad y ventanas horarias. Esto encaja muy bien con servicios de limpieza en distintas direcciones y empleados con agendas diferentes.
- Google Calendar Freebusy permite consultar disponibilidad libre/ocupada de calendarios, útil si queremos integrar calendarios reales de empleados.
- OpenAI Responses API y Agents SDK encajan para agentes con herramientas: el modelo puede llamar funciones internas como `crearReserva`, `consultarDisponibilidad`, `sugerirEmpleado` o `escalarAHumano`.
- Vercel AI SDK encaja con Next.js para construir chat, tool calling y respuestas estructuradas.
- Supabase + pgvector permite crear una base de conocimiento semántica para que el asistente responda dudas con documentos de la empresa: servicios, zonas, horarios, precios orientativos, políticas, productos usados, etc.

## Cómo debería funcionar la asignación inteligente

Cuando entra una reserva, el sistema no debe asignar a ciegas. Debe seguir este flujo:

1. Normalizar solicitud
   - Tipo de servicio.
   - Dirección y ciudad.
   - Fecha y hora preferidas.
   - Duración estimada.
   - Requisitos: cristales, sanitario, fin de obra, comunidad, oficina, productos especiales.
   - Urgencia.

2. Filtrar candidatos
   - Empleados activos.
   - Disponibles ese día.
   - No de vacaciones.
   - Con habilidades necesarias.
   - En ciudad o zona compatible.
   - Con carga de trabajo razonable.

3. Puntuar candidatos
   - Coincidencia de habilidades.
   - Cercanía a la dirección.
   - Hueco en agenda.
   - Rendimiento histórico.
   - Afinidad con ese cliente.
   - Reparto justo de carga.
   - Coste operativo.

4. Recomendar
   - Mejor empleado/equipo.
   - Motivo claro: “Nadia Ramos está disponible, tiene experiencia en cristales y está en Madrid ese día”.
   - Nivel de confianza.
   - Alternativas.

5. Confirmar o automatizar
   - Fase 1: solo sugerencia.
   - Fase 2: asignación con un clic.
   - Fase 3: asignación automática si la confianza supera un umbral.

## MVP potente para demo

### Motor de recomendación inicial

Crear una función interna:

```ts
suggestAssignee(serviceId): AssignmentSuggestion[]
```

Cada sugerencia debería devolver:

```ts
{
  employeeId: string;
  employeeName: string;
  score: number;
  confidence: "Alta" | "Media" | "Baja";
  reasons: string[];
  warnings: string[];
}
```

Ejemplo:

```json
{
  "employeeName": "Nadia Ramos",
  "score": 91,
  "confidence": "Alta",
  "reasons": [
    "Especialista en cristales",
    "Disponible en Madrid a las 10:00",
    "Carga de trabajo baja ese día"
  ],
  "warnings": []
}
```

### Panel en Servicios

En `Reservas web pendientes de asignar`, cambiar el selector plano por:

- “Recomendado: Nadia Ramos”
- Botón `Asignar recomendada`
- Desplegable `Elegir otra persona`
- Motivo de la recomendación.

Esto visualmente vende mucho más que un selector normal.

## Arquitectura recomendada

### API pública de reservas

La reserva pública debe estar fuera del CRM interno:

```txt
POST /api/public/bookings
```

Responsabilidad:

- Validar datos.
- Crear solicitud.
- Crear servicio pendiente.
- Crear lead opcional.
- Lanzar recomendación de empleado.

### API de IA para entender solicitudes

```txt
POST /api/ai/booking-intake
```

Responsabilidad:

- Convertir texto libre del cliente en datos estructurados.
- Detectar datos faltantes.
- Clasificar servicio.

Salida esperada:

```json
{
  "serviceType": "cristales",
  "requiredSkills": ["cristales", "altura_baja"],
  "estimatedDurationMinutes": 120,
  "urgency": "normal",
  "missingFields": [],
  "confidence": 0.86
}
```

### API de recomendación

```txt
POST /api/assignments/suggest
POST /api/assignments/confirm
```

Responsabilidad:

- Proponer empleados.
- Confirmar asignación.
- Actualizar calendario.
- Registrar actividad.

## Datos que necesitamos guardar

### Empleado

- Zona o ciudad.
- Disponibilidad.
- Vacaciones.
- Habilidades.
- Servicios completados.
- Rating interno.
- Incidencias.
- Carga de trabajo por día.
- Preferencias o restricciones.

### Servicio

- Tipo.
- Dirección.
- Coordenadas.
- Fecha y hora.
- Duración estimada.
- Requisitos.
- Estado.
- Empleado asignado.
- Riesgo operativo.

### Cliente

- Historial.
- Preferencias.
- Horarios permitidos.
- Notas.
- Servicios recurrentes.

## Asistente IA para cliente final

En `/reserva` podemos añadir un chat discreto:

> “¿Tienes dudas? Pregúntanos.”

Casos útiles:

- “¿Limpiáis comunidades?”
- “¿Trabajáis los sábados?”
- “Necesito limpieza fin de obra, ¿qué pongo?”
- “¿Puedo pedir cristales exteriores?”
- “¿Cuánto tardáis en responder?”

El asistente no debe inventar precios cerrados. Debe:

- responder con información de la empresa;
- pedir datos faltantes;
- ayudar a completar la reserva;
- crear la solicitud si el usuario lo confirma;
- escalar a humano si hay incertidumbre.

## Asistente IA para el dueño

Dentro del CRM:

- “¿Qué reservas web están pendientes?”
- “Asígnalas de forma óptima para mañana.”
- “¿Quién puede cubrir esta baja?”
- “Reasigna los servicios de Nadia.”
- “Explícame por qué recomiendas a Miguel.”
- “Mándale recordatorio al cliente de mañana.”

Esto sí puede ser una locura para vender, porque no es solo chat: ejecuta acciones con herramientas internas.

## Fases

### Fase 1: Recomendación inteligente demo

- Añadir habilidades a empleados.
- Añadir duración estimada por tipo de servicio.
- Crear `suggestAssignee`.
- Mostrar recomendación en `Reservas web pendientes`.
- Confirmar asignación con un clic.

### Fase 2: Chat en reserva pública

- Chat sencillo con IA.
- Respuestas basadas en reglas y datos de empresa.
- Tool call para crear reserva.
- Guardrails: no prometer precio cerrado ni disponibilidad final.

### Fase 3: Optimización real

- Integrar disponibilidad real.
- Añadir coordenadas/distancias.
- Usar Google Calendar Freebusy.
- Usar OR-Tools para optimización por rutas, ventanas horarias y capacidad.

### Fase 4: Autopiloto controlado

- Autoasignar reservas sencillas con alta confianza.
- Dejar en revisión las reservas con baja confianza.
- Registrar explicación de cada decisión.
- Métricas de ahorro: tiempo ahorrado, asignaciones automáticas, incidencias evitadas.

## Recomendación de producto

Para la demo comercial, lo más impactante no es construir todo OR-Tools ya. Lo más impactante es:

1. Cliente envía reserva.
2. CRM muestra “Recomendado: Nadia Ramos”.
3. Explica por qué.
4. Botón `Asignar recomendada`.
5. Calendario se actualiza.
6. El dueño ve que se ha quitado trabajo.

Ese flujo vende la inteligencia del producto de forma inmediata.

## Fuentes consultadas

- Google OR-Tools, Vehicle Routing Problem: https://developers.google.com/optimization/routing/vrp
- Google Calendar API, Freebusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy
- OpenAI Agents SDK: https://developers.openai.com/api/docs/guides/agents
- OpenAI Tools / function calling: https://developers.openai.com/api/docs/guides/tools
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Vercel AI SDK: https://ai-sdk.dev/docs/introduction
- Supabase Semantic Search / pgvector: https://supabase.com/docs/guides/ai/semantic-search
