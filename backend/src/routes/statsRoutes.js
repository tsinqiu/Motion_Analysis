const express = require('express');
const defaultActivityService = require('../services/activityService');
const { asyncHandler, parseDateRange, parseEnum } = require('../http');

const TIMELINE_GROUPS = ['day', 'month'];

function parseStatsFilters(query) {
  const { startDate, endDate } = parseDateRange(query);
  return {
    activityType: query.activity_type,
    startDate,
    endDate
  };
}

function createStatsRouter(activityService = defaultActivityService) {
  const router = express.Router();

  router.get(
    '/stats/activity-types',
    asyncHandler(async (req, res) => {
      const stats = await activityService.getActivityTypeStats(parseStatsFilters(req.query));
      res.json(stats);
    })
  );

  router.get(
    '/stats/summary',
    asyncHandler(async (req, res) => {
      const stats = await activityService.getSummaryStats(parseStatsFilters(req.query));
      res.json(stats);
    })
  );

  router.get(
    '/stats/timeline',
    asyncHandler(async (req, res) => {
      const groupBy = parseEnum(req.query.group_by, TIMELINE_GROUPS, 'group_by', 'day');
      const stats = await activityService.getTimelineStats({
        ...parseStatsFilters(req.query),
        groupBy
      });
      res.json(stats);
    })
  );

  return router;
}

module.exports = createStatsRouter;
