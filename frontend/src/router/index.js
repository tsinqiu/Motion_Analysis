import { createRouter, createWebHistory } from 'vue-router'

import Activities from '@/views/Activities.vue'
import ActivityDetail from '@/views/ActivityDetail.vue'
import Analytics from '@/views/Analytics.vue'
import DatabaseSchema from '@/views/DatabaseSchema.vue'
import Dashboard from '@/views/Dashboard.vue'
import MobilePreview from '@/views/MobilePreview.vue'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: Dashboard,
    meta: { title: '首页' },
  },
  {
    path: '/activities',
    name: 'activities',
    component: Activities,
    meta: { title: '活动列表' },
  },
  {
    path: '/activities/:id',
    name: 'activity-detail',
    component: ActivityDetail,
    meta: { title: '运动详情' },
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: Analytics,
    meta: { title: '统计分析' },
  },
  {
    path: '/schema',
    name: 'schema',
    component: DatabaseSchema,
    meta: { title: '数据库结构' },
  },
  {
    path: '/mobile-preview',
    name: 'mobile-preview',
    component: MobilePreview,
    meta: { title: '移动端效果' },
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
