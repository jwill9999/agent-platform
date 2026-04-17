.PHONY: setup all install rebuild-native build seed api web stop-sessions stop-ports reset-db up down reset start new restart dev dev-seed dev-reset doctor

# One-shot: install deps, build, seed DB, start API + web (nvm applied in each step).
.DEFAULT_GOAL := setup

PORT ?= 3000
WEB_PORT ?= 3001
# Local dev: repo-root data/ (created on first API start). Override for Docker: SQLITE_PATH=/workspace/data/dev.sqlite make api
SQLITE_PATH ?= $(CURDIR)/data/dev.sqlite

# Directory containing this Makefile (repo root when building from Makefile).
REPO_ROOT := $(patsubst %/,%,$(dir $(abspath $(firstword $(MAKEFILE_LIST)))))

# If nvm is installed, load it and apply .nvmrc in REPO_ROOT. No-op when nvm is missing (Docker/CI).
# Used by install, build, doctor, seed, api, web, up, reset (anything that runs node or pnpm).
define WITH_NVM
export NVM_DIR="$${NVM_DIR:-$$HOME/.nvm}"; if [ -s "$$NVM_DIR/nvm.sh" ]; then . "$$NVM_DIR/nvm.sh" && cd "$(REPO_ROOT)" && nvm use; fi;
endef

# Harness chat prefers AGENT_OPENAI_API_KEY; if unset, reuse OPENAI_API_KEY for local make targets (avoids duplicate .env lines).
define WITH_AGENT_OPENAI_FALLBACK
export AGENT_OPENAI_API_KEY="$${AGENT_OPENAI_API_KEY:-$${OPENAI_API_KEY-}}";
endef

# Recompile better-sqlite3 for the current Node (must match `make doctor`). Run after switching Node or if seed/api fails with ERR_DLOPEN / NODE_MODULE_VERSION.
install:
	@bash -c '$(WITH_NVM) pnpm install && pnpm rebuild:native'

rebuild-native:
	@bash -c '$(WITH_NVM) pnpm rebuild:native'

# Chains install → up (build, free ports, seed DB, start API + web). Same as `make` with no args.
setup: install
	@$(MAKE) up

all: setup

build:
	@bash -c '$(WITH_NVM) pnpm build'

# Print Node path/version — native deps (better-sqlite3) must be built with the same Node you use for `make api`.
doctor:
	@bash -c '$(WITH_NVM) node -v && command -v node && pnpm -v'

seed: build
	@bash -c '$(WITH_NVM) SQLITE_PATH="$(SQLITE_PATH)" pnpm seed'

# API + PTY terminal: Node must match pnpm install (see .nvmrc).
api: build
	@bash -c '$(WITH_NVM) $(WITH_AGENT_OPENAI_FALLBACK) node -e "console.log(\"Using\", process.version, process.execPath, \"— must match Node used for pnpm install (make doctor)\")" && SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js'

# Next.js dev server on WEB_PORT.
web:
	@bash -c '$(WITH_NVM) pnpm --filter @agent-platform/web run dev'

stop-ports:
	@bash -lc 'set -euo pipefail; for port in "$(PORT)" "$(WEB_PORT)"; do pids="$$(lsof -tiTCP:$$port || true)"; if [ -n "$$pids" ]; then echo "Stopping processes on port $$port: $$pids"; kill $$pids || true; sleep 0.5; remaining="$$(lsof -tiTCP:$$port || true)"; if [ -n "$$remaining" ]; then echo "Force killing processes on port $$port: $$remaining"; kill -9 $$remaining || true; fi; fi; done'

stop-sessions:
	@bash -lc 'set -euo pipefail; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=web-dev-server" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "web-dev-server:0.0" C-c || true; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=api-server-run" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "api-server-run:0.0" C-c || true; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=api-dev-server" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "api-dev-server:0.0" C-c || true'

reset-db:
	@bash -lc 'set -euo pipefail; if [ -f "$(SQLITE_PATH)" ]; then echo "Removing $(SQLITE_PATH)"; rm -f "$(SQLITE_PATH)"; fi'

# API + web together: same nvm/Node for background node and foreground pnpm/next.
# Runs seed after build/down so the DB has the seeded agents + demo rows before the API serves /v1 (idempotent).
up: build down seed
	@bash -c 'set -euo pipefail; $(WITH_NVM) $(WITH_AGENT_OPENAI_FALLBACK) trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web exec next dev --hostname 0.0.0.0 --port "$(WEB_PORT)"'

down: stop-sessions stop-ports

reset: down reset-db build seed
	@bash -c 'set -euo pipefail; $(WITH_NVM) $(WITH_AGENT_OPENAI_FALLBACK) trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web exec next dev --hostname 0.0.0.0 --port "$(WEB_PORT)"'

start: up

# Stop API + web, then bring them back up. Keeps the SQLite file (no `reset-db`).
restart:
	@$(MAKE) down
	@$(MAKE) up

# Reinstall deps, then full reset: wipe DB, rebuild, seed, start (destructive local DB).
new: install
	@$(MAKE) reset

dev: build
	@$(MAKE) up

dev-seed: stop-sessions stop-ports reset-db seed
	@$(MAKE) reset

dev-reset: dev-seed
