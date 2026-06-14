import { createRouter, createWebHistory } from 'vue-router'

import Admin from '@/views/Admin.vue'
import Activities from '@/views/Activities.vue'
import ActivityDetail from '@/views/ActivityDetail.vue'
import Assistant from '@/views/Assistant.vue'
import Calendar from '@/views/Calendar.vue'
import Community from '@/views/Community.vue'
import DatabaseSchema from '@/views/DatabaseSchema.vue'
import Explore from '@/views/Explore.vue'
import Login from '@/views/Login.vue'
import Records from '@/views/Records.vue'
import Register from '@/views/Register.vue'
import Settings from '@/views/Settings.vue'
import StartWorkout from '@/views/StartWorkout.vue'
import Statistics from '@/views/Statistics.vue'
import Sync from '@/views/Sync.vue'
import Today from '@/views/Today.vue'
import TrainingLoad from '@/views/TrainingLoad.vue'
import Trends from '@/views/Trends.vue'
import {
  authSession,
  hasAuthToken,
  initAuthSession,
  installAuthFailureHandler,
  isAuthenticated,
  normalizeRedirect,
} from '@/stores/authStore'

const routes = [
  {
    path: '/',
    redirect: '/today',
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { title: '登录', publicOnly: true, authLayout: true },
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
    meta: { title: '注册', publicOnly: true, authLayout: true },
  },
  {
    path: '/today',
    name: 'today',
    component: Today,
    meta: { title: '今日', requiresAuth: true },
  },
  {
    path: '/activities',
    name: 'activities',
    component: Activities,
    meta: { title: '我的运动', requiresAuth: true },
  },
  {
    path: '/activities/:id',
    name: 'activity-detail',
    component: ActivityDetail,
    meta: { title: '运动详情', requiresAuth: true },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: Calendar,
    meta: { title: '运动日历', requiresAuth: true },
  },
  {
    path: '/trends',
    name: 'trends',
    component: Trends,
    meta: { title: '趋势', requiresAuth: true },
  },
  {
    path: '/training-load',
    name: 'training-load',
    component: TrainingLoad,
    meta: { title: '训练负荷', requiresAuth: true },
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: Statistics,
    meta: { title: '运动统计', requiresAuth: true },
  },
  {
    path: '/analytics',
    redirect: '/statistics',
  },
  {
    path: '/records',
    name: 'records',
    component: Records,
    meta: { title: '最佳记录', requiresAuth: true },
  },
  {
    path: '/sync',
    name: 'sync',
    component: Sync,
    meta: { title: '同步', requiresAuth: true },
  },
  {
    path: '/assistant',
    name: 'assistant',
    component: Assistant,
    meta: { title: 'AI 助手', requiresAuth: true },
  },
  {
    path: '/explore',
    name: 'explore',
    component: Explore,
    meta: { title: '探索', requiresAuth: true },
  },
  {
    path: '/community',
    name: 'community',
    component: Community,
    meta: { title: '运动圈', requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    meta: { title: '设置', requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: Admin,
    meta: { title: '管理中心', requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/start',
    name: 'start-workout',
    component: StartWorkout,
    meta: { title: '开始运动', requiresAuth: true },
  },
  {
    path: '/schema',
    name: 'schema',
    component: DatabaseSchema,
    meta: { title: '数据库结构', requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

installAuthFailureHandler(router)

router.beforeEach(async (to) => {
  if (to.meta.publicOnly) {
    if (hasAuthToken()) {
      const ready = isAuthenticated.value || await initAuthSession()
      if (ready) {
        return normalizeRedirect(to.query.redirect)
      }
    }
    return true
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (!hasAuthToken()) {
    return {
      name: 'login',
      query: { redirect: normalizeRedirect(to.fullPath) },
    }
  }

  const ready = isAuthenticated.value || await initAuthSession()
  if (!ready) {
    return {
      name: 'login',
      query: { redirect: normalizeRedirect(to.fullPath) },
    }
  }

  if (to.meta.requiresAdmin && authSession.user?.role !== 'admin') {
    return { name: 'today' }
  }

  return true
})

router.afterEach((to) => {
  document.title = `${to.meta.title || '系统'} - Motion Analysis`
})

export default router
