import { Router } from 'express';
import { getHomeData } from '../services/homeService.js';
import { sendOk } from '../utils/http.js';

export const homeRouter = Router();

homeRouter.get('/', async (req, res, next) => {
  try {
    sendOk(res, await getHomeData({ bypassCache: Boolean(req.query.refresh) }));
  } catch (error) {
    next(error);
  }
});
