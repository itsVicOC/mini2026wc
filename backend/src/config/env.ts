import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FOOTBALL_DATA_API_BASE_URL: z.string().url().default('https://api.football-data.org/v4'),
  FOOTBALL_DATA_API_TOKEN: z.string().optional().default(''),
  FOOTBALL_DATA_COMPETITION: z.string().default('WC'),
  FOOTBALL_DATA_SEASON: z.coerce.number().int().default(2026),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z.string().default('mini2026wc'),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  APP_TIMEZONE: z.string().default('Asia/Shanghai'),
  ADMIN_SYNC_TOKEN: z.string().default('change-me'),
  WECHAT_APP_ID: z.string().optional().default(''),
  WECHAT_APP_SECRET: z.string().optional().default(''),
  WECHAT_SUBSCRIBE_TEMPLATE_ID: z.string().optional().default(''),
  WECHAT_SUBSCRIBE_PAGE: z.string().default('pages/home/home'),
  WECHAT_SUBSCRIBE_MATCH_KEY: z.string().default('thing1'),
  WECHAT_SUBSCRIBE_TIME_KEY: z.string().default('time2'),
  WECHAT_SUBSCRIBE_TIP_KEY: z.string().default('thing3'),
  ENABLE_SUBSCRIPTION_CRON: booleanFromEnv.default(false),
  SUBSCRIPTION_NOTIFY_CRON: z.string().default('* * * * *'),
  ENABLE_SYNC_CRON: booleanFromEnv.default(false),
  ENABLE_FULL_SYNC_CRON: booleanFromEnv.default(false),
  MATCHES_SYNC_CRON: z.string().default('* * * * *'),
  STANDINGS_SYNC_CRON: z.string().default('*/5 * * * *'),
  SCORERS_SYNC_CRON: z.string().default('*/5 * * * *'),
  TEAMS_SYNC_CRON: z.string().default('0 3 * * *'),
  FULL_SYNC_CRON: z.string().default('0 4 * * *'),
  MATCH_DETAILS_SYNC_CRON: z.string().default('* * * * *'),
  MATCH_DETAILS_SYNC_LIMIT: z.coerce.number().int().positive().default(6),
  MATCH_DETAIL_FINISHED_LOOKBACK_HOURS: z.coerce.number().int().positive().default(5),
  MATCH_DETAIL_FINISHED_SYNC_MINUTES: z.coerce.number().int().positive().default(5),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30)
});

export const env = envSchema.parse(process.env);
