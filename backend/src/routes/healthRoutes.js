const express = require('express');
const defaultHealthService = require('../services/healthService');
const { asyncHandler } = require('../http');
const statsCache = require('../cache/statsCache');
const { sendData } = require('../response');

function createHealthRouter(healthService = defaultHealthService) {
  const router = express.Router();

  router.get(
    '/health',
    asyncHandler(async (req, res) => {
      const database = await healthService.checkDatabase();
      sendData(res, {
        status: database.ok ? 'ok' : 'degraded',
        database,
        cache: {
          stats: statsCache.stats()
        }
      });
    })
  );

  return router;
}

module.exports = createHealthRouter;
