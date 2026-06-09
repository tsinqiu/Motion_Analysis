const db = require('../db');

const SORT_COLUMNS = {
  local_start_time: 'a.local_start_time',
  distance_m: 'js.distance_m',
  duration_s: 'js.duration_s',
  avg_heart_rate_bpm: 'js.avg_heart_rate_bpm',
  max_heart_rate_bpm: 'js.max_heart_rate_bpm',
  avg_pace: '(js.duration_s / NULLIF(js.distance_m / 1000, 0))',
  activity_training_load: 'js.activity_training_load'
};

function buildActivityFilters({ activityType, startDate, endDate, keyword, source, owner, ownerUserId } = {}) {
  const where = [];
  const params = [];

  if (activityType) {
    where.push('a.activity_type = ?');
    params.push(activityType);
  }

  if (startDate) {
    where.push('a.local_start_time >= ?');
    params.push(`${startDate} 00:00:00.000`);
  }

  if (endDate) {
    where.push('a.local_start_time <= ?');
    params.push(`${endDate} 23:59:59.999`);
  }

  if (keyword) {
    where.push('(a.activity_name LIKE ? OR a.location_name LIKE ? OR a.activity_type LIKE ?)');
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern);
  }

  if (source) {
    where.push('a.data_source = ?');
    params.push(source);
  }

  if (owner === 'mine') {
    where.push('a.owner_user_id = ?');
    params.push(ownerUserId);
  } else if (owner === 'admin') {
    where.push("u.role = 'admin'");
  }

  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function listActivities({
  activityType,
  startDate,
  endDate,
  keyword,
  source,
  owner,
  ownerUserId,
  limit,
  offset,
  page,
  pageSize,
  sortBy,
  sortOrder
}) {
  const filters = buildActivityFilters({ activityType, startDate, endDate, keyword, source, owner, ownerUserId });
  const sortColumn = SORT_COLUMNS[sortBy] || SORT_COLUMNS.local_start_time;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countRows = await db.query(
    `
      SELECT COUNT(DISTINCT a.id) AS total
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${filters.clause}
    `,
    filters.params
  );
  const total = countRows[0]?.total || 0;

  const items = await db.query(
    `
    SELECT
      a.id,
      a.garmin_activity_id AS garminActivityId,
      a.activity_name AS activityName,
      a.activity_type AS activityType,
      a.local_start_time AS localStartTime,
      a.location_name AS locationName,
      a.owner_user_id AS ownerUserId,
      u.username AS ownerUsername,
      a.data_source AS dataSource,
      a.is_manual AS isManual,
      ROUND(s.total_distance_m / 1000, 2) AS fitDistanceKm,
      ROUND(js.distance_m / 1000, 2) AS jsonDistanceKm,
      s.total_timer_time_s AS fitTimerTimeS,
      js.moving_duration_s AS movingDurationS,
      ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2) AS avgPaceSecPerKm,
      js.avg_heart_rate_bpm AS avgHeartRateBpm,
      js.max_heart_rate_bpm AS maxHeartRateBpm,
      js.activity_training_load AS activityTrainingLoad,
      js.aerobic_training_effect AS aerobicTrainingEffect,
      js.anaerobic_training_effect AS anaerobicTrainingEffect,
      js.training_effect_label AS trainingEffectLabel,
      js.vo2max,
      js.body_battery_delta AS bodyBatteryDelta
    FROM Activities a
    LEFT JOIN Users u ON u.id = a.owner_user_id
    LEFT JOIN Sessions s ON s.activity_id = a.id
    LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
    ${filters.clause}
    ORDER BY ${sortColumn} ${direction}, a.id DESC
    LIMIT ? OFFSET ?
  `,
    [...filters.params, limit, offset]
  );

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
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
        a.owner_user_id AS ownerUserId,
        u.username AS ownerUsername,
        a.data_source AS dataSource,
        a.is_manual AS isManual,
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
      LEFT JOIN Users u ON u.id = a.owner_user_id
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

async function getHeartRateSeries(activityId, { limit, offset }) {
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
      LIMIT ? OFFSET ?
    `,
    [activityId, limit, offset]
  );
}

async function getSpeedSeries(activityId, { limit, offset }) {
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
      LIMIT ? OFFSET ?
    `,
    [activityId, limit, offset]
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

async function getActivityTypeStats(filters) {
  const activityFilters = buildActivityFilters(filters);

  return db.query(
    `
    SELECT
      a.activity_type AS activityType,
      COUNT(*) AS activityCount,
      ROUND(COUNT(*) * 100 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS percentage,
      ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
      ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
      ROUND(SUM(js.moving_duration_s) / 60, 1) AS totalMovingMin,
      ROUND(AVG(js.avg_heart_rate_bpm), 1) AS avgHeartRateBpm,
      ROUND(SUM(js.activity_training_load), 1) AS totalTrainingLoad
    FROM Activities a
    LEFT JOIN Users u ON u.id = a.owner_user_id
    LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
    ${activityFilters.clause}
    GROUP BY a.activity_type
    ORDER BY activityCount DESC
  `,
    activityFilters.params
  );
}

async function getSummaryStats(filters) {
  const activityFilters = buildActivityFilters(filters);

  const rows = await db.query(
    `
      SELECT
        COUNT(*) AS activityCount,
        ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
        ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
        ROUND(SUM(js.moving_duration_s) / 60, 1) AS totalMovingMin,
        ROUND(AVG(js.duration_s / NULLIF(js.distance_m / 1000, 0)), 2) AS avgPaceSecPerKm,
        ROUND(AVG(js.avg_heart_rate_bpm), 1) AS avgHeartRateBpm,
        MAX(js.max_heart_rate_bpm) AS maxHeartRateBpm,
        ROUND(AVG(js.avg_speed_mps), 2) AS avgSpeedMps,
        ROUND(MAX(js.distance_m) / 1000, 2) AS longestDistanceKm,
        ROUND(MIN(js.duration_s / NULLIF(js.distance_m / 1000, 0)), 2) AS fastestPaceSecPerKm,
        ROUND(SUM(js.activity_training_load), 1) AS totalTrainingLoad
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
    `,
    activityFilters.params
  );

  return rows[0];
}

async function getTimelineStats({ groupBy, ...filters }) {
  const activityFilters = buildActivityFilters(filters);
  const periodExpression =
    groupBy === 'month'
      ? "DATE_FORMAT(a.local_start_time, '%Y-%m')"
      : "DATE_FORMAT(a.local_start_time, '%Y-%m-%d')";

  return db.query(
    `
      SELECT
        ${periodExpression} AS period,
        COUNT(*) AS activityCount,
        ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
        ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
        ROUND(SUM(js.activity_training_load), 1) AS totalTrainingLoad,
        ROUND(AVG(js.avg_heart_rate_bpm), 1) AS avgHeartRateBpm
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
      GROUP BY period
      ORDER BY period ASC
    `,
    activityFilters.params
  );
}

async function getHeartRateZones(filters) {
  const activityFilters = buildActivityFilters(filters);
  const rows = await db.query(
    `
      SELECT
        z.zone_index AS zeroBasedZoneIndex,
        SUM(z.duration_s) AS durationS
      FROM ActivityZones z
      JOIN Activities a ON a.id = z.activity_id
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      WHERE z.zone_type = 'heart_rate'
        ${activityFilters.clause ? `AND ${activityFilters.clause.replace(/^WHERE\s+/, '')}` : ''}
      GROUP BY z.zone_index
      ORDER BY z.zone_index
    `,
    activityFilters.params
  );

  const totalDuration = rows.reduce((sum, row) => sum + Number(row.durationS || 0), 0);
  const labels = ['轻松', '有氧', '节奏', '阈值', '高强度'];

  return rows.map((row) => {
    const zoneNumber = Number(row.zeroBasedZoneIndex) + 1;
    const durationS = Number(row.durationS || 0);
    return {
      zone: `Zone ${zoneNumber}`,
      label: labels[zoneNumber - 1] || `Zone ${zoneNumber}`,
      durationS,
      durationMin: Math.round((durationS / 60) * 100) / 100,
      percentage: totalDuration ? Math.round((durationS * 1000) / totalDuration) / 10 : 0
    };
  });
}

async function getPersonalBests(filters) {
  const activityFilters = buildActivityFilters({ ...filters, activityType: filters.activityType || 'running' });
  const rows = await db.query(
    `
      SELECT
        ROUND(MAX(js.distance_m) / 1000, 2) AS longestDistanceKm,
        ROUND(MIN(CASE WHEN js.distance_m >= 5000 THEN js.duration_s / NULLIF(js.distance_m / 1000, 0) END), 2) AS fastest5kPaceSecPerKm,
        ROUND(MIN(CASE WHEN js.distance_m >= 10000 THEN js.duration_s / NULLIF(js.distance_m / 1000, 0) END), 2) AS fastest10kPaceSecPerKm,
        ROUND(MAX(js.activity_training_load), 1) AS highestTrainingLoad,
        MAX(js.avg_heart_rate_bpm) AS highestAvgHeartRateBpm
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
    `,
    activityFilters.params
  );

  const bests = rows[0] || {};
  return {
    activityType: filters.activityType || 'running',
    longestDistanceKm: bests.longestDistanceKm,
    fastest5kPaceSecPerKm: bests.fastest5kPaceSecPerKm,
    fastest10kPaceSecPerKm: bests.fastest10kPaceSecPerKm,
    highestTrainingLoad: bests.highestTrainingLoad,
    highestAvgHeartRateBpm: bests.highestAvgHeartRateBpm,
    note: 'pace PBs use whole-activity average pace for activities at or above the target distance'
  };
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
  getActivityTypeStats,
  getSummaryStats,
  getTimelineStats,
  getHeartRateZones,
  getPersonalBests
};
