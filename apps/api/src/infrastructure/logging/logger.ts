export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(service: string): Logger {
  const line = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        service,
        msg,
        ...fields,
      }),
    );
  };

  return {
    info: (msg, fields) => line('info', msg, fields),
    warn: (msg, fields) => line('warn', msg, fields),
    error: (msg, fields) => line('error', msg, fields),
  };
}
