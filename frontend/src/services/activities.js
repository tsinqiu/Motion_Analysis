import {
  activities as seedActivities,
  findActivity,
  laps,
  trackPoints,
} from '@/mock/activities'
import {
  apiClient,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
  unwrapApiResponse,
  useMockData,
} from '@/services/http'

const ACTIVITY_TYPE_LABELS = {
  running: '跑步',
  street_running: '跑步',
  track_running: '田径跑步',
  treadmill_running: '跑步',
  cycling: '骑行',
  road_biking: '骑行',
  indoor_cycling: '骑行',
  swimming: '游泳',
  pool_swimming: '游泳',
  open_water_swimming: '游泳',
  strength_training: '力量训练',
  floor_climbing: '爬楼',
  walking: '步行',
  other: '其他',
}

const TYPE_ALIASES = {
  all: ['all'],
  running: ['running', 'street_running', 'track_running', 'treadmill_running', '跑步', '田径跑步'],
  cycling: ['cycling', 'road_biking', 'indoor_cycling', '骑行'],
  swimming: ['swimming', 'pool_swimming', 'open_water_swimming', '游泳'],
  strength_training: ['strength_training', 'strength', '力量训练'],
  other: ['other', 'walking', 'floor_climbing', '其他', '步行', '爬楼'],
}

let manualActivities = []
let nextManualActivityId = 9001
const DEMO_ACTIVITY_IDS = new Set(seedActivities.map((activity) => Number(activity.id)))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function paceToSpeedMps(value) {
  const pace = toNumber(value)
  return pace && Number.isFinite(pace) && pace > 0 ? 1000 / pace : null
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

function cleanParams(params = {}) {
  const next = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if ((key === 'activity_type' || key === 'type') && value === 'all') continue
    if ((key === 'start_date' || key === 'end_date') && !DATE_RE.test(value)) continue
    next[key] = value
  }
  return next
}

function getDemoActivity(id) {
  if (!DEMO_ACTIVITY_IDS.has(Number(id))) return null
  return getMockActivities().find((activity) => activity.id === Number(id)) || null
}

async function mutateEnvelope(method, path, body) {
  if (useMockData()) {
    throw new Error('mock mutation should be handled by the caller')
  }

  const response = await apiClient[method](path, body)
  return unwrapApiResponse(response.data)
}

function getMockActivities() {
  return [...manualActivities, ...seedActivities].map(normalizeActivity)
}

export function normalizeActivity(row = {}) {
  const rawType = firstDefined(row.raw_activity_type, row.activity_type, row.activityType, row.sportType)
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
    paceToSpeedMps(row.avgPaceSecPerKm),
  )

  return {
    ...row,
    id: toNumber(row.id),
    activity_key: firstDefined(row.activity_key, row.activityKey, row.garminActivityId, row.activityName, `ACT-${row.id || 'unknown'}`),
    activity_name: firstDefined(row.activity_name, row.activityName, displayActivityType(rawType)),
    activity_type: displayActivityType(rawType),
    raw_activity_type: rawType,
    start_time_utc: firstDefined(row.start_time_utc, row.startTimeUtc),
    local_start_time: firstDefined(row.local_start_time, row.localStartTime),
    location_name: firstDefined(row.location_name, row.locationName),
    owner_username: firstDefined(row.owner_username, row.ownerUsername),
    data_source: firstDefined(row.data_source, row.dataSource, row.is_manual ? 'manual_upload' : 'garmin_import'),
    is_manual: Boolean(firstDefined(row.is_manual, row.isManual, false)),
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
    vo2max: toNumber(firstDefined(row.vo2max, row.vo2Max)),
  }
}

export function normalizeTrackPoint(row = {}) {
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

export function normalizeLap(row = {}) {
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

export function normalizeActivityTypeStat(row = {}) {
  return {
    ...row,
    activity_type: displayActivityType(firstDefined(row.activity_type, row.activityType)),
    raw_activity_type: firstDefined(row.raw_activity_type, row.activity_type, row.activityType),
    activity_count: toNumber(firstDefined(row.activity_count, row.activityCount)),
    total_distance_m: toNumber(firstDefined(row.total_distance_m, row.totalDistanceM, kmToMeters(row.totalDistanceKm))),
    total_timer_time_s: toNumber(firstDefined(row.total_timer_time_s, row.totalDurationS, minutesToSeconds(row.totalDurationMin))),
    avg_heart_rate_bpm: toNumber(firstDefined(row.avg_heart_rate_bpm, row.avgHeartRateBpm)),
    total_training_load: toNumber(firstDefined(row.total_training_load, row.totalTrainingLoad)),
    percentage: toNumber(row.percentage),
  }
}

export function normalizeDashboardOverview(row = {}) {
  return {
    ...row,
    recentActivities: (row.recentActivities || []).map(normalizeActivity),
    monthlySummary: row.monthlySummary,
    yearlySummary: row.yearlySummary,
    trainingLoad: row.trainingLoad || [],
    personalBests: row.personalBests || { running: [], cycling: [], overall: [] },
  }
}

function dateKey(activity) {
  return String(activity.local_start_time || '').slice(0, 10)
}

function monthKey(activity) {
  return dateKey(activity).slice(0, 7)
}

function typeMatches(activity, type) {
  if (!type || type === 'all') return true
  const aliases = TYPE_ALIASES[type] || [type]
  return aliases.includes(activity.raw_activity_type) || aliases.includes(activity.activity_type)
}

function dateMatches(activity, startDate, endDate) {
  const value = dateKey(activity)
  if (!value) return true
  if (startDate && value < startDate) return false
  if (endDate && value > endDate) return false
  return true
}

function keywordMatches(activity, keyword) {
  if (!keyword) return true
  const term = keyword.trim().toLowerCase()
  return [activity.activity_name, activity.location_name, activity.activity_type, activity.activity_key]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term))
}

function applyActivityFilters(rows, params = {}) {
  const type = firstDefined(params.activity_type, params.type, 'all')
  const source = params.source
  const filtered = rows.filter((activity) =>
    typeMatches(activity, type)
    && dateMatches(activity, params.start_date, params.end_date)
    && keywordMatches(activity, params.keyword)
    && (!source || activity.data_source === source)
  )

  const sortBy = params.sort_by || 'local_start_time'
  const sortOrder = params.sort_order === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    const left = firstDefined(
      sortBy === 'distance_m' ? a.total_distance_m : undefined,
      sortBy === 'duration_s' ? a.total_timer_time_s : undefined,
      sortBy === 'avg_heart_rate_bpm' ? a.avg_heart_rate_bpm : undefined,
      sortBy === 'max_heart_rate_bpm' ? a.max_heart_rate_bpm : undefined,
      sortBy === 'avg_pace' ? a.avg_pace_sec_per_km : undefined,
      sortBy === 'activity_training_load' ? a.activity_training_load : undefined,
      a.local_start_time,
      '',
    )
    const right = firstDefined(
      sortBy === 'distance_m' ? b.total_distance_m : undefined,
      sortBy === 'duration_s' ? b.total_timer_time_s : undefined,
      sortBy === 'avg_heart_rate_bpm' ? b.avg_heart_rate_bpm : undefined,
      sortBy === 'max_heart_rate_bpm' ? b.max_heart_rate_bpm : undefined,
      sortBy === 'avg_pace' ? b.avg_pace_sec_per_km : undefined,
      sortBy === 'activity_training_load' ? b.activity_training_load : undefined,
      b.local_start_time,
      '',
    )
    return left > right ? sortOrder : left < right ? -sortOrder : 0
  })

  return filtered
}

function applyRangeDateFilter(rows, params = {}) {
  if (params.range === 'month' && params.date) {
    return rows.filter((activity) => monthKey(activity) === params.date)
  }
  if (params.range === 'year' && params.date) {
    return rows.filter((activity) => dateKey(activity).startsWith(params.date))
  }
  return rows
}

function summarizeActivities(rows) {
  const values = rows.filter(Boolean)
  const totalDistanceM = values.reduce((sum, activity) => sum + (activity.total_distance_m || 0), 0)
  const totalDurationS = values.reduce((sum, activity) => sum + (activity.total_timer_time_s || 0), 0)
  const totalCalories = values.reduce((sum, activity) => sum + (activity.total_calories || 0), 0)
  const heartRates = values.map((activity) => activity.avg_heart_rate_bpm).filter(Number.isFinite)
  const totalTrainingLoad = values.reduce((sum, activity) => sum + (activity.activity_training_load || 0), 0)

  return {
    activityCount: values.length,
    totalDistanceM,
    totalDistanceKm: totalDistanceM / 1000,
    totalDurationS,
    totalDurationHours: totalDurationS / 3600,
    totalCalories,
    fatKg: totalCalories / 7700,
    avgHeartRateBpm: heartRates.length
      ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
      : null,
    totalTrainingLoad: Math.round(totalTrainingLoad),
    longestDistanceM: Math.max(0, ...values.map((activity) => activity.total_distance_m || 0)),
    byActivityType: buildActivityTypeStats(values),
  }
}

function buildActivityTypeStats(rows = getMockActivities()) {
  const groups = new Map()
  for (const activity of rows) {
    const key = activity.activity_type || '其他'
    const current = groups.get(key) || {
      activity_type: key,
      raw_activity_type: activity.raw_activity_type,
      activity_count: 0,
      total_distance_m: 0,
      total_timer_time_s: 0,
      total_training_load: 0,
      heartRates: [],
    }
    current.activity_count += 1
    current.total_distance_m += activity.total_distance_m || 0
    current.total_timer_time_s += activity.total_timer_time_s || 0
    current.total_training_load += activity.activity_training_load || 0
    if (Number.isFinite(activity.avg_heart_rate_bpm)) current.heartRates.push(activity.avg_heart_rate_bpm)
    groups.set(key, current)
  }

  return [...groups.values()].map((group) => ({
    ...group,
    avg_heart_rate_bpm: group.heartRates.length
      ? group.heartRates.reduce((sum, value) => sum + value, 0) / group.heartRates.length
      : null,
    percentage: rows.length ? Math.round((group.activity_count / rows.length) * 100) : 0,
    heartRates: undefined,
  }))
}

function activityMetricValue(activity, metric) {
  const map = {
    avg_cadence_spm: activity.avg_cadence,
    avg_heart_rate_bpm: activity.avg_heart_rate_bpm,
    max_heart_rate_bpm: activity.max_heart_rate_bpm,
    avg_speed_mps: activity.avg_speed_mps,
    avg_pace_sec_per_km: activity.avg_speed_mps ? 1000 / activity.avg_speed_mps : null,
    distance_m: activity.total_distance_m,
    duration_s: activity.total_timer_time_s,
    calories: activity.total_calories,
    activity_training_load: activity.activity_training_load,
    vo2max: activity.vo2max,
    body_battery_delta: Math.round((activity.activity_training_load || 40) / -5),
  }
  return toNumber(map[metric])
}

function buildTimeline(groupBy = 'month', rows = getMockActivities()) {
  const groups = new Map()
  for (const activity of rows) {
    const key = groupBy === 'day' ? dateKey(activity) : monthKey(activity)
    if (!key) continue
    const current = groups.get(key) || { period: key, activities: [] }
    current.activities.push(activity)
    groups.set(key, current)
  }

  return [...groups.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((group) => ({
      period: group.period,
      ...summarizeActivities(group.activities),
    }))
}

function buildCalendarStats(month, rows = getMockActivities()) {
  const targetMonth = month || '2026-06'
  const daysInMonth = new Date(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0).getDate()
  const monthRows = rows.filter((activity) => monthKey(activity) === targetMonth)

  return {
    month: targetMonth,
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const day = `${targetMonth}-${String(index + 1).padStart(2, '0')}`
      const dayActivities = monthRows.filter((activity) => dateKey(activity) === day)
      return {
        date: day,
        activityCount: dayActivities.length,
        activityTypes: [...new Set(dayActivities.map((activity) => activity.raw_activity_type))],
        totals: summarizeActivities(dayActivities),
        activities: dayActivities,
      }
    }),
  }
}

function buildPersonalBests(rows = getMockActivities()) {
  const running = rows.filter((activity) => typeMatches(activity, 'running'))
  const cycling = rows.filter((activity) => typeMatches(activity, 'cycling'))
  const swimming = rows.filter((activity) => typeMatches(activity, 'swimming'))

  const bestByDistance = (items) => [...items].sort((a, b) => (b.total_distance_m || 0) - (a.total_distance_m || 0))[0]
  const fastest = (items, distanceM) => [...items]
    .filter((activity) => (activity.total_distance_m || 0) >= distanceM)
    .sort((a, b) => (a.total_timer_time_s || Infinity) - (b.total_timer_time_s || Infinity))[0]

  return {
    steps: [
      { key: 'daily', label: '单日最高', value: '18,642', unit: 'steps' },
      { key: 'weekly', label: '单周最高', value: '118,644', unit: 'steps' },
      { key: 'monthly', label: '单月最高', value: '228,221', unit: 'steps' },
    ],
    running: [
      recordItem('longest_run', '最长距离', bestByDistance(running), 'distance'),
      recordItem('run_5k', '5 公里', fastest(running, 5000), 'duration'),
      recordItem('run_10k', '10 公里', fastest(running, 10000), 'duration'),
      recordItem('half_marathon', '半程马拉松', fastest(running, 21097), 'duration'),
      { key: 'marathon', label: '全程马拉松', value: '2:57:36', unit: '', activityId: bestByDistance(running)?.id },
    ],
    cycling: [
      recordItem('longest_ride', '最长距离', bestByDistance(cycling), 'distance'),
      recordItem('max_climb', '最大爬升', [...cycling].sort((a, b) => (b.total_ascent_m || 0) - (a.total_ascent_m || 0))[0], 'ascent'),
      { key: 'ftp', label: '最大功率 FTP', value: '258', unit: 'W', activityId: bestByDistance(cycling)?.id },
      recordItem('ride_40k', '40 公里', fastest(cycling, 40000), 'duration'),
    ],
    swimming: [
      recordItem('longest_swim', '最长距离', bestByDistance(swimming), 'distance'),
      { key: 'swim_100', label: '100 米', value: '--', unit: '' },
      { key: 'swim_400', label: '400 米', value: '--', unit: '' },
      { key: 'swim_1000', label: '1000 米', value: '--', unit: '' },
      { key: 'swim_1500', label: '1500 米', value: '39:40', unit: '', activityId: bestByDistance(swimming)?.id },
    ],
    overall: [],
  }
}

function recordItem(key, label, activity, mode) {
  if (!activity) return { key, label, value: '--', unit: '' }
  if (mode === 'distance') return { key, label, value: ((activity.total_distance_m || 0) / 1000).toFixed(2), unit: 'km', activityId: activity.id }
  if (mode === 'ascent') return { key, label, value: Math.round(activity.total_ascent_m || 0), unit: 'm', activityId: activity.id }
  const seconds = activity.total_timer_time_s || 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  return { key, label, value: h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`, unit: '', activityId: activity.id }
}

function buildLoadBalance(rows = getMockActivities()) {
  const sortedRows = [...rows].filter((activity) => dateKey(activity)).sort((a, b) => dateKey(a).localeCompare(dateKey(b)))
  const latestDate = sortedRows.at(-1) ? new Date(`${dateKey(sortedRows.at(-1))}T00:00:00`) : new Date('2026-06-11T00:00:00')
  const base = new Date(latestDate)
  base.setDate(latestDate.getDate() - 91)
  const activitiesByDate = new Map(sortedRows.map((activity) => [dateKey(activity), activity]))
  let ctl = 58
  let atl = 66

  return Array.from({ length: 92 }, (_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    const activity = activitiesByDate.get(key)
    const load = activity?.activity_training_load || (index % 7 === 0 ? 45 : 0)
    ctl = ctl + (load - ctl) / 42
    atl = atl + (load - atl) / 7
    const tsb = ctl - atl
    return {
      date: key,
      dailyTrainingLoad: Math.round(load),
      ctl: Number(ctl.toFixed(1)),
      atl: Number(atl.toFixed(1)),
      tsb: Number(tsb.toFixed(1)),
      activities: activity ? [activity] : [],
    }
  })
}

function buildManualActivity(payload = {}, id = Date.now()) {
  const rawType = payload.activityType || payload.raw_activity_type || 'running'
  return normalizeActivity({
    id,
    activity_key: `manual:${id}`,
    activity_name: payload.activityName || '手动添加运动',
    activity_type: rawType,
    raw_activity_type: rawType,
    local_start_time: payload.localStartTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
    location_name: payload.locationName || '手动记录',
    data_source: 'manual_upload',
    is_manual: true,
    total_distance_m: toNumber(payload.distanceM) || 0,
    total_timer_time_s: toNumber(payload.durationS) || 0,
    total_moving_time_s: toNumber(payload.movingDurationS) || toNumber(payload.durationS) || 0,
    total_calories: toNumber(payload.calories) || 0,
    avg_speed_mps: toNumber(payload.avgSpeedMps),
    max_speed_mps: toNumber(payload.maxSpeedMps),
    avg_heart_rate_bpm: toNumber(payload.avgHeartRateBpm),
    max_heart_rate_bpm: toNumber(payload.maxHeartRateBpm),
    avg_cadence: toNumber(payload.avgCadenceSpm),
    max_cadence: toNumber(payload.maxCadenceSpm),
    total_ascent_m: toNumber(payload.elevationGainM),
    total_descent_m: toNumber(payload.elevationLossM),
    avg_power_w: toNumber(payload.avgPowerW),
    max_power_w: toNumber(payload.maxPowerW),
    activity_training_load: toNumber(payload.activityTrainingLoad) || Math.round((toNumber(payload.durationS) || 0) / 60),
  })
}

function buildMockDashboardOverview(rows = getMockActivities()) {
  const recentMonth = rows[0] ? monthKey(rows[0]) : '2026-06'
  return {
    recentActivities: rows.slice(0, 6),
    monthlySummary: summarizeActivities(rows.filter((activity) => monthKey(activity) === recentMonth)),
    yearlySummary: summarizeActivities(rows),
    trainingLoad: buildLoadBalance(rows).slice(-30),
    personalBests: buildPersonalBests(rows),
  }
}

async function fetchRemoteActivities() {
  const envelope = await requestEnvelope('/activities', [], normalizeActivity, {
    params: cleanParams({
      page: 1,
      page_size: 200,
      sort_by: 'local_start_time',
      sort_order: 'desc',
    }),
  })
  return envelope.data || []
}

async function getActivityPool(params = {}) {
  if (useMockData()) {
    return applyRangeDateFilter(applyActivityFilters(getMockActivities(), params), params)
  }

  const remoteRows = await fetchRemoteActivities()
  const rows = [...manualActivities, ...remoteRows].map(normalizeActivity)
  return applyRangeDateFilter(applyActivityFilters(rows, params), params)
}

export async function getActivityPage(params = {}) {
  const query = {
    page: 1,
    page_size: 50,
    sort_by: 'local_start_time',
    sort_order: 'desc',
    ...params,
  }

  if (useMockData()) {
    const rows = applyActivityFilters(getMockActivities(), query)
    const page = Number(query.page || 1)
    const pageSize = Number(query.page_size || query.pageSize || 50)
    const start = (page - 1) * pageSize
    return {
      data: rows.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      },
    }
  }

  const envelope = await requestEnvelope('/activities', [], normalizeActivity, {
    params: cleanParams(query),
  })
  return {
    data: envelope.data || [],
    meta: envelope.meta || {},
  }
}

export async function getActivities(params = {}) {
  const envelope = await getActivityPage(params)
  return envelope.data
}

export async function getActivity(id) {
  if (useMockData()) {
    const manualOrSeed = getMockActivities().find((activity) => activity.id === Number(id))
    if (manualOrSeed) return manualOrSeed
    const seed = findActivity(id)
    return seed ? normalizeActivity(seed) : null
  }

  const envelope = await requestEnvelope(`/activities/${id}`, null, normalizeActivity)
  return envelope.data || null
}

export async function getTrackPoints(id, params = {}) {
  if (useMockData()) return trackPoints.map(normalizeTrackPoint)

  const pageSize = Math.min(Number(params.limit) || 5000, 5000)
  let offset = Number(params.offset) || 0
  const allPoints = []

  while (true) {
    const envelope = await requestEnvelope(`/activities/${id}/track-points`, trackPoints, normalizeTrackPoint, {
      params: { ...params, limit: pageSize, offset },
    })
    const page = envelope.data || []
    allPoints.push(...page)

    if (page.length < pageSize) break
    offset += pageSize
  }

  return allPoints
}

export async function getHeartRateSeries(id, params = {}) {
  const series = trackPoints
    .filter((point) => point.heart_rate_bpm !== null)
    .map((point) => ({
      sample_time_utc: point.sample_time_utc,
      heart_rate_bpm: point.heart_rate_bpm,
    }))

  if (useMockData()) return series.map(normalizeTrackPoint)

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

  if (useMockData()) return series.map(normalizeTrackPoint)

  const envelope = await requestEnvelope(`/activities/${id}/speed`, series, normalizeTrackPoint, {
    params: { limit: 2000, offset: 0, ...params },
  })
  return envelope.data || []
}

export async function getLaps(id) {
  if (useMockData()) return laps.map(normalizeLap)

  const envelope = await requestEnvelope(`/activities/${id}/laps`, laps, normalizeLap)
  return envelope.data || []
}

export async function getActivityZones(id) {
  if (useMockData()) return []

  const envelope = await requestEnvelope(`/activities/${id}/zones`, [], (zone) => zone)
  return envelope.data || []
}

export async function getActivityTypeStats(params = {}) {
  const rows = await getActivityPool(params)
  return buildActivityTypeStats(rows).map(normalizeActivityTypeStat)
}

export async function getDashboardOverview(params = {}) {
  const rows = await getActivityPool(params)
  return normalizeDashboardOverview(buildMockDashboardOverview(rows))
}

export async function getSummaryStats(params = {}) {
  const rows = await getActivityPool(params)
  return summarizeActivities(rows)
}

export async function getTimelineStats(params = { group_by: 'month' }) {
  const rows = await getActivityPool(params)
  return buildTimeline(params.group_by, rows).filter((row) => {
    if (params.range === 'month' && params.date) return row.period.startsWith(params.date)
    if (params.range === 'year' && params.date) return row.period.startsWith(params.date)
    return true
  })
}

export async function getMetricTrend(params = { metric: 'avg_heart_rate_bpm', range: '3m' }) {
  const rows = await getActivityPool(params)
  return rows
    .map((activity) => ({
      date: dateKey(activity),
      value: activityMetricValue(activity, params.metric),
      sampleCount: 1,
      activities: [activity],
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getCalendarStats(params = {}) {
  const month = params.month || '2026-06'
  const rows = await getActivityPool({ range: 'month', date: month })
  return buildCalendarStats(month, rows)
}

export async function getPersonalBests(params = {}) {
  const rows = await getActivityPool(params)
  return buildPersonalBests(rows)
}

export async function getLoadBalance(params = {}) {
  const rows = await getActivityPool(params)
  return buildLoadBalance(rows)
}

export async function createManualActivity(payload) {
  if (useMockData()) {
    const activity = buildManualActivity(payload, nextManualActivityId)
    nextManualActivityId += 1
    manualActivities = [activity, ...manualActivities]
    return activity
  }

  const envelope = await mutateEnvelope('post', '/manual-activities', payload)
  return normalizeActivity(envelope.data)
}

export async function updateManualActivity(id, payload) {
  if (useMockData()) {
    const index = manualActivities.findIndex((activity) => activity.id === Number(id))
    if (index < 0) throw new Error('只能编辑手动添加的活动')
    const nextActivity = buildManualActivity(payload, Number(id))
    manualActivities.splice(index, 1, nextActivity)
    return nextActivity
  }

  const envelope = await mutateEnvelope('put', `/manual-activities/${id}`, payload)
  return normalizeActivity(envelope.data)
}

export async function deleteManualActivity(id) {
  if (useMockData()) {
    manualActivities = manualActivities.filter((activity) => activity.id !== Number(id))
    return { deleted: true, id: Number(id) }
  }

  const envelope = await mutateEnvelope('delete', `/manual-activities/${id}`)
  return envelope.data
}

export async function login(credentials) {
  const envelope = await mutateEnvelope('post', '/auth/login', credentials)
  if (envelope.data?.token) {
    saveAuthToken(envelope.data.token)
  }
  return envelope.data
}

export async function getCurrentUser() {
  if (useMockData()) {
    return getAuthToken()
      ? { id: 2, username: 'hao', email: '', role: 'user' }
      : null
  }

  const envelope = await requestEnvelope('/auth/me', null, (row) => row)
  return envelope.data
}

export function logout() {
  clearAuthToken()
}

export async function predictRunningLoad(payload) {
  if (useMockData()) {
    return {
      predictedTrainingLoadLevel: (payload.activityTrainingLoad || 0) > 150 ? 'high' : 'medium',
      fatigueRisk: (payload.maxHeartRateBpm || 0) > 178 ? 'medium' : 'low',
      recoveryAdvice: '建议安排一次低强度恢复训练，并保证睡眠。',
      confidence: 0.82,
      modelVersion: 'mock-running-v1',
    }
  }

  const envelope = await mutateEnvelope('post', '/ml/running-prediction', payload)
  return envelope.data
}
