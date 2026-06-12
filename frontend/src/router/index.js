import { createRouter, createWebHistory } from 'vue-router'

import Activities from '@/views/Activities.vue'
import ActivityDetail from '@/views/ActivityDetail.vue'
import Calendar from '@/views/Calendar.vue'
import Community from '@/views/Community.vue'
import DatabaseSchema from '@/views/DatabaseSchema.vue'
import Explore from '@/views/Explore.vue'
import Records from '@/views/Records.vue'
import Settings from '@/views/Settings.vue'
import StartWorkout from '@/views/StartWorkout.vue'
import Statistics from '@/views/Statistics.vue'
import Sync from '@/views/Sync.vue'
import Today from '@/views/Today.vue'
import TrainingLoad from '@/views/TrainingLoad.vue'
import Trends from '@/views/Trends.vue'

const routes = [
  {
    path: '/',
    redirect: '/today',
  },
  {
    path: '/today',
    name: 'today',
    component: Today,
    meta: { title: '今日' },
  },
  {
    path: '/activities',
    name: 'activities',
    component: Activities,
    meta: { title: '我的运动' },
  },
  {
    path: '/activities/:id',
    name: 'activity-detail',
    component: ActivityDetail,
    meta: { title: '运动详情' },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: Calendar,
    meta: { title: '运动日历' },
  },
  {
    path: '/trends',
    name: 'trends',
    component: Trends,
    meta: { title: '趋势' },
  },
  {
    path: '/training-load',
    name: 'training-load',
    component: TrainingLoad,
    meta: { title: '训练负荷' },
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: Statistics,
    meta: { title: '运动统计' },
  },
  {
    path: '/analytics',
    redirect: '/statistics',
  },
  {
    path: '/records',
    name: 'records',
    component: Records,
    meta: { title: '最佳记录' },
  },
  {
    path: '/sync',
    name: 'sync',
    component: Sync,
    meta: { title: '同步' },
  },
  {
    path: '/explore',
    name: 'explore',
    component: Explore,
    meta: { title: '探索' },
  },
  {
    path: '/community',
    name: 'community',
    component: Community,
    meta: { title: '运动圈' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    meta: { title: '设置' },
  },
  {
    path: '/start',
    name: 'start-workout',
    component: StartWorkout,
    meta: { title: '开始运动' },
  },
  {
    path: '/schema',
    name: 'schema',
    component: DatabaseSchema,
    meta: { title: '数据库结构' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = `${to.meta.title || '前端'} - Motion Analysis`
})

export default router
