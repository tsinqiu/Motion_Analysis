const db = require('../db');

const DEFAULT_SETTINGS = {
  distanceUnit: 'km',
  weightUnit: 'kg',
  temperatureUnit: 'c',
  paceUnit: 'min_per_km',
  defaultPrivacy: 'private',
  hideMapEndpoints: true,
  healthSync: false
};

function toSettings(row) {
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    distanceUnit: row.distanceUnit || DEFAULT_SETTINGS.distanceUnit,
    weightUnit: row.weightUnit || DEFAULT_SETTINGS.weightUnit,
    temperatureUnit: row.temperatureUnit || DEFAULT_SETTINGS.temperatureUnit,
    paceUnit: row.paceUnit || DEFAULT_SETTINGS.paceUnit,
    defaultPrivacy: row.defaultPrivacy || DEFAULT_SETTINGS.defaultPrivacy,
    hideMapEndpoints: Boolean(row.hideMapEndpoints),
    healthSync: Boolean(row.healthSync)
  };
}

async function getSettings(user) {
  const rows = await db.query(
    `
      SELECT
        distance_unit AS distanceUnit,
        weight_unit AS weightUnit,
        temperature_unit AS temperatureUnit,
        pace_unit AS paceUnit,
        default_privacy AS defaultPrivacy,
        hide_map_endpoints AS hideMapEndpoints,
        health_sync AS healthSync
      FROM UserSettings
      WHERE user_id = ?
      LIMIT 1
    `,
    [user.id]
  );

  return toSettings(rows[0]);
}

async function updateSettings(payload, user) {
  const current = await getSettings(user);
  const next = { ...current, ...payload };

  await db.query(
    `
      INSERT INTO UserSettings (
        user_id, distance_unit, weight_unit, temperature_unit, pace_unit,
        default_privacy, hide_map_endpoints, health_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        distance_unit = VALUES(distance_unit),
        weight_unit = VALUES(weight_unit),
        temperature_unit = VALUES(temperature_unit),
        pace_unit = VALUES(pace_unit),
        default_privacy = VALUES(default_privacy),
        hide_map_endpoints = VALUES(hide_map_endpoints),
        health_sync = VALUES(health_sync)
    `,
    [
      user.id,
      next.distanceUnit,
      next.weightUnit,
      next.temperatureUnit,
      next.paceUnit,
      next.defaultPrivacy,
      next.hideMapEndpoints,
      next.healthSync
    ]
  );

  return next;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings
};
