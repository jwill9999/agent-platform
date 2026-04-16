import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import type { RateLimitSettings } from '@agent-platform/contracts';

const RATE_LIMIT_MESSAGE = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests — please try again later',
  },
};

export function parsePositiveInt(envVal: string | undefined, fallback: number): number {
  const parsed = Number(envVal);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createLimiter(config: RateLimitSettings): RequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });
}

/**
 * Dynamic rate limiter that can be reconfigured at runtime.
 * Wraps express-rate-limit so settings changes take effect immediately.
 */
export function createDynamicRateLimiter(): {
  middleware: RequestHandler;
  reconfigure: (config: RateLimitSettings) => void;
  getConfig: () => RateLimitSettings;
} {
  let config: RateLimitSettings = {
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 100),
  };
  let limiter = createLimiter(config);

  const middleware: RequestHandler = (req, res, next) => {
    limiter(req, res, next);
  };

  const reconfigure = (newConfig: RateLimitSettings): void => {
    config = { ...newConfig };
    limiter = createLimiter(config);
  };

  const getConfig = (): RateLimitSettings => ({ ...config });

  return { middleware, reconfigure, getConfig };
}
