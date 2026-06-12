import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { inspectFootballDataStandings, syncAll } from '../services/syncService.js';
import { sendOk } from '../utils/http.js';

export const adminRouter = Router();

adminRouter.post('/sync', adminAuth, async (_req, res, next) => {
  try {
    sendOk(res, await syncAll('manual'));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/inspect/standings', adminAuth, async (_req, res, next) => {
  try {
    sendOk(res, await inspectFootballDataStandings());
  } catch (error) {
    next(error);
  }
});
