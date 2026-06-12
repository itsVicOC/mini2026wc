import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { sendError } from '../utils/http.js';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('X-Admin-Token');
  if (!token || token !== env.ADMIN_SYNC_TOKEN) {
    sendError(res, 401, 'Unauthorized');
    return;
  }
  next();
}

