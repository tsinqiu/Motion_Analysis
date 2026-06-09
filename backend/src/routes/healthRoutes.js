const express = require('express');
const defaultHealthService = require('../services/healthService');
const { asyncHandler } = require('../http');

function createHealthRouter(healthService = defaultHealthService) {
  const router = express.Router();

  router.get(
    '/health',
    asyncHandler(async (req, res) => {
      const database = await healthService.checkDatabase();
      res.json({
        status: database.ok ? 'ok' : 'degraded',
        database
      });
    })
  );

  return router;
}

module.exports = createHealthRouter;
