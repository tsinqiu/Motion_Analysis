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

function parsePageSize(value, fallback = 50, max = 200) {
  return parseLimit(value, fallback, max);
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

function parsePage(value) {
  if (value === undefined) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(value)) {
    throw new ApiError(400, 'page must be a positive integer', 'INVALID_QUERY');
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

function parseDateRange(query, { maxDays } = {}) {
  const startDate = parseDate(query.start_date, 'start_date');
  const endDate = parseDate(query.end_date, 'end_date');

  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(400, 'start_date must be earlier than or equal to end_date', 'INVALID_QUERY');
  }

  if (startDate && endDate && maxDays) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    const days = Math.floor((end - start) / 86400000) + 1;
    if (days > maxDays) {
      throw new ApiError(400, `date range must be ${maxDays} days or less`, 'INVALID_QUERY');
    }
  }

  return { startDate, endDate };
}

function parseKeyword(value, max = 100) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const text = String(value).trim();
  if (text.length > max) {
    throw new ApiError(400, `keyword must be at most ${max} characters`, 'INVALID_QUERY');
  }

  return text || undefined;
}

function parseActivityType(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const text = String(value).trim();
  if (!/^[a-zA-Z0-9_ -]{1,80}$/.test(text)) {
    throw new ApiError(400, 'activity_type contains unsupported characters', 'INVALID_QUERY');
  }

  return text;
}

function parseSort(query, allowedFields, defaultField = 'local_start_time') {
  return {
    sortBy: parseEnum(query.sort_by, allowedFields, 'sort_by', defaultField),
    sortOrder: parseEnum(query.sort_order, ['asc', 'desc'], 'sort_order', 'desc')
  };
}

function parseOptionalNumber(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new ApiError(400, `${name} must be from ${min} to ${max}`, 'INVALID_INPUT');
  }

  return numeric;
}

module.exports = {
  asyncHandler,
  parsePositiveId,
  parseLimit,
  parsePageSize,
  parseOffset,
  parsePage,
  parseDate,
  parseEnum,
  parseDateRange,
  parseKeyword,
  parseActivityType,
  parseSort,
  parseOptionalNumber
};
