# CRM con WhatsApp para negocios

Identidad actual: **Auralogic Citas**, herramienta open source de [Auralogic](https://auralogic.dev/). La distribución abierta permite probar el producto y solicitar implementaciones o adaptaciones al estudio; una suscripción comercial no es requisito para usar el código.

Fecha: 7 de octubre de 2026. Estado: plan de producto. La primera implementación está documentada en README.md y docs/ROADMAP.md; las funciones aquí propuestas no equivalen a capacidades ya entregadas.

## Objetivo y supuestos

Ayudar a un negocio a convertir conversaciones de WhatsApp en ventas y atención organizada: cada cliente tiene historial, responsable y próxima acción.

Alcance confirmado por el usuario: SaaS para vender a varios negocios que trabajan con citas. Ejemplos de posibles clientes iniciales: salones, barberías, talleres y servicios profesionales. El sector específico todavía está por elegir.

La primera versión debe permitir este recorrido: crear negocio → configurar servicios, personal y horarios → conectar número → recibir consulta → asignar agente → reservar cita disponible → confirmar → atender o reprogramar → registrar resultado → medir asistencia e ingresos registrados.

## Integración de WhatsApp

La interfaz de conversación será propia del CRM y se comunicará con un conector en el servidor. El plan no consiste en insertar la página de WhatsApp Web dentro del CRM.

### Ruta solicitada: WhatsApp Web con QR

- Vincular un número como dispositivo mediante QR.
- Mostrar estados: sin vincular, esperando QR, conectando, conectado y desconectado.
- Recibir y enviar mensajes, con capacidades confirmadas en una prueba real.
- Guardar las credenciales de sesión cifradas, por negocio y por conexión.
- Recuperar la sesión después de reiniciar el servicio cuando el proveedor lo permita.
- Advertir dentro del producto cuando se necesita volver a vincular.
- Sincronizar el historial disponible y mostrar su alcance; no prometer todos los mensajes antiguos.
- Evaluar Baileys y whatsapp-web.js en una prueba técnica antes de elegir dependencia y versión.

Baileys usa WebSockets para interactuar con WhatsApp Web. whatsapp-web.js utiliza un navegador administrado mediante Puppeteer. Ambos son conectores no oficiales; no se puede garantizar continuidad ni ausencia de bloqueos. La documentación de whatsapp-web.js advierte explícitamente este riesgo.

### Ruta oficial para operación comercial

Preparar la misma interfaz de proveedores para incorporar WhatsApp Cloud API, la API oficial alojada por Meta. Su incorporación requiere revisar onboarding, permisos, capacidades, reglas de mensajería y costos vigentes. No se asume que el flujo QR, el historial ni todas las funciones de WhatsApp Web sean equivalentes.

El CRM consulta las capacidades del proveedor: texto, adjuntos, confirmaciones, historial y plantillas. La interfaz solo muestra funciones disponibles. Elegir la ruta de producción después de validar el piloto y la tolerancia del negocio a interrupciones.

## Funciones de la primera versión

| Área               | Funciones                                                                             | Resultado para el negocio                          |
| ------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Negocio y equipo   | Registro, invitaciones, propietario, administrador y agente                           | Un equipo trabaja con permisos claros              |
| Conexión           | Un número por negocio en el piloto, QR, estado, reconexión y desvinculación           | Conectar WhatsApp y detectar interrupciones        |
| Bandeja            | Chats en tiempo real, búsqueda, filtros y contador de pendientes                      | Ver qué necesita atención                          |
| Conversación       | Texto, imágenes, documentos y audio según proveedor; historial y estados disponibles  | Atender desde el CRM                               |
| Colaboración       | Asignación, transferencia, notas internas y aviso de otro agente atendiendo           | Reducir respuestas duplicadas                      |
| Contactos          | Nombre, teléfono, correo opcional, etiquetas, origen y campos personalizados básicos  | Conocer al cliente sin salir del chat              |
| Agenda             | Servicios, duración, precio de referencia, personal, disponibilidad, bloqueos y citas | Reservar desde la conversación sin cruzar horarios |
| Citas              | Pendiente, confirmada, atendida, cancelada y no asistió; reprogramación e historial   | Dar seguimiento a cada reserva                     |
| Ventas básicas     | Consulta, cita agendada y resultado; monto registrado y responsable                   | Conocer qué consultas generan negocio              |
| Seguimiento        | Tareas, vencimientos, recordatorios internos y próxima acción                         | Evitar que una consulta quede olvidada             |
| Respuestas rápidas | Textos guardados, búsqueda y variables sencillas                                      | Responder preguntas frecuentes con rapidez         |
| Indicadores        | Chats pendientes, tiempo de primera respuesta, oportunidades y ventas ganadas         | Medir atención y resultados                        |
| Configuración      | Horario, zona horaria, moneda, equipo y conexión                                      | Adaptar el CRM al negocio                          |

La reserva valida disponibilidad en el servidor y evita conflictos de horario dentro de una transacción. Configurar duración, tiempo entre citas y excepciones por persona. En el piloto cada cita reserva un prestador; citas grupales y combinaciones de varios recursos se posponen. Guardar instantes en UTC y mostrar horarios en la zona del negocio.

La confirmación inicial puede registrarla el agente tras recibir respuesta del cliente. Los recordatorios internos entran en el MVP; los mensajes automáticos de WhatsApp se incorporan después de validar el proveedor, los permisos y el consentimiento. No prometer automatización continua sobre una conexión QR.

El estado de atención es independiente de la etapa de venta. Una conversación puede cerrarse aunque una oportunidad siga abierta. Las notas internas nunca se envían a WhatsApp. Un contacto puede tener varias oportunidades.

Etapas iniciales sugeridas para prospectos: Nueva consulta → En seguimiento → Cita agendada → Convertido / Perdido. El estado de la cita se administra por separado. El tablero comercial avanzado es secundario frente a la agenda.

La colaboración reduce colisiones mediante asignación y avisos; no se promete impedir toda respuesta simultánea sin una política explícita de bloqueo.

## Pantallas principales

1. Inicio: citas del día, pendientes de confirmar, tareas vencidas y resumen comercial.
2. Bandeja: lista de conversaciones a la izquierda, chat al centro y ficha del cliente a la derecha.
3. Contactos: listado, búsqueda, etiquetas e historial del cliente.
4. Agenda: vistas por día y semana, filtros por prestador, reserva y reprogramación desde el chat.
5. Tareas: próximas acciones por fecha y responsable.
6. Reportes: atención, citas, asistencia, ingresos registrados y filtros por periodo y agente.
7. Configuración: negocio, equipo, servicios, disponibilidad, permisos, respuestas rápidas y WhatsApp.

El historial muestra cancelaciones y reprogramaciones. Los permisos distinguen agentes que atienden y personal que presta servicios: una persona con agenda no necesita automáticamente acceso a todas las conversaciones.

Prioridad de diseño: escritorio para equipos de atención y versión adaptable al móvil para consultar y responder. Idioma inicial español.

## Fases posteriores

### Operación y ventas

- Varios números por negocio, equipos y distribución automática de conversaciones.
- Importación y exportación de contactos con deduplicación y permisos.
- Productos, cotizaciones PDF y enlaces de pago; registrar pago confirmado mediante el proveedor correspondiente.
- Reserva pública mediante enlace, anticipos, lista de espera y sincronización con calendarios externos.
- Tablero comercial avanzado para servicios que necesitan cotización antes de reservar.
- Formularios de captura y registro del origen del prospecto.
- Reportes por canal, agente y fuente; registrar eventos para calcularlos con consistencia.

### Automatización

- Reglas por mensaje recibido, etiqueta, cambio de etapa y horario.
- Bienvenida, respuesta fuera de horario y recordatorios cuando el proveedor y sus reglas lo permitan.
- Cancelar seguimientos programados al responder el cliente, cerrar la oportunidad o retirar consentimiento.
- Campañas solo con destinatarios habilitados, bajas y capacidades autorizadas del proveedor; no forman parte del MVP con QR.

### IA y expansión

- Resúmenes de conversaciones y propuestas de respuesta para revisión del agente.
- Clasificación sugerida de intención y datos del prospecto.
- Asistente basado en información del negocio, con transferencia a una persona.
- Integraciones con comercio electrónico, calendario y otros canales según demanda validada.

La IA no marca pagos como confirmados ni modifica importes o compromisos comerciales sin una regla verificable o intervención humana.

## Arquitectura propuesta

La selección exacta de versiones se hará al iniciar la implementación.

- Frontend y servidor web: Astro con TypeScript y adaptador Node, por elección explícita del usuario.
- Backend: Node.js con TypeScript, inicialmente un monolito modular para clientes, conversaciones, ventas y tareas.
- Persistencia inicial: SQLite nativo de Node 24 con WAL y migraciones. PostgreSQL se evaluará para despliegues distribuidos.
- Cola persistida en SQLite para envíos iniciales. Redis y una cola distribuida quedan para una fase de escala.
- Servicio persistente de WhatsApp separado del frontend; una sesión tiene un único proceso propietario para evitar conexiones concurrentes.
- Actualización inicial mediante polling autenticado; WebSockets o SSE se evaluarán cuando lo justifique el uso.
- Almacenamiento compatible con S3 para adjuntos, con acceso temporal autorizado.
- Despliegue inicial con contenedores de aplicación y worker, compartiendo un volumen SQLite sobre disco local. El conector QR necesita un proceso persistente y almacenamiento de sesión.

Flujo entrante: proveedor → evento normalizado → persistencia y deduplicación → actualización del CRM → notificación al equipo.

Flujo saliente: agente → validar permiso y conexión → guardar intención de envío → cola → proveedor → actualizar resultado.

Un envío con resultado incierto debe mostrarse para conciliación antes de repetirlo: deduplicar trabajos internos no garantiza entrega exactamente una vez al proveedor.

Para comenzar se separan módulos y el proceso de conexión; no hace falta una arquitectura extensa de microservicios.

## Modelo de datos inicial

- Negocios: nombre, zona horaria, moneda y configuración.
- Usuarios y membresías: un usuario puede pertenecer a varios negocios con roles distintos.
- Conexiones: proveedor, identidad del número, estado y referencia a credenciales protegidas.
- Contactos e identidades de canal: teléfono normalizado cuando exista y identificadores externos; no asumir que todo identificador de WhatsApp es un teléfono.
- Conversaciones: negocio, conexión, contacto, responsable y estado de atención.
- Mensajes: identidad externa, dirección, contenido, adjuntos, marcas de tiempo y estados reportados por el proveedor.
- Notas internas: contenido y autor, separadas de los mensajes externos.
- Etiquetas y relaciones con contactos/conversaciones.
- Embudos, etapas y oportunidades: contacto, responsable, importe, moneda y cierre.
- Tareas: responsable, fecha, estado y vínculo con contacto u oportunidad.
- Servicios: duración, precio de referencia, moneda y prestadores habilitados.
- Prestadores: agenda y relación opcional con un usuario del CRM.
- Disponibilidad y bloqueos: horarios semanales, excepciones, vacaciones e intervalos entre servicios.
- Citas: contacto, servicio, prestador, inicio, fin, estado, origen y precio acordado.
- Historial de citas: confirmaciones, cancelaciones y reprogramaciones con autor.
- Ingresos registrados: monto, moneda y referencia a cita; reservar o atender no implica haber cobrado.
- Respuestas rápidas y campos personalizados.
- Eventos de auditoría: asignaciones, cambios de permisos, exportaciones y cambios comerciales relevantes.

Todas las entidades del negocio deben estar aisladas por negocio. Los identificadores externos se deduplican dentro del proveedor y la conexión correspondiente. Se conservan eventos de cambios de etapa para calcular conversiones históricas.

## Permisos y operación

- Propietario: configura el negocio y administra miembros y conexiones.
- Administrador: gestiona operación, asignación y reportes según permisos.
- Agente: atiende conversaciones autorizadas y trabaja sus contactos, oportunidades y tareas.
- Verificación de acceso en el servidor y en canales de tiempo real, descargas, búsquedas y trabajos en segundo plano.
- Cifrado de sesiones, secretos fuera del código, acceso protegido a adjuntos y exclusión de credenciales y QR de logs.
- Copias de seguridad y restauración ensayada antes del piloto comercial.
- Configuración de retención, exportación y eliminación de datos según las necesidades del negocio; requisitos legales concretos pendientes del país y sector.
- Monitoreo de desconexiones, cola de mensajes, fallos de envío y retraso en eventos.

## Plan de implementación por entregables

1. Validación técnica: probar vinculación, envío, recepción, adjuntos, reinicio, desconexión, sincronización disponible y consumo de recursos. Elegir conector con evidencia.
2. Base del CRM: negocio, usuarios, permisos, contactos y diseño de la bandeja; usar un proveedor simulado para avanzar sin depender de WhatsApp.
3. Conexión real y atención: QR, eventos persistidos, chat, cola de envíos, asignaciones, notas y respuestas rápidas.
4. Agenda y seguimiento: servicios, disponibilidad, reservas sin conflictos, estados de cita, tareas y recordatorios internos.
5. Piloto con pocos negocios: métricas, aislamiento, recuperación ante fallos, observación del uso y corrección de problemas.
6. Preparación comercial: onboarding, límites de uso, soporte, suscripciones si aplica y decisión sobre integración oficial.

No hay estimación de fechas comprometida: depende del tamaño del equipo, proveedor elegido, alcance de adjuntos e incorporación oficial. Estimar después de la prueba técnica y del alcance confirmado.

## Criterios de aceptación del MVP

- Un negocio conecta su número y ve el estado real de la conexión.
- Un mensaje entrante aparece una sola vez en el historial aunque se repita el evento.
- Un agente envía texto y adjuntos soportados; el panel distingue pendiente, enviado y error, sin inventar confirmaciones de entrega.
- Dos agentes comparten el historial, ven la asignación y pueden transferir atención.
- Una nota interna permanece dentro del CRM.
- Se crea una oportunidad desde el chat, cambia de etapa y se registra la próxima acción.
- Se agenda desde el chat con servicio y prestador; dos reservas concurrentes no ocupan el mismo intervalo del prestador.
- Una cita se confirma, reprograma o cancela conservando su historial; la cancelación libera disponibilidad.
- Los horarios se muestran correctamente en la zona del negocio y los agentes no acceden a agendas de otro negocio.
- Las tareas vencidas aparecen en el panel del responsable.
- Un negocio no accede a datos de otro mediante API, búsqueda, adjuntos o actualizaciones en tiempo real.
- Un reinicio recupera sesiones válidas y trabajos pendientes sin repetir envíos conocidos; los resultados inciertos se concilian.
- Una desconexión se muestra y permite volver a vincular sin borrar el historial del CRM.
- Los indicadores tienen definiciones explícitas: primera respuesta humana por conversación, citas por fecha de atención, asistencia sobre citas atendidas más ausencias, e ingresos efectivamente registrados por moneda. Cancelaciones y reprogramaciones se muestran por separado.

Verificación prevista: pruebas de aislamiento y roles, deduplicación y estados de envío, reservas concurrentes, disponibilidad y zona horaria; prueba integral de consulta a cita atendida; comprobación manual con número de prueba y reinicios. No basta con una demo que use mensajes simulados.

## Modelo comercial propuesto

Se venderá como SaaS. Diferenciar planes por agentes, prestadores con agenda, números, almacenamiento y automatizaciones. Ejemplo de estructura, sin precios fijados:

- Básico: un número, equipo pequeño, contactos, bandeja y agenda.
- Equipo: más agentes/números, distribución y reportes ampliados.
- Avanzado: automatizaciones, integraciones y asistencia con IA.

Separar costos de infraestructura y soporte de los costos del proveedor de mensajería y de IA. Definir precios después de medir costo por negocio activo y validar disposición a pagar. Evitar planes ilimitados antes de conocer consumo y mantenimiento de conexiones.

## Decisiones pendientes

1. Sector específico dentro de negocios con citas.
2. Servicios individuales o necesidad inicial de citas grupales/recursos compartidos.
3. Ruta QR para piloto y requisitos de continuidad para producción.
4. Número inicial de agentes y números por negocio.
5. País, moneda, necesidades de privacidad y presupuesto operativo.

## Fuentes de la integración

- [Baileys: repositorio oficial del proyecto](https://github.com/WhiskeySockets/Baileys).
- [whatsapp-web.js: funcionamiento, capacidades y advertencia de bloqueo](https://github.com/wwebjs/whatsapp-web.js).
- [WhatsApp Cloud API: colección y documentación de Meta](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api).

Las capacidades externas deberán verificarse de nuevo al implementar. Este documento propone funciones del producto; no garantiza que cada proveedor soporte todas ellas.
