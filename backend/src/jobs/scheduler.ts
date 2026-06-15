import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { syncAll, syncMatches, syncScorers, syncStandings, syncTeams } from '../services/syncService.js';
import { sendDueMatchSubscriptions } from '../services/subscriptionService.js';

const runningJobs = new Set<string>();

export function startScheduler() {
  if (!env.ENABLE_SYNC_CRON) {
    logger.info('sync cron is disabled');
  } else {
    cron.schedule(env.MATCHES_SYNC_CRON, async () => {
      await runOnce('cron-matches', () => syncMatches('cron-matches'));
    });

    cron.schedule(env.STANDINGS_SYNC_CRON, async () => {
      await runOnce('cron-standings', () => syncStandings('cron-standings'));
    });

    cron.schedule(env.SCORERS_SYNC_CRON, async () => {
      await runOnce('cron-scorers', () => syncScorers('cron-scorers'));
    });

    cron.schedule(env.TEAMS_SYNC_CRON, async () => {
      await runOnce('cron-teams', () => syncTeams('cron-teams'));
    });

    if (env.ENABLE_FULL_SYNC_CRON) {
      cron.schedule(env.FULL_SYNC_CRON, async () => {
        await runOnce('cron-full', () => syncAll('cron-full'));
      });
    }

    logger.info(
      {
        matches: env.MATCHES_SYNC_CRON,
        standings: env.STANDINGS_SYNC_CRON,
        scorers: env.SCORERS_SYNC_CRON,
        teams: env.TEAMS_SYNC_CRON,
        fullSyncEnabled: env.ENABLE_FULL_SYNC_CRON,
        fullSync: env.FULL_SYNC_CRON
      },
      'sync cron started'
    );
  }

  if (!env.ENABLE_SUBSCRIPTION_CRON) {
    logger.info('subscription cron is disabled');
    return;
  }

  cron.schedule(env.SUBSCRIPTION_NOTIFY_CRON, async () => {
    await runOnce('cron-subscriptions', sendDueMatchSubscriptions);
  });

  logger.info({ subscriptions: env.SUBSCRIPTION_NOTIFY_CRON }, 'subscription cron started');
}

async function runOnce(jobName: string, task: () => Promise<unknown>) {
  if (runningJobs.has(jobName)) {
    logger.warn({ jobName }, 'scheduled job skipped because previous run is still active');
    return;
  }

  runningJobs.add(jobName);
  try {
    logger.info({ jobName }, 'running scheduled job');
    await task();
  } catch (error) {
    logger.error(
      { jobName, error: error instanceof Error ? error.message : String(error) },
      'scheduled job failed'
    );
  } finally {
    runningJobs.delete(jobName);
  }
}
