const { ApiError } = require('./errors');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parsePositiveId(value, name = 'id') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  return parsed;
}

function parseLimit(value, fallback = 1000, max = 5000) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max || String(parsed) !== String(value)) {
    throw new ApiError(400, `limit must be an integer from 1 to ${max}`);
  }

  return parsed;
}

function parseOffset(value) {
  if (value === undefined) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== String(value)) {
    throw new ApiError(400, 'offset must be an integer greater than or equal to 0');
  }

  return parsed;
}

module.exports = {
  asyncHandler,
  parsePositiveId,
  parseLimit,
  parseOffset
};
