import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message }, 'request failed');
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};

