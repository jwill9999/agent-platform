import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ['@agent-platform/model-router', '@agent-platform/contracts'],
  /** Monorepo: trace dependencies from repo root (see Next.js lockfile warning). */
  outputFileTracingRoot: path.join(__dirname, '../..'),
  /** Docker / CI: minimal Node image for `Dockerfile.web`. */
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
