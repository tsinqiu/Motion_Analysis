import { apiClient, unwrapApiResponse, useMockData } from '@/services/http'

export { useMockData }

export function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value)
}

export function cleanParams(params = {}) {
  const next = {}
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue
    if ((key === 'activity_type' || key === 'type') && value === 'all') continue
    next[key] = value
  }
  return next
}

export function normalizeCollection(value, normalizer) {
  if (!normalizer) return value
  if (Array.isArray(value)) return value.map(normalizer)
  if (value && typeof value === 'object') return normalizer(value)
  return value
}

export async function getEnvelope(path, { params, mockValue, normalizer, mockMeta } = {}) {
  if (useMockData()) {
    return {
      data: normalizeCollection(cloneValue(mockValue), normalizer),
      meta: mockMeta || {},
    }
  }

  const response = await apiClient.get(path, { params: cleanParams(params) })
  const envelope = unwrapApiResponse(response.data)
  return {
    data: normalizeCollection(envelope.data, normalizer),
    meta: envelope.meta || {},
  }
}

export async function mutateEnvelope(method, path, body, { mockValue, normalizer } = {}) {
  if (useMockData()) {
    return {
      data: normalizeCollection(cloneValue(mockValue), normalizer),
      meta: {},
    }
  }

  const response = await apiClient[method](path, body)
  const envelope = unwrapApiResponse(response.data)
  return {
    data: normalizeCollection(envelope.data, normalizer),
    meta: envelope.meta || {},
  }
}

export function collectionPayload(value) {
  if (Array.isArray(value)) return { items: value, page: 1, pageSize: value.length, total: value.length, totalPages: 1 }
  return value || { items: [], page: 1, pageSize: 0, total: 0, totalPages: 1 }
}
