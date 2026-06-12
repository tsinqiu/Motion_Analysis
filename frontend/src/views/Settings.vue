<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Settings</p>
          <h2>设置</h2>
        </div>
        <span class="status-chip good">隐私优先</span>
      </div>
      <p class="muted-copy">前端不会保存真实邮箱、服务器账号、数据库密码或个人轨迹原始文件；`.env` 只保留本地。</p>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Account</p>
          <h2>账号信息</h2>
        </div>
        <span class="status-chip good">{{ roleLabel }}</span>
      </div>
      <div class="account-summary">
        <div class="account-avatar">{{ initials }}</div>
        <div>
          <strong>{{ authSession.user?.username || '已登录用户' }}</strong>
          <span>{{ authSession.user?.email || '未提供邮箱' }}</span>
          <small>状态：{{ authSession.user?.status || 'active' }}</small>
        </div>
        <button class="secondary-link" type="button" @click="handleLogout">退出登录</button>
      </div>
    </section>

    <section class="settings-grid">
      <label>
        <span>距离单位</span>
        <select v-model="settings.distanceUnit">
          <option>公里</option>
          <option>英里</option>
        </select>
      </label>
      <label>
        <span>体重单位</span>
        <select v-model="settings.weightUnit">
          <option>kg</option>
          <option>lb</option>
        </select>
      </label>
      <label>
        <span>温度单位</span>
        <select v-model="settings.temperatureUnit">
          <option>℃</option>
          <option>℉</option>
        </select>
      </label>
      <label>
        <span>配速显示</span>
        <select v-model="settings.paceUnit">
          <option>min/km</option>
          <option>min/mi</option>
        </select>
      </label>
      <label class="toggle-row">
        <span>隐藏地图起终点</span>
        <input v-model="settings.hideMapEndpoints" type="checkbox" />
      </label>
      <label class="toggle-row">
        <span>同步健康数据</span>
        <input v-model="settings.healthSync" type="checkbox" />
      </label>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'

import { userSettings } from '@/mock/garsync'
import { authSession, signOut } from '@/stores/authStore'

const router = useRouter()
const settings = reactive({ ...userSettings })
const roleLabel = computed(() => authSession.user?.role === 'admin' ? '管理员' : '普通用户')
const initials = computed(() => String(authSession.user?.username || 'GS').slice(0, 2).toUpperCase())

function handleLogout() {
  signOut()
  router.push({ name: 'login' })
}
</script>
