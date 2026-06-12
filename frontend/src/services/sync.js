import { syncProviders } from '@/mock/garsync'
import { collectionPayload, getEnvelope, mutateEnvelope, useMockData } from '@/services/api'

const PROVIDER_NAMES = {
  garmin: 'Garmin Connect',
  strava: 'Strava',
  coros: 'COROS',
  apple_health: 'Apple Health',
}

const PROVIDER_BY_NAME = {
  'Garmin Connect': 'garmin',
  Strava: 'strava',
  COROS: 'coros',
  'Apple Health': 'apple_health',
  Keep: 'keep',
}

let mockProviders = syncProviders.map(normalizeProvider)
let mockJobs = []
let mockLogs = [
  { id: 'mock-log-1', provider: 'garmin', level: 'info', message: 'Mock mode sync log.', createdAt: new Date().toISOString() },
]

export function normalizeProvider(row = {}) {
  const provider = row.provider || PROVIDER_BY_NAME[row.name] || String(row.name || '').toLowerCase() || 'garmin'
  return {
    ...row,
    provider,
    name: row.name || PROVIDER_NAMES[provider] || provider,
    status: row.status || 'not_connected',
    autoSync: Boolean(row.autoSync ?? row.auto),
    syncDirection: row.syncDirection || row.direction || 'import',
    lastSyncAt: row.lastSyncAt || row.lastSync || null,
    adapterStatus: row.adapterStatus || 'not_configured',
    authorizationUrl: row.authorizationUrl || '',
  }
}

function normalizeJob(row = {}) {
  return {
    ...row,
    id: row.id || row.jobId || `job-${Date.now()}`,
    provider: row.provider || 'garmin',
    jobType: row.jobType || row.job_type || 'manual_sync',
    status: row.status || 'queued',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  }
}

function normalizeLog(row = {}) {
  return {
    ...row,
    id: row.id || row.logId || `${row.provider || 'sync'}-${row.createdAt || Date.now()}`,
    provider: row.provider || 'garmin',
    level: row.level || row.status || 'info',
    message: row.message || row.detail || row,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  }
}

function normalizePaged(payload, normalizer) {
  const page = collectionPayload(payload)
  return {
    ...page,
    items: (page.items || []).map(normalizer),
  }
}

export async function getSyncProviders() {
  if (useMockData()) return mockProviders.map((provider) => ({ ...provider }))

  const envelope = await getEnvelope('/sync/providers')
  return (envelope.data || []).map(normalizeProvider)
}

export async function updateProviderSettings(provider, payload) {
  if (useMockData()) {
    mockProviders = mockProviders.map((item) =>
      item.provider === provider ? normalizeProvider({ ...item, ...payload }) : item,
    )
    return mockProviders.find((item) => item.provider === provider)
  }

  const envelope = await mutateEnvelope('put', `/sync/providers/${provider}/settings`, payload, {
    normalizer: normalizeProvider,
  })
  return envelope.data
}

export async function authorizeProvider(provider) {
  if (useMockData()) return { provider, adapterStatus: 'not_configured', authorizationUrl: '' }

  const envelope = await mutateEnvelope('post', `/sync/providers/${provider}/authorize`, {})
  return envelope.data
}

export async function disconnectProvider(provider) {
  if (useMockData()) {
    mockProviders = mockProviders.map((item) =>
      item.provider === provider ? normalizeProvider({ ...item, status: 'not_connected', lastSyncAt: null }) : item,
    )
    return { provider, disconnected: true }
  }

  const envelope = await mutateEnvelope('post', `/sync/providers/${provider}/disconnect`, {})
  return envelope.data
}

export async function createSyncJob(payload) {
  const body = { jobType: 'manual_sync', ...payload }
  if (useMockData()) {
    const job = normalizeJob({ ...body, id: `mock-job-${Date.now()}`, status: 'skipped' })
    mockJobs = [job, ...mockJobs]
    mockLogs = [normalizeLog({ provider: job.provider, level: 'info', message: 'Mock mode skipped third-party sync.' }), ...mockLogs]
    return job
  }

  const envelope = await mutateEnvelope('post', '/sync/jobs', body, { normalizer: normalizeJob })
  return envelope.data
}

export async function getSyncJobs(params = {}) {
  if (useMockData()) return normalizePaged(mockJobs, normalizeJob)

  const envelope = await getEnvelope('/sync/jobs', { params })
  return normalizePaged(envelope.data, normalizeJob)
}

export async function getSyncLogs(params = {}) {
  if (useMockData()) return normalizePaged(mockLogs, normalizeLog)

  const envelope = await getEnvelope('/sync/logs', { params })
  return normalizePaged(envelope.data, normalizeLog)
}
