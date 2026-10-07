# Roadmap y oportunidades de contribución

## Implementado en 0.1

Astro SSR, cuentas y negocios, roles e invitaciones, clientes, notas, servicios, prestadores, disponibilidad, reservas con control de concurrencia, agenda semanal, estados e historial de citas, seguimientos, cobros manuales, reportes y conector experimental de WhatsApp para texto.

## Antes de un lanzamiento público amplio

- Validación del worker con número real y recuperación ante desconexión/revinculación.
- Pruebas adicionales de expiración de invitaciones y cambios de negocio.
- Recuperación de cuenta, MFA y administración/revocación de miembros.
- Política de retención, eliminación/exportación de datos y cuotas de registro.
- Paginación de clientes y conversaciones, búsquedas indexadas y pruebas de carga.
- Evaluar Cloud API y definir qué conector se soporta para operación comercial.

## Primeras contribuciones sugeridas

- **Documentación:** guía con capturas y recorrido de la primera reserva.
- **Accesibilidad:** auditoría de teclado, contraste y anuncios del chat.
- **UI:** agenda diaria y filtros por estado de cita.
- **Pruebas:** invitaciones caducadas, notas internas y roles en endpoints.
- **Internacionalización:** configuración de moneda e idioma por negocio.

## Siguiente fase

- Enlace público para reservar, lista de espera y varios intervalos de disponibilidad por día.
- Recordatorios automáticos que se cancelen al reprogramar, cancelar o retirar consentimiento.
- Adjuntos con almacenamiento privado y URLs autorizadas.
- Reconciliación de identidades de WhatsApp y sincronización controlada de historial.
- Anticipos y pagos mediante proveedor, con webhooks verificados e idempotencia.
- PostgreSQL, cola distribuida y trabajadores con partición de conexiones.
- Suscripciones y límites por plan después de medir uso y costos.

La IA, campañas y omnicanalidad se priorizan después de validar consulta → reserva → atención → seguimiento.
