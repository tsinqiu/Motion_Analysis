import axios from 'axios'

const TOKEN_STORAGE_KEY = 'motion-analysis-token'
let authFailureHandler = null

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 8000,
})

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const backendError = error.response?.data?.error
    if (backendError?.message) {
      const normalizedError = new Error(backendError.message)
      normalizedError.code = backendError.code
      normalizedError.status = error.response.status
      if (
        normalizedError.status === 401
        && ['AUTH_REQUIRED', 'INVALID_TOKEN'].includes(normalizedError.code)
      ) {
        clearAuthToken()
        if (typeof authFailureHandler === 'function') {
          authFailureHandler(normalizedError)
        }
      }
      return Promise.reject(normalizedError)
    }

    return Promise.reject(error)
  },
)

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler
}

export function useMockData() {
  return import.meta.env.VITE_USE_MOCK === 'true'
}

export function unwrapApiResponse(payload) {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return {
      data: payload.data,
      meta: payload.meta || {},
    }
  }

  return {
    data: payload,
    meta: {},
  }
}

export function getAuthToken() {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function saveAuthToken(token) {
  if (typeof localStorage === 'undefined') return
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

export function clearAuthToken() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}
