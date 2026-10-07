# Contribuir a Auralogic Citas

Puedes contribuir con código, pruebas, documentación, accesibilidad y reportes de errores. Se aceptan issues y PR en español o inglés.

Repositorio: [Traka-Dev/auralogic-citas](https://github.com/Traka-Dev/auralogic-citas). Proyecto mantenido por [Auralogic](https://auralogic.dev/).

## Preparar el entorno

1. Usa Node 24 y sigue la instalación del README.
2. Haz un fork, clónalo y crea una rama desde `main`: `feat/descripcion`, `fix/descripcion` o `docs/descripcion`.
3. Para cambios grandes, abre primero una propuesta con el problema, el comportamiento esperado y el alcance. Para una corrección pequeña puedes enviar directamente un PR.
4. Usa datos ficticios. No incluyas números reales, QR, bases de datos, sesiones o credenciales en cambios, issues o capturas.

## Implementación

- Mantén el renderizado con Astro. Añade JavaScript al cliente solo para interacciones que lo necesitan.
- Sitúa reglas del negocio en `src/lib`, rutas HTTP en `src/pages/api` y componentes reutilizables en `src/components`.
- Filtra siempre por `business_id`. La comprobación de acceso debe estar en el servidor, incluidos los trabajos del worker.
- Parametriza SQL. Una interpolación solo puede identificar tablas de una lista cerrada; nunca contenido de una solicitud.
- Guarda dinero como centavos y tiempos como UTC. Convierte fechas locales con la zona del negocio y rechaza horas ambiguas.
- Usa transacciones para reservas y cambios que deben ser atómicos. No conviertas una cita reservada en un pago confirmado.
- Protege todas las mutaciones con autenticación, autorización, origen y CSRF.
- No guardes notas internas como mensajes de WhatsApp ni registres cuerpos, QR o secretos en logs.
- Los cambios de esquema se añaden al final de la lista de migraciones. No edites migraciones ya publicadas.
- Incluye pruebas cuando cambien permisos, agenda, persistencia o integración; verifica manualmente las modificaciones visuales.

## Antes del PR

```bash
npm run format
npm run verify
npm run test:e2e
```

Describe el problema, el resultado y cómo lo comprobaste. Añade capturas para cambios visuales y explica migraciones o cambios de configuración. No hace falta una cobertura artificial de cada línea: necesitamos pruebas de comportamiento, aislamiento y fallos reales.

## Commits y autoría

Usa Conventional Commits cuando sea práctico: `feat:`, `fix:`, `docs:`, `test:` o `chore:`. Añade una firma DCO con `git commit -s`, certificando lo establecido en [Developer Certificate of Origin 1.1](https://developercertificate.org/). Las contribuciones se incorporan bajo AGPL-3.0-only; no se solicita cesión exclusiva de autoría.

## Revisión

Los mantenedores revisan corrección, seguridad, alcance, accesibilidad y documentación. Un PR necesita CI verde y revisión antes de fusionarse. Un cambio incompatible requiere explicación y guía de migración. No publiques una vulnerabilidad como issue: sigue [SECURITY.md](SECURITY.md).

El mantenedor inicial es [@Traka-Dev](https://github.com/Traka-Dev). No incluyas campañas, telemetría, dependencias comerciales o cambios de identidad sin discutir primero la necesidad y el alcance. Los derechos sobre el código y las marcas se distinguen en [docs/BRANDING.md](docs/BRANDING.md).
