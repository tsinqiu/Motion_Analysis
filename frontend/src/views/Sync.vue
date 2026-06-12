<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Data sync center</p>
          <h2>同步</h2>
        </div>
        <span class="status-chip neutral">本地模拟</span>
      </div>
      <p class="muted-copy">第三方平台授权不在本轮后端接口范围内；当前页面用于展示连接状态、同步方向、进度与错误日志。</p>
    </section>

    <div class="provider-grid">
      <article v-for="provider in providers" :key="provider.name" class="dark-panel provider-card">
        <div class="provider-head">
          <strong>{{ provider.name }}</strong>
          <span>{{ provider.status }}</span>
        </div>
        <div class="provider-meta">
          <span><small>方向</small><b>{{ provider.direction }}</b></span>
          <span><small>数量</small><b>{{ provider.count }}</b></span>
          <span><small>最近同步</small><b>{{ provider.lastSync }}</b></span>
          <span><small>自动同步</small><b>{{ provider.auto ? '开启' : '关闭' }}</b></span>
        </div>
        <div class="sync-progress"><span :style="{ width: syncing === provider.name ? '76%' : provider.count ? '100%' : '0%' }"></span></div>
        <button class="primary-link" type="button" :disabled="syncing === provider.name" @click="sync(provider)">
          <RefreshCw :size="16" />
          {{ syncing === provider.name ? '同步中' : '立即同步' }}
        </button>
      </article>
    </div>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Sync logs</p>
          <h2>同步日志</h2>
        </div>
      </div>
      <div class="log-list">
        <span v-for="log in logs" :key="log">{{ log }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { RefreshCw } from '@lucide/vue'

import { syncProviders } from '@/mock/garsync'

const providers = ref(syncProviders.map((provider) => ({ ...provider })))
const syncing = ref('')
const logs = ref(['Garmin Connect 同步完成：导入 138 条活动记录。'])
let timeoutId = null

function sync(provider) {
  window.clearTimeout(timeoutId)
  syncing.value = provider.name
  logs.value.unshift(`${provider.name} 开始同步，执行去重与增量检查。`)
  timeoutId = window.setTimeout(() => {
    provider.status = provider.status === '待授权' ? '需要重新授权' : '已连接'
    provider.lastSync = '2026-06-11 12:31'
    provider.count += provider.status === '已连接' ? 1 : 0
    logs.value.unshift(`${provider.name} 同步结束：${provider.status}。`)
    syncing.value = ''
    timeoutId = null
  }, 900)
}

onBeforeUnmount(() => window.clearTimeout(timeoutId))
</script>
