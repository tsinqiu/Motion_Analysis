import { getDashboardOverview as getMockDashboardOverview, normalizeDashboardOverview } from '@/services/activities'
import { getEnvelope, useMockData } from '@/services/api'

export async function getDashboardOverview(params = {}) {
  if (useMockData()) {
    return getMockDashboardOverview(params)
  }

  const envelope = await getEnvelope('/dashboard/overview', {
    params,
    normalizer: normalizeDashboardOverview,
  })
  return envelope.data || {
    recentActivities: [],
    monthlySummary: {},
    yearlySummary: {},
    trainingLoad: [],
    personalBests: {},
  }
}
