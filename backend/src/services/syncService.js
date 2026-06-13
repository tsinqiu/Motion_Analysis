const db = require('../db');
const { ApiError } = require('../errors');

const PROVIDERS = [
  { provider: 'garmin', name: 'Garmin Connect' },
  { provider: 'strava', name: 'Strava' },
  { provider: 'coros', name: 'COROS' },
  { provider: 'apple_health', name: 'Apple Health' }
];

const DEFAULT_PROVIDER_STATE = {
  status: 'not_connected',
  autoSync: false,
  syncDirection: 'import',
  lastSyncAt: null,
  adapterStatus: 'not_configured',
  authorizationUrl: null
};

function assertProvider(provider) {
  if (!PROVIDERS.some((item) => item.provider === provider)) {
    throw new ApiError(400, 'provider is not supported', 'VALIDATION_ERROR');
  }
}

function normalizeConnection(row) {
  return {
    status: row?.status || DEFAULT_PROVIDER_STATE.status,
    autoSync: Boolean(row?.autoSync),
    syncDirection: row?.syncDirection || DEFAULT_PROVIDER_STATE.syncDirection,
    lastSyncAt: row?.lastSyncAt || null,
    adapterStatus: 'not_configured',
    authorizationUrl: null
  };
}

function toJob(row) {
  return {
    id: row.id,
    provider: row.provider,
    jobType: row.jobType,
    status: row.status,
    requestedAt: row.requestedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    activityCount: row.activityCount,
    errorMessage: row.errorMessage
  };
}

function toLog(row) {
  return {
    id: row.id,
    jobId: row.jobId,
    provider: row.provider,
    level: row.level,
    message: row.message,
    createdAt: row.createdAt
  };
}

async function listProviders(user) {
  const rows = await db.query(
    `
      SELECT
        provider,
        status,
        auto_sync AS autoSync,
        sync_direction AS syncDirection,
        last_sync_at AS lastSyncAt
      FROM SyncProviderConnections
      WHERE user_id = ?
    `,
    [user.id]
  );
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return PROVIDERS.map((item) => ({
    ...item,
    ...DEFAULT_PROVIDER_STATE,
    ...normalizeConnection(byProvider.get(item.provider))
  }));
}

async function updateProviderSettings(provider, payload, user) {
  assertProvider(provider);
  await db.query(
    `
      INSERT INTO SyncProviderConnections (user_id, provider, status, auto_sync, sync_direction)
      VALUES (?, ?, 'not_connected', ?, ?)
      ON DUPLICATE KEY UPDATE
        auto_sync = VALUES(auto_sync),
        sync_direction = VALUES(sync_direction)
    `,
    [user.id, provider, payload.autoSync, payload.syncDirection]
  );

  return (await listProviders(user)).find((item) => item.provider === provider);
}

async function authorizeProvider(provider, user) {
  assertProvider(provider);
  await db.query(
    `
      INSERT INTO SyncProviderConnections (user_id, provider, status, auto_sync, sync_direction, connected_at)
      VALUES (?, ?, 'pending_authorization', FALSE, 'import', NULL)
      ON DUPLICATE KEY UPDATE
        status = 'pending_authorization',
        disconnected_at = NULL
    `,
    [user.id, provider]
  );

  return {
    provider,
    status: 'pending_authorization',
    authorizationUrl: null,
    adapterStatus: 'not_configured'
  };
}

async function disconnectProvider(provider, user) {
  assertProvider(provider);
  await db.query(
    `
      INSERT INTO SyncProviderConnections (user_id, provider, status, auto_sync, sync_direction, disconnected_at)
      VALUES (?, ?, 'not_connected', FALSE, 'import', NOW(3))
      ON DUPLICATE KEY UPDATE
        status = 'not_connected',
        auto_sync = FALSE,
        disconnected_at = NOW(3)
    `,
    [user.id, provider]
  );

  return {
    provider,
    status: 'not_connected',
    disconnected: true
  };
}

async function createJob(payload, user) {
  assertProvider(payload.provider);

  return db.transaction(async (connection) => {
    const [jobResult] = await connection.query(
      `
        INSERT INTO SyncJobs (user_id, provider, job_type, status, requested_at, started_at, finished_at, activity_count, error_message)
        VALUES (?, ?, ?, 'skipped', NOW(3), NOW(3), NOW(3), 0, ?)
      `,
      [user.id, payload.provider, payload.jobType || 'manual_sync', 'sync adapter is not configured']
    );
    const jobId = jobResult.insertId;

    await connection.query(
      `
        INSERT INTO SyncLogs (job_id, user_id, provider, level, message)
        VALUES (?, ?, ?, 'warn', ?)
      `,
      [jobId, user.id, payload.provider, 'sync adapter is not configured; no activity was imported']
    );

    const [rows] = await connection.query(
      `
        SELECT
          id,
          provider,
          job_type AS jobType,
          status,
          requested_at AS requestedAt,
          started_at AS startedAt,
          finished_at AS finishedAt,
          activity_count AS activityCount,
          error_message AS errorMessage
        FROM SyncJobs
        WHERE id = ?
      `,
      [jobId]
    );

    return toJob(rows[0]);
  });
}

async function listJobs(filters, user) {
  const where = ['user_id = ?'];
  const params = [user.id];
  if (filters.provider) {
    assertProvider(filters.provider);
    where.push('provider = ?');
    params.push(filters.provider);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  const countRows = await db.query(`SELECT COUNT(*) AS total FROM SyncJobs WHERE ${where.join(' AND ')}`, params);
  const rows = await db.query(
    `
      SELECT
        id,
        provider,
        job_type AS jobType,
        status,
        requested_at AS requestedAt,
        started_at AS startedAt,
        finished_at AS finishedAt,
        activity_count AS activityCount,
        error_message AS errorMessage
      FROM SyncJobs
      WHERE ${where.join(' AND ')}
      ORDER BY requested_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, filters.pageSize, filters.offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map(toJob),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

async function listLogs(filters, user) {
  const where = ['user_id = ?'];
  const params = [user.id];
  if (filters.provider) {
    assertProvider(filters.provider);
    where.push('provider = ?');
    params.push(filters.provider);
  }
  if (filters.jobId) {
    where.push('job_id = ?');
    params.push(filters.jobId);
  }

  const countRows = await db.query(`SELECT COUNT(*) AS total FROM SyncLogs WHERE ${where.join(' AND ')}`, params);
  const rows = await db.query(
    `
      SELECT
        id,
        job_id AS jobId,
        provider,
        level,
        message,
        created_at AS createdAt
      FROM SyncLogs
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, filters.pageSize, filters.offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map(toLog),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

module.exports = {
  PROVIDERS,
  listProviders,
  updateProviderSettings,
  authorizeProvider,
  disconnectProvider,
  createJob,
  listJobs,
  listLogs
};
