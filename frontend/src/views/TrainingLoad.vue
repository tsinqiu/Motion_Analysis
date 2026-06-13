<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Training load balance</p>
          <h2>训练负荷平衡（{{ currentLoad }}）</h2>
        </div>
        <strong class="status-chip" :class="statusTone">{{ statusLabel }}</strong>
      </div>
      <div class="range-row">
        <button v-for="range in ranges" :key="range.value" type="button" :class="{ active: filters.range === range.value }" @click="filters.range = range.value">
          {{ range.label }}
        </button>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载训练负荷" message="正在读取 CTL、ATL、TSB 曲线。" />
    <StateBlock v-else-if="error" title="训练负荷加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="loadRows.length === 0" title="暂无训练负荷" message="当前数据源没有 activity_training_load。" />

    <template v-else>
      <ChartPanel title="体能 / 疲劳 / 状态" eyebrow="CTL · ATL · TSB" :option="loadOption" />
      <div class="load-dashboard">
        <section class="dark-panel today-state">
          <p class="overline">Today state</p>
          <h2>今日状态</h2>
          <div class="state-metrics">
            <span><small>体能 CTL</small><b class="blue">{{ current.ctl }}</b></span>
            <span><small>疲劳 ATL</small><b class="purple">{{ current.atl }}</b></span>
            <span><small>状态 TSB</small><b>{{ current.tsb }}</b></span>
          </div>
          <p>{{ suggestion }}</p>
        </section>
        <section class="dark-panel risk-panel">
          <p class="overline">Risk zones</p>
          <h2>状态区间</h2>
          <div class="risk-list">
            <span>过渡期</span>
            <span>精力充沛</span>
            <span>灰色地带</span>
            <span>最佳</span>
            <span>高风险</span>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

import ChartPanel from '@/components/ChartPanel.vue'
import StateBlock from '@/components/StateBlock.vue'
import { getLoadBalance } from '@/services/training'

const ranges = [
  { label: '42天', value: '42d' },
  { label: '3个月', value: '3m' },
  { label: '6个月', value: '6m' },
  { label: '1年', value: '1y' },
  { label: '2年', value: '2y' },
]

const filters = reactive({ range: '3m' })
const loadRows = ref([])
const error = ref('')
const loading = ref(false)

const current = computed(() => loadRows.value.at(-1) || { ctl: '--', atl: '--', tsb: '--', dailyTrainingLoad: 0 })
const currentLoad = computed(() => Math.round(current.value.dailyTrainingLoad || current.value.ctl || 0))
const statusLabel = computed(() => {
  const tsb = Number(current.value.tsb || 0)
  if (tsb < -25) return '高风险'
  if (tsb < -8) return '灰色地带'
  if (tsb <= 5) return '最佳'
  if (tsb <= 20) return '精力充沛'
  return '过渡期'
})
const statusTone = computed(() => (statusLabel.value === '高风险' ? 'danger' : statusLabel.value === '最佳' ? 'good' : 'neutral'))
const suggestion = computed(() => {
  if (statusLabel.value === '高风险') return '疲劳显著高于体能，建议安排恢复日，降低训练强度。'
  if (statusLabel.value === '灰色地带') return '处于训练刺激窗口，建议关注睡眠与静息心率，避免连续高强度。'
  if (statusLabel.value === '最佳') return '训练负荷平衡良好，可以按照计划继续推进。'
  return '当前状态较轻松，可以安排一次有氧或技术训练。'
})

const loadOption = computed(() => ({
  color: ['#33b5ff', '#8b5cf6', '#ef4444'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 8, textStyle: { color: '#9ca3af' } },
  grid: { left: 44, right: 22, top: 46, bottom: 36 },
  xAxis: {
    type: 'category',
    data: loadRows.value.map((row) => row.date),
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  series: [
    { name: '体能 CTL', type: 'line', smooth: true, data: loadRows.value.map((row) => row.ctl) },
    { name: '疲劳 ATL', type: 'line', smooth: true, data: loadRows.value.map((row) => row.atl) },
    { name: '状态 TSB', type: 'line', smooth: true, data: loadRows.value.map((row) => row.tsb), areaStyle: { opacity: 0.08 } },
  ],
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    loadRows.value = await getLoadBalance(filters)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '训练负荷加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => ({ ...filters }), load, { immediate: true })
</script>
