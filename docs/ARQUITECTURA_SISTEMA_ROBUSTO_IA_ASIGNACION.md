# Arquitectura robusta del sistema inteligente de asignación

## Objetivo

Convertir la demo actual de asignación inteligente en un sistema robusto, escalable y preparado para producción.

El objetivo no es solo recomendar empleados. El objetivo real es reducir carga operativa a las empresas de limpieza:

```txt
Cliente solicita servicio
El CRM interpreta la solicitud
El sistema recomienda o autoasigna empleado
El calendario se actualiza
El responsable mantiene control
El sistema aprende con cada decisión
```

La frase de producto debe ser:

> “El sistema empieza recomendando, aprende de cómo trabaja tu empresa y solo automatiza cuando tiene señales suficientes para hacerlo con seguridad.”

## Principios del sistema

### 1. La IA no decide sola

Un LLM puede ayudar a entender una solicitud, resumirla y explicarla, pero no debe saltarse reglas operativas.

El orden correcto es:

1. Reglas duras.
2. Motor de scoring.
3. Aprendizaje por historial.
4. Optimización de agenda.
5. Explicación en lenguaje humano.

### 2. Primero seguridad, después automatización

El sistema no debe autoasignar todos los servicios desde el principio.

Primero recomienda. Después aprende. Finalmente autoasigna solo casos seguros.

### 3. Todo debe ser auditable

Cada recomendación debe poder explicarse:

```txt
Se recomendó Nadia porque:
- tiene especialidad en cristales;
- trabaja habitualmente en Madrid;
- tenía disponibilidad;
- ya completó servicios similares;
- el responsable aceptó decisiones parecidas antes.
```

Esto es clave para que el responsable confíe en el sistema.

## Arquitectura objetivo

La arquitectura robusta debe separar claramente la interfaz, el motor de decisión, los datos y las integraciones.

```txt
Cliente final
  ↓
Formulario público / asistente IA
  ↓
API pública de reservas
  ↓
Base de datos
  ↓
Motor de asignación
  ↓
CRM del responsable
  ↓
Confirmación / autoasignación / calendario / notificaciones
```

## Componentes principales

### 1. Portal o formulario público

Ruta actual de demo:

```txt
/reserva
```

En producción debería crear una reserva mediante API:

```txt
POST /api/public/bookings
```

Datos mínimos:

- empresa o comunidad;
- persona de contacto;
- email;
- teléfono;
- servicio solicitado;
- dirección;
- ciudad;
- fecha preferida;
- hora preferida;
- detalles.

### 2. API pública de reservas

Responsabilidades:

- validar datos;
- evitar spam;
- crear lead;
- crear servicio pendiente;
- guardar solicitud;
- lanzar cálculo de recomendación;
- devolver confirmación al cliente.

Ejemplo:

```txt
POST /api/public/bookings
```

Respuesta:

```json
{
  "bookingId": "booking_123",
  "leadId": "lead_123",
  "serviceId": "srv_123",
  "status": "pending_assignment"
}
```

### 3. Motor de asignación

El motor no debe estar mezclado con la UI.

APIs recomendadas:

```txt
POST /api/assignments/suggest
POST /api/assignments/confirm
POST /api/assignments/auto-assign
POST /api/assignments/recalculate
POST /api/assignments/simulate-day
```

El CRM consulta:

```txt
¿A quién recomiendas para este servicio?
```

El motor responde:

```json
{
  "state": "Recomendación alta",
  "employee": "Nadia Ramos",
  "reasons": [
    "Tiene especialidad en cristales",
    "Trabaja habitualmente en Madrid",
    "Tiene disponibilidad en esa franja",
    "Ya completó servicios similares"
  ],
  "warnings": [],
  "alternatives": ["Laura Méndez"]
}
```

## Modelo de datos

### Empresas

```txt
companies
```

Campos:

- id;
- name;
- plan;
- subscription_status;
- created_at.

### Usuarios

```txt
users
```

Campos:

- id;
- company_id;
- name;
- email;
- role;
- created_at.

Roles:

- Super Admin;
- Admin;
- Manager;
- Employee.

### Empleados

```txt
employees
```

Campos:

- id;
- company_id;
- name;
- role;
- status;
- base_city;
- notes;
- performance_score;
- incident_rate;
- created_at.

### Habilidades de empleados

```txt
employee_skills
```

Ejemplos:

- cristales;
- oficinas;
- sanitario;
- comunidades;
- garajes;
- hoteles;
- fin de obra.

### Zonas de trabajo

```txt
employee_zones
```

Ejemplos:

- Madrid Centro;
- Salamanca;
- Retiro;
- Getafe;
- Barcelona;
- Alicante.

### Disponibilidad

```txt
employee_availability
```

Campos:

- employee_id;
- weekday;
- start_time;
- end_time;
- active.

### Ausencias

```txt
employee_absences
```

Campos:

- employee_id;
- start_date;
- end_date;
- reason.

### Reservas web

```txt
bookings
```

Campos:

- id;
- company_id;
- customer_name;
- contact_name;
- email;
- phone;
- service_type;
- address;
- city;
- preferred_date;
- preferred_time;
- description;
- status;
- created_at.

### Servicios

```txt
services
```

Campos:

- id;
- company_id;
- booking_id;
- customer_id;
- title;
- service_type;
- status;
- start_at;
- end_at;
- city;
- address;
- estimated_duration_minutes;
- assigned_employee_id;
- price;
- vat_rate.

### Recomendaciones

```txt
assignment_recommendations
```

Campos:

- id;
- company_id;
- service_id;
- recommended_employee_id;
- state;
- reasons;
- warnings;
- alternatives;
- internal_score;
- created_at.

El campo `internal_score` existe solo para auditoría interna. No debe mostrarse al cliente.

### Decisiones del responsable

```txt
assignment_decisions
```

Campos:

- id;
- company_id;
- service_id;
- recommended_employee_id;
- selected_employee_id;
- was_accepted_by_manager;
- decision_type;
- manager_override_reason;
- created_at.

Tipos:

- manager_confirmed;
- manager_override;
- auto_assigned.

### Resultado operativo

```txt
assignment_outcomes
```

Campos:

- id;
- service_id;
- employee_id;
- completed_on_time;
- customer_rating;
- employee_rating;
- incident_count;
- real_duration_minutes;
- estimated_duration_minutes;
- travel_minutes;
- margin;
- created_at.

Esta tabla es clave para que el sistema aprenda de resultados reales, no solo de decisiones.

## Flujo completo de decisión

### Paso 1. Entra una reserva

Ejemplo:

```txt
Limpieza extra de cristales para una comunidad en Madrid.
Fecha: 19 de junio de 2026.
Hora: 10:00.
```

### Paso 2. Clasificación

El sistema clasifica:

```txt
Tipo: Cristales
Cliente: Comunidad
Ciudad: Madrid
Duración estimada: 150 minutos
Habilidad necesaria: cristales
```

### Paso 3. Reglas duras

Se descartan empleados que no pueden hacer el servicio:

- vacaciones;
- no trabaja ese día;
- solape horario;
- no tiene habilidad obligatoria;
- fuera de zona;
- exceso de carga diaria;
- cliente crítico con empleado no adecuado.

Estas reglas son deterministas. No dependen de un LLM.

### Paso 4. Scoring

Los candidatos válidos se ordenan con señales:

- habilidad;
- disponibilidad;
- zona;
- carga de agenda;
- rendimiento;
- historial con cliente;
- historial en servicios similares;
- incidencias;
- margen operativo.

### Paso 5. Aprendizaje

El sistema mira decisiones anteriores:

```txt
¿El responsable aceptó antes a Nadia para cristales?
¿Nadia completó servicios parecidos sin incidencias?
¿Hubo cambios manuales hacia otro empleado?
¿La duración real fue mayor que la estimada?
```

### Paso 6. Resultado visible

La interfaz no muestra porcentajes. Muestra lenguaje claro:

```txt
Recomendación alta
Lista para autoasignar
Revisar antes de asignar
No recomendable
```

## Aprendizaje del sistema

El sistema aprende con un ciclo de feedback:

```txt
Recomienda
El responsable acepta o corrige
El servicio se ejecuta
Se mide el resultado
La próxima recomendación mejora
```

### Qué aprende

Aprende:

- qué empleados encajan mejor por tipo de servicio;
- qué empleados funcionan mejor por zona;
- qué empleados reciben mejores valoraciones;
- qué estimaciones de duración son irreales;
- qué responsables corrigen siempre ciertos patrones;
- qué clientes necesitan empleados concretos;
- cuándo una autoasignación es segura.

### Ejemplo

Primera vez:

```txt
Sistema: Recomiendo a Nadia.
Responsable: Aceptar.
Resultado: servicio completado sin incidencias.
```

Siguiente caso similar:

```txt
Sistema: Nadia vuelve a ser recomendada.
Motivo: ya ha completado servicios similares y el responsable aceptó decisiones parecidas.
```

Cuando hay suficientes señales:

```txt
Estado: Lista para autoasignar
Acción: Autoasignar ahora
```

## Modo sombra

Antes de activar autoasignación real, el sistema debe funcionar en modo sombra.

En modo sombra:

1. El responsable sigue asignando manualmente.
2. El sistema calcula qué habría recomendado.
3. Se compara la recomendación con la decisión real.
4. Se mide si el sistema habría acertado.

Esto permite validar el motor sin riesgo operativo.

Ejemplo:

```txt
Responsable asignó: Nadia.
Sistema habría recomendado: Nadia.
Resultado: acierto.
```

O:

```txt
Responsable asignó: Laura.
Sistema habría recomendado: Nadia.
Resultado: revisar patrón.
```

## Autoasignación segura

El sistema solo debe autoasignar cuando se cumplan todas estas condiciones:

- no hay conflicto de calendario;
- el empleado trabaja ese día;
- el empleado tiene la habilidad necesaria;
- la zona es compatible;
- el servicio es estándar;
- no requiere presupuesto manual;
- el cliente no está marcado como crítico;
- el empleado tiene buen historial en servicios similares;
- no hay alerta de carga, distancia o margen;
- la empresa ha permitido autoasignación para ese tipo de servicio.

Si falta una condición, el estado debe ser:

```txt
Revisar antes de asignar
```

## Papel del LLM

### Sí debe hacer

- interpretar texto libre del cliente;
- detectar datos incompletos;
- preguntar dirección, fecha o franja si falta;
- clasificar el tipo de servicio;
- resumir la solicitud para el responsable;
- explicar una recomendación en lenguaje claro;
- responder dudas del cliente;
- ayudar al responsable a consultar la agenda.

### No debe hacer solo

- inventar disponibilidad;
- inventar precios;
- saltarse restricciones;
- confirmar un servicio no validado;
- asignar empleados sin pasar por el motor;
- enviar mensajes críticos sin reglas de negocio.

## Integraciones necesarias

### Google Calendar

Para disponibilidad real:

- leer eventos;
- detectar solapes;
- crear eventos;
- actualizar cambios;
- enviar invitaciones internas.

### Google Maps o Routes API

Para distancia y desplazamiento:

- calcular tiempo entre servicios;
- ordenar rutas;
- evitar asignaciones con desplazamientos absurdos;
- mejorar planificación diaria.

### Supabase

Para:

- autenticación;
- base de datos PostgreSQL;
- control por empresa;
- políticas RLS;
- almacenamiento de documentos.

### Stripe

Para:

- suscripciones SaaS;
- estados de pago;
- bloqueo por impago;
- portal de facturación.

### Email y SMS

Para:

- confirmación de reserva;
- recordatorios;
- aviso al empleado;
- cambios de horario;
- solicitudes de reseña.

## Observabilidad

Un sistema robusto necesita medir qué está pasando.

Métricas recomendadas:

- reservas recibidas;
- recomendaciones aceptadas;
- recomendaciones corregidas;
- autoasignaciones aplicadas;
- autoasignaciones revertidas;
- servicios con retraso;
- incidencias por empleado;
- duración estimada frente a duración real;
- satisfacción del cliente;
- margen por tipo de servicio.

Alertas:

- demasiadas correcciones manuales;
- muchos servicios sin asignar;
- empleado sobrecargado;
- conflicto de calendario;
- caída de notificaciones;
- fallo de integración externa.

## Seguridad y permisos

### Roles

Super Admin:

- gestiona empresas;
- ve métricas SaaS;
- gestiona suscripciones.

Admin:

- configura empresa;
- gestiona usuarios;
- activa o desactiva autoasignación.

Manager:

- revisa reservas;
- acepta recomendaciones;
- corrige asignaciones;
- gestiona calendario.

Employee:

- ve servicios asignados;
- actualiza estado;
- registra incidencias.

### Reglas de seguridad

- cada empresa solo ve sus datos;
- las recomendaciones pertenecen a una empresa;
- los empleados no pueden ver datos de otras empresas;
- las APIs públicas deben validar entrada;
- las acciones críticas deben quedar registradas.

## Roadmap hacia producción

### Fase 1. Demo local robusta

Estado actual:

- reserva pública;
- lead automático;
- servicio automático;
- recomendación inteligente;
- aprendizaje local;
- asignación desde CRM;
- lenguaje claro sin porcentajes.

### Fase 2. Preproducción con base de datos

Objetivo:

- mover estado de `localStorage` a PostgreSQL;
- guardar recomendaciones;
- guardar decisiones;
- guardar resultados;
- preparar APIs reales.

### Fase 3. Piloto con empresa real

Objetivo:

- trabajar con datos reales;
- activar modo sombra;
- comparar recomendaciones con decisiones reales;
- ajustar pesos;
- detectar reglas específicas de la empresa.

### Fase 4. Autoasignación controlada

Objetivo:

- autoasignar solo servicios estándar;
- mantener revisión humana para casos delicados;
- permitir activar o desactivar autoasignación por tipo de servicio.

### Fase 5. Optimización avanzada

Objetivo:

- optimizar agenda diaria completa;
- reducir desplazamientos;
- equilibrar cargas;
- calcular rutas;
- usar OR-Tools o un servicio de optimización separado.

### Fase 6. IA conversacional

Objetivo:

- asistente para clientes;
- asistente para responsables;
- consultas tipo “¿quién puede cubrir mañana?”;
- explicación de decisiones;
- generación de mensajes y confirmaciones.

## Cómo venderlo en demo

Guion recomendado:

```txt
1. Un cliente entra en la web y pide una limpieza.
2. El CRM crea automáticamente el lead y el servicio.
3. El sistema recomienda a la persona adecuada.
4. No muestra porcentajes raros, muestra motivos claros.
5. El responsable acepta con un clic.
6. La decisión se guarda como aprendizaje.
7. En una reserva similar, el sistema ya puede dejarla lista para autoasignar.
```

Frase clave:

> “No es solo un CRM. Es un sistema que aprende cómo trabaja la empresa y reduce trabajo operativo real.”

## Qué falta para producción

Falta:

- persistencia real en PostgreSQL;
- APIs reales de asignación;
- autenticación y permisos aplicados a cada endpoint;
- integración real con calendario;
- integración real con mapas;
- métricas de resultado operativo;
- modo sombra;
- panel de configuración de autoasignación;
- pruebas automatizadas de reglas;
- trazabilidad completa de decisiones;
- despliegue en preproducción.

## Conclusión

El sistema robusto debe avanzar de forma progresiva:

```txt
Recomendar
Aprender
Simular
Autoasignar casos seguros
Optimizar agenda completa
Asistir con IA conversacional
```

Ese camino permite vender una demo potente hoy y construir después un producto serio, confiable y escalable.
