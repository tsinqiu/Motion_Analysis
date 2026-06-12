const express = require('express');
const defaultWorkoutService = require('../services/workoutService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler, parseActivityType, parseOptionalNumber, parsePositiveId } = require('../http');
const { authenticate } = require('../middleware/authMiddleware');
const statsCache = require('../cache/statsCache');
const { sendCreated, sendData } = require('../response');

function optionalText(value, max = 200) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (text.length > max) {
    throw new ApiError(400, `text field must be at most ${max} characters`, 'VALIDATION_ERROR');
  }
  return text;
}

function parseDateTime(value, name, fallbackNow = false) {
  if ((value === undefined || value === null || value === '') && fallbackNow) {
    return new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
  }

  const text = optionalText(value, 40);
  if (!text) {
    throw new ApiError(400, `${name} is required`, 'VALIDATION_ERROR');
  }
  const normalized = text.replace('T', ' ').replace('Z', '');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match) {
    throw new ApiError(400, `${name} must be a datetime string`, 'VALIDATION_ERROR');
  }
  return `${match[1]} ${match[2]}:${match[3] || '00'}.${(match[4] || '000').padEnd(3, '0')}`;
}

function parseNumber(value, name, limits) {
  try {
    return parseOptionalNumber(value, name, limits);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(400, error.message, 'VALIDATION_ERROR');
    }
    throw error;
  }
}

function parseTrackPoint(point, index) {
  const sampleTimeUtc = parseDateTime(point.sampleTimeUtc || point.sample_time_utc, `trackPoints[${index}].sampleTimeUtc`, true);
  const latitude = parseNumber(point.latitude, 'latitude', { min: -90, max: 90 });
  const longitude = parseNumber(point.longitude, 'longitude', { min: -180, max: 180 });
  const rawSampleIndex = point.sampleIndex ?? point.sample_index;
  let sampleIndex = null;
  if (rawSampleIndex !== undefined && rawSampleIndex !== null && rawSampleIndex !== '') {
    sampleIndex = Number.parseInt(rawSampleIndex, 10);
    if (!Number.isInteger(sampleIndex) || sampleIndex < 0 || String(sampleIndex) !== String(rawSampleIndex)) {
      throw new ApiError(400, 'sampleIndex must be a non-negative integer', 'VALIDATION_ERROR');
    }
  }

  return {
    sampleIndex,
    sampleTimeUtc,
    latitude,
    longitude,
    altitudeM: parseNumber(point.altitudeM ?? point.altitude_m, 'altitudeM', { min: -500, max: 10000 }),
    distanceM: parseNumber(point.distanceM ?? point.distance_m, 'distanceM', { min: 0, max: 500000 }),
    speedMps: parseNumber(point.speedMps ?? point.speed_mps, 'speedMps', { min: 0, max: 30 }),
    heartRateBpm: parseNumber(point.heartRateBpm ?? point.heart_rate_bpm, 'heartRateBpm', { min: 30, max: 260 }),
    cadence: parseNumber(point.cadence, 'cadence', { min: 0, max: 300 }),
    powerW: parseNumber(point.powerW ?? point.power_w, 'powerW', { min: 0, max: 2500 })
  };
}

function parseTrackPoints(body) {
  const points = Array.isArray(body) ? body : body.trackPoints || body.track_points;
  if (!Array.isArray(points) || points.length === 0) {
    throw new ApiError(400, 'trackPoints must be a non-empty array', 'VALIDATION_ERROR');
  }
  if (points.length > 1000) {
    throw new ApiError(400, 'trackPoints can contain at most 1000 points per request', 'VALIDATION_ERROR');
  }

  return points.map(parseTrackPoint);
}

function parseFinishPayload(body) {
  return {
    activityName: optionalText(body.activityName || body.activity_name, 200),
    locationName: optionalText(body.locationName || body.location_name, 200),
    durationS: parseNumber(body.durationS ?? body.duration_s, 'durationS', { min: 1, max: 86400 }),
    distanceM: parseNumber(body.distanceM ?? body.distance_m, 'distanceM', { min: 0, max: 500000 }),
    calories: parseNumber(body.calories, 'calories', { min: 0, max: 20000 })
  };
}

function createWorkoutRouter({ workoutService = defaultWorkoutService, authService = defaultAuthService } = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.post(
    '/workouts',
    requireAuth,
    asyncHandler(async (req, res) => {
      const activityType = parseActivityType(req.body.activityType || req.body.activity_type);
      if (!activityType) {
        throw new ApiError(400, 'activityType is required', 'VALIDATION_ERROR');
      }
      sendCreated(
        res,
        await workoutService.createWorkout(
          {
            activityType,
            startedAt: parseDateTime(req.body.startedAt || req.body.started_at, 'startedAt', true)
          },
          req.user
        )
      );
    })
  );

  router.get(
    '/workouts/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await workoutService.getWorkout(parsePositiveId(req.params.id, 'workout id'), req.user));
    })
  );

  router.post(
    '/workouts/:id/track-points',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendCreated(
        res,
        await workoutService.appendTrackPoints(
          parsePositiveId(req.params.id, 'workout id'),
          parseTrackPoints(req.body),
          req.user
        )
      );
    })
  );

  router.post(
    '/workouts/:id/pause',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await workoutService.pauseWorkout(parsePositiveId(req.params.id, 'workout id'), req.user));
    })
  );

  router.post(
    '/workouts/:id/resume',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await workoutService.resumeWorkout(parsePositiveId(req.params.id, 'workout id'), req.user));
    })
  );

  router.post(
    '/workouts/:id/finish',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await workoutService.finishWorkout(
        parsePositiveId(req.params.id, 'workout id'),
        parseFinishPayload(req.body || {}),
        req.user
      );
      statsCache.clear();
      sendData(res, result);
    })
  );

  router.post(
    '/workouts/:id/cancel',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await workoutService.cancelWorkout(parsePositiveId(req.params.id, 'workout id'), req.user));
    })
  );

  return router;
}

module.exports = createWorkoutRouter;
