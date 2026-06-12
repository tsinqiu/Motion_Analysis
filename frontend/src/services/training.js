import { getLoadBalance as getMockLoadBalance, normalizeActivity } from '@/services/activities'
import { getEnvelope, useMockData } from '@/services/api'

function normalizeLoadRow(row = {}) {
  return {
    ...row,
    activities: (row.activities || []).map(normalizeActivity),
  }
}

export async function getLoadBalance(params = {}) {
  if (useMockData()) return getMockLoadBalance(params)

  const envelope = await getEnvelope('/training/load-balance', {
    params,
    normalizer: normalizeLoadRow,
  })
  return envelope.data || []
}
