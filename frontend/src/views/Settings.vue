<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>设置</h2>
        </div>
        <span class="status-chip good">隐私优先</span>
      </div>
      <p class="muted-copy">系统只展示必要的账号和运动数据，不在页面中暴露数据库密码、密钥或个人轨迹原始文件。</p>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
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

    <StateBlock
      v-if="loading"
      title="正在加载设置"
      message="正在读取个人设置。"
    />
    <StateBlock
      v-else-if="error"
      title="设置加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />

    <form v-else class="settings-grid" @submit.prevent="save">
      <label class="settings-wide profile-bio-field">
        <span>个人介绍</span>
        <textarea v-model.trim="profile.bio" maxlength="50" placeholder="用一句话介绍你的运动偏好，最多 50 字" />
        <small>{{ profile.bio.length }}/50</small>
      </label>
      <label>
        <span>距离单位</span>
        <select v-model="settings.distanceUnit">
          <option value="km">公里</option>
          <option value="mi">英里</option>
        </select>
      </label>
      <label>
        <span>体重单位</span>
        <select v-model="settings.weightUnit">
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      <label>
        <span>温度单位</span>
        <select v-model="settings.temperatureUnit">
          <option value="c">℃</option>
          <option value="f">℉</option>
        </select>
      </label>
      <label>
        <span>配速显示</span>
        <select v-model="settings.paceUnit">
          <option value="min_per_km">分/公里</option>
          <option value="min_per_mile">分/英里</option>
        </select>
      </label>
      <label>
        <span>默认隐私</span>
        <select v-model="settings.defaultPrivacy">
          <option value="private">私密</option>
          <option value="followers">关注者</option>
          <option value="public">公开</option>
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
      <div class="settings-actions">
        <button class="primary-link" type="submit" :disabled="saving">{{ saving ? '保存中' : '保存设置' }}</button>
        <span v-if="saved" class="success-copy">设置已保存。</span>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import StateBlock from '@/components/StateBlock.vue'
import { updateCurrentUserProfile } from '@/services/auth'
import { getSettings, updateSettings } from '@/services/settings'
import { authSession, signOut } from '@/stores/authStore'

const router = useRouter()
const settings = reactive({
  distanceUnit: 'km',
  weightUnit: 'kg',
  temperatureUnit: 'c',
  paceUnit: 'min_per_km',
  defaultPrivacy: 'private',
  hideMapEndpoints: true,
  healthSync: false,
})
const profile = reactive({
  bio: '',
})
const error = ref('')
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const roleLabel = computed(() => authSession.user?.role === 'admin' ? '管理员' : '普通用户')
const initials = computed(() => String(authSession.user?.username || 'GS').slice(0, 2).toUpperCase())

function syncProfile() {
  profile.bio = authSession.user?.bio || ''
}

async function load() {
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    Object.assign(settings, await getSettings())
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设置加载失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const [nextSettings, nextUser] = await Promise.all([
      updateSettings(settings),
      updateCurrentUserProfile({ bio: profile.bio }),
    ])
    Object.assign(settings, nextSettings)
    if (nextUser) {
      authSession.user = nextUser
      syncProfile()
    }
    saved.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设置保存失败'
  } finally {
    saving.value = false
  }
}

function handleLogout() {
  signOut()
  router.push({ name: 'login' })
}

onMounted(() => {
  syncProfile()
  load()
})
</script>
