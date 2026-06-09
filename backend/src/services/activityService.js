const db = require('../db');

async function listActivities({ activityType, limit, offset }) {
  const where = [];
  const params = [];

  if (activityType) {
    where.push('a.activity_type = ?');
    params.push(activityType);
  }

  const sql = `
    SELECT
      a.id,
      a.garmin_activity_id AS garminActivityId,
      a.activity_name AS activityName,
      a.activity_type AS activityType,
      a.local_start_time AS localStartTime,
      a.location_name AS locationName,
      ROUND(s.total_distance_m / 1000, 2) AS fitDistanceKm,
      ROUND(js.distance_m / 1000, 2) AS jsonDistanceKm,
      s.total_timer_time_s AS fitTimerTimeS,
      js.moving_duration_s AS movingDurationS,
      js.activity_training_load AS activityTrainingLoad,
      js.aerobic_training_effect AS aerobicTrainingEffect,
      js.anaerobic_training_effect AS anaerobicTrainingEffect,
      js.training_effect_label AS trainingEffectLabel,
      js.vo2max,
      js.body_battery_delta AS bodyBatteryDelta
    FROM Activities a
    LEFT JOIN Sessions s ON s.activity_id = a.id
    LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY a.local_start_time DESC
    LIMIT ? OFFSET ?
  `;

  return db.query(sql, [...params, limit, offset]);
}

async function getActivityById(activityId) {
  const rows = await db.query(
    `
      SELECT
        a.id,
        a.garmin_activity_id AS garminActivityId,
        a.activity_name AS activityName,
        a.activity_type AS activityType,
        a.local_start_time AS localStartTime,
        a.start_time_utc AS startTimeUtc,
        a.location_name AS locationName,
        a.start_latitude AS startLatitude,
        a.start_longitude AS startLongitude,
        a.end_latitude AS endLatitude,
        a.end_longitude AS endLongitude,
        a.match_status AS matchStatus,
        s.total_elapsed_time_s AS fitElapsedTimeS,
        s.total_timer_time_s AS fitTimerTimeS,
        js.elapsed_duration_s AS elapsedDurationS,
        js.duration_s AS durationS,
        js.moving_duration_s AS movingDurationS,
        js.distance_m AS distanceM,
        js.calories,
        js.avg_speed_mps AS avgSpeedMps,
        js.max_speed_mps AS maxSpeedMps,
        js.avg_heart_rate_bpm AS avgHeartRateBpm,
        js.max_heart_rate_bpm AS maxHeartRateBpm,
        s.avg_cadence AS fitSingleLegCadence,
        js.avg_cadence_spm AS avgCadenceSpm,
        js.avg_power_w AS avgPowerW,
        js.max_power_w AS maxPowerW,
        js.normalized_power_w AS normalizedPowerW,
        js.activity_training_load AS activityTrainingLoad,
        js.aerobic_training_effect AS aerobicTrainingEffect,
        js.anaerobic_training_effect AS anaerobicTrainingEffect,
        js.training_effect_label AS trainingEffectLabel,
        js.vo2max,
        js.body_battery_delta AS bodyBatteryDelta,
        js.water_estimated_ml AS waterEstimatedMl,
        js.elevation_gain_m AS elevationGainM,
        js.elevation_loss_m AS elevationLossM
      FROM Activities a
      LEFT JOIN Sessions s ON s.activity_id = a.id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      WHERE a.id = ?
    `,
    [activityId]
  );

  return rows[0] || null;
}

async function activityExists(activityId) {
  const rows = await db.query('SELECT id FROM Activities WHERE id = ? LIMIT 1', [activityId]);
  return rows.length > 0;
}

async function getTrackPoints(activityId, { limit, offset }) {
  return db.query(
    `
      SELECT
        sample_index AS sampleIndex,
        sample_time_utc AS sampleTimeUtc,
        latitude,
        longitude,
        altitude_m AS altitudeM,
        distance_m AS distanceM,
        speed_mps AS speedMps,
        heart_rate_bpm AS heartRateBpm,
        cadence AS fitSingleLegCadence,
        power_w AS powerW
      FROM TrackPoints
      WHERE activity_id = ?
      ORDER BY sample_index
      LIMIT ? OFFSET ?
    `,
    [activityId, limit, offset]
  );
}

async function getHeartRateSeries(activityId) {
  return db.query(
    `
      SELECT
        sample_time_utc AS sampleTimeUtc,
        heart_rate_bpm AS heartRateBpm
      FROM TrackPoints
      WHERE activity_id = ?
        AND sample_time_utc IS NOT NULL
        AND heart_rate_bpm IS NOT NULL
      ORDER BY sample_index
    `,
    [activityId]
  );
}

async function getSpeedSeries(activityId) {
  return db.query(
    `
      SELECT
        sample_time_utc AS sampleTimeUtc,
        speed_mps AS speedMps
      FROM TrackPoints
      WHERE activity_id = ?
        AND sample_time_utc IS NOT NULL
        AND speed_mps IS NOT NULL
      ORDER BY sample_index
    `,
    [activityId]
  );
}

async function getLaps(activityId) {
  return db.query(
    `
      SELECT
        lap_index AS lapIndex,
        start_time_utc AS startTimeUtc,
        total_distance_m AS totalDistanceM,
        total_timer_time_s AS totalTimerTimeS,
        avg_speed_mps AS avgSpeedMps,
        avg_heart_rate_bpm AS avgHeartRateBpm,
        avg_power_w AS avgPowerW
      FROM Laps
      WHERE activity_id = ?
      ORDER BY lap_index
    `,
    [activityId]
  );
}

async function getZones(activityId) {
  return db.query(
    `
      SELECT
        zone_type AS zoneType,
        zone_index AS zoneIndex,
        duration_s AS durationS,
        ROUND(duration_s / 60, 2) AS durationMin,
        source_field AS sourceField
      FROM ActivityZones
      WHERE activity_id = ?
      ORDER BY zone_type, zone_index
    `,
    [activityId]
  );
}

async function getActivityTypeStats() {
  return db.query(`
    SELECT
      a.activity_type AS activityType,
      COUNT(*) AS activityCount,
      ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
      ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
      ROUND(SUM(js.moving_duration_s) / 60, 1) AS totalMovingMin,
      ROUND(AVG(js.avg_heart_rate_bpm), 1) AS avgHeartRateBpm,
      ROUND(SUM(js.activity_training_load), 1) AS totalTrainingLoad
    FROM Activities a
    LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
    GROUP BY a.activity_type
    ORDER BY activityCount DESC
  `);
}

module.exports = {
  listActivities,
  getActivityById,
  activityExists,
  getTrackPoints,
  getHeartRateSeries,
  getSpeedSeries,
  getLaps,
  getZones,
  getActivityTypeStats
};
