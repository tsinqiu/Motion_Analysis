const express = require('express');
const defaultActivityService = require('../services/activityService');
const { ApiError } = require('../errors');
const {
  asyncHandler,
  parseDateRange,
  parseEnum,
  parseLimit,
  parseOffset,
  parsePositiveId
} = require('../http');

const ACTIVITY_SORT_FIELDS = ['local_start_time', 'distance_m', 'duration_s', 'activity_training_load'];
const SORT_ORDERS = ['asc', 'desc'];

function createActivityRouter(activityService = defaultActivityService) {
  const router = express.Router();

  async function requireActivity(activityId) {
    const exists = await activityService.activityExists(activityId);
    if (!exists) {
      throw new ApiError(404, 'activity not found');
    }
  }

  router.get(
    '/activities',
    asyncHandler(async (req, res) => {
      const limit = parseLimit(req.query.limit, 50, 200);
      const offset = parseOffset(req.query.offset);
      const { startDate, endDate } = parseDateRange(req.query);
      const sortBy = parseEnum(req.query.sort_by, ACTIVITY_SORT_FIELDS, 'sort_by', 'local_start_time');
      const sortOrder = parseEnum(req.query.sort_order, SORT_ORDERS, 'sort_order', 'desc');
      const activities = await activityService.listActivities({
        activityType: req.query.activity_type,
        startDate,
        endDate,
        limit,
        offset,
        sortBy,
        sortOrder
      });

      res.json(activities);
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

      res.json(activity);
    })
  );

  router.get(
    '/activities/:id/track-points',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parseLimit(req.query.limit, 1000, 5000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const points = await activityService.getTrackPoints(activityId, { limit, offset });

      res.json(points);
    })
  );

  router.get(
    '/activities/:id/heart-rate',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parseLimit(req.query.limit, 2000, 10000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const series = await activityService.getHeartRateSeries(activityId, { limit, offset });

      res.json(series);
    })
  );

  router.get(
    '/activities/:id/speed',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      const limit = parseLimit(req.query.limit, 2000, 10000);
      const offset = parseOffset(req.query.offset);
      await requireActivity(activityId);
      const series = await activityService.getSpeedSeries(activityId, { limit, offset });

      res.json(series);
    })
  );

  router.get(
    '/activities/:id/laps',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      await requireActivity(activityId);
      const laps = await activityService.getLaps(activityId);

      res.json(laps);
    })
  );

  router.get(
    '/activities/:id/zones',
    asyncHandler(async (req, res) => {
      const activityId = parsePositiveId(req.params.id, 'activity id');
      await requireActivity(activityId);
      const zones = await activityService.getZones(activityId);

      res.json(zones);
    })
  );

  return router;
}

module.exports = createActivityRouter;
