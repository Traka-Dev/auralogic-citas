FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATABASE_PATH=/app/data/auralogic-citas.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
