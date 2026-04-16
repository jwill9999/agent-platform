import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Router } from 'express';
import { serve, setup } from 'swagger-ui-express';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve the OpenAPI YAML path relative to the project root. */
function loadSpec(): Record<string, unknown> {
  const specPath = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'contracts',
    'openapi',
    'agent-platform.yaml',
  );
  const raw = readFileSync(specPath, 'utf-8');
  return parse(raw) as Record<string, unknown>;
}

/**
 * Mount Swagger UI on the given Express router at `/api-docs`.
 * Loads the OpenAPI spec from `contracts/openapi/agent-platform.yaml`.
 */
export function mountSwaggerUI(router: Router): void {
  const spec = loadSpec();
  router.use('/api-docs', serve, setup(spec, { explorer: true }));
}
