import type { ResultSetHeader } from 'mysql2';
import { pool } from '../db/pool.js';
import { toMysqlDateTime } from '../utils/time.js';

export type SyncStatus = 'success' | 'failed' | 'running';

export async function createSyncLog(jobName: string, resource: string) {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO sync_logs (job_name, resource, started_at, \`status\`)
      VALUES (:jobName, :resource, :startedAt, 'running')
    `,
    {
      jobName,
      resource,
      startedAt: toMysqlDateTime(new Date())
    }
  );
  return result.insertId;
}

export async function finishSyncLog(
  id: number,
  params: {
    status: SyncStatus;
    requestCount: number;
    upsertCount: number;
    errorMessage?: string;
  }
) {
  await pool.execute(
    `
      UPDATE sync_logs
      SET
        finished_at = :finishedAt,
        \`status\` = :status,
        request_count = :requestCount,
        upsert_count = :upsertCount,
        error_message = :errorMessage
      WHERE id = :id
    `,
    {
      id,
      finishedAt: toMysqlDateTime(new Date()),
      status: params.status,
      requestCount: params.requestCount,
      upsertCount: params.upsertCount,
      errorMessage: params.errorMessage ?? null
    }
  );
}

export async function getLatestSuccessfulSync() {
  const [rows] = await pool.query(
    `
      SELECT resource, MAX(finished_at) AS finished_at
      FROM sync_logs
      WHERE \`status\` = 'success'
      GROUP BY resource
    `
  );
  return rows as Array<{ resource: string; finished_at: string | null }>;
}
