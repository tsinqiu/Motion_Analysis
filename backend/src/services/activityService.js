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

const TRAINING_RANGE_DAYS = {
  '42d': 42,
  '3m': 90,
  '6m': 183,
  '1y': 365,
  '2y': 730
};

const TREND_METRICS = {
  avg_cadence_spm: {
    expression: 'ROUND(AVG(js.avg_cadence_spm), 2)',
    sampleExpression: 'COUNT(js.avg_cadence_spm)',
    having: 'COUNT(js.avg_cadence_spm) > 0'
  },
  avg_heart_rate_bpm: {
    expression: 'ROUND(AVG(js.avg_heart_rate_bpm), 1)',
    sampleExpression: 'COUNT(js.avg_heart_rate_bpm)',
    having: 'COUNT(js.avg_heart_rate_bpm) > 0'
  },
  max_heart_rate_bpm: {
    expression: 'MAX(js.max_heart_rate_bpm)',
    sampleExpression: 'COUNT(js.max_heart_rate_bpm)',
    having: 'COUNT(js.max_heart_rate_bpm) > 0'
  },
  avg_speed_mps: {
    expression: 'ROUND(AVG(js.avg_speed_mps), 2)',
    sampleExpression: 'COUNT(js.avg_speed_mps)',
    having: 'COUNT(js.avg_speed_mps) > 0'
  },
  avg_pace_sec_per_km: {
    expression: 'ROUND(SUM(js.duration_s) / NULLIF(SUM(js.distance_m) / 1000, 0), 2)',
    sampleExpression: 'COUNT(CASE WHEN js.duration_s IS NOT NULL AND js.distance_m > 0 THEN 1 END)',
    having: 'SUM(js.distance_m) > 0 AND SUM(js.duration_s) IS NOT NULL'
  },
  distance_m: {
    expression: 'ROUND(SUM(js.distance_m), 2)',
    sampleExpression: 'COUNT(js.distance_m)',
    having: 'COUNT(js.distance_m) > 0'
  },
  duration_s: {
    expression: 'ROUND(SUM(js.duration_s), 2)',
    sampleExpression: 'COUNT(js.duration_s)',
    having: 'COUNT(js.duration_s) > 0'
  },
  calories: {
    expression: 'ROUND(SUM(js.calories), 2)',
    sampleExpression: 'COUNT(js.calories)',
    having: 'COUNT(js.calories) > 0'
  },
  activity_training_load: {
    expression: 'ROUND(SUM(js.activity_training_load), 2)',
    sampleExpression: 'COUNT(js.activity_training_load)',
    having: 'COUNT(js.activity_training_load) > 0'
  },
  vo2max: {
    expression: 'ROUND(AVG(js.vo2max), 2)',
    sampleExpression: 'COUNT(js.vo2max)',
    having: 'COUNT(js.vo2max) > 0'
  },
  body_battery_delta: {
    expression: 'ROUND(SUM(js.body_battery_delta), 2)',
    sampleExpression: 'COUNT(js.body_battery_delta)',
    having: 'COUNT(js.body_battery_delta) > 0'
  }
};

function toDateString(value) {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function monthBounds(month) {
  const startDate = `${month}-01`;
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { startDate, endDate: toDateString(end) };
}

function yearBounds(year) {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function resolveRangeDates({ range, date, startDate, endDate, today = toDateString(new Date()) } = {}) {
  if (startDate || endDate) {
    return { startDate, endDate };
  }

  if (range === 'all') {
    return { startDate: undefined, endDate: undefined };
  }

  if (range === 'month') {
    return monthBounds(date || today.slice(0, 7));
  }

  if (range === 'year') {
    return yearBounds(date || today.slice(0, 4));
  }

  return { startDate, endDate };
}

function roundNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined));
}

function mapActivitySummary(row) {
  return compactRecord({
    id: row.id,
    activityName: row.activityName,
    activityType: row.activityType,
    localStartTime: row.localStartTime,
    locationName: row.locationName,
    dataSource: row.dataSource,
    isManual: row.isManual,
    distanceKm: row.distanceKm,
    distanceM: row.distanceM,
    durationS: row.durationS,
    movingDurationS: row.movingDurationS,
    calories: row.calories,
    avgHeartRateBpm: row.avgHeartRateBpm,
    activityTrainingLoad: row.activityTrainingLoad
  });
}

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
    where.push('(a.activity_name LIKE ? OR a.location_name LIKE ? OR a.activity_type LIKE ? OR a.activity_key LIKE ? OR a.garmin_activity_id LIKE ?)');
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
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
      a.activity_key AS activityKey,
      a.activity_name AS activityName,
      a.activity_type AS activityType,
      a.local_start_time AS localStartTime,
      a.start_time_utc AS startTimeUtc,
      a.location_name AS locationName,
      a.owner_user_id AS ownerUserId,
      u.username AS ownerUsername,
      a.data_source AS dataSource,
      a.is_manual AS isManual,
      ROUND(s.total_distance_m / 1000, 2) AS fitDistanceKm,
      ROUND(js.distance_m / 1000, 2) AS jsonDistanceKm,
      s.total_timer_time_s AS fitTimerTimeS,
      COALESCE(js.distance_m, s.total_distance_m) AS distanceM,
      COALESCE(js.duration_s, s.total_timer_time_s) AS durationS,
      js.moving_duration_s AS movingDurationS,
      js.elapsed_duration_s AS elapsedDurationS,
      js.calories,
      js.avg_speed_mps AS avgSpeedMps,
      js.max_speed_mps AS maxSpeedMps,
      ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2) AS avgPaceSecPerKm,
      js.avg_heart_rate_bpm AS avgHeartRateBpm,
      js.max_heart_rate_bpm AS maxHeartRateBpm,
      COALESCE(js.avg_cadence_spm, s.avg_cadence) AS avgCadenceSpm,
      js.max_cadence_spm AS maxCadenceSpm,
      COALESCE(js.avg_power_w, s.avg_power_w) AS avgPowerW,
      COALESCE(js.max_power_w, s.max_power_w) AS maxPowerW,
      COALESCE(js.normalized_power_w, s.normalized_power_w) AS normalizedPowerW,
      COALESCE(js.elevation_gain_m, s.total_ascent_m) AS elevationGainM,
      COALESCE(js.elevation_loss_m, s.total_descent_m) AS elevationLossM,
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
        a.activity_key AS activityKey,
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
        COALESCE(js.avg_cadence_spm, s.avg_cadence) AS avgCadenceSpm,
        js.max_cadence_spm AS maxCadenceSpm,
        COALESCE(js.avg_power_w, s.avg_power_w) AS avgPowerW,
        COALESCE(js.max_power_w, s.max_power_w) AS maxPowerW,
        COALESCE(js.normalized_power_w, s.normalized_power_w) AS normalizedPowerW,
        js.activity_training_load AS activityTrainingLoad,
        js.aerobic_training_effect AS aerobicTrainingEffect,
        js.anaerobic_training_effect AS anaerobicTrainingEffect,
        js.training_effect_label AS trainingEffectLabel,
        js.vo2max,
        js.body_battery_delta AS bodyBatteryDelta,
        js.water_estimated_ml AS waterEstimatedMl,
        COALESCE(js.elevation_gain_m, s.total_ascent_m) AS elevationGainM,
        COALESCE(js.elevation_loss_m, s.total_descent_m) AS elevationLossM
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

async function getDailyActivitySummaries(filters) {
  const activityFilters = buildActivityFilters(filters);
  return db.query(
    `
      SELECT
        DATE_FORMAT(a.local_start_time, '%Y-%m-%d') AS activityDate,
        a.id,
        a.activity_name AS activityName,
        a.activity_type AS activityType,
        a.local_start_time AS localStartTime,
        a.location_name AS locationName,
        a.data_source AS dataSource,
        a.is_manual AS isManual,
        ROUND(js.distance_m / 1000, 2) AS distanceKm,
        js.distance_m AS distanceM,
        js.duration_s AS durationS,
        js.moving_duration_s AS movingDurationS,
        js.calories,
        js.avg_heart_rate_bpm AS avgHeartRateBpm,
        js.activity_training_load AS activityTrainingLoad
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
      ORDER BY a.local_start_time ASC, a.id ASC
    `,
    activityFilters.params
  );
}

function groupActivitiesByDate(rows) {
  return rows.reduce((result, row) => {
    const key = row.activityDate;
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key).push(mapActivitySummary(row));
    return result;
  }, new Map());
}

async function getLatestActivityDate(filters) {
  const activityFilters = buildActivityFilters(filters);
  const rows = await db.query(
    `
      SELECT DATE_FORMAT(MAX(a.local_start_time), '%Y-%m-%d') AS latestDate
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
    `,
    activityFilters.params
  );

  return rows[0]?.latestDate || toDateString(new Date());
}

async function getLoadBalance({ range, endDate, ...filters }) {
  const days = TRAINING_RANGE_DAYS[range];
  const resolvedEndDate = endDate || await getLatestActivityDate(filters);
  const startDate = addDays(resolvedEndDate, -(days - 1));
  const warmupStartDate = addDays(startDate, -42);
  const activityFilters = buildActivityFilters({
    ...filters,
    startDate: warmupStartDate,
    endDate: resolvedEndDate
  });

  const dailyRows = await db.query(
    `
      SELECT
        DATE_FORMAT(a.local_start_time, '%Y-%m-%d') AS activityDate,
        ROUND(SUM(js.activity_training_load), 2) AS dailyTrainingLoad
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
        ${activityFilters.clause ? 'AND' : 'WHERE'} js.activity_training_load IS NOT NULL
      GROUP BY activityDate
      ORDER BY activityDate ASC
    `,
    activityFilters.params
  );

  const requestedHasData = dailyRows.some(
    (row) => row.activityDate >= startDate && row.activityDate <= resolvedEndDate
  );
  if (!requestedHasData) {
    return [];
  }

  const activities = await getDailyActivitySummaries({
    ...filters,
    startDate,
    endDate: resolvedEndDate
  });
  const activitiesByDate = groupActivitiesByDate(activities);
  const loadByDate = new Map(dailyRows.map((row) => [row.activityDate, Number(row.dailyTrainingLoad || 0)]));
  const ctlAlpha = 2 / (42 + 1);
  const atlAlpha = 2 / (7 + 1);
  let ctl = 0;
  let atl = 0;
  const result = [];

  for (let date = warmupStartDate; date <= resolvedEndDate; date = addDays(date, 1)) {
    const dailyTrainingLoad = loadByDate.get(date) || 0;
    ctl += ctlAlpha * (dailyTrainingLoad - ctl);
    atl += atlAlpha * (dailyTrainingLoad - atl);

    if (date >= startDate) {
      result.push({
        date,
        dailyTrainingLoad: roundNumber(dailyTrainingLoad, 2),
        ctl: roundNumber(ctl, 2),
        atl: roundNumber(atl, 2),
        tsb: roundNumber(ctl - atl, 2),
        activities: activitiesByDate.get(date) || []
      });
    }
  }

  return result;
}

async function getActivityTypeStats(filters) {
  const activityFilters = buildActivityFilters(filters);

  const rows = await db.query(
    `
    SELECT
      a.activity_type AS activityType,
      COUNT(*) AS activityCount,
      ROUND(SUM(js.distance_m), 2) AS totalDistanceM,
      ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
      ROUND(SUM(js.duration_s), 2) AS totalDurationS,
      ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
      ROUND(SUM(js.moving_duration_s), 2) AS totalMovingDurationS,
      ROUND(SUM(js.moving_duration_s) / 60, 1) AS totalMovingMin,
      ROUND(SUM(js.calories), 1) AS totalCalories,
      ROUND(AVG(js.duration_s / NULLIF(js.distance_m / 1000, 0)), 2) AS avgPaceSecPerKm,
      ROUND(AVG(js.avg_speed_mps), 2) AS avgSpeedMps,
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

  const totalCount = rows.reduce((sum, row) => sum + Number(row.activityCount || 0), 0);
  return rows.map((row) => ({
    ...row,
    percentage: totalCount ? roundNumber((Number(row.activityCount || 0) * 100) / totalCount, 1) : 0
  }));
}

async function getSummaryStats(filters) {
  const resolvedFilters = {
    ...filters,
    ...resolveRangeDates(filters)
  };
  const activityFilters = buildActivityFilters(resolvedFilters);

  const rows = await db.query(
    `
      SELECT
        COUNT(*) AS activityCount,
        ROUND(SUM(js.distance_m), 2) AS totalDistanceM,
        ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
        ROUND(SUM(js.duration_s), 2) AS totalDurationS,
        ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
        ROUND(SUM(js.moving_duration_s), 2) AS totalMovingDurationS,
        ROUND(SUM(js.moving_duration_s) / 60, 1) AS totalMovingMin,
        ROUND(SUM(js.calories), 1) AS totalCalories,
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

  const byActivityType = await getActivityTypeStats(resolvedFilters);
  const summary = rows[0] || {};
  const totalCalories = Number(summary.totalCalories || 0);
  return {
    ...summary,
    fatKg: roundNumber(totalCalories / 7700, 4),
    byActivityType
  };
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
        ROUND(SUM(js.distance_m), 2) AS totalDistanceM,
        ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
        ROUND(SUM(js.duration_s), 2) AS totalDurationS,
        ROUND(SUM(js.duration_s) / 60, 1) AS totalDurationMin,
        ROUND(SUM(js.calories), 1) AS totalCalories,
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

async function getMetricTrend({ metric, range, endDate, ...filters }) {
  const metricConfig = TREND_METRICS[metric];
  const days = TRAINING_RANGE_DAYS[range];
  const resolvedEndDate = endDate || await getLatestActivityDate(filters);
  const startDate = addDays(resolvedEndDate, -(days - 1));
  const activityFilters = buildActivityFilters({
    ...filters,
    startDate,
    endDate: resolvedEndDate
  });

  const rows = await db.query(
    `
      SELECT
        DATE_FORMAT(a.local_start_time, '%Y-%m-%d') AS date,
        ${metricConfig.expression} AS value,
        ${metricConfig.sampleExpression} AS sampleCount
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
      GROUP BY date
      HAVING ${metricConfig.having}
      ORDER BY date ASC
    `,
    activityFilters.params
  );

  const activities = await getDailyActivitySummaries({
    ...filters,
    startDate,
    endDate: resolvedEndDate
  });
  const activitiesByDate = groupActivitiesByDate(activities);

  return rows.map((row) => ({
    date: row.date,
    value: row.value === null || row.value === undefined ? null : Number(row.value),
    sampleCount: Number(row.sampleCount || 0),
    activities: activitiesByDate.get(row.date) || []
  }));
}

async function getCalendarStats({ month, ...filters }) {
  const { startDate, endDate } = monthBounds(month);
  const activityFilters = buildActivityFilters({
    ...filters,
    startDate,
    endDate
  });

  const rows = await db.query(
    `
      SELECT
        DATE_FORMAT(a.local_start_time, '%Y-%m-%d') AS date,
        COUNT(*) AS activityCount,
        ROUND(SUM(js.distance_m) / 1000, 2) AS totalDistanceKm,
        ROUND(SUM(js.duration_s), 2) AS totalDurationS,
        ROUND(SUM(js.calories), 1) AS totalCalories,
        GROUP_CONCAT(DISTINCT a.activity_type ORDER BY a.activity_type SEPARATOR ',') AS activityTypes
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
      GROUP BY date
      ORDER BY date ASC
    `,
    activityFilters.params
  );

  const activities = await getDailyActivitySummaries({
    ...filters,
    startDate,
    endDate
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const activitiesByDate = groupActivitiesByDate(activities);
  const days = [];

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const row = byDate.get(date);
    days.push({
      date,
      activityCount: Number(row?.activityCount || 0),
      activityTypes: row?.activityTypes ? row.activityTypes.split(',').filter(Boolean) : [],
      totalDistanceKm: Number(row?.totalDistanceKm || 0),
      totalDurationS: Number(row?.totalDurationS || 0),
      totalCalories: Number(row?.totalCalories || 0),
      totals: {
        activityCount: Number(row?.activityCount || 0),
        totalDistanceKm: Number(row?.totalDistanceKm || 0),
        totalDistanceM: roundNumber(Number(row?.totalDistanceKm || 0) * 1000, 2),
        totalDurationS: Number(row?.totalDurationS || 0),
        totalCalories: Number(row?.totalCalories || 0)
      },
      activities: activitiesByDate.get(date) || []
    });
  }

  return {
    month,
    days
  };
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

function pbRecord(key, label, row, valueField, unit) {
  if (!row || row[valueField] === null || row[valueField] === undefined) {
    return null;
  }

  return {
    key,
    label,
    value: Number(row[valueField]),
    unit,
    activityId: row.activityId,
    activityName: row.activityName,
    date: row.activityDate
  };
}

async function getBestActivity(filters, { key, label, activityType, where = '', orderBy, valueExpression, unit }) {
  const activityFilters = buildActivityFilters({ ...filters, activityType });
  const rows = await db.query(
    `
      SELECT
        a.id AS activityId,
        a.activity_name AS activityName,
        DATE_FORMAT(a.local_start_time, '%Y-%m-%d') AS activityDate,
        ${valueExpression} AS value
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
        ${activityFilters.clause ? 'AND' : 'WHERE'} ${where || '1 = 1'}
      ORDER BY ${orderBy}
      LIMIT 1
    `,
    activityFilters.params
  );

  return pbRecord(key, label, rows[0], 'value', unit);
}

async function getBestPeriodDistance(filters, { key, label, periodExpression }) {
  const activityFilters = buildActivityFilters(filters);
  const rows = await db.query(
    `
      SELECT
        ${periodExpression} AS periodKey,
        MIN(DATE_FORMAT(a.local_start_time, '%Y-%m-%d')) AS startDate,
        MAX(DATE_FORMAT(a.local_start_time, '%Y-%m-%d')) AS endDate,
        ROUND(SUM(js.distance_m) / 1000, 2) AS value
      FROM Activities a
      LEFT JOIN Users u ON u.id = a.owner_user_id
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      ${activityFilters.clause}
        ${activityFilters.clause ? 'AND' : 'WHERE'} js.distance_m IS NOT NULL
      GROUP BY periodKey
      ORDER BY SUM(js.distance_m) DESC
      LIMIT 1
    `,
    activityFilters.params
  );

  const period = rows[0];
  if (!period || period.value === null || period.value === undefined) {
    return null;
  }

  const topActivity = await getBestActivity(
    {
      ...filters,
      startDate: period.startDate,
      endDate: period.endDate
    },
    {
      key,
      label,
      where: 'js.distance_m IS NOT NULL',
      orderBy: 'js.distance_m DESC',
      valueExpression: `${Number(period.value)}`
    }
  );

  return topActivity ? { ...topActivity, value: Number(period.value), unit: 'km', date: period.startDate } : null;
}

async function getPersonalBests(filters) {
  const running = [];
  const cycling = [];
  const swimming = [];
  const overall = [];

  const add = (target, item) => {
    if (item) {
      target.push(item);
    }
  };

  add(running, await getBestActivity(filters, {
    key: 'longest_distance',
    label: '最长距离',
    activityType: 'running',
    where: 'js.distance_m IS NOT NULL',
    orderBy: 'js.distance_m DESC',
    valueExpression: 'ROUND(js.distance_m / 1000, 2)',
    unit: 'km'
  }));
  add(running, await getBestActivity(filters, {
    key: 'fastest_5k',
    label: '5公里',
    activityType: 'running',
    where: 'js.distance_m >= 5000 AND js.duration_s IS NOT NULL',
    orderBy: '(js.duration_s / NULLIF(js.distance_m / 1000, 0)) ASC',
    valueExpression: 'ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2)',
    unit: 'sec/km'
  }));
  add(running, await getBestActivity(filters, {
    key: 'fastest_10k',
    label: '10公里',
    activityType: 'running',
    where: 'js.distance_m >= 10000 AND js.duration_s IS NOT NULL',
    orderBy: '(js.duration_s / NULLIF(js.distance_m / 1000, 0)) ASC',
    valueExpression: 'ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2)',
    unit: 'sec/km'
  }));
  add(running, await getBestActivity(filters, {
    key: 'fastest_half_marathon',
    label: '半程马拉松',
    activityType: 'running',
    where: 'js.distance_m >= 21097.5 AND js.duration_s IS NOT NULL',
    orderBy: '(js.duration_s / NULLIF(js.distance_m / 1000, 0)) ASC',
    valueExpression: 'ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2)',
    unit: 'sec/km'
  }));
  add(running, await getBestActivity(filters, {
    key: 'fastest_marathon',
    label: '全程马拉松',
    activityType: 'running',
    where: 'js.distance_m >= 42195 AND js.duration_s IS NOT NULL',
    orderBy: '(js.duration_s / NULLIF(js.distance_m / 1000, 0)) ASC',
    valueExpression: 'ROUND(js.duration_s / NULLIF(js.distance_m / 1000, 0), 2)',
    unit: 'sec/km'
  }));
  add(running, await getBestActivity(filters, {
    key: 'highest_training_load',
    label: '最高训练负荷',
    activityType: 'running',
    where: 'js.activity_training_load IS NOT NULL',
    orderBy: 'js.activity_training_load DESC',
    valueExpression: 'ROUND(js.activity_training_load, 1)',
    unit: 'load'
  }));
  add(running, await getBestActivity(filters, {
    key: 'highest_avg_heart_rate',
    label: '最高平均心率',
    activityType: 'running',
    where: 'js.avg_heart_rate_bpm IS NOT NULL',
    orderBy: 'js.avg_heart_rate_bpm DESC',
    valueExpression: 'js.avg_heart_rate_bpm',
    unit: 'bpm'
  }));

  add(cycling, await getBestActivity(filters, {
    key: 'longest_distance',
    label: '最长距离',
    activityType: 'cycling',
    where: 'js.distance_m IS NOT NULL',
    orderBy: 'js.distance_m DESC',
    valueExpression: 'ROUND(js.distance_m / 1000, 2)',
    unit: 'km'
  }));
  add(cycling, await getBestActivity(filters, {
    key: 'highest_elevation_gain',
    label: '最大爬升',
    activityType: 'cycling',
    where: 'js.elevation_gain_m IS NOT NULL',
    orderBy: 'js.elevation_gain_m DESC',
    valueExpression: 'ROUND(js.elevation_gain_m, 1)',
    unit: 'm'
  }));
  add(cycling, await getBestActivity(filters, {
    key: 'fastest_avg_speed',
    label: '最快均速',
    activityType: 'cycling',
    where: 'js.avg_speed_mps IS NOT NULL',
    orderBy: 'js.avg_speed_mps DESC',
    valueExpression: 'ROUND(js.avg_speed_mps * 3.6, 2)',
    unit: 'km/h'
  }));
  add(cycling, await getBestActivity(filters, {
    key: 'highest_training_load',
    label: '最高训练负荷',
    activityType: 'cycling',
    where: 'js.activity_training_load IS NOT NULL',
    orderBy: 'js.activity_training_load DESC',
    valueExpression: 'ROUND(js.activity_training_load, 1)',
    unit: 'load'
  }));

  add(swimming, await getBestActivity(filters, {
    key: 'longest_distance',
    label: '最长距离',
    activityType: 'swimming',
    where: 'js.distance_m IS NOT NULL',
    orderBy: 'js.distance_m DESC',
    valueExpression: 'ROUND(js.distance_m / 1000, 2)',
    unit: 'km'
  }));

  add(overall, await getBestPeriodDistance(filters, {
    key: 'highest_single_day_distance',
    label: '单日最高运动距离',
    periodExpression: "DATE_FORMAT(a.local_start_time, '%Y-%m-%d')"
  }));
  add(overall, await getBestPeriodDistance(filters, {
    key: 'highest_single_week_distance',
    label: '单周最高运动距离',
    periodExpression: 'YEARWEEK(a.local_start_time, 3)'
  }));
  add(overall, await getBestPeriodDistance(filters, {
    key: 'highest_single_month_distance',
    label: '单月最高运动距离',
    periodExpression: "DATE_FORMAT(a.local_start_time, '%Y-%m')"
  }));
  add(overall, await getBestActivity(filters, {
    key: 'highest_calories',
    label: '最高卡路里',
    where: 'js.calories IS NOT NULL',
    orderBy: 'js.calories DESC',
    valueExpression: 'ROUND(js.calories, 1)',
    unit: 'kcal'
  }));

  return {
    steps: [],
    running,
    cycling,
    swimming,
    overall
  };
}

async function getDashboardOverview(filters = {}) {
  const today = await getLatestActivityDate(filters);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const recentActivities = await listActivities({
    ...filters,
    limit: 6,
    offset: 0,
    page: 1,
    pageSize: 6,
    sortBy: 'local_start_time',
    sortOrder: 'desc'
  });
  const monthlySummary = await getSummaryStats({
    ...filters,
    range: 'month',
    date: month
  });
  const yearlySummary = await getSummaryStats({
    ...filters,
    range: 'year',
    date: year
  });
  const trainingLoad = await getLoadBalance({
    ...filters,
    range: '3m',
    endDate: today
  });
  const personalBests = await getPersonalBests(filters);

  return {
    recentActivities: recentActivities.items,
    monthlySummary,
    yearlySummary,
    trainingLoad: trainingLoad.slice(-30),
    personalBests
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
  getMetricTrend,
  getCalendarStats,
  getHeartRateZones,
  getLoadBalance,
  getPersonalBests,
  getDashboardOverview
};
