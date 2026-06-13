const express = require('express');
const defaultSettingsService = require('../services/settingsService');
const defaultAuthService = require('../services/authService');
const { ApiError } = require('../errors');
const { asyncHandler } = require('../http');
const { authenticate } = require('../middleware/authMiddleware');
const { sendData } = require('../response');

const ALLOWED = {
  distanceUnit: ['km', 'mi'],
  weightUnit: ['kg', 'lb'],
  temperatureUnit: ['c', 'f'],
  paceUnit: ['min_per_km', 'min_per_mile'],
  defaultPrivacy: ['private', 'followers', 'public']
};

function parseBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, `${name} must be a boolean`, 'VALIDATION_ERROR');
  }
  return value;
}

function parseSettingEnum(body, name) {
  if (body[name] === undefined) {
    return undefined;
  }
  if (!ALLOWED[name].includes(body[name])) {
    throw new ApiError(400, `${name} is not supported`, 'VALIDATION_ERROR');
  }
  return body[name];
}

function parseSettingsPatch(body) {
  const payload = {};
  for (const name of Object.keys(ALLOWED)) {
    const value = parseSettingEnum(body, name);
    if (value !== undefined) {
      payload[name] = value;
    }
  }

  for (const name of ['hideMapEndpoints', 'healthSync']) {
    if (body[name] !== undefined) {
      payload[name] = parseBoolean(body[name], name);
    }
  }

  return payload;
}

function createSettingsRouter({ settingsService = defaultSettingsService, authService = defaultAuthService } = {}) {
  const router = express.Router();
  const requireAuth = authenticate(authService);

  router.get(
    '/settings',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await settingsService.getSettings(req.user));
    })
  );

  router.put(
    '/settings',
    requireAuth,
    asyncHandler(async (req, res) => {
      sendData(res, await settingsService.updateSettings(parseSettingsPatch(req.body), req.user));
    })
  );

  return router;
}

module.exports = createSettingsRouter;
