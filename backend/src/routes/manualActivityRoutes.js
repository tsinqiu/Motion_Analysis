const express = require('express');
const defaultManualActivityService = require('../services/manualActivityService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseActivityType, parseOptionalNumber, parsePositiveId } = require('../http');
const { authenticate } = require('../middleware/authMiddleware');
const statsCache = require('../cache/statsCache');
const { sendCreated, sendData } = require('../response');

const NUMERIC_LIMITS = {
  distanceM: { min: 0, max: 200000, required: true },
  durationS: { min: 1, max: 86400, required: true },
  movingDurationS: { min: 1, max: 86400 },
  elapsedDurationS: { min: 1, max: 86400 },
  calories: { min: 0, max: 10000 },
  avgSpeedMps: { min: 0, max: 15 },
  maxSpeedMps: { min: 0, max: 20 },
  avgHeartRateBpm: { min: 30, max: 240 },
  maxHeartRateBpm: { min: 30, max: 260 },
  avgCadenceSpm: { min: 0, max: 300 },
  maxCadenceSpm: { min: 0, max: 350 },
  avgPowerW: { min: 0, max: 1000 },
  maxPowerW: { min: 0, max: 2000 },
  normalizedPowerW: { min: 0, max: 1000 },
  activityTrainingLoad: { min: 0, max: 2000 },
  elevationGainM: { min: 0, max: 10000 },
  elevationLossM: { min: 0, max: 10000 },
  avgStrideLengthCm: { min: 0, max: 300 }
};
const DISTANCE_REQUIRED_TYPES = new Set([
  'running',
  'street_running',
  'track_running',
  'treadmill_running',
  'cycling',
  'road_biking',
  'indoor_cycling'
]);

function optionalText(value, max = 200) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (text.length > max) {
    throw new ApiError(400, `text field must be at most ${max} characters`, 'INVALID_MANUAL_ACTIVITY');
  }
  return text;
}

function requiredText(value, name, max = 120) {
  const text = optionalText(value, max);
  if (!text) {
    throw new ApiError(400, `${name} is required`, 'INVALID_MANUAL_ACTIVITY');
  }
  return text;
}

function parseDateTime(value, name) {
  const text = requiredText(value, name, 40).replace('T', ' ').replace('Z', '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/);
  if (!match) {
    throw new ApiError(400, `${name} must be a datetime string`, 'INVALID_MANUAL_ACTIVITY');
  }
  return `${match[1]} ${match[2]}:${match[3] || '00'}.000`;
}

function parseNumberField(body, name, limits) {
  const value = body[name];
  if (value === undefined || value === null || value === '') {
    if (limits.required) {
      throw new ApiError(400, `${name} is required`, 'INVALID_MANUAL_ACTIVITY');
    }
    return null;
  }

  try {
    return parseOptionalNumber(value, name, limits);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.statusCode, error.message, 'INVALID_MANUAL_ACTIVITY');
    }
    throw error;
  }
}

function parseManualActivity(body) {
  const payload = {
    activityType: parseActivityType(body.activityType || body.activity_type),
    activityName: optionalText(body.activityName || body.activity_name, 200),
    localStartTime: parseDateTime(body.localStartTime || body.local_start_time, 'localStartTime'),
    startTimeUtc: body.startTimeUtc || body.start_time_utc ? parseDateTime(body.startTimeUtc || body.start_time_utc, 'startTimeUtc') : null,
    locationName: optionalText(body.locationName || body.location_name, 200)
  };

  if (!payload.activityType) {
    throw new ApiError(400, 'activityType is required', 'INVALID_MANUAL_ACTIVITY');
  }

  for (const [name, limits] of Object.entries(NUMERIC_LIMITS)) {
    payload[name] = parseNumberField(body, name, limits);
  }

  if (!payload.activityName) {
    payload.activityName = `Manual ${payload.activityType}`;
  }
  if (!payload.movingDurationS) {
    payload.movingDurationS = payload.durationS;
  }
  if (!payload.elapsedDurationS) {
    payload.elapsedDurationS = payload.durationS;
  }
  if (payload.avgSpeedMps === null && payload.distanceM && payload.durationS) {
    payload.avgSpeedMps = payload.distanceM / payload.durationS;
  }

  if (DISTANCE_REQUIRED_TYPES.has(payload.activityType) && payload.distanceM <= 0) {
    throw new ApiError(400, 'distanceM must be greater than 0 for distance activities', 'INVALID_MANUAL_ACTIVITY');
  }
  if (payload.movingDurationS > payload.elapsedDurationS || payload.durationS > payload.elapsedDurationS) {
    throw new ApiError(400, 'durations must be consistent', 'INVALID_MANUAL_ACTIVITY');
  }
  if (payload.avgHeartRateBpm && payload.maxHeartRateBpm && payload.avgHeartRateBpm > payload.maxHeartRateBpm) {
    throw new ApiError(400, 'avgHeartRateBpm must not be greater than maxHeartRateBpm', 'INVALID_MANUAL_ACTIVITY');
  }
  if (payload.avgSpeedMps && payload.maxSpeedMps && payload.avgSpeedMps > payload.maxSpeedMps) {
    throw new ApiError(400, 'avgSpeedMps must not be greater than maxSpeedMps', 'INVALID_MANUAL_ACTIVITY');
  }

  return payload;
}

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    throw new ApiError(403, 'only administrators can manage manual activities', 'FORBIDDEN');
  }
}

function createManualActivityRouter({
  manualActivityService = defaultManualActivityService,
  authService = defaultAuthService
} = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.post(
    '/manual-activities',
    requireAuth,
    asyncHandler(async (req, res) => {
      requireAdmin(req.user);
      const activity = await manualActivityService.createManualActivity(parseManualActivity(req.body), req.user);
      statsCache.clear();
      sendCreated(res, activity);
    })
  );

  router.get(
    '/manual-activities/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const activity = await manualActivityService.getManualActivity(parsePositiveId(req.params.id), req.user);
      sendData(res, activity);
    })
  );

  router.put(
    '/manual-activities/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      requireAdmin(req.user);
      const activity = await manualActivityService.updateManualActivity(
        parsePositiveId(req.params.id),
        parseManualActivity(req.body),
        req.user
      );
      statsCache.clear();
      sendData(res, activity);
    })
  );

  router.delete(
    '/manual-activities/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      requireAdmin(req.user);
      const result = await manualActivityService.deleteManualActivity(parsePositiveId(req.params.id), req.user);
      statsCache.clear();
      sendData(res, result);
    })
  );

  return router;
}

module.exports = createManualActivityRouter;
