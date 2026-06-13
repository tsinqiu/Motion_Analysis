<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>趋势</h2>
        </div>
        <strong class="avg-chip">平均 {{ averageValue }}</strong>
      </div>
      <div class="checkbox-filter-grid">
        <fieldset>
          <legend>时间范围</legend>
          <label v-for="range in ranges" :key="range.value" class="checkbox-pill">
            <input v-model="selectedRanges" type="checkbox" :value="range.value" />
            <span>{{ range.label }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>运动类型</legend>
          <label v-for="sport in sportFilters" :key="sport.value" class="checkbox-pill">
            <input v-model="selectedTypes" type="checkbox" :value="sport.value" />
            <span>{{ sport.label }}</span>
          </label>
        </fieldset>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载趋势" message="正在读取趋势数据。" />
    <StateBlock v-else-if="error" title="趋势加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="allTrendRows.length === 0" title="暂无数据" message="当前指标或筛选条件没有趋势数据。" />

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
import { Activity, Flame, Gauge, HeartPulse, Mountain } from '@lucide/vue'

import ChartPanel from '@/components/ChartPanel.vue'
import StateBlock from '@/components/StateBlock.vue'
import { sportFilters } from '@/mock/garsync'
import { getMetricTrend } from '@/services/stats'
import { formatDistance, formatPaceSeconds } from '@/utils/formatters'

const ranges = [
  { label: '42天', value: '42d' },
  { label: '3个月', value: '3m' },
  { label: '6个月', value: '6m' },
  { label: '1年', value: '1y' },
  { label: '2年', value: '2y' },
]

const metrics = [
  { label: '平均心率', value: 'avg_heart_rate_bpm', unit: 'bpm', color: '#ef4444', icon: HeartPulse },
  { label: '平均配速', value: 'avg_pace_sec_per_km', unit: '分:秒/km', color: '#21d47b', icon: Gauge },
  { label: '平均步频', value: 'avg_cadence_spm', unit: '步/分钟', color: '#ff9d19', icon: Activity },
  { label: '距离', value: 'distance_m', unit: 'km', color: '#22c55e', icon: Mountain },
  { label: '训练负荷', value: 'activity_training_load', unit: '负荷', color: '#8b5cf6', icon: Flame },
]

const filters = reactive({
  metric: 'avg_heart_rate_bpm',
})
const selectedRanges = ref(['6m'])
const selectedTypes = ref(['all'])
const trendSeries = ref([])
const error = ref('')
const loading = ref(false)

const activeMetric = computed(() => metrics.find((metric) => metric.value === filters.metric) || metrics[0])
const allTrendRows = computed(() => trendSeries.value.flatMap((series) => series.rows || []))
const averageValue = computed(() => {
  const values = allTrendRows.value.map((row) => Number(row.value)).filter(Number.isFinite)
  if (!values.length) return '--'
  return formatMetricValue(values.reduce((sum, value) => sum + value, 0) / values.length)
})
const xAxisDates = computed(() => {
  const dates = new Set()
  trendSeries.value.forEach((series) => {
    series.rows.forEach((row) => dates.add(row.date))
  })
  return [...dates].sort()
})

function formatMetricValue(value) {
  if (!Number.isFinite(Number(value))) return '--'
  if (filters.metric === 'avg_pace_sec_per_km') return formatPaceSeconds(value)
  if (filters.metric === 'distance_m') return formatDistance(value)
  if (filters.metric === 'avg_heart_rate_bpm') return `${Number(value).toFixed(0)} bpm`
  if (filters.metric === 'avg_cadence_spm') return `${Number(value).toFixed(0)} 步/分钟`
  return Number(value).toFixed(1)
}

function formatTooltip(params = []) {
  const items = Array.isArray(params) ? params : [params]
  const head = items[0]?.axisValue || ''
  const lines = items
    .filter((item) => item && item.data !== null && item.data !== undefined)
    .map((item) => `${item.marker}${item.seriesName}: ${formatMetricValue(item.data)}`)
  return [head, ...lines].join('<br/>')
}

const trendOption = computed(() => ({
  color: ['#21d47b', '#33b5ff', '#ff9d19', '#8b5cf6', '#ef4444', '#94a3b8'],
  tooltip: { trigger: 'axis', formatter: formatTooltip },
  legend: { top: 0, textStyle: { color: '#64748b' } },
  grid: { left: 48, right: 24, top: 30, bottom: 42 },
  xAxis: {
    type: 'category',
    data: xAxisDates.value,
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9ca3af', formatter: (value) => formatMetricValue(value) },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  series: trendSeries.value.map((series) => ({
    name: series.label,
    type: 'line',
    smooth: true,
    symbolSize: 7,
    data: xAxisDates.value.map((date) => {
      const row = series.rows.find((item) => item.date === date)
      return row ? row.value : null
    }),
    areaStyle: { opacity: trendSeries.value.length === 1 ? 0.1 : 0 },
  })),
}))

function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label || value
}

function normalizeSelections() {
  if (!selectedRanges.value.length) selectedRanges.value = ['6m']
  if (!selectedTypes.value.length) selectedTypes.value = ['all']
  if (selectedTypes.value.includes('all') && selectedTypes.value.length > 1) {
    selectedTypes.value = selectedTypes.value.filter((value) => value !== 'all')
  }
}

async function load() {
  normalizeSelections()
  loading.value = true
  error.value = ''
  try {
    const rangeList = selectedRanges.value
    const typeList = selectedTypes.value.includes('all') ? ['all'] : selectedTypes.value
    trendSeries.value = await Promise.all(
      rangeList.flatMap((range) => typeList.map(async (activityType) => {
        const rows = await getMetricTrend({
          metric: filters.metric,
          range,
          activity_type: activityType,
        })
        return {
          key: `${range}-${activityType}`,
          label: `${labelFor(ranges, range)} · ${labelFor(sportFilters, activityType)}`,
          rows: rows || [],
        }
      })),
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : '趋势加载失败'
  } finally {
    loading.value = false
  }
}

watch([selectedRanges, selectedTypes, () => filters.metric], load, { immediate: true, deep: true })
</script>
