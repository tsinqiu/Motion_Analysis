const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const db = require('../db');
const { ApiError } = require('../errors');
const statsCache = require('../cache/statsCache');

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

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function assertProvider(provider) {
  if (!PROVIDERS.some((item) => item.provider === provider)) {
    throw new ApiError(400, 'provider is not supported', 'VALIDATION_ERROR');
  }
}

function normalizeConnection(provider, row) {
  const adapterStatus = provider === 'garmin' ? 'configured' : DEFAULT_PROVIDER_STATE.adapterStatus;
  return {
    status: row?.status || DEFAULT_PROVIDER_STATE.status,
    autoSync: Boolean(row?.autoSync),
    syncDirection: row?.syncDirection || DEFAULT_PROVIDER_STATE.syncDirection,
    lastSyncAt: row?.lastSyncAt || null,
    adapterStatus,
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

function parseRawJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getGarminTokenDir(user) {
  return path.join(config.garmin.tokenBaseDir, String(user.id), 'garmin');
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentYearMarchStart() {
  const year = new Date().getFullYear();
  return `${year}-03-01`;
}

function assertCredential(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${name} is required`, 'VALIDATION_ERROR');
  }
  return value.trim();
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function truncate(value, max = 900) {
  const text = String(value || '').trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || PROJECT_ROOT,
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs || config.garmin.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = timedOut ? 'process timed out' : stderr || stdout || `process exited with code ${code}`;
      reject(new Error(truncate(detail)));
    });
  });
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      current += char;
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      current += char;
      if (char === '\\' && next) {
        current += next;
        index += 1;
        continue;
      }
      if (char === quote && next === quote) {
        current += next;
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if ((char === '-' && next === '-') || char === '#') {
      lineComment = true;
      current += char;
      if (next === '-') {
        current += next;
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      current += char + next;
      index += 1;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }
  return statements;
}

async function executeSqlFile(filePath) {
  const sql = await fs.readFile(filePath, 'utf8');
  const statements = splitSqlStatements(sql);
  const connection = await db.getPool().getConnection();
  try {
    for (const statement of statements) {
      await connection.query(statement);
    }
  } finally {
    connection.release();
  }
}

async function addLog(jobId, user, provider, level, message, raw = null) {
  await db.query(
    `
      INSERT INTO SyncLogs (job_id, user_id, provider, level, message, raw_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [jobId, user.id, provider, level, truncate(message), raw ? JSON.stringify(raw) : null]
  );
}

async function getJobById(jobId) {
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
      WHERE id = ?
    `,
    [jobId]
  );
  return toJob(rows[0]);
}

async function createSkippedJob(payload, user, message) {
  return db.transaction(async (connection) => {
    const [jobResult] = await connection.query(
      `
        INSERT INTO SyncJobs (user_id, provider, job_type, status, requested_at, started_at, finished_at, activity_count, error_message)
        VALUES (?, ?, ?, 'skipped', NOW(3), NOW(3), NOW(3), 0, ?)
      `,
      [user.id, payload.provider, payload.jobType || 'manual_sync', message]
    );
    const jobId = jobResult.insertId;

    await connection.query(
      `
        INSERT INTO SyncLogs (job_id, user_id, provider, level, message)
        VALUES (?, ?, ?, 'warn', ?)
      `,
      [jobId, user.id, payload.provider, message]
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

async function getExistingGarminIds(startDate) {
  const rows = await db.query(
    `
      SELECT garmin_activity_id AS garminActivityId
      FROM Activities
      WHERE garmin_activity_id IS NOT NULL
        AND (
          start_time_utc IS NULL
          OR start_time_utc >= ?
          OR local_start_time >= ?
        )
    `,
    [`${startDate} 00:00:00`, `${startDate} 00:00:00`]
  );
  return rows.map((row) => String(row.garminActivityId)).filter(Boolean);
}

async function getGarminAccount(user) {
  const rows = await db.query(
    `
      SELECT
        status,
        last_sync_at AS lastSyncAt,
        connected_at AS connectedAt,
        raw_json AS rawJson
      FROM SyncProviderConnections
      WHERE user_id = ? AND provider = 'garmin'
      LIMIT 1
    `,
    [user.id]
  );
  const row = rows[0];
  const raw = parseRawJson(row?.rawJson);
  return {
    provider: 'garmin',
    exists: row?.status === 'connected',
    status: row?.status || 'not_connected',
    email: raw.email || null,
    isCn: Boolean(raw.isCn),
    lastSyncAt: row?.lastSyncAt || null,
    connectedAt: row?.connectedAt || null
  };
}

async function runGarminSync(jobId, user, payload) {
  const account = await getGarminAccount(user);
  if (!account.exists) {
    throw new ApiError(400, 'garmin account is not connected', 'GARMIN_ACCOUNT_NOT_CONNECTED');
  }

  const startDate = payload.startDate || getCurrentYearMarchStart();
  const endDate = payload.endDate || getTodayText();
  const jobDir = path.join(config.garmin.syncWorkDir, `user-${user.id}`, `job-${jobId}`);
  const knownIdsPath = path.join(jobDir, 'known_ids.json');
  const summaryPath = path.join(jobDir, 'download_summary.json');
  const importSqlPath = path.join(jobDir, 'import.sql');

  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(knownIdsPath, JSON.stringify(await getExistingGarminIds(startDate)), 'utf8');

  await addLog(jobId, user, 'garmin', 'info', `checking Garmin activities from ${startDate} to ${endDate}`);
  await runProcess(
    config.garmin.pythonPath,
    [
      config.garmin.downloadScriptPath,
      '--out-dir',
      jobDir,
      '--token-dir',
      getGarminTokenDir(user),
      '--start-date',
      startDate,
      '--end-date',
      endDate,
      '--json-mode',
      config.garmin.jsonMode,
      '--chunk-days',
      String(config.garmin.chunkDays),
      '--chunk-sleep',
      String(toNumber(config.garmin.chunkSleepSeconds, 10)),
      '--sleep',
      String(toNumber(config.garmin.sleepSeconds, 1.5)),
      '--extra-sleep',
      String(toNumber(config.garmin.extraSleepSeconds, 0.5)),
      '--retries',
      String(config.garmin.retries),
      '--skip-activity-ids-file',
      knownIdsPath,
      '--summary-out',
      summaryPath,
      ...(account.isCn ? ['--cn'] : [])
    ],
    {
      cwd: PROJECT_ROOT,
      timeoutMs: config.garmin.timeoutMs,
      env: { GARMIN_NON_INTERACTIVE: '1' }
    }
  );

  const summary = parseRawJson(await fs.readFile(summaryPath, 'utf8'));
  const downloadedIds = Array.isArray(summary.downloadedActivityIds) ? summary.downloadedActivityIds : [];
  if (!downloadedIds.length) {
    await addLog(jobId, user, 'garmin', 'info', 'no new Garmin activities found');
    return { importedCount: 0, startDate, endDate, summary };
  }

  await runProcess(
    config.garmin.pythonPath,
    [
      config.garmin.importScriptPath,
      '--fit-dir',
      path.join(jobDir, 'fit'),
      '--json-dir',
      path.join(jobDir, 'json'),
      '--out',
      importSqlPath
    ],
    { cwd: PROJECT_ROOT, timeoutMs: config.garmin.timeoutMs }
  );
  await executeSqlFile(importSqlPath);

  const placeholders = downloadedIds.map(() => '?').join(', ');
  const updateResult = await db.query(
    `
      UPDATE Activities
      SET owner_user_id = ?, data_source = 'garmin_sync'
      WHERE garmin_activity_id IN (${placeholders})
    `,
    [user.id, ...downloadedIds.map(String)]
  );
  statsCache.clear();

  return {
    importedCount: updateResult.affectedRows || downloadedIds.length,
    startDate,
    endDate,
    summary
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
    ...normalizeConnection(item.provider, byProvider.get(item.provider))
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

async function getProviderAccount(provider, user) {
  assertProvider(provider);
  if (provider !== 'garmin') {
    return { provider, exists: false, status: 'not_connected', email: null, lastSyncAt: null };
  }
  return getGarminAccount(user);
}

async function authorizeProvider(provider, user, payload = {}) {
  assertProvider(provider);
  if (provider === 'garmin') {
    const email = assertCredential(payload.email, 'email');
    const password = assertCredential(payload.password, 'password');
    const isCn = Boolean(payload.isCn);
    const tokenDir = getGarminTokenDir(user);

    await fs.rm(tokenDir, { recursive: true, force: true });
    try {
      await runProcess(
        config.garmin.pythonPath,
        [
          config.garmin.downloadScriptPath,
          '--token-dir',
          tokenDir,
          '--login-only',
          ...(isCn ? ['--cn'] : [])
        ],
        {
          cwd: PROJECT_ROOT,
          timeoutMs: config.garmin.timeoutMs,
          env: {
            GARMIN_NON_INTERACTIVE: '1',
            GARMIN_EMAIL: email,
            GARMIN_PASSWORD: password,
            ...(payload.mfaCode ? { GARMIN_MFA_CODE: String(payload.mfaCode) } : {})
          }
        }
      );
    } catch (error) {
      throw new ApiError(400, `garmin login failed: ${truncate(error.message || error)}`, 'GARMIN_LOGIN_FAILED');
    }

    await db.query(
      `
        INSERT INTO SyncProviderConnections (user_id, provider, status, auto_sync, sync_direction, last_sync_at, connected_at, disconnected_at, raw_json)
        VALUES (?, 'garmin', 'connected', FALSE, 'import', NULL, NOW(3), NULL, ?)
        ON DUPLICATE KEY UPDATE
          status = 'connected',
          connected_at = NOW(3),
          disconnected_at = NULL,
          raw_json = VALUES(raw_json)
      `,
      [user.id, JSON.stringify({ email, isCn })]
    );

    return getProviderAccount('garmin', user);
  }

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
  if (payload.provider !== 'garmin') {
    return createSkippedJob(payload, user, 'sync adapter is not configured; no activity was imported');
  }

  const result = await db.query(
    `
      INSERT INTO SyncJobs (user_id, provider, job_type, status, requested_at)
      VALUES (?, 'garmin', ?, 'queued', NOW(3))
    `,
    [user.id, payload.jobType || 'manual_sync']
  );
  const jobId = result.insertId;

  try {
    await db.query(`UPDATE SyncJobs SET status = 'running', started_at = NOW(3) WHERE id = ?`, [jobId]);
    const syncResult = await runGarminSync(jobId, user, payload);
    await db.query(
      `
        UPDATE SyncJobs
        SET status = 'success', finished_at = NOW(3), activity_count = ?, raw_json = ?
        WHERE id = ?
      `,
      [syncResult.importedCount, JSON.stringify(syncResult), jobId]
    );
    await db.query(
      `
        UPDATE SyncProviderConnections
        SET status = 'connected', last_sync_at = NOW(3)
        WHERE user_id = ? AND provider = 'garmin'
      `,
      [user.id]
    );
    await addLog(jobId, user, 'garmin', 'info', `Garmin sync completed; imported ${syncResult.importedCount} new activities`);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : truncate(error.message || error);
    await db.query(
      `
        UPDATE SyncJobs
        SET status = 'failed', finished_at = NOW(3), error_message = ?
        WHERE id = ?
      `,
      [message, jobId]
    );
    await addLog(jobId, user, 'garmin', 'error', message);
  }

  return getJobById(jobId);
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
  getProviderAccount,
  authorizeProvider,
  disconnectProvider,
  createJob,
  listJobs,
  listLogs
};
