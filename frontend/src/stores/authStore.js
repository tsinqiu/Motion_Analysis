import { computed, reactive } from 'vue'

import {
  clearAuthSession,
  getCurrentUser,
  login,
  persistAuthToken,
  register,
} from '@/services/auth'
import { getAuthToken, setAuthFailureHandler } from '@/services/http'

export const authSession = reactive({
  user: null,
  loading: false,
  initialized: false,
  error: '',
})

export const isAuthenticated = computed(() => Boolean(getAuthToken() && authSession.user))

export function hasAuthToken() {
  return Boolean(getAuthToken())
}

export function normalizeRedirect(value, fallback = '/today') {
  const target = Array.isArray(value) ? value[0] : value
  if (!target || typeof target !== 'string') return fallback
  if (!target.startsWith('/') || target.startsWith('//')) return fallback
  if (target.startsWith('/login') || target.startsWith('/register')) return fallback
  return target
}

function setUser(user) {
  authSession.user = user || null
  authSession.initialized = true
}

export function resetAuthState() {
  clearAuthSession()
  authSession.user = null
  authSession.initialized = true
  authSession.error = ''
}

export async function initAuthSession({ force = false } = {}) {
  if (!hasAuthToken()) {
    setUser(null)
    return false
  }

  if (!force && authSession.initialized && authSession.user) {
    return true
  }

  authSession.loading = true
  authSession.error = ''
  try {
    const user = await getCurrentUser()
    setUser(user)
    return Boolean(user)
  } catch (error) {
    resetAuthState()
    authSession.error = error instanceof Error ? error.message : '登录状态已失效'
    return false
  } finally {
    authSession.loading = false
  }
}

async function finishAuth(request) {
  authSession.loading = true
  authSession.error = ''
  try {
    const result = await request()
    if (!result?.token || !result?.user) {
      throw new Error('登录响应缺少用户或 token')
    }
    persistAuthToken(result.token)
    setUser(result.user)
    return result.user
  } catch (error) {
    authSession.error = error instanceof Error ? error.message : '认证失败'
    throw error
  } finally {
    authSession.loading = false
  }
}

export function signIn(payload) {
  return finishAuth(() => login(payload))
}

export function signUp(payload) {
  return finishAuth(() => register(payload))
}

export function signOut() {
  resetAuthState()
}

export function installAuthFailureHandler(router) {
  setAuthFailureHandler(() => {
    resetAuthState()
    const current = router.currentRoute.value
    if (!current.meta.publicOnly) {
      router.push({
        name: 'login',
        query: { redirect: normalizeRedirect(current.fullPath) },
      })
    }
  })
}
