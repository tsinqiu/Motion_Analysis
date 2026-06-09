const express = require('express');
const defaultActivityService = require('../services/activityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseDateRange, parseEnum } = require('../http');
const { optionalAuthenticate } = require('../middleware/authMiddleware');

const TIMELINE_GROUPS = ['day', 'month'];
const OWNER_FILTERS = ['all', 'admin', 'mine'];
const SOURCE_FILTERS = ['garmin_import', 'manual_upload'];

function keyword(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const text = String(value).trim();
  if (text.length > 100) {
    throw new ApiError(400, 'keyword must be at most 100 characters', 'INVALID_QUERY');
  }
  return text || undefined;
}

function parseStatsFilters(query, user) {
  const { startDate, endDate } = parseDateRange(query);
  const owner = parseEnum(query.owner, OWNER_FILTERS, 'owner', 'all');
  if (owner === 'mine' && !user) {
    throw new ApiError(401, 'login is required to filter your activities', 'AUTH_REQUIRED');
  }

  return {
    activityType: query.activity_type,
    startDate,
    endDate,
    keyword: keyword(query.keyword),
    source: parseEnum(query.source, SOURCE_FILTERS, 'source', undefined),
    owner,
    ownerUserId: user?.id
  };
}

function createStatsRouter(activityService = defaultActivityService, authService = defaultAuthService) {
  const router = express.Router();
  const maybeAuth = optionalAuthenticate(authService);

  router.get(
    '/stats/activity-types',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const stats = await activityService.getActivityTypeStats(parseStatsFilters(req.query, req.user));
      res.json(stats);
    })
  );

  router.get(
    '/stats/summary',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const stats = await activityService.getSummaryStats(parseStatsFilters(req.query, req.user));
      res.json(stats);
    })
  );

  router.get(
    '/stats/timeline',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const groupBy = parseEnum(req.query.group_by, TIMELINE_GROUPS, 'group_by', 'day');
      const stats = await activityService.getTimelineStats({
        ...parseStatsFilters(req.query, req.user),
        groupBy
      });
      res.json(stats);
    })
  );

  router.get(
    '/stats/heart-rate-zones',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const stats = await activityService.getHeartRateZones(parseStatsFilters(req.query, req.user));
      res.json(stats);
    })
  );

  router.get(
    '/stats/personal-bests',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const stats = await activityService.getPersonalBests(parseStatsFilters(req.query, req.user));
      res.json(stats);
    })
  );

  return router;
}

module.exports = createStatsRouter;
