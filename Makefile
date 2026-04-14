.PHONY: install build seed api web stop-sessions stop-ports reset-db start restart dev dev-seed dev-reset

PORT ?= 3000
WEB_PORT ?= 3001
SQLITE_PATH ?= /workspace/data/dev.sqlite

install:
	pnpm install

build:
	pnpm build

seed: build
	SQLITE_PATH="$(SQLITE_PATH)" pnpm seed

api: build
	SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js

web:
	pnpm --filter @agent-platform/web run dev

stop-ports:
	@bash -lc 'set -euo pipefail; for port in "$(PORT)" "$(WEB_PORT)"; do pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN || true)"; if [ -n "$$pids" ]; then echo "Stopping processes on port $$port: $$pids"; kill $$pids; fi; done'

stop-sessions:
	@bash -lc 'set -euo pipefail; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=web-dev-server" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "web-dev-server:0.0" C-c || true; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=api-server-run" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "api-server-run:0.0" C-c || true; tmux -f /exec-daemon/tmux.portal.conf has-session -t "=api-dev-server" 2>/dev/null && tmux -f /exec-daemon/tmux.portal.conf send-keys -t "api-dev-server:0.0" C-c || true'

reset-db:
	@bash -lc 'set -euo pipefail; if [ -f "$(SQLITE_PATH)" ]; then echo "Removing $(SQLITE_PATH)"; rm -f "$(SQLITE_PATH)"; fi'

start: dev

restart: dev-seed

dev: build
	@bash -lc 'set -euo pipefail; for port in "$(PORT)" "$(WEB_PORT)"; do pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN || true)"; if [ -n "$$pids" ]; then echo "Stopping processes on port $$port: $$pids"; kill $$pids; fi; done; trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web exec next dev --port "$(WEB_PORT)"'

dev-seed: stop-sessions stop-ports reset-db seed
	@bash -lc 'set -euo pipefail; trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web exec next dev --port "$(WEB_PORT)"'

dev-reset: dev-seed
