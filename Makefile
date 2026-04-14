.PHONY: install build seed api web dev dev-seed

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

dev: build
	@bash -lc 'set -euo pipefail; trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web run dev -- --port "$(WEB_PORT)"'

dev-seed: seed
	@bash -lc 'set -euo pipefail; trap "kill 0" EXIT INT TERM; SQLITE_PATH="$(SQLITE_PATH)" PORT="$(PORT)" node apps/api/dist/index.js & pnpm --filter @agent-platform/web run dev -- --port "$(WEB_PORT)"'
