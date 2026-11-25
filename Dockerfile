# syntax=docker/dockerfile:1

# ---------- base com pnpm ----------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---------- dependências e build ----------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY src/compartilhado/package.json src/compartilhado/
COPY src/backend/package.json src/backend/
COPY src/frontend/package.json src/frontend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY src ./src
RUN pnpm --filter @vulncase/backend build \
 && pnpm --filter @vulncase/frontend build \
 && pnpm --filter @vulncase/backend deploy --prod --legacy /out/api

# ---------- API ----------
FROM node:24-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/api/node_modules ./node_modules
COPY --from=build /out/api/package.json ./
COPY --from=build /app/src/backend/dist ./dist
COPY --from=build /app/src/backend/drizzle ./drizzle
RUN mkdir -p /data/evidencias && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]

# ---------- front-end estático ----------
FROM caddy:2-alpine AS web
COPY --from=build /app/src/frontend/dist /srv
COPY docker/Caddyfile.web /etc/caddy/Caddyfile
