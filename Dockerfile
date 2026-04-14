# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
RUN apk add --no-cache curl python3 make g++ && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY packages/model-router packages/model-router
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @agent-platform/contracts build && pnpm --filter @agent-platform/db build && pnpm --filter @agent-platform/model-router build && pnpm --filter @agent-platform/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache curl python3 make g++ \
  && addgroup -g 10001 -S appuser \
  && adduser -S -u 10001 -G appuser appuser
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/contracts/package.json packages/contracts/
COPY --from=build /app/packages/db/package.json packages/db/
COPY --from=build /app/packages/model-router/package.json packages/model-router/
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/db/drizzle packages/db/drizzle
COPY --from=build /app/packages/model-router/dist packages/model-router/dist
COPY --from=build /app/apps/api/dist apps/api/dist
RUN pnpm install --frozen-lockfile --prod \
  && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "apps/api/dist/index.js"]
