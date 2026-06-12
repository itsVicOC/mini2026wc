import { Router } from 'express';
import { appConfig } from '../config/app.js';
import { getMatches } from '../repositories/matchRepository.js';
import { getCache, setCache } from '../utils/cache.js';
import { sendOk } from '../utils/http.js';

export const knockoutsRouter = Router();

knockoutsRouter.get('/', async (_req, res, next) => {
  try {
    const cacheKey = 'knockouts';
    const cached = getCache(cacheKey);
    if (cached) {
      sendOk(res, cached);
      return;
    }

    const matches = await getMatches({ knockoutOnly: true });
    const grouped = groupByStage(matches);
    setCache(cacheKey, grouped, appConfig.cacheTtlMs);
    sendOk(res, grouped);
  } catch (error) {
    next(error);
  }
});

function groupByStage(matches: Array<{ stage: string | null }>) {
  const groups = new Map<string, Array<{ stage: string | null }>>();
  for (const match of matches) {
    const stage = match.stage ?? 'UNKNOWN';
    const group = groups.get(stage) ?? [];
    group.push(match);
    groups.set(stage, group);
  }
  return Array.from(groups.entries()).map(([stage, stageMatches]) => ({
    stage,
    matches: stageMatches
  }));
}

