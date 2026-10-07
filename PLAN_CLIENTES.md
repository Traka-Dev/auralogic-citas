# Módulo de clientes

Especificación de referencia para el CRM de WhatsApp y citas. La primera implementación está documentada en README.md; algunas funciones aquí descritas siguen en el roadmap.

## Propósito

Reunir la información necesaria para atender, reservar y dar seguimiento a cada persona. Desde la conversación se puede abrir su ficha y consultar sus citas sin volver a pedir los mismos datos.

En este documento, negocio es la empresa que contrata el SaaS y cliente es la persona que solicita sus servicios. Los registros de clientes pertenecen a cada negocio y no se comparten entre empresas.

## Primera versión

| Función             | Comportamiento                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Lista de clientes   | Buscar por nombre o teléfono; filtrar por etiquetas, responsable y estado de relación                    |
| Alta manual         | Registrar nombre y teléfono; correo opcional                                                             |
| Alta desde WhatsApp | Crear un contacto al recibir una consulta de una identidad nueva, evitando duplicados dentro del negocio |
| Ficha               | Mostrar datos, etiquetas, responsable, origen y preferencias útiles para prestar el servicio             |
| Historial           | Consultar conversaciones disponibles, citas y notas con fecha y autor                                    |
| Seguimiento         | Registrar próxima acción, responsable y fecha; permitir varios pendientes                                |
| Edición             | Actualizar datos y registrar cambios relevantes                                                          |
| Archivo             | Ocultar registros de la vista habitual sin borrar su historial                                           |

La creación desde WhatsApp depende de la integración real. La interfaz no debe presentar un contacto de ejemplo como si fuera una sincronización real.

## Datos del cliente

- Nombre: puede estar pendiente de confirmar cuando proviene de WhatsApp.
- Teléfono: con país, normalizado cuando se puede verificar su formato. Se solicita país explícito; no se agrega automáticamente un prefijo por la ubicación del servidor.
- Identidad de WhatsApp: independiente del teléfono, porque un identificador externo no siempre es un número.
- Correo: opcional.
- Origen: WhatsApp, registro manual, recomendación o formulario cuando esté disponible.
- Responsable de atención: miembro del negocio.
- Estado de relación: prospecto, cliente o inactivo. Archivar es una acción separada.
- Etiquetas: por ejemplo, interesado en corte, coloración o seguimiento pendiente.
- Preferencias de servicio: texto breve; evitar recopilar información que no haga falta.
- Preferencia de contacto: autorización o rechazo de comunicaciones, finalidad, fuente y fecha cuando aplique. Una consulta entrante no equivale a aceptar campañas.
- Fecha de creación y actualización.

Las citas, notas, mensajes y tareas son registros relacionados; no se guardan como un único texto dentro de la ficha.

## Pantalla de clientes

Encabezado con búsqueda y botón Nuevo cliente. El listado muestra nombre, teléfono, etiquetas, responsable y próxima cita activa. Al abrir un registro, aparece una ficha con tres áreas:

1. Resumen: datos, responsable, etiquetas y próxima acción.
2. Citas: próximas y anteriores, con servicio, prestador y estado.
3. Historial: conversaciones y notas internas con fecha y autor.

Acciones principales: editar, abrir conversación, agendar cita, añadir nota y crear seguimiento. Las acciones dependen de permisos y de que exista el módulo o la conexión correspondiente; no se muestran como funcionales antes de implementarse.

## Flujos

### Consulta nueva

Llega mensaje → identificar conexión y negocio → buscar identidad del contacto → crear si no existe → abrir conversación → confirmar nombre → asignar responsable → reservar o crear seguimiento.

### Cliente que vuelve

Buscar por nombre o teléfono → revisar preferencias e historial → seleccionar servicio y disponibilidad → reservar cita → registrar próxima acción si hace falta.

### Registro duplicado

Detectar coincidencia de identidad o teléfono → mostrar registro existente → permitir usarlo. Si dos contactos existentes parecen ser la misma persona, proponer revisión manual. No unir automáticamente personas por nombre coincidente.

### Ausencia

Registrar que no asistió en la cita → crear tarea de seguimiento si corresponde → registrar la respuesta. Una ausencia no convierte automáticamente al cliente en inactivo ni lo bloquea.

## Reglas

- El mismo teléfono puede pertenecer a clientes de distintos negocios sin compartir datos.
- En un negocio, una identidad de WhatsApp se vincula a un único contacto. Si un teléfono familiar es compartido, mantener un contacto de comunicación y distinguir beneficiarios de las citas mediante una función posterior; no mezclar historiales de forma silenciosa.
- El nombre de perfil recibido es una sugerencia y no reemplaza un nombre confirmado por el agente.
- Las notas internas nunca se envían como mensajes.
- Cambiar responsable no elimina tareas ni citas; la reasignación de pendientes es explícita.
- Archivar no cancela citas. Mostrar las citas activas antes de archivar.
- La próxima cita se calcula a partir de citas futuras activas; no se mantiene como dato manual.
- Los ingresos registrados se calculan desde pagos o registros de cobro; el precio de una cita no prueba que se pagó.
- Guardar fechas de eventos en UTC y presentarlas en la zona horaria del negocio.

## Modelo mínimo

- clients: negocio, nombre, correo, origen, responsable, estado de relación y fecha de archivo.
- client_channel_identities: negocio, cliente, proveedor, identidad externa y teléfono normalizado cuando exista.
- tags y client_tags: etiquetas configurables por negocio.
- client_notes: cliente, negocio, autor, contenido y fecha.
- contact_preferences: cliente, finalidad, decisión, fuente y fecha.
- tasks: cliente, negocio, responsable, acción, vencimiento y estado.
- appointments y conversations: referencias al cliente dentro del mismo negocio.

Usar restricciones y verificación de acceso en el servidor para impedir relaciones entre negocios. Deduplicar la identidad externa dentro del contexto de proveedor y negocio, permitiendo que distintas conexiones del mismo negocio encuentren el mismo cliente cuando la identidad sea compatible.

## Entrega y validación

1. Implementar negocio, acceso y clientes persistidos: crear, listar, buscar, editar y archivar.
2. Añadir etiquetas, notas y tareas con autor y permisos.
3. Integrar alta desde mensajes cuando funcione el conector.
4. Vincular agenda e historial de citas cuando exista ese módulo.

Se considera terminado el primer entregable cuando los registros sobreviven a un reinicio, se valida el formato de los datos, se detectan duplicados, buscar devuelve el registro esperado y un usuario no puede leer ni modificar clientes de otro negocio.

La vinculación con WhatsApp y citas se valida con pruebas integrales posteriores; no se considera entregada por añadir botones a la ficha.

## Después del MVP

- Importación CSV con previsualización y revisión de duplicados.
- Exportación con permisos y registro de auditoría.
- Unión de duplicados con previsualización e historial de la operación.
- Beneficiarios distintos de quien reserva y teléfonos compartidos.
- Segmentación por visitas, servicio y tiempo desde la última atención.
- Seguimientos automáticos según consentimiento y capacidades del proveedor.

Primero se valida la ficha y el recorrido consulta → reserva → atención → seguimiento; puntos, membresías y campañas se priorizan después según uso real.
