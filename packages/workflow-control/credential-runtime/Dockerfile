FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/workflow-control/package.json packages/workflow-control/tsconfig.json ./packages/workflow-control/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @agent-platform/workflow-control
RUN pnpm --filter @agent-platform/workflow-control rebuild better-sqlite3
COPY packages/workflow-control/src ./packages/workflow-control/src
RUN pnpm --filter @agent-platform/workflow-control build && pnpm --filter @agent-platform/workflow-control --ignore-scripts deploy --prod /out
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
USER node
ENTRYPOINT ["node", "dist/localCredentialBrokerCli.js"]
