import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: '请求参数不正确'
    });
    return;
  }

  if (error instanceof HttpError) {
    logger.warn({ statusCode: error.statusCode, error: message }, 'request failed');
    res.status(error.statusCode).json({
      success: false,
      message: error.expose ? message : 'Internal server error'
    });
    return;
  }

  logger.error({ error: message, stack: error instanceof Error ? error.stack : undefined }, 'request failed');
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};
