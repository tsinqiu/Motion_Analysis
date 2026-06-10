const express = require('express');
const defaultActivityService = require('../services/activityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseActivityType, parseDate, parseEnum, parseKeyword } = require('../http');
const { optionalAuthenticate } = require('../middleware/authMiddleware');
const statsCache = require('../cache/statsCache');
const { sendData } = require('../response');

const TRAINING_RANGES = ['3m', '6m', '1y'];
const OWNER_FILTERS = ['all', 'admin', 'mine'];
const SOURCE_FILTERS = ['garmin_import', 'manual_upload'];

function parseTrainingFilters(query, user) {
  const owner = parseEnum(query.owner, OWNER_FILTERS, 'owner', 'all');
  if (owner === 'mine' && !user) {
    throw new ApiError(401, 'login is required to filter your activities', 'AUTH_REQUIRED');
  }

  return {
    activityType: parseActivityType(query.activity_type),
    keyword: parseKeyword(query.keyword),
    source: parseEnum(query.source, SOURCE_FILTERS, 'source', undefined),
    owner,
    ownerUserId: user?.id,
    range: parseEnum(query.range, TRAINING_RANGES, 'range', '3m'),
    endDate: parseDate(query.end_date, 'end_date')
  };
}

async function sendCached(req, res, loader) {
  const cached = statsCache.get(req);
  if (cached) {
    sendData(res, cached, { cache: { hit: true } });
    return;
  }

  const data = await loader();
  statsCache.set(req, data);
  sendData(res, data, { cache: { hit: false } });
}

function createTrainingRouter(activityService = defaultActivityService, authService = defaultAuthService) {
  const router = express.Router();

  router.get(
    '/training/load-balance',
    optionalAuthenticate(authService),
    asyncHandler(async (req, res) => {
      await sendCached(req, res, () =>
        activityService.getLoadBalance(parseTrainingFilters(req.query, req.user))
      );
    })
  );

  return router;
}

module.exports = createTrainingRouter;
