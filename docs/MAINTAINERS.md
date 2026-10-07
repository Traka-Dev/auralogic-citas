# Publicación y mantenimiento

Repositorio: [Traka-Dev/auralogic-citas](https://github.com/Traka-Dev/auralogic-citas). Mantenedor inicial: [@Traka-Dev](https://github.com/Traka-Dev), de [Auralogic](https://auralogic.dev/).

Configuración y mantenimiento del repositorio:

1. Habilita issues, discusiones si se necesitan y reporte privado de vulnerabilidades.
2. Publica un canal privado de seguridad y conducta en `SECURITY.md` y `CODE_OF_CONDUCT.md`.
3. Protege `main`: PR obligatorio, al menos una revisión, resolución de conversaciones y check `quality` verde. Deshabilita force-push y borrado de la rama.
4. CODEOWNERS asigna la revisión inicial a `@Traka-Dev`. Actualízalo al incorporar mantenedores.
5. Activa alertas de dependencias y revisa PR de Dependabot. No fusionar automáticamente cambios del conector sin comprobar compatibilidad.
6. Convierte las tareas del roadmap en issues pequeñas con etiquetas `good first issue`, `help wanted`, `bug`, `documentation` y `security` cuando corresponda.
7. Para releases, actualiza CHANGELOG, verifica migraciones y pruebas, etiqueta `vX.Y.Z` y documenta cambios incompatibles.

## Flujo de revisión

Los cambios de permisos, sesiones, cifrado y reservas requieren una revisión atenta y pruebas de fallo. Los cambios visuales deben incluir comprobación móvil. Las decisiones importantes se documentan en `docs/adr` antes de cambiar la arquitectura.

Las decisiones finales corresponden a los mantenedores del repositorio. Los contribuidores conservan su autoría y pueden solicitar revisión explicando el comportamiento y evidencia. No hay SLA de respuesta. La atribución y el contacto comercial de la herramienta se documentan en [BRANDING.md](BRANDING.md).
