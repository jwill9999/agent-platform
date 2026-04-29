# Deployment

## Docker (Recommended)

### Setup

1. Copy `.env.example` to `.env` and configure:

```bash
cp -f .env.example .env
```

2. Set required variables in `.env`:

```env
HOST_PORT=3000
SQLITE_PATH=/data/agent.sqlite
AGENT_OPENAI_API_KEY=sk-...
```

3. Build and start:

```bash
# API only
docker compose up --build

# API + Web (full stack)
docker compose --profile services up --build
```

### Services

| Service | Port                           | Dockerfile       | Profile    |
| ------- | ------------------------------ | ---------------- | ---------- |
| `api`   | `HOST_PORT` (default 3000)     | `Dockerfile`     | default    |
| `web`   | `WEB_HOST_PORT` (default 3001) | `Dockerfile.web` | `services` |

### Volumes

| Source env var              | Mount        | Purpose                      |
| --------------------------- | ------------ | ---------------------------- |
| `AGENT_DATA_HOST_PATH`      | `/data`      | App/runtime data persistence |
| `AGENT_WORKSPACE_HOST_PATH` | `/workspace` | User workspace files         |

Workspace storage uses an explicit host directory mounted at `/workspace`. Keep app data separate from user files: app/runtime data belongs under `/data`, while user-created, uploaded, generated, scratch, and exported files belong under `/workspace`.

### Health Checks

- **API:** `GET /health` — curl-based, 10s interval, 3 retries, 15s start period
- **Web:** `GET /` — wget-based, 10s interval, 5 retries, 15s start period
- Web depends on API being healthy before starting

### Seeding the Database

**Host-side seeding:**

```bash
pnpm build
SQLITE_PATH=<path-to-sqlite-file> pnpm seed
```

**Docker-side seeding:**

```bash
docker compose run --rm api node packages/db/dist/seed/run.js
```

The seed is idempotent — safe to run multiple times.

## Environment Variables

### API Container

| Variable                  | Default              | Description                                |
| ------------------------- | -------------------- | ------------------------------------------ |
| `PORT`                    | `3000`               | Internal listen port                       |
| `HOST`                    | `0.0.0.0`            | Bind address                               |
| `SQLITE_PATH`             | `/data/agent.sqlite` | Database file path (inside container)      |
| `SECRETS_MASTER_KEY`      | —                    | Base64 32-byte key for AES-256-GCM secrets |
| `AGENT_OPENAI_API_KEY`    | —                    | OpenAI API key for chat                    |
| `OPENAI_ALLOW_LEGACY_ENV` | `0`                  | Set `1` to allow `OPENAI_API_KEY` fallback |

### Workspace Storage Variables

| Variable                         | Default / convention                      | Description                                      |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `AGENT_PLATFORM_HOME`            | OS-specific app home                      | Host root for config, data, workspaces, and logs |
| `AGENT_WORKSPACE_HOST_PATH`      | `$AGENT_PLATFORM_HOME/workspaces/default` | Host user workspace directory                    |
| `AGENT_WORKSPACE_CONTAINER_PATH` | `/workspace`                              | Container workspace path                         |
| `AGENT_DATA_HOST_PATH`           | `$AGENT_PLATFORM_HOME/data`               | Host app data directory                          |

Host defaults:

| Host OS | Default home                                  |
| ------- | --------------------------------------------- |
| Linux   | `~/.agent-platform`                           |
| macOS   | `~/Library/Application Support/AgentPlatform` |
| Windows | `%LOCALAPPDATA%\\AgentPlatform`               |

Expected host layout:

```text
AgentPlatform/
  config/
  data/
  workspaces/default/uploads/
  workspaces/default/generated/
  workspaces/default/scratch/
  workspaces/default/exports/
  logs/
```

### Web Container

| Variable              | Default           | Description                       |
| --------------------- | ----------------- | --------------------------------- |
| `PORT`                | `3001`            | Internal listen port              |
| `HOSTNAME`            | `0.0.0.0`         | Bind address                      |
| `API_PROXY_URL`       | `http://api:3000` | API proxy target for BFF route    |
| `NEXT_OPENAI_API_KEY` | —                 | OpenAI key for Next.js chat route |

### Docker Compose Overrides

| Variable        | Default | Description                       |
| --------------- | ------- | --------------------------------- |
| `HOST_PORT`     | `3000`  | Host → API container port mapping |
| `WEB_HOST_PORT` | `3001`  | Host → Web container port mapping |

## E2E Testing in Docker

```bash
# Start full stack
docker compose --profile services up --build -d

# Apply E2E seed
docker compose exec -T api sh -c \
  'E2E_SEED=1 SQLITE_PATH=/data/agent.sqlite node packages/db/dist/seed/run.js'

# Install browsers (one-time)
pnpm test:e2e:install

# Run E2E tests
pnpm test:e2e
```

Override test URLs if ports differ: `BASE_URL=http://localhost:3001 API_URL=http://localhost:3000 pnpm test:e2e`

## Production Considerations

### Current State (MVP)

- **Single-user** — no authentication or multi-tenancy
- **SQLite** — single-file database, not suitable for concurrent writes at scale
- **Local-first** — designed for development and single-user deployments

### Expansion Path

- **PostgreSQL** — documented as the next persistence backend
- **Authentication** — stub middleware ready for implementation
- **Scaling** — stateless API design supports horizontal scaling once DB is externalized

### Security Notes

- `OPENAI_API_KEY` is blocked by default to prevent stale env var leaks — use `AGENT_OPENAI_API_KEY` instead
- Secrets are always AES-256-GCM encrypted with key version tracking
- No hardcoded model IDs — provider, model, and API key are user-configurable
- Filesystem access is bounded by Docker volume mounts
