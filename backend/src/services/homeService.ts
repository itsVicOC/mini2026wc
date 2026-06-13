import { appConfig } from '../config/app.js';
import { getMatches, getProgress } from '../repositories/matchRepository.js';
import { getLatestSuccessfulSync } from '../repositories/syncLogRepository.js';
import { addDays, todayInBeijing } from '../utils/time.js';
import { getCache, setCache } from '../utils/cache.js';

export async function getHomeData(options: { bypassCache?: boolean } = {}) {
  const cacheKey = 'home';
  const cached = options.bypassCache ? null : getCache<HomeData>(cacheKey);
  if (cached) {
    return cached;
  }

  const today = todayInBeijing();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const [progress, todayMatches, weekMatches, syncs] = await Promise.all([
    getProgress(),
    getMatches({ dateFrom: today, dateTo: today }),
    getMatches({ dateFrom: tomorrow, dateTo: weekEnd }),
    getLatestSuccessfulSync()
  ]);

  const data = {
    timezone: appConfig.timezone,
    progress,
    todayMatches,
    weekMatches: groupMatchesByDate(weekMatches),
    lastSync: syncs
  };

  setCache(cacheKey, data, appConfig.cacheTtlMs);
  return data;
}

type HomeData = Awaited<ReturnType<typeof createHomeDataType>>;

function createHomeDataType() {
  return Promise.resolve({
    timezone: '',
    progress: {
      total: 0,
      finished: 0,
      pending: 0,
      live: 0,
      progressPercent: 0
    },
    todayMatches: [] as unknown[],
    weekMatches: [] as Array<{ date: string; matches: unknown[] }>,
    lastSync: [] as Array<{ resource: string; finished_at: string | null }>
  });
}

function groupMatchesByDate(matches: Array<{ beijingDate: string }>) {
  const groups = new Map<string, Array<{ beijingDate: string }>>();
  for (const match of matches) {
    const group = groups.get(match.beijingDate) ?? [];
    group.push(match);
    groups.set(match.beijingDate, group);
  }
  return Array.from(groups.entries()).map(([date, groupedMatches]) => ({
    date,
    matches: groupedMatches
  }));
}
