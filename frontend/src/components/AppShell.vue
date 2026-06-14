<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/today">
        <span class="brand-mark">GS</span>
        <span>
          <strong>GarSync Motion</strong>
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
        <h1>Garmin 运动数据分析数据库系统</h1>
        <div class="topbar-actions">
          <button class="theme-toggle" type="button" @click="toggleTheme">
            <component :is="isNightTheme ? Sun : Moon" :size="16" />
            {{ isNightTheme ? '日间' : '夜晚' }}
          </button>
          <div class="user-chip" :title="authSession.user?.email">
            <UserRound :size="16" />
            <span>{{ userLabel }}</span>
            <small>{{ roleLabel }}</small>
          </div>
          <RouterLink class="topbar-start" to="/start">
            <Play :size="16" />
            开始
          </RouterLink>
          <button class="topbar-logout" type="button" @click="handleLogout">
            <LogOut :size="16" />
            退出
          </button>
        </div>
      </header>

      <main class="page-frame">
        <RouterView />
        <footer class="app-footer">
          <span>Garmin 运动数据分析数据库系统</span>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Activity,
  BarChart3,
  Bot,
  Compass,
  Database,
  HeartPulse,
  LogOut,
  Moon,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from '@lucide/vue'

import { authSession, signOut } from '@/stores/authStore'
import { useThemeMode } from '@/composables/useThemeMode'

const { isNightTheme, toggleTheme } = useThemeMode()
const userLabel = computed(() => authSession.user?.username || '已登录用户')
const roleLabel = computed(() => authSession.user?.role === 'admin' ? '管理员' : '用户')

function handleLogout() {
  signOut()
  window.location.assign('/login')
}

const baseNavItems = [
  { to: '/today', label: '今日', icon: HeartPulse },
  { to: '/activities', label: '运动记录', icon: Activity },
  { to: '/trends', label: '趋势', icon: BarChart3 },
  { to: '/statistics', label: '运动统计', icon: BarChart3 },
  { to: '/sync', label: '同步', icon: RefreshCw },
  { to: '/assistant', label: 'AI 助手', icon: Bot },
  { to: '/explore', label: '探索', icon: Compass },
  { to: '/community', label: '运动圈', icon: Users },
  { to: '/schema', label: '数据库', icon: Database },
  { to: '/settings', label: '设置', icon: Settings },
]

const navItems = computed(() => {
  if (authSession.user?.role !== 'admin') return baseNavItems
  return [
    ...baseNavItems,
    { to: '/admin', label: '管理中心', icon: ShieldCheck },
  ]
})
</script>
