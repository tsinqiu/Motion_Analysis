import {
  apiClient,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
  unwrapApiResponse,
  useMockData,
} from '@/services/http'

const MOCK_USER_STORAGE_KEY = 'motion-analysis-mock-user'

function mockUserFromPayload(payload = {}) {
  const email = String(payload.email || 'demo@example.local').trim().toLowerCase()
  const username = String(payload.username || email.split('@')[0] || 'demo').trim()
  return {
    id: 9001,
    username,
    email,
    role: 'user',
    status: 'active',
    bio: '',
    createdAt: new Date().toISOString(),
  }
}

function loadMockUser() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(MOCK_USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveMockUser(user) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(user))
}

function clearMockUser() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(MOCK_USER_STORAGE_KEY)
}

function mockToken(user) {
  return `mock.${window.btoa(`${user.id}:${user.email}:${Date.now()}`)}`
}

export async function login(payload) {
  if (useMockData()) {
    const user = loadMockUser() || mockUserFromPayload(payload)
    saveMockUser(user)
    return { user, token: mockToken(user) }
  }

  const response = await apiClient.post('/auth/login', payload)
  return unwrapApiResponse(response.data).data
}

export async function register(payload) {
  if (useMockData()) {
    const user = mockUserFromPayload(payload)
    saveMockUser(user)
    return { user, token: mockToken(user) }
  }

  const response = await apiClient.post('/auth/register', payload)
  return unwrapApiResponse(response.data).data
}

export async function getCurrentUser() {
  if (!getAuthToken()) return null

  if (useMockData()) {
    return loadMockUser() || mockUserFromPayload()
  }

  const response = await apiClient.get('/auth/me')
  const data = unwrapApiResponse(response.data).data
  return data?.user || data || null
}

export async function getAdminUsers() {
  if (useMockData()) {
    const current = loadMockUser() || mockUserFromPayload()
    return [current]
  }

  const response = await apiClient.get('/admin/users')
  return unwrapApiResponse(response.data).data || []
}

export async function createAdminUser(payload) {
  if (useMockData()) {
    return mockUserFromPayload(payload)
  }

  const response = await apiClient.post('/admin/users', payload)
  return unwrapApiResponse(response.data).data
}

export async function disableAdminUser(id) {
  if (useMockData()) {
    return { id, status: 'disabled' }
  }

  const response = await apiClient.delete(`/admin/users/${id}`)
  return unwrapApiResponse(response.data).data
}

export async function updateCurrentUserProfile(payload) {
  if (useMockData()) {
    const current = loadMockUser() || mockUserFromPayload()
    const user = { ...current, bio: String(payload.bio || '').trim().slice(0, 50) }
    saveMockUser(user)
    return user
  }

  const response = await apiClient.put('/auth/me/profile', payload)
  const data = unwrapApiResponse(response.data).data
  return data?.user || data || null
}

export function persistAuthToken(token) {
  saveAuthToken(token)
}

export function clearAuthSession() {
  clearAuthToken()
  if (useMockData()) {
    clearMockUser()
  }
}
