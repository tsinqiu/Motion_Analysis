const express = require('express');
const defaultActivityService = require('../services/activityService');
const { asyncHandler } = require('../http');

function createStatsRouter(activityService = defaultActivityService) {
  const router = express.Router();

  router.get(
    '/stats/activity-types',
    asyncHandler(async (req, res) => {
      const stats = await activityService.getActivityTypeStats();
      res.json(stats);
    })
  );

  return router;
}

module.exports = createStatsRouter;
