const config = require('../config');

const store = new Map();

function stableObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableObject(value[key]);
      return result;
    }, {});
}

function makeKey(req) {
  return JSON.stringify({
    path: req.path,
    query: stableObject(req.query),
    user: req.user ? { id: req.user.id, role: req.user.role } : null
  });
}

function get(req) {
  const ttlMs = config.cache.statsTtlSeconds * 1000;
  if (ttlMs <= 0) {
    return null;
  }

  const key = makeKey(req);
  const cached = store.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return cached.value;
}

function set(req, value) {
  const ttlMs = config.cache.statsTtlSeconds * 1000;
  if (ttlMs <= 0) {
    return value;
  }

  store.set(makeKey(req), {
    value,
    expiresAt: Date.now() + ttlMs
  });
  return value;
}

function clear() {
  store.clear();
}

function stats() {
  return {
    enabled: config.cache.statsTtlSeconds > 0,
    ttlSeconds: config.cache.statsTtlSeconds,
    size: store.size
  };
}

module.exports = {
  get,
  set,
  clear,
  stats
};
