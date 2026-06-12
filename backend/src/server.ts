import { createApp } from './app.js';
import { env } from './config/env.js';
import { startScheduler } from './jobs/scheduler.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server started');
  });

  startScheduler();
}

bootstrap().catch((error) => {
  logger.error({ error }, 'failed to start server');
  process.exit(1);
});
