import { mutateEnvelope, useMockData } from '@/services/api'
import { normalizeActivity } from '@/services/activities'

let mockWorkoutId = 10001

function normalizeWorkout(row = {}) {
  return {
    ...row,
    id: row.id || row.workoutId,
    status: row.status || 'active',
    activityType: row.activityType || row.activity_type,
    startedAt: row.startedAt || row.started_at,
  }
}

function normalizeFinishResult(row = {}) {
  return {
    ...row,
    activity: row.activity ? normalizeActivity(row.activity) : row.activity,
  }
}

export async function createWorkout(payload) {
  if (useMockData()) {
    mockWorkoutId += 1
    return normalizeWorkout({ ...payload, id: mockWorkoutId, status: 'active' })
  }

  const envelope = await mutateEnvelope('post', '/workouts', payload, { normalizer: normalizeWorkout })
  return envelope.data
}

export async function appendWorkoutTrackPoints(id, trackPoints) {
  if (useMockData()) return { inserted: trackPoints.length, trackPoints }

  const envelope = await mutateEnvelope('post', `/workouts/${id}/track-points`, { trackPoints })
  return envelope.data
}

export async function pauseWorkout(id) {
  if (useMockData()) return normalizeWorkout({ id, status: 'paused' })

  const envelope = await mutateEnvelope('post', `/workouts/${id}/pause`, {}, { normalizer: normalizeWorkout })
  return envelope.data
}

export async function resumeWorkout(id) {
  if (useMockData()) return normalizeWorkout({ id, status: 'active' })

  const envelope = await mutateEnvelope('post', `/workouts/${id}/resume`, {}, { normalizer: normalizeWorkout })
  return envelope.data
}

export async function finishWorkout(id, payload) {
  if (useMockData()) return normalizeFinishResult({ id, status: 'finished', activity: payload })

  const envelope = await mutateEnvelope('post', `/workouts/${id}/finish`, payload, { normalizer: normalizeFinishResult })
  return envelope.data
}

export async function cancelWorkout(id) {
  if (useMockData()) return { id, status: 'cancelled' }

  const envelope = await mutateEnvelope('post', `/workouts/${id}/cancel`, {})
  return envelope.data
}
