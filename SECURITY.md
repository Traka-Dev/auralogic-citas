# Seguridad

Esta versión 0.1 es una base para pilotos. No se ofrece una auditoría de seguridad ni un SLA. La revisión y los avisos se atienden en la rama principal; no existen ramas LTS todavía.

## Reportar una vulnerabilidad

No publiques credenciales, datos de clientes ni pasos sensibles en un issue público. Usa [el reporte privado de vulnerabilidades de GitHub](https://github.com/Traka-Dev/auralogic-citas/security/advisories/new). Si el canal no está disponible, contacta de forma privada a [Auralogic](https://auralogic.dev/#contact) sin enviar información sensible en el formulario inicial.

Incluye versión, componente afectado, impacto y una reproducción con datos ficticios. No accedas a datos de otras personas para comprobar un hallazgo.

## Controles existentes

- Sesiones aleatorias almacenadas como hashes; contraseñas con scrypt y cookies HttpOnly.
- Límites de intentos de autenticación persistidos, origen estricto y token CSRF.
- Permisos del lado del servidor y claves foráneas compuestas por negocio.
- Escapado de contenido por Astro y construcción del chat con `textContent`.
- Encabezados de seguridad, límite de cuerpo en el adaptador y páginas privadas sin caché.
- Credenciales de WhatsApp y QR cifrados con AES-256-GCM y contexto del negocio.
- Bloqueo de worker único y resultados inciertos de envío sin reintentos automáticos.

## Antes de recibir datos reales

Usa HTTPS, protege el disco y las copias, define retención de datos, revisa permisos y prueba restauración. No hay MFA, recuperación de contraseña, cifrado de toda la base, cuotas globales de registro ni protección distribuida contra abuso. Para un servicio público agrega controles en el proxy y revisa los pendientes del roadmap.

La clave de cifrado de WhatsApp debe respaldarse por separado. Cambiarla sin una migración invalida las sesiones guardadas. No la incluyas en Git, imágenes Docker, logs ni reportes.
