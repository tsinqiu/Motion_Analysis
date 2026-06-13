<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>趋势</h2>
        </div>
        <strong class="avg-chip">平均 {{ averageValue }}</strong>
      </div>
      <div class="trend-filter-grid">
        <fieldset class="trend-filter-group">
          <legend>时间范围</legend>
          <button
            v-for="range in ranges"
            :key="range.value"
            type="button"
            class="trend-filter-button"
            :class="{ active: selectedRanges.includes(range.value) }"
            @click="toggleRange(range.value)"
          >
            <component :is="range.icon" :size="17" />
            <span>{{ range.label }}</span>
          </button>
        </fieldset>
        <fieldset class="trend-filter-group">
          <legend>运动类型</legend>
          <button
            v-for="sport in sportOptions"
            :key="sport.value"
            type="button"
            class="trend-filter-button"
            :class="{ active: selectedTypes.includes(sport.value) }"
            :style="{ '--sport-color': sport.color }"
            @click="toggleType(sport.value)"
          >
            <component :is="sport.icon" :size="17" />
            <span>{{ sport.label }}</span>
          </button>
        </fieldset>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载趋势" message="正在读取趋势数据。" />
    <StateBlock v-else-if="error" title="趋势加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="allTrendRows.length === 0" title="暂无数据" message="当前指标或筛选条件没有趋势数据。" />

    <template v-else>
      <ChartPanel title="指标趋势" :eyebrow="activeMetric.label" :option="trendOption" />
      <section class="metric-picker five-up">
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
import {
  Activity,
  Bike,
  CalendarDays,
  CalendarRange,
  Check,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  Mountain,
  Waves,
} from '@lucide/vue'

import ChartPanel from '@/components/ChartPanel.vue'
import StateBlock from '@/components/StateBlock.vue'
import { sportFilters } from '@/mock/garsync'
import { getMetricTrend } from '@/services/stats'
import { formatDistance, formatPaceSeconds } from '@/utils/formatters'

const ranges = [
  { label: '42天', value: '42d', icon: CalendarDays },
  { label: '3个月', value: '3m', icon: CalendarRange },
  { label: '6个月', value: '6m', icon: CalendarRange },
  { label: '1年', value: '1y', icon: CalendarRange },
  { label: '2年', value: '2y', icon: CalendarRange },
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

const sportIcons = {
  all: Check,
  running: Activity,
  cycling: Bike,
  swimming: Waves,
  strength_training: Dumbbell,
  other: CalendarDays,
}

const sportOptions = computed(() =>
  sportFilters.map((sport) => ({
    ...sport,
    icon: sportIcons[sport.value] || Activity,
  })),
)
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
  grid: { left: 24, right: 24, top: 34, bottom: 42, containLabel: true },
  xAxis: {
    type: 'category',
    data: xAxisDates.value,
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  dataZoom: [
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
      preventDefaultMouseMove: true,
    },
  ],
  yAxis: {
    type: 'value',
    name: activeMetric.value.unit,
    nameTextStyle: { color: '#9ca3af', padding: [0, 0, 0, 4] },
    nameGap: 18,
    axisLabel: {
      color: '#9ca3af',
      formatter: (value) => formatMetricValue(value),
      hideOverlap: true,
      margin: 12,
    },
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

function toggleRange(value) {
  selectedRanges.value = selectedRanges.value.includes(value)
    ? selectedRanges.value.filter((item) => item !== value)
    : [...selectedRanges.value, value]
  normalizeSelections()
}

function toggleType(value) {
  if (value === 'all') {
    selectedTypes.value = ['all']
    return
  }
  const withoutAll = selectedTypes.value.filter((item) => item !== 'all')
  selectedTypes.value = withoutAll.includes(value)
    ? withoutAll.filter((item) => item !== value)
    : [...withoutAll, value]
  normalizeSelections()
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
