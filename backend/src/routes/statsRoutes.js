const express = require('express');
const defaultActivityService = require('../services/activityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseActivityType, parseDateRange, parseEnum, parseKeyword } = require('../http');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const statsCache = require('../cache/statsCache');
const { sendData } = require('../response');

const TIMELINE_GROUPS = ['day', 'month'];
const OWNER_FILTERS = ['all', 'admin', 'mine'];
const SOURCE_FILTERS = ['garmin_import', 'manual_upload'];

function parseStatsFilters(query, user) {
  const { startDate, endDate } = parseDateRange(query, { maxDays: 1095 });
  const owner = parseEnum(query.owner, OWNER_FILTERS, 'owner', 'all');
  if (owner === 'mine' && !user) {
    throw new ApiError(401, 'login is required to filter your activities', 'AUTH_REQUIRED');
  }

  return {
    activityType: parseActivityType(query.activity_type),
    startDate,
    endDate,
    keyword: parseKeyword(query.keyword),
    source: parseEnum(query.source, SOURCE_FILTERS, 'source', undefined),
    owner,
    ownerUserId: user?.id
  };
}

async function sendCachedStats(req, res, loader) {
  const cached = statsCache.get(req);
  if (cached) {
    sendData(res, cached, { cache: { hit: true } });
    return;
  }

  const data = await loader();
  statsCache.set(req, data);
  sendData(res, data, { cache: { hit: false } });
}

function createStatsRouter(activityService = defaultActivityService, authService = defaultAuthService) {
  const router = express.Router();
  const maybeAuth = optionalAuthenticate(authService);

  router.get(
    '/stats/activity-types',
    maybeAuth,
    asyncHandler(async (req, res) => {
      await sendCachedStats(req, res, () =>
        activityService.getActivityTypeStats(parseStatsFilters(req.query, req.user))
      );
    })
  );

  router.get(
    '/stats/summary',
    maybeAuth,
    asyncHandler(async (req, res) => {
      await sendCachedStats(req, res, () =>
        activityService.getSummaryStats(parseStatsFilters(req.query, req.user))
      );
    })
  );

  router.get(
    '/stats/timeline',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const groupBy = parseEnum(req.query.group_by, TIMELINE_GROUPS, 'group_by', 'day');
      await sendCachedStats(req, res, () =>
        activityService.getTimelineStats({
          ...parseStatsFilters(req.query, req.user),
          groupBy
        })
      );
    })
  );

  router.get(
    '/stats/heart-rate-zones',
    maybeAuth,
    asyncHandler(async (req, res) => {
      await sendCachedStats(req, res, () =>
        activityService.getHeartRateZones(parseStatsFilters(req.query, req.user))
      );
    })
  );

  router.get(
    '/stats/personal-bests',
    maybeAuth,
    asyncHandler(async (req, res) => {
      await sendCachedStats(req, res, () =>
        activityService.getPersonalBests(parseStatsFilters(req.query, req.user))
      );
    })
  );

  return router;
}

module.exports = createStatsRouter;
