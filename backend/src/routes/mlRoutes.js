const express = require('express');
const defaultMlService = require('../services/mlService');
const { ApiError } = require('../errors');
const { asyncHandler } = require('../http');
const { sendData } = require('../response');

const FEATURE_LIMITS = {
  distanceM: { min: 1, max: 200000 },
  durationS: { min: 1, max: 86400 },
  movingDurationS: { min: 1, max: 86400 },
  elapsedDurationS: { min: 1, max: 86400 },
  avgSpeedMps: { min: 0, max: 15 },
  maxSpeedMps: { min: 0, max: 20 },
  avgHeartRateBpm: { min: 30, max: 240 },
  maxHeartRateBpm: { min: 30, max: 260 },
  avgCadenceSpm: { min: 0, max: 300 },
  maxCadenceSpm: { min: 0, max: 350 },
  elevationGainM: { min: 0, max: 10000 },
  elevationLossM: { min: 0, max: 10000 },
  avgStrideLengthCm: { min: 0, max: 300 },
  normalizedPowerW: { min: 0, max: 1000 }
};

function parseRunningFeatures(body, featureNames) {
  const features = {};
  const normalizedBody = {
    ...body
  };

  if (
    (normalizedBody.maxCadenceSpm === undefined || normalizedBody.maxCadenceSpm === null || normalizedBody.maxCadenceSpm === '')
    && normalizedBody.avgCadenceSpm !== undefined
    && normalizedBody.avgCadenceSpm !== null
    && normalizedBody.avgCadenceSpm !== ''
  ) {
    normalizedBody.maxCadenceSpm = normalizedBody.avgCadenceSpm;
  }

  if (normalizedBody.normalizedPowerW === undefined || normalizedBody.normalizedPowerW === null || normalizedBody.normalizedPowerW === '') {
    normalizedBody.normalizedPowerW = normalizedBody.avgPowerW ?? 0;
  }

  for (const name of featureNames) {
    const value = normalizedBody[name];
    const limits = FEATURE_LIMITS[name];

    if (value === undefined || value === null || value === '') {
      throw new ApiError(400, `${name} is required`, 'INVALID_ML_INPUT');
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new ApiError(400, `${name} must be a number`, 'INVALID_ML_INPUT');
    }

    if (numericValue < limits.min || numericValue > limits.max) {
      throw new ApiError(
        400,
        `${name} must be from ${limits.min} to ${limits.max}`,
        'INVALID_ML_INPUT'
      );
    }

    features[name] = numericValue;
  }

  if (features.movingDurationS > features.elapsedDurationS) {
    throw new ApiError(400, 'movingDurationS must not be greater than elapsedDurationS', 'INVALID_ML_INPUT');
  }

  if (features.durationS > features.elapsedDurationS) {
    throw new ApiError(400, 'durationS must not be greater than elapsedDurationS', 'INVALID_ML_INPUT');
  }

  if (features.avgHeartRateBpm > features.maxHeartRateBpm) {
    throw new ApiError(400, 'avgHeartRateBpm must not be greater than maxHeartRateBpm', 'INVALID_ML_INPUT');
  }

  if (features.avgSpeedMps > features.maxSpeedMps) {
    throw new ApiError(400, 'avgSpeedMps must not be greater than maxSpeedMps', 'INVALID_ML_INPUT');
  }

  return features;
}

function createMlRouter(mlService = defaultMlService) {
  const router = express.Router();

  router.get(
    '/ml/health',
    asyncHandler(async (req, res) => {
      const status = await mlService.getHealth();
      sendData(res, status);
    })
  );

  router.post(
    '/ml/running-prediction',
    asyncHandler(async (req, res) => {
      const features = parseRunningFeatures(req.body, mlService.FEATURE_NAMES);
      const prediction = await mlService.runPrediction(features);
      sendData(res, prediction);
    })
  );

  return router;
}

module.exports = createMlRouter;
