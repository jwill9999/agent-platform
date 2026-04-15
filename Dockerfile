# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
RUN apk add --no-cache curl python3 make g++ && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY packages/model-router packages/model-router
COPY packages/harness packages/harness
COPY packages/mcp-adapter packages/mcp-adapter
COPY packages/plugin-sdk packages/plugin-sdk
COPY packages/plugin-session packages/plugin-session
COPY packages/plugin-observability packages/plugin-observability
COPY packages/planner packages/planner
COPY packages/agent-validation packages/agent-validation
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm -r run build

# Prune to production deps (keeps native addons like better-sqlite3 intact)
RUN pnpm prune --prod

FROM node:20-alpine AS runner
RUN apk add --no-cache curl su-exec \
  && addgroup -g 10001 -S appuser \
  && adduser -S -u 10001 -G appuser appuser
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app ./
USER root
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/index.js"]
