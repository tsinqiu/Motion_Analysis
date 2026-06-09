const { ApiError } = require('./errors');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parsePositiveId(value, name = 'id') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new ApiError(400, `${name} must be a positive integer`, 'INVALID_PATH_PARAM');
  }
  return parsed;
}

function parseLimit(value, fallback = 1000, max = 5000) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max || String(parsed) !== String(value)) {
    throw new ApiError(400, `limit must be an integer from 1 to ${max}`, 'INVALID_QUERY');
  }

  return parsed;
}

function parseOffset(value) {
  if (value === undefined) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== String(value)) {
    throw new ApiError(400, 'offset must be an integer greater than or equal to 0', 'INVALID_QUERY');
  }

  return parsed;
}

function parseDate(value, name) {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new ApiError(400, `${name} must use YYYY-MM-DD format`, 'INVALID_QUERY');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${name} must be a valid date`, 'INVALID_QUERY');
  }

  return value;
}

function parseEnum(value, allowed, name, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (!allowed.includes(value)) {
    throw new ApiError(400, `${name} must be one of: ${allowed.join(', ')}`, 'INVALID_QUERY');
  }

  return value;
}

function parseDateRange(query) {
  const startDate = parseDate(query.start_date, 'start_date');
  const endDate = parseDate(query.end_date, 'end_date');

  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(400, 'start_date must be earlier than or equal to end_date', 'INVALID_QUERY');
  }

  return { startDate, endDate };
}

module.exports = {
  asyncHandler,
  parsePositiveId,
  parseLimit,
  parseOffset,
  parseDate,
  parseEnum,
  parseDateRange
};
