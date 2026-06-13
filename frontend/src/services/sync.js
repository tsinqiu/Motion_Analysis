import { syncProviders } from '@/mock/garsync'
import { collectionPayload, getEnvelope, mutateEnvelope, useMockData } from '@/services/api'
import { apiClient, unwrapApiResponse } from '@/services/http'

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
let mockGarminAccount = normalizeGarminAccount({
  provider: 'garmin',
  exists: mockProviders.some((provider) => provider.provider === 'garmin' && provider.status === 'connected'),
  status: mockProviders.find((provider) => provider.provider === 'garmin')?.status || 'not_connected',
  email: 'runner@example.com',
  isCn: false,
  connectedAt: '2026-06-10 22:18',
  lastSyncAt: '2026-06-10 22:18',
})
let mockJobs = []
let mockLogs = [
  { id: 'mock-log-1', provider: 'garmin', level: 'info', message: 'Mock mode sync log.', createdAt: new Date().toISOString() },
]

function normalizeStatus(status) {
  return {
    已连接: 'connected',
    未连接: 'not_connected',
    待授权: 'needs_auth',
    异常: 'error',
  }[status] || status
}

export function normalizeProvider(row = {}) {
  const provider = row.provider || PROVIDER_BY_NAME[row.name] || String(row.name || '').toLowerCase() || 'garmin'
  return {
    ...row,
    provider,
    name: row.name || PROVIDER_NAMES[provider] || provider,
    status: normalizeStatus(row.status) || 'not_connected',
    autoSync: Boolean(row.autoSync ?? row.auto),
    syncDirection: row.syncDirection || row.direction || 'import',
    lastSyncAt: row.lastSyncAt || row.lastSync || null,
    adapterStatus: row.adapterStatus || 'not_configured',
    authorizationUrl: row.authorizationUrl || '',
  }
}

export function normalizeGarminAccount(row = {}) {
  const status = row.status || (row.exists ? 'connected' : 'not_connected')
  return {
    provider: 'garmin',
    exists: Boolean(row.exists ?? status === 'connected'),
    status,
    email: row.email || null,
    isCn: Boolean(row.isCn),
    lastSyncAt: row.lastSyncAt || row.last_sync_at || null,
    connectedAt: row.connectedAt || row.connected_at || null,
  }
}

function normalizeJob(row = {}) {
  return {
    ...row,
    id: row.id || row.jobId || `job-${Date.now()}`,
    provider: row.provider || 'garmin',
    jobType: row.jobType || row.job_type || 'manual_sync',
    status: row.status || 'queued',
    requestedAt: row.requestedAt || row.requested_at || row.createdAt || row.created_at || new Date().toISOString(),
    startedAt: row.startedAt || row.started_at || null,
    finishedAt: row.finishedAt || row.finished_at || null,
    activityCount: Number(row.activityCount ?? row.activity_count ?? 0),
    errorMessage: row.errorMessage || row.error_message || '',
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

export async function getGarminAccount() {
  if (useMockData()) return { ...mockGarminAccount }

  const envelope = await getEnvelope('/sync/providers/garmin/account', {
    normalizer: normalizeGarminAccount,
  })
  return envelope.data
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

export async function authorizeGarminAccount(payload) {
  const body = {
    email: payload.email,
    password: payload.password,
    mfaCode: payload.mfaCode || undefined,
    isCn: Boolean(payload.isCn),
  }

  if (useMockData()) {
    mockGarminAccount = normalizeGarminAccount({
      provider: 'garmin',
      exists: true,
      status: 'connected',
      email: body.email,
      isCn: body.isCn,
      connectedAt: new Date().toISOString(),
      lastSyncAt: mockGarminAccount.lastSyncAt,
    })
    mockProviders = mockProviders.map((item) =>
      item.provider === 'garmin'
        ? normalizeProvider({ ...item, status: 'connected', adapterStatus: 'configured' })
        : item,
    )
    mockLogs = [
      normalizeLog({ provider: 'garmin', level: 'info', message: 'Mock mode Garmin account authorized.' }),
      ...mockLogs,
    ]
    return { ...mockGarminAccount }
  }

  const response = await apiClient.post('/sync/providers/garmin/authorize', body, {
    timeout: 120000,
  })
  const envelope = unwrapApiResponse(response.data)
  return normalizeGarminAccount(envelope.data)
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

export async function disconnectGarminAccount() {
  if (useMockData()) {
    mockGarminAccount = normalizeGarminAccount({ provider: 'garmin', exists: false, status: 'not_connected' })
    mockProviders = mockProviders.map((item) =>
      item.provider === 'garmin'
        ? normalizeProvider({ ...item, status: 'not_connected', lastSyncAt: null })
        : item,
    )
    mockLogs = [
      normalizeLog({ provider: 'garmin', level: 'info', message: 'Mock mode Garmin account disconnected.' }),
      ...mockLogs,
    ]
    return { provider: 'garmin', status: 'not_connected', disconnected: true }
  }

  const envelope = await mutateEnvelope('post', '/sync/providers/garmin/disconnect', {})
  return envelope.data
}

export async function createSyncJob(payload) {
  const body = { jobType: 'manual_sync', ...payload }
  if (useMockData()) {
    const connected = body.provider !== 'garmin' || mockGarminAccount.exists
    const job = normalizeJob({
      ...body,
      id: `mock-job-${Date.now()}`,
      status: connected ? 'success' : 'failed',
      activityCount: connected ? 0 : 0,
      errorMessage: connected ? '' : 'garmin account is not connected',
      finishedAt: new Date().toISOString(),
    })
    mockJobs = [job, ...mockJobs]
    if (connected && job.provider === 'garmin') {
      mockGarminAccount = normalizeGarminAccount({ ...mockGarminAccount, lastSyncAt: job.finishedAt })
    }
    mockLogs = [
      normalizeLog({
        provider: job.provider,
        level: connected ? 'info' : 'error',
        message: connected ? 'Mock mode Garmin sync completed; imported 0 new activities.' : job.errorMessage,
      }),
      ...mockLogs,
    ]
    return job
  }

  const response = await apiClient.post('/sync/jobs', body, {
    timeout: 600000,
  })
  const envelope = unwrapApiResponse(response.data)
  return normalizeJob(envelope.data)
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
