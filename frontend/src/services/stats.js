import {
  getActivityTypeStats as getMockActivityTypeStats,
  getCalendarStats as getMockCalendarStats,
  getMetricTrend as getMockMetricTrend,
  getPersonalBests as getMockPersonalBests,
  getSummaryStats as getMockSummaryStats,
  getTimelineStats as getMockTimelineStats,
  normalizeActivity,
  normalizeActivityTypeStat,
} from '@/services/activities'
import { getEnvelope, useMockData } from '@/services/api'

function normalizeTrendRow(row = {}) {
  return {
    ...row,
    activities: (row.activities || []).map(normalizeActivity),
  }
}

function normalizeCalendarDay(day = {}) {
  return {
    ...day,
    activities: (day.activities || []).map(normalizeActivity),
  }
}

function normalizeCalendar(payload = {}) {
  return {
    ...payload,
    days: (payload.days || []).map(normalizeCalendarDay),
  }
}

export async function getSummaryStats(params = {}) {
  if (useMockData()) return getMockSummaryStats(params)

  const envelope = await getEnvelope('/stats/summary', { params })
  return envelope.data || {}
}

export async function getActivityTypeStats(params = {}) {
  if (useMockData()) return getMockActivityTypeStats(params)

  const envelope = await getEnvelope('/stats/activity-types', {
    params,
    normalizer: normalizeActivityTypeStat,
  })
  return envelope.data || []
}

export async function getTimelineStats(params = { group_by: 'month' }) {
  if (useMockData()) return getMockTimelineStats(params)

  const envelope = await getEnvelope('/stats/timeline', { params })
  return envelope.data || []
}

export async function getMetricTrend(params = { metric: 'avg_heart_rate_bpm', range: '3m' }) {
  if (useMockData()) return getMockMetricTrend(params)

  const envelope = await getEnvelope('/stats/metric-trend', {
    params,
    normalizer: normalizeTrendRow,
  })
  return envelope.data || []
}

export async function getCalendarStats(params = {}) {
  if (useMockData()) return getMockCalendarStats(params)

  const envelope = await getEnvelope('/stats/calendar', {
    params,
    normalizer: normalizeCalendar,
  })
  return envelope.data || { days: [] }
}

export async function getPersonalBests(params = {}) {
  if (useMockData()) return getMockPersonalBests(params)

  const envelope = await getEnvelope('/stats/personal-bests', { params })
  return envelope.data || { steps: [], running: [], cycling: [], swimming: [], overall: [] }
}
