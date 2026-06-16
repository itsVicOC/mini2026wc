import { Router } from 'express';
import { z } from 'zod';
import { appConfig } from '../config/app.js';
import { getTeamDetail } from '../repositories/teamRepository.js';
import { getCache, setCache } from '../utils/cache.js';
import { HttpError } from '../utils/errors.js';
import { sendOk } from '../utils/http.js';

const paramsSchema = z.object({
  apiTeamId: z.coerce.number().int().positive()
});

export const teamsRouter = Router();

teamsRouter.get('/:apiTeamId', async (req, res, next) => {
  try {
    const params = paramsSchema.parse(req.params);
    const cacheKey = `team-detail:${params.apiTeamId}`;
    const cached = getCache(cacheKey);
    if (cached) {
      sendOk(res, cached);
      return;
    }

    const data = await getTeamDetail(params.apiTeamId);
    if (!data) {
      throw new HttpError(404, '球队不存在');
    }

    setCache(cacheKey, data, appConfig.cacheTtlMs);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});
