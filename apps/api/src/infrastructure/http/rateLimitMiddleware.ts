import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for the /v1 API routes.
 *
 * Defaults: 100 requests per 60-second window, configurable via env vars.
 * Returns standard JSON error shape on limit exceeded.
 */
export const apiRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests — please try again later',
    },
  },
});
