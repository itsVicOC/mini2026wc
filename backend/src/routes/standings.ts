import { Router } from 'express';
import { z } from 'zod';
import { appConfig } from '../config/app.js';
import { getStandings } from '../repositories/standingRepository.js';
import { getCache, setCache } from '../utils/cache.js';
import { sendOk } from '../utils/http.js';

const querySchema = z.object({
  group: z.string().optional()
});

export const standingsRouter = Router();

standingsRouter.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const cacheKey = `standings:${query.group ?? 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) {
      sendOk(res, cached);
      return;
    }

    const data = await getStandings(query.group);
    setCache(cacheKey, data, appConfig.cacheTtlMs);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

