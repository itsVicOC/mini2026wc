import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './utils/logger.js';
import { homeRouter } from './routes/home.js';
import { matchesRouter } from './routes/matches.js';
import { standingsRouter } from './routes/standings.js';
import { knockoutsRouter } from './routes/knockouts.js';
import { scorersRouter } from './routes/scorers.js';
import { adminRouter } from './routes/admin.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { errorHandler } from './middleware/errorHandler.js';
import { pingDatabase } from './db/pool.js';
import { toBeijingDateTimeText } from './utils/time.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    const now = new Date();
    res.json({
      success: true,
      data: {
        status: 'ok',
        revision: 'subscription-select-star-20260616',
        serverTimeUtc: now.toISOString(),
        serverTimeBeijing: toBeijingDateTimeText(now)
      }
    });
  });

  app.get('/health/db', async (_req, res) => {
    try {
      await pingDatabase();
      res.json({
        success: true,
        data: {
          status: 'ok'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Database connection failed'
      });
    }
  });

  app.use('/api/home', homeRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/standings', standingsRouter);
  app.use('/api/knockouts', knockoutsRouter);
  app.use('/api/scorers', scorersRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/admin', adminRouter);

  app.use(errorHandler);

  return app;
}
