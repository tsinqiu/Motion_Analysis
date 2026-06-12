<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Metric trends</p>
          <h2>趋势</h2>
        </div>
        <strong class="avg-chip">Avg: {{ averageValue }}</strong>
      </div>
      <SportTabs v-model="filters.activity_type" :items="sportFilters" />
      <div class="range-row">
        <button v-for="range in ranges" :key="range.value" type="button" :class="{ active: filters.range === range.value }" @click="filters.range = range.value">
          {{ range.label }}
        </button>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载趋势" message="正在读取 metric-trend 聚合结果。" />
    <StateBlock v-else-if="error" title="趋势加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="trendRows.length === 0" title="暂无数据" message="当前指标或筛选条件没有趋势数据。" />

    <template v-else>
      <ChartPanel title="指标趋势" :eyebrow="activeMetric.label" :option="trendOption" />
      <section class="metric-picker">
        <button
          v-for="metric in metrics"
          :key="metric.value"
          type="button"
          :class="{ active: filters.metric === metric.value }"
          :style="{ '--metric-color': metric.color }"
          @click="filters.metric = metric.value"
        >
          <component :is="metric.icon" :size="18" />
          <span>{{ metric.label }}</span>
          <small>{{ metric.unit }}</small>
        </button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Activity, Bike, Flame, Gauge, HeartPulse, Mountain, Zap } from '@lucide/vue'

import ChartPanel from '@/components/ChartPanel.vue'
import SportTabs from '@/components/SportTabs.vue'
import StateBlock from '@/components/StateBlock.vue'
import { sportFilters } from '@/mock/garsync'
import { getMetricTrend } from '@/services/stats'

const ranges = [
  { label: '42天', value: '42d' },
  { label: '3个月', value: '3m' },
  { label: '6个月', value: '6m' },
  { label: '1年', value: '1y' },
  { label: '2年', value: '2y' },
]

const metrics = [
  { label: '平均心率', value: 'avg_heart_rate_bpm', unit: 'bpm', color: '#ef4444', icon: HeartPulse },
  { label: '最大心率', value: 'max_heart_rate_bpm', unit: 'bpm', color: '#f97316', icon: HeartPulse },
  { label: '平均配速', value: 'avg_pace_sec_per_km', unit: 'sec/km', color: '#21d47b', icon: Gauge },
  { label: '平均步频', value: 'avg_cadence_spm', unit: 'spm/rpm', color: '#ff9d19', icon: Activity },
  { label: 'VO2 Max', value: 'vo2max', unit: '', color: '#33b5ff', icon: Zap },
  { label: '训练负荷', value: 'activity_training_load', unit: 'load', color: '#8b5cf6', icon: Flame },
  { label: '距离', value: 'distance_m', unit: 'm', color: '#22c55e', icon: Mountain },
  { label: '平均速度', value: 'avg_speed_mps', unit: 'm/s', color: '#60a5fa', icon: Bike },
]

const filters = reactive({
  activity_type: 'all',
  range: '6m',
  metric: 'avg_heart_rate_bpm',
})
const trendRows = ref([])
const error = ref('')
const loading = ref(false)

const activeMetric = computed(() => metrics.find((metric) => metric.value === filters.metric) || metrics[0])
const averageValue = computed(() => {
  const values = trendRows.value.map((row) => Number(row.value)).filter(Number.isFinite)
  if (!values.length) return '--'
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
})

const trendOption = computed(() => ({
  color: [activeMetric.value.color],
  tooltip: { trigger: 'axis' },
  grid: { left: 48, right: 24, top: 30, bottom: 42 },
  xAxis: {
    type: 'category',
    data: trendRows.value.map((row) => row.date),
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  series: [
    {
      name: activeMetric.value.label,
      type: 'line',
      smooth: true,
      symbolSize: 8,
      data: trendRows.value.map((row) => row.value),
      areaStyle: { opacity: 0.1 },
    },
  ],
}))

async function load() {
  loading.value = true
  error.value = ''
  try {
    trendRows.value = await getMetricTrend(filters)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '趋势加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => ({ ...filters }), load, { immediate: true })
</script>
