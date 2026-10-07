# WhatsApp Web experimental

El conector usa el paquete oficial del proyecto [Baileys](https://github.com/WhiskeySockets/Baileys), fijado en la línea legacy `6.7.24`. No está afiliado a Meta. Su protocolo puede cambiar y esta dependencia puede requerir mantenimiento. La vinculación y el intercambio reales necesitan una prueba con un número propio; el repositorio no simula una conexión exitosa.

## Activación

1. Genera una clave:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. En `.env`, pon `WHATSAPP_ENABLED=true` y pega la clave en `WHATSAPP_ENCRYPTION_KEY`. Reinicia el servidor si ya estaba abierto.
3. Ejecuta `npm run whatsapp:worker` en otra terminal. Debe usar el mismo `.env` y `DATABASE_PATH` que la aplicación.
4. En el CRM, abre WhatsApp como propietario o administrador y pulsa **Conectar por QR**.
5. Vincula el dispositivo desde la aplicación del teléfono y comprueba envío/recepción con un contacto de prueba.

El QR solo se devuelve a administradores y caduca. El estado se actualiza automáticamente. Si el worker no está activo, la UI lo indica y no acepta nuevos envíos.

## Capacidades actuales

| Función                              | Estado                                                |
| ------------------------------------ | ----------------------------------------------------- |
| QR y sesiones cifradas               | Implementado                                          |
| Texto entrante y saliente            | Implementado; requiere validación con cuenta real     |
| Asignación de conversaciones         | Implementado                                          |
| Recuperación de sesión tras reinicio | Implementada cuando la sesión sigue siendo válida     |
| Confirmaciones de entrega/lectura    | Se muestran cuando el proveedor las reporta           |
| Adjuntos                             | Se muestran como referencia; se consultan en WhatsApp |
| Historial anterior                   | No se importa                                         |
| Grupos, estados y campañas           | No incluidos                                          |
| API oficial de Meta                  | Pendiente                                             |

Solo se admite una conexión por negocio. Las identidades `@lid` se guardan como identidades externas; no se convierten en números inventados. La reconciliación entre LID y número conocido es una mejora pendiente.

## Recuperación y envíos

Después de reiniciar, los mensajes que quedaron en `sending` pasan a `uncertain`. Revisa WhatsApp antes de volver a enviarlos. Una desvinculación elimina las credenciales de esa conexión y conserva los mensajes del CRM. Si el worker perdió la conexión antes de ejecutar la desvinculación, al volver a arrancar limpia la sesión local; también puedes revocar el dispositivo desde el teléfono.

Desvincular cancela los mensajes que todavía están en cola. Un mensaje cuyo envío ya empezó puede llegar aunque se desvincule; comprueba WhatsApp antes de repetirlo.

La clave de cifrado necesita una copia protegida. Sin ella no se pueden restaurar sesiones. La documentación no promete evitar bloqueos ni sincronizar todo lo disponible en la aplicación del teléfono.
