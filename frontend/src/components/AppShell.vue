<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/today">
        <span class="brand-mark">GS</span>
        <span>
          <strong>GarSync Motion</strong>
          <small>运动数据库管理系统</small>
        </span>
      </RouterLink>

      <nav class="nav-list" aria-label="主导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          <component :is="item.icon" :size="18" aria-hidden="true" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="content-shell">
      <header class="topbar">
        <div>
          <p class="overline">Garmin 运动数据分析数据库系统</p>
          <h1>{{ route.meta.title || '运动数据中枢' }}</h1>
        </div>
        <div class="topbar-actions">
          <span class="api-status">{{ apiStatus }}</span>
          <RouterLink class="topbar-start" to="/start">
            <Play :size="16" />
            开始
          </RouterLink>
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
import {
  Activity,
  BarChart3,
  CalendarDays,
  Compass,
  Database,
  HeartPulse,
  Play,
  RefreshCw,
  Settings,
  Trophy,
  Users,
} from '@lucide/vue'

import ApiModeBanner from '@/components/ApiModeBanner.vue'
import { useMockData } from '@/services/http'

const route = useRoute()
const apiStatus = useMockData() ? 'Mock 数据' : '后端 API'

const navItems = [
  { to: '/today', label: '今日', icon: HeartPulse },
  { to: '/activities', label: '我的运动', icon: Activity },
  { to: '/calendar', label: '运动日历', icon: CalendarDays },
  { to: '/trends', label: '趋势', icon: BarChart3 },
  { to: '/training-load', label: '训练负荷', icon: Activity },
  { to: '/statistics', label: '运动统计', icon: BarChart3 },
  { to: '/records', label: '最佳记录', icon: Trophy },
  { to: '/sync', label: '同步', icon: RefreshCw },
  { to: '/explore', label: '探索', icon: Compass },
  { to: '/community', label: '运动圈', icon: Users },
  { to: '/schema', label: '数据库结构', icon: Database },
  { to: '/settings', label: '设置', icon: Settings },
]
</script>
