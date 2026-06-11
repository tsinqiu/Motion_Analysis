<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">MA</span>
        <span>
          <strong>Motion Analysis</strong>
          <small>运动数据库管理系统</small>
        </span>
      </RouterLink>

      <nav class="nav-list" aria-label="主导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

    </aside>

    <div class="content-shell">
      <header class="topbar">
        <div>
          <p class="overline">数据库课程大作业</p>
          <h1>{{ route.meta.title || '运动数据分析' }}</h1>
        </div>
        <div class="topbar-actions">
          <span class="api-status">{{ apiStatus }}</span>
        </div>
      </header>

      <main class="page-frame">
        <ApiModeBanner />
        <RouterView />
        <footer class="app-footer">
          <span>Garmin 运动数据分析数据库管理系统前端</span>
          <strong>Frontend: Hao Chen</strong>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

import ApiModeBanner from '@/components/ApiModeBanner.vue'
import { useMockData } from '@/services/http'

const route = useRoute()
const apiStatus = useMockData() ? 'Mock 数据' : '后端 API'

const navItems = [
  { to: '/', label: '首页概览', icon: '01' },
  { to: '/activities', label: '活动列表', icon: '02' },
  { to: '/analytics', label: '统计分析', icon: '03' },
  { to: '/schema', label: '数据库结构', icon: '04' },
  { to: '/mobile-preview', label: '移动端效果', icon: '05' },
]
</script>
