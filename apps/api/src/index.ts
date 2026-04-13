import { createApp } from './infrastructure/http/createApp.js';
import { createLogger } from './infrastructure/logging/logger.js';

const log = createLogger('api');
const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
  log.info('api.listen', { host, port });
});
