import { Router } from 'express';
import { z } from 'zod';
import { appConfig } from '../config/app.js';
import { getMatches } from '../repositories/matchRepository.js';
import { getCache, setCache } from '../utils/cache.js';
import { sendOk } from '../utils/http.js';

const querySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  stage: z.string().optional(),
  group: z.string().optional(),
  status: z.string().optional()
});

export const matchesRouter = Router();

matchesRouter.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const cacheKey = `matches:${JSON.stringify(query)}`;
    const cached = getCache(cacheKey);
    if (cached) {
      sendOk(res, cached);
      return;
    }

    const data = await getMatches({
      dateFrom: query.date_from,
      dateTo: query.date_to,
      stage: query.stage,
      group: query.group,
      status: query.status
    });
    setCache(cacheKey, data, appConfig.cacheTtlMs);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

