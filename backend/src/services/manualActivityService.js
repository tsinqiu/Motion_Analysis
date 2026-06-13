const db = require('../db');
const { ApiError } = require('../errors');

const SUMMARY_COLUMNS = [
  'duration_s',
  'moving_duration_s',
  'elapsed_duration_s',
  'distance_m',
  'calories',
  'avg_speed_mps',
  'max_speed_mps',
  'avg_heart_rate_bpm',
  'max_heart_rate_bpm',
  'avg_cadence_spm',
  'max_cadence_spm',
  'avg_power_w',
  'max_power_w',
  'normalized_power_w',
  'activity_training_load',
  'elevation_gain_m',
  'elevation_loss_m',
  'avg_stride_length_cm',
  'raw_json'
];

function canManage(user, activity) {
  return user.role === 'admin' || activity.ownerUserId === user.id;
}

function toSummaryValues(payload) {
  return [
    payload.durationS,
    payload.movingDurationS,
    payload.elapsedDurationS,
    payload.distanceM,
    payload.calories,
    payload.avgSpeedMps,
    payload.maxSpeedMps,
    payload.avgHeartRateBpm,
    payload.maxHeartRateBpm,
    payload.avgCadenceSpm,
    payload.maxCadenceSpm,
    payload.avgPowerW,
    payload.maxPowerW,
    payload.normalizedPowerW,
    payload.activityTrainingLoad,
    payload.elevationGainM,
    payload.elevationLossM,
    payload.avgStrideLengthCm,
    JSON.stringify({ manualUpload: payload })
  ];
}

async function getManualActivity(activityId, user) {
  const rows = await db.query(
    `
      SELECT
        a.id,
        a.activity_name AS activityName,
        a.activity_type AS activityType,
        a.local_start_time AS localStartTime,
        a.location_name AS locationName,
        a.owner_user_id AS ownerUserId,
        a.data_source AS dataSource,
        a.is_manual AS isManual,
        js.duration_s AS durationS,
        js.moving_duration_s AS movingDurationS,
        js.elapsed_duration_s AS elapsedDurationS,
        js.distance_m AS distanceM,
        js.calories,
        js.avg_speed_mps AS avgSpeedMps,
        js.max_speed_mps AS maxSpeedMps,
        js.avg_heart_rate_bpm AS avgHeartRateBpm,
        js.max_heart_rate_bpm AS maxHeartRateBpm,
        js.avg_cadence_spm AS avgCadenceSpm,
        js.max_cadence_spm AS maxCadenceSpm,
        js.avg_power_w AS avgPowerW,
        js.max_power_w AS maxPowerW,
        js.normalized_power_w AS normalizedPowerW,
        js.activity_training_load AS activityTrainingLoad,
        js.elevation_gain_m AS elevationGainM,
        js.elevation_loss_m AS elevationLossM,
        js.avg_stride_length_cm AS avgStrideLengthCm
      FROM Activities a
      LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
      WHERE a.id = ? AND a.is_manual = TRUE
    `,
    [activityId]
  );

  const activity = rows[0];
  if (!activity) {
    throw new ApiError(404, 'manual activity not found', 'MANUAL_ACTIVITY_NOT_FOUND');
  }

  if (!canManage(user, activity)) {
    throw new ApiError(403, 'you cannot access this manual activity', 'FORBIDDEN');
  }

  return activity;
}

async function createManualActivity(payload, user) {
  const activityId = await db.transaction(async (connection) => {
    const activityKey = `manual:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const [activityResult] = await connection.query(
      `
        INSERT INTO Activities (
          activity_key, activity_name, activity_type, local_start_time, start_time_utc,
          location_name, owner_user_id, data_source, is_manual, match_status, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual_upload', TRUE, 'manual_upload', ?)
      `,
      [
        activityKey,
        payload.activityName,
        payload.activityType,
        payload.localStartTime,
        payload.startTimeUtc || payload.localStartTime,
        payload.locationName,
        user.id,
        JSON.stringify({ manualUpload: payload })
      ]
    );

    const insertedActivityId = activityResult.insertId;
    await connection.query(
      `
        INSERT INTO ActivitySummaries (activity_id, ${SUMMARY_COLUMNS.join(', ')})
        VALUES (?, ${SUMMARY_COLUMNS.map(() => '?').join(', ')})
      `,
      [insertedActivityId, ...toSummaryValues(payload)]
    );

    return insertedActivityId;
  });

  return getManualActivity(activityId, user);
}

async function updateManualActivity(activityId, payload, user) {
  await getManualActivity(activityId, user);

  await db.transaction(async (connection) => {
    await connection.query(
      `
        UPDATE Activities
        SET activity_name = ?, activity_type = ?, local_start_time = ?, start_time_utc = ?,
            location_name = ?, raw_json = ?
        WHERE id = ? AND is_manual = TRUE
      `,
      [
        payload.activityName,
        payload.activityType,
        payload.localStartTime,
        payload.startTimeUtc || payload.localStartTime,
        payload.locationName,
        JSON.stringify({ manualUpload: payload }),
        activityId
      ]
    );

    await connection.query(
      `
        UPDATE ActivitySummaries
        SET ${SUMMARY_COLUMNS.map((column) => `${column} = ?`).join(', ')}
        WHERE activity_id = ?
      `,
      [...toSummaryValues(payload), activityId]
    );

  });

  return getManualActivity(activityId, user);
}

async function deleteManualActivity(activityId, user) {
  await getManualActivity(activityId, user);
  await db.query('DELETE FROM Activities WHERE id = ? AND is_manual = TRUE', [activityId]);
  return { deleted: true, id: activityId };
}

module.exports = {
  createManualActivity,
  getManualActivity,
  updateManualActivity,
  deleteManualActivity
};
