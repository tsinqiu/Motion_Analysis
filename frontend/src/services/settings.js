import { userSettings } from '@/mock/garsync'
import { getEnvelope, mutateEnvelope, useMockData } from '@/services/api'

const DEFAULT_SETTINGS = {
  distanceUnit: 'km',
  weightUnit: 'kg',
  temperatureUnit: 'c',
  paceUnit: 'min_per_km',
  defaultPrivacy: 'private',
  hideMapEndpoints: true,
  healthSync: false,
}

const LEGACY_VALUE_MAP = {
  '公里': 'km',
  '英里': 'mi',
  '℃': 'c',
  '℉': 'f',
  'min/km': 'min_per_km',
  'min/mi': 'min_per_mile',
  '私密': 'private',
  '关注者': 'followers',
  '公开': 'public',
}

let mockSettings = normalizeSettings(userSettings)

export function normalizeSettings(row = {}) {
  const next = { ...DEFAULT_SETTINGS, ...row }
  return {
    ...next,
    distanceUnit: LEGACY_VALUE_MAP[next.distanceUnit] || next.distanceUnit || DEFAULT_SETTINGS.distanceUnit,
    weightUnit: LEGACY_VALUE_MAP[next.weightUnit] || next.weightUnit || DEFAULT_SETTINGS.weightUnit,
    temperatureUnit: LEGACY_VALUE_MAP[next.temperatureUnit] || next.temperatureUnit || DEFAULT_SETTINGS.temperatureUnit,
    paceUnit: LEGACY_VALUE_MAP[next.paceUnit] || next.paceUnit || DEFAULT_SETTINGS.paceUnit,
    defaultPrivacy: LEGACY_VALUE_MAP[next.defaultPrivacy] || next.defaultPrivacy || DEFAULT_SETTINGS.defaultPrivacy,
    hideMapEndpoints: Boolean(next.hideMapEndpoints),
    healthSync: Boolean(next.healthSync),
  }
}

export async function getSettings() {
  if (useMockData()) return { ...mockSettings }

  const envelope = await getEnvelope('/settings', { normalizer: normalizeSettings })
  return envelope.data || { ...DEFAULT_SETTINGS }
}

export async function updateSettings(payload) {
  const normalized = normalizeSettings(payload)
  if (useMockData()) {
    mockSettings = normalized
    return { ...mockSettings }
  }

  const envelope = await mutateEnvelope('put', '/settings', normalized, { normalizer: normalizeSettings })
  return envelope.data || normalized
}
