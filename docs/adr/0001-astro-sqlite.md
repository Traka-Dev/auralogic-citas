# ADR 0001: Astro SSR y SQLite para la primera versión

Estado: aceptado para 0.1.

## Contexto

El usuario pidió Astro en lugar de Next.js y un proyecto abierto que otras personas puedan ejecutar y mejorar. La agenda necesita persistencia y protección contra reservas concurrentes.

## Decisión

Astro con adaptador Node standalone, TypeScript estricto y SQLite nativo de Node 24. Formularios HTML con endpoints del servidor. Worker persistente e independiente para WhatsApp. Lógica del negocio separada de pantallas y transporte HTTP.

## Consecuencias

El desarrollo local no depende de servicios contratados ni contenedores. Las reservas son transaccionales y las pruebas pueden usar bases temporales. La instalación requiere un filesystem local persistente y no puede escalar con bases independientes. La migración a PostgreSQL y cola distribuida se evaluará con la carga real.

AGPL-3.0-only mantiene el proyecto abierto bajo sus términos, incluyendo uso por red. El conector Baileys es experimental; no se convierte en una garantía comercial de WhatsApp.
