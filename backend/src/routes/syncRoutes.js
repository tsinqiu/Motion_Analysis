const express = require('express');
const defaultSyncService = require('../services/syncService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseEnum, parsePage, parsePageSize, parsePositiveId } = require('../http');
const { authenticate } = require('../middleware/authMiddleware');
const { sendCreated, sendData } = require('../response');

const PROVIDERS = ['garmin', 'strava', 'coros', 'apple_health'];
const SYNC_DIRECTIONS = ['import', 'export', 'two_way'];
const JOB_TYPES = ['manual_sync', 'scheduled_sync', 'backfill'];
const JOB_STATUSES = ['queued', 'running', 'success', 'failed', 'skipped'];

function parseProvider(value) {
  return parseEnum(value, PROVIDERS, 'provider');
}

function parseBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${name} must be a boolean`, 'VALIDATION_ERROR');
  }
  return value;
}

function parseOptionalBoolean(value, name) {
  if (value === undefined) {
    return undefined;
  }
  return parseBoolean(value, name);
}

function parsePaging(query, fallback = 20, max = 100) {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.page_size, fallback, max);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function createSyncRouter({ syncService = defaultSyncService, authService = defaultAuthService } = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.get(
    '/sync/providers',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await syncService.listProviders(req.user));
    })
  );

  router.put(
    '/sync/providers/:provider/settings',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = {
        autoSync: parseBoolean(req.body.autoSync, 'autoSync'),
        syncDirection: parseEnum(req.body.syncDirection, SYNC_DIRECTIONS, 'syncDirection')
      };

      sendData(res, await syncService.updateProviderSettings(parseProvider(req.params.provider), payload, req.user));
    })
  );

  router.post(
    '/sync/providers/:provider/authorize',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = {
        email: req.body.email,
        password: req.body.password,
        mfaCode: req.body.mfaCode,
        isCn: parseOptionalBoolean(req.body.isCn, 'isCn')
      };
      sendData(res, await syncService.authorizeProvider(parseProvider(req.params.provider), req.user, payload));
    })
  );

  router.get(
    '/sync/providers/:provider/account',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await syncService.getProviderAccount(parseProvider(req.params.provider), req.user));
    })
  );

  router.post(
    '/sync/providers/:provider/disconnect',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await syncService.disconnectProvider(parseProvider(req.params.provider), req.user));
    })
  );

  router.post(
    '/sync/jobs',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = {
        provider: parseProvider(req.body.provider),
        jobType: parseEnum(req.body.jobType, JOB_TYPES, 'jobType', 'manual_sync')
      };

      sendCreated(res, await syncService.createJob(payload, req.user));
    })
  );

  router.get(
    '/sync/jobs',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(
        res,
        await syncService.listJobs(
          {
            ...parsePaging(req.query),
            provider: req.query.provider ? parseProvider(req.query.provider) : undefined,
            status: parseEnum(req.query.status, JOB_STATUSES, 'status', undefined)
          },
          req.user
        )
      );
    })
  );

  router.get(
    '/sync/logs',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(
        res,
        await syncService.listLogs(
          {
            ...parsePaging(req.query),
            provider: req.query.provider ? parseProvider(req.query.provider) : undefined,
            jobId: req.query.job_id ? parsePositiveId(req.query.job_id, 'job_id') : undefined
          },
          req.user
        )
      );
    })
  );

  return router;
}

module.exports = createSyncRouter;
