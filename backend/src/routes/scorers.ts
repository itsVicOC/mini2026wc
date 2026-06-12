import { Router } from 'express';
import { z } from 'zod';
import { appConfig } from '../config/app.js';
import { getScorers } from '../repositories/scorerRepository.js';
import { getCache, setCache } from '../utils/cache.js';
import { sendOk } from '../utils/http.js';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const scorersRouter = Router();

scorersRouter.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const cacheKey = `scorers:${query.limit}`;
    const cached = getCache(cacheKey);
    if (cached) {
      sendOk(res, cached);
      return;
    }

    const data = await getScorers(query.limit);
    setCache(cacheKey, data, appConfig.cacheTtlMs);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

