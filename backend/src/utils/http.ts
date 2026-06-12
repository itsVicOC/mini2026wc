import type { Response } from 'express';

export function sendOk<T>(res: Response, data: T) {
  res.json({
    success: true,
    data
  });
}

export function sendError(res: Response, status: number, message: string) {
  res.status(status).json({
    success: false,
    message
  });
}

