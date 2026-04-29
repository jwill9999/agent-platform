.PHONY: build rebuild up down restart reset new workspace-init seed logs logs-api logs-web status shell-api shell-web clean test lint typecheck format help

# ---------------------------------------------------------------------------
# Docker-only Makefile — all runtime commands run inside containers.
# Local targets (test, lint, typecheck) are for host-side quality gates only.
# ---------------------------------------------------------------------------

COMPOSE := docker compose --profile services
AGENT_PLATFORM_HOME ?= $(CURDIR)/.agent-platform
AGENT_WORKSPACE_HOST_PATH ?= $(AGENT_PLATFORM_HOME)/workspaces/default
AGENT_WORKSPACE_CONTAINER_PATH ?= /workspace
AGENT_DATA_HOST_PATH ?= $(AGENT_PLATFORM_HOME)/data
export AGENT_PLATFORM_HOME
export AGENT_WORKSPACE_HOST_PATH
export AGENT_WORKSPACE_CONTAINER_PATH
export AGENT_DATA_HOST_PATH

.DEFAULT_GOAL := up

# ---------------------------------------------------------------------------
# Docker lifecycle
# ---------------------------------------------------------------------------

## Build Docker images (api + web)
build:
	$(COMPOSE) build

## Build from scratch — no layer cache
rebuild:
	$(COMPOSE) build --no-cache

## Prepare host workspace directories
workspace-init:
	node scripts/workspace-init.mjs

## Build, start, wait for healthy, then seed DB (the "just works" command)
up: workspace-init
	$(COMPOSE) up -d --build --wait
	$(COMPOSE) exec api node packages/db/dist/seed/run.js
	@echo ""
	@echo "✅ Services running:"
	@echo "   API: http://localhost:$${HOST_PORT:-3000}"
	@echo "   Web: http://localhost:$${WEB_HOST_PORT:-3001}"
	@echo ""
	@echo "   make logs      — follow output"
	@echo "   make status    — check health"
	@echo "   make restart   — rebuild & restart"

## Stop all services (keeps volumes / DB)
down:
	$(COMPOSE) down

## Restart: stop → rebuild → start + seed (keeps DB)
restart: workspace-init
	$(COMPOSE) down
	$(COMPOSE) up -d --build --wait
	$(COMPOSE) exec api node packages/db/dist/seed/run.js

## Wipe DB & volumes, rebuild, start fresh
reset: workspace-init
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build --wait
	$(COMPOSE) exec api node packages/db/dist/seed/run.js

## Nuclear: remove everything (volumes + images), rebuild from scratch
new: workspace-init
	$(COMPOSE) down -v --remove-orphans --rmi local
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --wait
	$(COMPOSE) exec api node packages/db/dist/seed/run.js

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

## Seed DB inside the running API container (idempotent)
seed:
	$(COMPOSE) exec api node packages/db/dist/seed/run.js

# ---------------------------------------------------------------------------
# Logs & status
# ---------------------------------------------------------------------------

## Follow logs for all services
logs:
	$(COMPOSE) logs -f

## Follow API logs only
logs-api:
	$(COMPOSE) logs -f api

## Follow web logs only
logs-web:
	$(COMPOSE) logs -f web

## Show container status and health
status:
	$(COMPOSE) ps

# ---------------------------------------------------------------------------
# Shell access
# ---------------------------------------------------------------------------

## Open a shell in the API container
shell-api:
	$(COMPOSE) exec api sh

## Open a shell in the web container
shell-web:
	$(COMPOSE) exec web sh

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

## Remove containers, volumes, and locally-built images
clean:
	$(COMPOSE) down -v --remove-orphans --rmi local

# ---------------------------------------------------------------------------
# Local quality gates (runs on host for fast feedback, not in Docker)
# ---------------------------------------------------------------------------

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

format:
	pnpm format:check

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

help:
	@echo "Docker targets:"
	@echo "  make up        Build, start, seed (default)"
	@echo "  make down      Stop services"
	@echo "  make restart   Rebuild & restart (keeps DB)"
	@echo "  make reset     Wipe DB, rebuild, start fresh"
	@echo "  make new       Nuclear: wipe everything, rebuild from scratch"
	@echo "  make workspace-init Prepare host workspace directories"
	@echo "  make seed      Seed DB in running API container"
	@echo "  make logs      Follow all service logs"
	@echo "  make status    Show container health"
	@echo "  make shell-api Open shell in API container"
	@echo "  make shell-web Open shell in web container"
	@echo "  make clean     Remove containers, volumes, images"
	@echo ""
	@echo "Local quality gates:"
	@echo "  make test      Run unit tests"
	@echo "  make lint      Run linter"
	@echo "  make typecheck Run TypeScript checks"
