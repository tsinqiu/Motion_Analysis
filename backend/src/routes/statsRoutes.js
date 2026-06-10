const express = require('express');
const defaultActivityService = require('../services/activityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const {
  asyncHandler,
  parseActivityType,
  parseDateRange,
  parseEnum,
  parseKeyword,
  parseYear,
  parseYearMonth
} = require('../http');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const statsCache = require('../cache/statsCache');
const { sendData } = require('../response');

const TIMELINE_GROUPS = ['day', 'month'];
const SUMMARY_RANGES = ['month', 'year', 'all'];
const TREND_RANGES = ['3m', '6m', '1y'];
const TREND_METRICS = [
  'avg_cadence_spm',
  'avg_heart_rate_bpm',
  'max_heart_rate_bpm',
  'avg_speed_mps',
  'avg_pace_sec_per_km',
  'distance_m',
  'duration_s',
  'calories',
  'activity_training_load',
  'vo2max',
  'body_battery_delta'
];
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

function parseSummaryFilters(query, user) {
  const filters = parseStatsFilters(query, user);
  const range = parseEnum(query.range, SUMMARY_RANGES, 'range', undefined);
  let date;

  if (range === 'month') {
    date = parseYearMonth(query.date, 'date');
  } else if (range === 'year') {
    date = parseYear(query.date, 'date');
  } else if (query.date !== undefined && range !== 'all') {
    throw new ApiError(400, 'date requires range=month or range=year', 'INVALID_QUERY');
  }

  const result = { ...filters };
  if (range !== undefined) {
    result.range = range;
  }
  if (date !== undefined) {
    result.date = date;
  }
  return result;
}

function parseTrendFilters(query, user) {
  const filters = parseStatsFilters(query, user);
  const metric = query.metric;
  if (!metric) {
    throw new ApiError(400, 'metric is required', 'INVALID_QUERY');
  }
  if (!TREND_METRICS.includes(metric)) {
    throw new ApiError(400, 'metric is not supported', 'UNSUPPORTED_METRIC');
  }

  return {
    ...filters,
    metric,
    range: parseEnum(query.range, TREND_RANGES, 'range', '3m'),
    endDate: parseDateRange({ end_date: query.end_date }).endDate
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
        activityService.getSummaryStats(parseSummaryFilters(req.query, req.user))
      );
    })
  );

  router.get(
    '/stats/metric-trend',
    maybeAuth,
    asyncHandler(async (req, res) => {
      await sendCachedStats(req, res, () =>
        activityService.getMetricTrend(parseTrendFilters(req.query, req.user))
      );
    })
  );

  router.get(
    '/stats/calendar',
    maybeAuth,
    asyncHandler(async (req, res) => {
      const month = parseYearMonth(req.query.month, 'month');
      if (!month) {
        throw new ApiError(400, 'month is required', 'INVALID_QUERY');
      }

      await sendCachedStats(req, res, () =>
        activityService.getCalendarStats({
          ...parseStatsFilters(req.query, req.user),
          month
        })
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
