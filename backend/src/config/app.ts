import { env } from './env.js';

export const appConfig = {
  competitionCode: env.FOOTBALL_DATA_COMPETITION,
  season: env.FOOTBALL_DATA_SEASON,
  totalMatches: 104,
  timezone: env.APP_TIMEZONE,
  cacheTtlMs: env.CACHE_TTL_SECONDS * 1000
};

