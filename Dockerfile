# Free-stack backend deploy (Koyeb / any container host). Frontend ships on Cloudflare Pages.
# ponytail: multi-stage build; prisma migrate deploy runs on every start (idempotent).
# uploads/ is ephemeral on free tiers (no persistent volume) — S3 is the upgrade path.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/package.json ./
RUN mkdir -p uploads
EXPOSE 3000
# Koyeb injects PORT; app reads process.env.PORT (default 3000) and binds 0.0.0.0
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]