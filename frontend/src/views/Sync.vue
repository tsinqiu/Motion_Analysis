<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>同步</h2>
        </div>
        <span class="status-chip good">同步中心</span>
      </div>
      <p class="muted-copy">管理不同平台的连接状态、同步任务和同步日志。</p>
      <p v-if="notice" class="success-copy">{{ notice }}</p>
    </section>

    <StateBlock
      v-if="loading"
      title="正在加载同步状态"
      message="正在读取同步平台、任务和日志。"
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
      <div class="provider-grid">
        <article v-for="provider in providers" :key="provider.provider" class="dark-panel provider-card">
          <div class="provider-head">
            <strong>{{ provider.name }}</strong>
            <span>{{ providerStatusLabel(provider.status) }}</span>
          </div>
          <p v-if="provider.adapterStatus === 'not_configured'" class="muted-copy">{{ provider.name }} 暂不可授权。</p>
          <div class="provider-meta">
            <span><small>方向</small><b>{{ directionLabel(provider.syncDirection) }}</b></span>
            <span><small>自动同步</small><b>{{ provider.autoSync ? '开启' : '关闭' }}</b></span>
            <span><small>最近同步</small><b>{{ formatDateTime(provider.lastSyncAt) }}</b></span>
            <span><small>授权状态</small><b>{{ adapterLabel(provider.adapterStatus) }}</b></span>
          </div>
          <div class="sync-progress"><span :style="{ width: provider.status === 'connected' ? '100%' : '12%' }"></span></div>
          <div class="provider-controls">
            <label class="toggle-row compact-toggle">
              <span>自动</span>
              <input
                :checked="provider.autoSync"
                type="checkbox"
                @change="saveProviderSettings(provider, { autoSync: $event.target.checked })"
              />
            </label>
            <select :value="provider.syncDirection" @change="saveProviderSettings(provider, { syncDirection: $event.target.value })">
              <option value="import">导入</option>
              <option value="export">导出</option>
              <option value="two_way">双向</option>
            </select>
          </div>
          <div class="provider-actions">
            <button class="secondary-link" type="button" :disabled="busy" @click="authorize(provider)">
              <LinkIcon :size="16" />
              授权
            </button>
            <button class="primary-link" type="button" :disabled="busy || provider.adapterStatus === 'not_configured'" @click="runSync(provider)">
              <RefreshCw :size="16" />
              同步
            </button>
            <button class="danger-link" type="button" :disabled="busy" @click="disconnect(provider)">
              断开
            </button>
          </div>
        </article>
      </div>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>同步任务</h2>
          </div>
        </div>
        <StateBlock v-if="jobs.items.length === 0" title="暂无同步任务" message="当前没有同步任务。" />
        <div v-else class="log-list">
          <span v-for="job in jobs.items" :key="job.id">{{ job.provider }} · {{ job.jobType }} · {{ job.status }} · {{ formatDateTime(job.createdAt) }}</span>
        </div>
      </section>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>同步日志</h2>
          </div>
        </div>
        <StateBlock v-if="logs.items.length === 0" title="暂无同步日志" message="当前没有同步日志。" />
        <div v-else class="log-list">
          <span v-for="log in logs.items" :key="log.id">{{ log.provider }} · {{ log.level }} · {{ log.message }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Link as LinkIcon, RefreshCw } from '@lucide/vue'

import StateBlock from '@/components/StateBlock.vue'
import {
  authorizeProvider,
  createSyncJob,
  disconnectProvider,
  getSyncJobs,
  getSyncLogs,
  getSyncProviders,
  updateProviderSettings,
} from '@/services/sync'

const providers = ref([])
const jobs = ref({ items: [] })
const logs = ref({ items: [] })
const error = ref('')
const notice = ref('')
const loading = ref(false)
const busy = ref(false)

function providerStatusLabel(status) {
  return {
    connected: '已连接',
    not_connected: '未连接',
    needs_auth: '需要授权',
    error: '异常',
  }[status] || status || '--'
}

function adapterLabel(status) {
  return status === 'configured' ? '可用' : status === 'not_configured' ? '未配置' : status || '--'
}

function directionLabel(value) {
  return { import: '导入', export: '导出', two_way: '双向' }[value] || value || '--'
}

function formatDateTime(value) {
  if (!value) return '--'
  return String(value).replace('T', ' ').slice(0, 19)
}

async function load() {
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const [nextProviders, nextJobs, nextLogs] = await Promise.all([
      getSyncProviders(),
      getSyncJobs({ page: 1, page_size: 10 }),
      getSyncLogs({ page: 1, page_size: 12 }),
    ])
    providers.value = nextProviders
    jobs.value = nextJobs
    logs.value = nextLogs
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步状态加载失败'
  } finally {
    loading.value = false
  }
}

async function withProviderAction(action, successMessage) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
    notice.value = successMessage
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步操作失败'
  } finally {
    busy.value = false
  }
}

function saveProviderSettings(provider, patch) {
  return withProviderAction(
    () => updateProviderSettings(provider.provider, {
      autoSync: patch.autoSync ?? provider.autoSync,
      syncDirection: patch.syncDirection ?? provider.syncDirection,
    }),
    `${provider.name} 设置已保存。`,
  )
}

function authorize(provider) {
  return withProviderAction(async () => {
    const result = await authorizeProvider(provider.provider)
    if (result?.authorizationUrl) {
      window.location.href = result.authorizationUrl
    }
  }, provider.adapterStatus === 'not_configured' ? `${provider.name} 暂不可授权。` : `${provider.name} 授权已发起。`)
}

function runSync(provider) {
  return withProviderAction(
    () => createSyncJob({ provider: provider.provider, jobType: 'manual_sync' }),
    `${provider.name} 同步任务已提交。`,
  )
}

function disconnect(provider) {
  return withProviderAction(
    () => disconnectProvider(provider.provider),
    `${provider.name} 已断开。`,
  )
}

onMounted(load)
</script>
