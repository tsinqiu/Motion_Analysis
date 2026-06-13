<template>
  <div class="page-stack">
    <section class="sync-hero">
      <div class="sync-brand">
        <img class="garmin-mark" :src="garminIconUrl" alt="Garmin Connect" />
        <div>
          <p class="overline">Garmin Connect</p>
          <h2>连接你的 Garmin 账号</h2>
          <p>同步后，新运动会自动归入当前账号；本地已有记录会自动跳过。</p>
        </div>
      </div>

      <div class="sync-account-card">
        <div class="garmin-avatar">{{ accountInitial }}</div>
        <div>
          <strong>{{ account.email || authSession.user?.email || '尚未绑定 Garmin' }}</strong>
          <span>{{ account.exists ? 'Garmin 已连接' : '等待绑定账号' }}</span>
        </div>
        <span class="status-chip" :class="account.exists ? 'good' : ''">
          {{ accountStatusLabel(account.status) }}
        </span>
      </div>
    </section>

    <p v-if="notice" class="success-copy sync-toast">{{ notice }}</p>

    <StateBlock
      v-if="loading"
      title="正在加载同步状态"
      message="马上就好，正在读取账号连接和最近同步记录。"
    />
    <StateBlock
      v-else-if="error"
      title="同步状态加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />

    <template v-else>
      <div class="sync-layout">
        <section class="dark-panel provider-card sync-status-card">
          <div class="sync-card-title">
            <div>
              <p class="overline">Account</p>
              <h2>连接状态</h2>
            </div>
            <Wifi :size="20" :class="account.exists ? 'good-text' : 'muted-text'" />
          </div>

          <div class="sync-status-line">
            <img class="garmin-mark small" :src="garminIconUrl" alt="" aria-hidden="true" />
            <div>
              <strong>{{ account.exists ? 'Garmin Connect 已绑定' : '还没有绑定 Garmin' }}</strong>
              <span>{{ account.email || '绑定后即可从最近的本地记录继续同步。' }}</span>
            </div>
          </div>

          <div class="provider-meta">
            <span><small>账号区域</small><b>{{ account.isCn ? '中国区 Garmin' : '全球区 Garmin' }}</b></span>
            <span><small>绑定时间</small><b>{{ formatDateTime(account.connectedAt) }}</b></span>
            <span><small>最近同步</small><b>{{ formatDateTime(account.lastSyncAt) }}</b></span>
            <span><small>导入记录</small><b>{{ latestJobCount }}</b></span>
          </div>

          <div class="sync-progress">
            <span :style="{ width: account.exists ? '100%' : '18%' }"></span>
          </div>

          <div class="sync-actions">
            <button
              class="primary-link"
              type="button"
              :disabled="busy || !account.exists"
              @click="runSync"
            >
              <RefreshCw :size="16" />
              {{ syncing ? '同步中' : '立即同步' }}
            </button>
            <button
              class="danger-link"
              type="button"
              :disabled="busy || !account.exists"
              @click="disconnect"
            >
              解除绑定
            </button>
          </div>

          <p class="sync-note">
            没有本地 Garmin 记录时会直接完成同步；有历史记录时，会从最近一次本地记录之后继续检查。
          </p>
        </section>

        <form class="dark-panel garmin-form" @submit.prevent="authorize">
          <div class="sync-form-title">
            <div>
              <p class="overline">Sign in</p>
              <h2>{{ account.exists ? '更新 Garmin 绑定' : '绑定 Garmin' }}</h2>
            </div>
            <UserRound :size="20" class="good-text" />
          </div>

          <label>
            <span>Garmin 邮箱</span>
            <input
              v-model.trim="form.email"
              autocomplete="username"
              placeholder="name@example.com"
              required
              type="email"
            />
          </label>
          <label>
            <span>Garmin 密码</span>
            <input
              v-model="form.password"
              autocomplete="current-password"
              placeholder="仅用于本次绑定"
              required
              type="password"
            />
          </label>
          <label>
            <span>验证码 / MFA（可选）</span>
            <input
              v-model.trim="form.mfaCode"
              autocomplete="one-time-code"
              placeholder="需要二次验证时填写"
              type="text"
            />
          </label>
          <label class="toggle-row sync-toggle">
            <span>使用 Garmin 中国区</span>
            <input v-model="form.isCn" type="checkbox" />
          </label>

          <button class="primary-link sync-submit" type="submit" :disabled="busy || !canSubmit">
            <LinkIcon :size="16" />
            {{ authorizing ? '绑定中' : '保存绑定' }}
          </button>
          <p class="sync-note">密码不会保存在数据库中，只用于本次连接验证。</p>
        </form>
      </div>

      <div class="sync-list-grid">
        <section class="dark-panel sync-list-card">
          <div class="section-heading">
            <div>
              <p class="overline">History</p>
              <h2>最近同步</h2>
            </div>
            <button class="secondary-link" type="button" :disabled="busy" @click="load">
              <RefreshCw :size="16" />
              刷新
            </button>
          </div>

          <StateBlock
            v-if="jobs.items.length === 0"
            title="暂无同步记录"
            message="绑定 Garmin 后，点击立即同步即可看到记录。"
          />
          <div v-else class="sync-event-list">
            <article v-for="job in jobs.items" :key="job.id" class="sync-event-item">
              <span class="sync-event-icon" :class="job.status">
                <CheckCircle2 v-if="job.status === 'success'" :size="16" />
                <Clock3 v-else :size="16" />
              </span>
              <div class="sync-event-main">
                <strong>{{ jobStatusLabel(job.status) }} · {{ jobTypeLabel(job.jobType) }}</strong>
                <span>{{ formatDateTime(job.requestedAt) }} · 导入 {{ job.activityCount ?? 0 }} 条</span>
                <small v-if="job.errorMessage">{{ job.errorMessage }}</small>
              </div>
            </article>
          </div>
        </section>

        <section class="dark-panel sync-list-card">
          <div class="section-heading">
            <div>
              <p class="overline">Activity</p>
              <h2>同步动态</h2>
            </div>
          </div>

          <StateBlock
            v-if="logs.items.length === 0"
            title="暂无同步动态"
            message="同步完成后，这里会显示最新状态。"
          />
          <div v-else class="sync-event-list compact">
            <article v-for="log in logs.items" :key="log.id" class="sync-event-item">
              <span class="sync-event-dot" :class="log.level"></span>
              <div class="sync-event-main">
                <strong>{{ logLevelLabel(log.level) }}</strong>
                <span>{{ log.message }}</span>
                <small>{{ formatDateTime(log.createdAt) }}</small>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  CheckCircle2,
  Clock3,
  Link as LinkIcon,
  RefreshCw,
  UserRound,
  Wifi,
} from '@lucide/vue'

import StateBlock from '@/components/StateBlock.vue'
import {
  authorizeGarminAccount,
  createSyncJob,
  disconnectGarminAccount,
  getGarminAccount,
  getSyncJobs,
  getSyncLogs,
} from '@/services/sync'
import { authSession } from '@/stores/authStore'

const account = ref({
  provider: 'garmin',
  exists: false,
  status: 'not_connected',
  email: null,
  isCn: false,
  lastSyncAt: null,
  connectedAt: null,
})
const jobs = ref({ items: [] })
const logs = ref({ items: [] })
const form = reactive({
  email: '',
  password: '',
  mfaCode: '',
  isCn: false,
})
const error = ref('')
const notice = ref('')
const loading = ref(false)
const busy = ref(false)
const authorizing = ref(false)
const syncing = ref(false)
const garminIconUrl = '/user-assets/avatars/Garmin_Connect_app_1024x1024-02.png'

const canSubmit = computed(() => Boolean(form.email && form.password))
const accountInitial = computed(() => {
  const source = account.value.email || authSession.user?.username || authSession.user?.email || 'G'
  return String(source).trim().slice(0, 1).toUpperCase()
})
const latestJobCount = computed(() => {
  const latest = jobs.value.items?.[0]
  if (!latest) return '--'
  return `${latest.activityCount ?? 0} 条`
})

function accountStatusLabel(status) {
  return {
    connected: '已连接',
    not_connected: '未连接',
    pending_authorization: '待授权',
    needs_auth: '需要授权',
    error: '异常',
  }[status] || status || '--'
}

function jobTypeLabel(value) {
  return {
    manual_sync: '手动同步',
    scheduled_sync: '自动同步',
    backfill: '历史补齐',
  }[value] || value || '--'
}

function jobStatusLabel(value) {
  return {
    queued: '等待中',
    running: '同步中',
    success: '已完成',
    failed: '失败',
    skipped: '已跳过',
  }[value] || value || '--'
}

function logLevelLabel(value) {
  return {
    info: '信息',
    warn: '提醒',
    error: '错误',
  }[value] || value || '--'
}

function formatDateTime(value) {
  if (!value) return '--'
  return String(value).replace('T', ' ').slice(0, 19)
}

function syncFormFromAccount(nextAccount) {
  form.email = nextAccount.email || form.email
  form.isCn = Boolean(nextAccount.isCn)
}

async function load({ clearNotice = true } = {}) {
  loading.value = true
  error.value = ''
  if (clearNotice) {
    notice.value = ''
  }
  try {
    const [nextAccount, nextJobs, nextLogs] = await Promise.all([
      getGarminAccount(),
      getSyncJobs({ provider: 'garmin', page: 1, page_size: 5 }),
      getSyncLogs({ provider: 'garmin', page: 1, page_size: 6 }),
    ])
    account.value = nextAccount
    jobs.value = nextJobs
    logs.value = nextLogs
    syncFormFromAccount(nextAccount)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步状态加载失败'
  } finally {
    loading.value = false
  }
}

async function withAction(action, successMessage) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
    await load({ clearNotice: false })
    notice.value = successMessage
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步操作失败'
  } finally {
    busy.value = false
  }
}

function authorize() {
  authorizing.value = true
  return withAction(async () => {
    const nextAccount = await authorizeGarminAccount(form)
    account.value = nextAccount
    form.password = ''
    form.mfaCode = ''
  }, 'Garmin 账号绑定已保存。').finally(() => {
    authorizing.value = false
  })
}

function runSync() {
  syncing.value = true
  return withAction(async () => {
    const job = await createSyncJob({ provider: 'garmin', jobType: 'manual_sync' })
    if (job.status === 'failed') {
      throw new Error(job.errorMessage || 'Garmin 同步失败')
    }
  }, '同步完成，最新状态已刷新。').finally(() => {
    syncing.value = false
  })
}

function disconnect() {
  return withAction(
    () => disconnectGarminAccount(),
    'Garmin 账号已解除绑定。',
  )
}

onMounted(load)
</script>
