import {
  activities,
  activityTypeStats,
  findActivity,
  laps,
  trackPoints,
} from '@/mock/activities'
import { apiClient, saveAuthToken, unwrapApiResponse, useMockData } from '@/services/http'

const ACTIVITY_TYPE_LABELS = {
  running: '跑步',
  street_running: '跑步',
  track_running: '田径跑步',
  treadmill_running: '跑步',
  cycling: '骑行',
  road_biking: '骑行',
  indoor_cycling: '骑行',
  strength_training: '力量训练',
  floor_climbing: '爬楼',
}

function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value)
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

function kmToMeters(value) {
  const number = toNumber(value)
  return number === null ? null : number * 1000
}

function minutesToSeconds(value) {
  const number = toNumber(value)
  return number === null ? null : number * 60
}

function displayActivityType(value) {
  return ACTIVITY_TYPE_LABELS[value] || value || '--'
}

function normalizeCollection(value, normalizer) {
  if (Array.isArray(value)) {
    return value.map(normalizer)
  }
  if (value && typeof value === 'object') {
    return normalizer(value)
  }
  return value
}

async function requestEnvelope(path, mockValue, normalizer, options = {}) {
  if (useMockData()) {
    return {
      data: normalizeCollection(cloneValue(mockValue), normalizer),
      meta: options.mockMeta || {},
    }
  }

  const response = await apiClient.get(path, { params: options.params })
  const envelope = unwrapApiResponse(response.data)
  return {
    data: normalizeCollection(envelope.data, normalizer),
    meta: envelope.meta || {},
  }
}

async function postEnvelope(path, body) {
  const response = await apiClient.post(path, body)
  return unwrapApiResponse(response.data)
}

function normalizeActivity(row = {}) {
  const rawType = firstDefined(row.raw_activity_type, row.activity_type, row.activityType)
  const distanceM = firstDefined(
    row.total_distance_m,
    row.distance_m,
    row.distanceM,
    kmToMeters(row.jsonDistanceKm),
    kmToMeters(row.fitDistanceKm),
    kmToMeters(row.distanceKm),
  )
  const durationS = firstDefined(
    row.total_timer_time_s,
    row.duration_s,
    row.durationS,
    row.fitTimerTimeS,
    row.movingDurationS,
    row.total_moving_time_s,
  )
  const avgSpeedMps = firstDefined(
    row.avg_speed_mps,
    row.avgSpeedMps,
    row.avgPaceSecPerKm ? 1000 / row.avgPaceSecPerKm : null,
  )

  return {
    ...row,
    activity_key: firstDefined(row.activity_key, row.garminActivityId, row.activityName, `ACT-${row.id || 'unknown'}`),
    activity_name: firstDefined(row.activity_name, row.activityName),
    activity_type: displayActivityType(rawType),
    raw_activity_type: rawType,
    start_time_utc: firstDefined(row.start_time_utc, row.startTimeUtc),
    local_start_time: firstDefined(row.local_start_time, row.localStartTime),
    location_name: firstDefined(row.location_name, row.locationName),
    owner_username: firstDefined(row.owner_username, row.ownerUsername),
    data_source: firstDefined(row.data_source, row.dataSource),
    total_distance_m: toNumber(distanceM),
    total_timer_time_s: toNumber(durationS),
    total_moving_time_s: toNumber(firstDefined(row.total_moving_time_s, row.movingDurationS, row.durationS)),
    total_calories: toNumber(firstDefined(row.total_calories, row.calories)),
    avg_speed_mps: toNumber(avgSpeedMps),
    max_speed_mps: toNumber(firstDefined(row.max_speed_mps, row.maxSpeedMps)),
    avg_heart_rate_bpm: toNumber(firstDefined(row.avg_heart_rate_bpm, row.avgHeartRateBpm)),
    max_heart_rate_bpm: toNumber(firstDefined(row.max_heart_rate_bpm, row.maxHeartRateBpm)),
    avg_cadence: toNumber(firstDefined(row.avg_cadence, row.avgCadenceSpm, row.fitSingleLegCadence)),
    avg_power_w: toNumber(firstDefined(row.avg_power_w, row.avgPowerW, row.normalizedPowerW)),
    max_power_w: toNumber(firstDefined(row.max_power_w, row.maxPowerW)),
    total_ascent_m: toNumber(firstDefined(row.total_ascent_m, row.elevationGainM)),
    total_descent_m: toNumber(firstDefined(row.total_descent_m, row.elevationLossM)),
    activity_training_load: toNumber(firstDefined(row.activity_training_load, row.activityTrainingLoad)),
    avg_pace_sec_per_km: toNumber(firstDefined(row.avg_pace_sec_per_km, row.avgPaceSecPerKm)),
  }
}

function normalizeTrackPoint(row = {}) {
  return {
    ...row,
    sample_index: firstDefined(row.sample_index, row.sampleIndex),
    sample_time_utc: String(firstDefined(row.sample_time_utc, row.sampleTimeUtc, '')),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    altitude_m: toNumber(firstDefined(row.altitude_m, row.altitudeM)),
    distance_m: toNumber(firstDefined(row.distance_m, row.distanceM)),
    speed_mps: toNumber(firstDefined(row.speed_mps, row.speedMps)),
    heart_rate_bpm: toNumber(firstDefined(row.heart_rate_bpm, row.heartRateBpm)),
    cadence: toNumber(firstDefined(row.cadence, row.fitSingleLegCadence)),
    power_w: toNumber(firstDefined(row.power_w, row.powerW)),
  }
}

function normalizeLap(row = {}) {
  return {
    ...row,
    lap_index: firstDefined(row.lap_index, row.lapIndex),
    start_time_utc: firstDefined(row.start_time_utc, row.startTimeUtc),
    total_distance_m: toNumber(firstDefined(row.total_distance_m, row.totalDistanceM)),
    total_timer_time_s: toNumber(firstDefined(row.total_timer_time_s, row.totalTimerTimeS)),
    avg_speed_mps: toNumber(firstDefined(row.avg_speed_mps, row.avgSpeedMps)),
    avg_heart_rate_bpm: toNumber(firstDefined(row.avg_heart_rate_bpm, row.avgHeartRateBpm)),
    avg_power_w: toNumber(firstDefined(row.avg_power_w, row.avgPowerW)),
  }
}

function normalizeActivityTypeStat(row = {}) {
  return {
    ...row,
    activity_type: displayActivityType(firstDefined(row.activity_type, row.activityType)),
    raw_activity_type: firstDefined(row.raw_activity_type, row.activity_type, row.activityType),
    activity_count: toNumber(firstDefined(row.activity_count, row.activityCount)),
    total_distance_m: toNumber(firstDefined(row.total_distance_m, kmToMeters(row.totalDistanceKm))),
    total_timer_time_s: toNumber(firstDefined(row.total_timer_time_s, minutesToSeconds(row.totalDurationMin))),
    avg_heart_rate_bpm: toNumber(firstDefined(row.avg_heart_rate_bpm, row.avgHeartRateBpm)),
    total_training_load: toNumber(firstDefined(row.total_training_load, row.totalTrainingLoad)),
    percentage: toNumber(row.percentage),
  }
}

function buildMockDashboardOverview() {
  return {
    recentActivities: activities,
    monthlySummary: {
      activityCount: activities.length,
      totalDistanceKm: activities.reduce((sum, activity) => sum + (activity.total_distance_m || 0), 0) / 1000,
      avgHeartRateBpm: 145,
      byActivityType: activityTypeStats,
    },
    yearlySummary: {
      activityCount: activities.length,
      totalDistanceKm: activities.reduce((sum, activity) => sum + (activity.total_distance_m || 0), 0) / 1000,
      avgHeartRateBpm: 145,
      byActivityType: activityTypeStats,
    },
    trainingLoad: [],
    personalBests: { running: [], cycling: [], overall: [] },
  }
}

function normalizeDashboardOverview(row = {}) {
  return {
    ...row,
    recentActivities: (row.recentActivities || []).map(normalizeActivity),
    monthlySummary: row.monthlySummary,
    yearlySummary: row.yearlySummary,
    trainingLoad: row.trainingLoad || [],
    personalBests: row.personalBests || { running: [], cycling: [], overall: [] },
  }
}

export async function getActivityPage(params = {}) {
  return requestEnvelope('/activities', activities, normalizeActivity, {
    params: {
      page: 1,
      page_size: 50,
      sort_by: 'local_start_time',
      sort_order: 'desc',
      ...params,
    },
    mockMeta: {
      page: 1,
      pageSize: activities.length,
      total: activities.length,
      totalPages: 1,
    },
  })
}

export async function getActivities(params = {}) {
  const envelope = await getActivityPage(params)
  return envelope.data
}

export async function getActivity(id) {
  const envelope = await requestEnvelope(`/activities/${id}`, findActivity(id), normalizeActivity)
  return envelope.data || null
}

export async function getTrackPoints(id, params = {}) {
  const envelope = await requestEnvelope(`/activities/${id}/track-points`, trackPoints, normalizeTrackPoint, {
    params: { limit: 1000, offset: 0, ...params },
  })
  return envelope.data || []
}

export async function getHeartRateSeries(id, params = {}) {
  const series = trackPoints
    .filter((point) => point.heart_rate_bpm !== null)
    .map((point) => ({
      sample_time_utc: point.sample_time_utc,
      heart_rate_bpm: point.heart_rate_bpm,
    }))

  const envelope = await requestEnvelope(`/activities/${id}/heart-rate`, series, normalizeTrackPoint, {
    params: { limit: 2000, offset: 0, ...params },
  })
  return envelope.data || []
}

export async function getSpeedSeries(id, params = {}) {
  const series = trackPoints
    .filter((point) => point.speed_mps !== null)
    .map((point) => ({
      sample_time_utc: point.sample_time_utc,
      speed_mps: point.speed_mps,
    }))

  const envelope = await requestEnvelope(`/activities/${id}/speed`, series, normalizeTrackPoint, {
    params: { limit: 2000, offset: 0, ...params },
  })
  return envelope.data || []
}

export async function getLaps(id) {
  const envelope = await requestEnvelope(`/activities/${id}/laps`, laps, normalizeLap)
  return envelope.data || []
}

export async function getActivityZones(id) {
  const envelope = await requestEnvelope(`/activities/${id}/zones`, [], (zone) => zone)
  return envelope.data || []
}

export async function getActivityTypeStats(params = {}) {
  const envelope = await requestEnvelope('/stats/activity-types', activityTypeStats, normalizeActivityTypeStat, {
    params,
  })
  return envelope.data || []
}

export async function getDashboardOverview(params = {}) {
  const envelope = await requestEnvelope('/dashboard/overview', buildMockDashboardOverview(), normalizeDashboardOverview, {
    params,
  })
  return envelope.data
}

export async function getSummaryStats(params = {}) {
  const envelope = await requestEnvelope('/stats/summary', {}, (summary) => summary, { params })
  return envelope.data
}

export async function getTimelineStats(params = { group_by: 'month' }) {
  const envelope = await requestEnvelope('/stats/timeline', [], (row) => row, { params })
  return envelope.data || []
}

export async function getMetricTrend(params = { metric: 'avg_heart_rate_bpm', range: '3m' }) {
  const envelope = await requestEnvelope('/stats/metric-trend', [], (row) => row, { params })
  return envelope.data || []
}

export async function login(credentials) {
  const envelope = await postEnvelope('/auth/login', credentials)
  if (envelope.data?.token) {
    saveAuthToken(envelope.data.token)
  }
  return envelope.data
}
