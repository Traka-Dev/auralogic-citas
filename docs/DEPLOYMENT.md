# Despliegue

## Node

Usa Node 24, un directorio de datos persistente sobre disco local y un proxy HTTPS. `APP_ORIGIN` debe coincidir exactamente con el origen del navegador, por ejemplo `https://crm.example.com`. El servidor rechaza las mutaciones desde otro origen.

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

El proceso recibe `DATABASE_PATH`, `HOST`, `PORT` y `APP_ORIGIN` en el entorno o `.env`. Las sesiones se almacenan en SQLite. La cookie usa `Secure` cuando `APP_ORIGIN` es HTTPS, también detrás de un proxy. Configura el proxy para preservar el origen del cliente y verifica el atributo de la cookie antes de abrir el servicio.

## Docker Compose

Configura `.env` a partir del ejemplo. Para usar el puerto publicado, `APP_ORIGIN=http://localhost:4321` en desarrollo.

```bash
docker compose up --build -d app
```

La imagen ejecuta la aplicación como usuario sin privilegios. El volumen `auralogic-citas-data` conserva SQLite y debe permanecer en un filesystem local. El puerto se publica solo en `127.0.0.1`; usa un proxy para acceso externo.

Para habilitar WhatsApp, define la clave y la variable de activación y ejecuta:

```bash
docker compose --profile whatsapp up --build -d
```

Un único worker comparte el volumen. No escales ese servicio ni montes el archivo SQLite sobre NFS. `docker compose down` conserva el volumen; `down -v` elimina los datos.

## Copias y restauración

Para una primera instalación, detén aplicación y worker antes de copiar la base, incluyendo WAL/SHM si existen. Alternativamente, usa la API de backup de SQLite o `VACUUM INTO` con el proceso operativo. Nunca copies solo el archivo principal mientras existen escrituras sin asegurar una instantánea consistente.

Prueba la restauración en otra instalación con el mismo esquema y una copia protegida de la clave de WhatsApp. Haz copia antes de una actualización. Las migraciones avanzan al iniciar; no hay downgrade automático.

## Operación

- Revisa `/api/health`, disco disponible y copias.
- Monitorea el worker y su heartbeat; los logs no contienen QR ni cuerpos de mensajes.
- Pon límites de conexiones y solicitudes en el proxy para un servicio público.
- Revisa las limitaciones de [SECURITY.md](../SECURITY.md) y el [roadmap](ROADMAP.md).
- No hay facturación SaaS ni pasarela de pagos: los cobros del panel son registros manuales.
