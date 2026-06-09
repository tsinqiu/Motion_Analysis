import {
  activities,
  activityTypeStats,
  findActivity,
  laps,
  trackPoints,
} from '@/mock/activities'
import { apiClient, useMockData } from '@/services/http'

async function requestOrMock(path, mockValue) {
  if (useMockData()) {
    return structuredClone(mockValue)
  }

  const response = await apiClient.get(path)
  return response.data
}

export function getActivities() {
  return requestOrMock('/activities', activities)
}

export function getActivity(id) {
  return requestOrMock(`/activities/${id}`, findActivity(id))
}

export function getTrackPoints(id) {
  return requestOrMock(`/activities/${id}/track-points`, trackPoints)
}

export function getHeartRateSeries(id) {
  const series = trackPoints
    .filter((point) => point.heart_rate_bpm !== null)
    .map((point) => ({
      sample_time_utc: point.sample_time_utc,
      heart_rate_bpm: point.heart_rate_bpm,
    }))

  return requestOrMock(`/activities/${id}/heart-rate`, series)
}

export function getSpeedSeries(id) {
  const series = trackPoints
    .filter((point) => point.speed_mps !== null)
    .map((point) => ({
      sample_time_utc: point.sample_time_utc,
      speed_mps: point.speed_mps,
    }))

  return requestOrMock(`/activities/${id}/speed`, series)
}

export function getLaps(id) {
  return requestOrMock(`/activities/${id}/laps`, laps)
}

export function getActivityTypeStats() {
  return requestOrMock('/stats/activity-types', activityTypeStats)
}
