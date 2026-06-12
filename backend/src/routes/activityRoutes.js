const express = require('express');
const defaultActivityService = require('../services/activityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const {
  asyncHandler,
  parseActivityType,
  parseDateRange,
  parseEnum,
  parseOffset,
  parsePage,
  parsePageSize,
  parseKeyword,
  parsePositiveId,
  parseSort
} = require('../http');
const { sendData, sendPaged } = require('../response');

const ACTIVITY_SORT_FIELDS = [
  'local_start_time',
  'distance_m',
  'duration_s',
  'avg_heart_rate_bpm',
  'max_heart_rate_bpm',
  'avg_pace',
  'activity_training_load'
];
const OWNER_FILTERS = ['all', 'admin', 'mine'];
const SOURCE_FILTERS = ['garmin_import', 'manual_upload', 'live_workout'];

function createActivityRouter(activityService = defaultActivityService, authService = defaultAuthService) {
  const router = express.Router();

  async function requireActivity(activityId) {
    const exists = await activityService.activityExists(activityId);
    if (!exists) {
      throw new ApiError(404, 'activity not found');
    }
  }

  router.get(
    '/activities',
    optionalAuthenticate(authService),
    asyncHandler(async (req, res) => {
      const pageSize = parsePageSize(req.query.page_size ?? req.query.limit, 50, 200);
      const page = req.query.page === undefined && req.query.offset !== undefined
        ? Math.floor(parseOffset(req.query.offset) / pageSize) + 1
        : parsePage(req.query.page);
      const offset = req.query.offset !== undefined ? parseOffset(req.query.offset) : (page - 1) * pageSize;
      const { startDate, endDate } = parseDateRange(req.query, { maxDays: 1095 });
      const { sortBy, sortOrder } = parseSort(req.query, ACTIVITY_SORT_FIELDS, 'local_start_time');
      const owner = parseEnum(req.query.owner, OWNER_FILTERS, 'owner', 'all');
      const source = parseEnum(req.query.source, SOURCE_FILTERS, 'source', undefined);

      if (owner === 'mine' && !req.user) {
        throw new ApiError(401, 'login is required to filter your activities', 'AUTH_REQUIRED');
      }

      const activities = await activityService.listActivities({
        activityType: parseActivityType(req.query.activity_type),
        startDate,
        endDate,
        keyword: parseKeyword(req.query.keyword),
        source,
        owner,
        ownerUserId: req.user?.id,
        limit: pageSize,
        offset,
        page,
        pageSize,
        sortBy,
        sortOrder
      });

      sendPaged(res, activities);
    })
  );

  router.get(
    '/activities/:id',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const activity = await activityService.getActivityById(activityId);

      if (!activity) {
        throw new ApiError(404, 'activity not found');
      }

      sendData(res, activity);
    })
  );

  router.get(
    '/activities/:id/track-points',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parsePageSize(req.query.limit, 1000, 5000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const points = await activityService.getTrackPoints(activityId, { limit, offset });

      sendData(res, points);
    })
  );

  router.get(
    '/activities/:id/heart-rate',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parsePageSize(req.query.limit, 2000, 10000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const series = await activityService.getHeartRateSeries(activityId, { limit, offset });

      sendData(res, series);
    })
  );

  router.get(
    '/activities/:id/speed',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parsePageSize(req.query.limit, 2000, 10000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const series = await activityService.getSpeedSeries(activityId, { limit, offset });

      sendData(res, series);
    })
  );

  router.get(
    '/activities/:id/laps',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      await requireActivity(activityId);
      const laps = await activityService.getLaps(activityId);

      sendData(res, laps);
    })
  );

  router.get(
    '/activities/:id/zones',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      await requireActivity(activityId);
      const zones = await activityService.getZones(activityId);

      sendData(res, zones);
    })
  );

  return router;
}

module.exports = createActivityRouter;
