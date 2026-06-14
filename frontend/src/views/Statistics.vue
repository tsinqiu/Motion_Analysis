<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>运动统计</h2>
        </div>
      </div>
      <div class="range-row">
        <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: mode === tab.value }" @click="mode = tab.value">
          {{ tab.label }}
        </button>
      </div>
      <SportTabs v-model="activityType" :items="sportFilters" aria-label="统计运动类型筛选" />
      <div v-if="mode !== 'all'" class="date-stepper">
        <button type="button" @click="stepDate(-1)">‹</button>
        <strong>{{ selectedLabel }}</strong>
        <button type="button" @click="stepDate(1)">›</button>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载统计" message="正在读取运动统计。" />
    <StateBlock v-else-if="error" title="统计加载失败" :message="error" action-label="重试" tone="danger" @action="load" />

    <template v-else>
      <div class="metric-grid">
        <MetricCard label="总距离" :value="formatDistance((summary.totalDistanceKm || 0) * 1000)" />
        <MetricCard label="卡路里" :value="formatCalories(summary.totalCalories)" />
        <MetricCard label="脂肪消耗" :value="formatFatKg(summary.totalCalories)" />
        <MetricCard label="运动时长" :value="formatClockDuration(summary.totalDurationS)" />
      </div>
      <div class="range-row" aria-label="柱状图指标">
        <button
          v-for="metric in barMetrics"
          :key="metric.key"
          type="button"
          :class="{ active: selectedBarMetric === metric.key }"
          @click="selectedBarMetric = metric.key"
        >
          {{ metric.label }}
        </button>
      </div>
      <ChartPanel title="周期柱状统计" eyebrow="运动统计" :option="barOption" />
      <ChartPanel title="运动类型占比" eyebrow="运动统计" :option="typeOption" />
      <section class="panel achievement-panel">
        <div class="panel-heading">
          <div>
            <p class="overline">Achievements</p>
            <h2>成就统计</h2>
          </div>
        </div>
        <div class="achievement-grid">
          <article class="record-group">
            <h3>跑步成就</h3>
            <div class="achievement-list">
              <button
                v-for="item in runningAchievements"
                :key="item.key"
                type="button"
                :disabled="!item.activityId"
                @click="goToActivity(item)"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatAchievementValue(item) }}</strong>
                <small>{{ item.date || '--' }}</small>
              </button>
            </div>
          </article>
          <article class="record-group">
            <h3>骑行成就</h3>
            <div class="achievement-list">
              <button
                v-for="item in cyclingAchievements"
                :key="item.key"
                type="button"
                :disabled="!item.activityId"
                @click="goToActivity(item)"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatAchievementValue(item) }}</strong>
                <small>{{ item.date || '--' }}</small>
              </button>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ChartPanel from '@/components/ChartPanel.vue'
import MetricCard from '@/components/MetricCard.vue'
import SportTabs from '@/components/SportTabs.vue'
import StateBlock from '@/components/StateBlock.vue'
import { sportFilters } from '@/mock/garsync'
import { getActivityTypeStats, getPersonalBests, getSummaryStats, getTimelineStats } from '@/services/stats'
import { formatCalories, formatClockDuration, formatDistance, formatFatKg, formatPaceSeconds } from '@/utils/formatters'

const tabs = [
  { label: '按月', value: 'month' },
  { label: '按年', value: 'year' },
  { label: '全部', value: 'all' },
]

const router = useRouter()
const mode = ref('month')
const selected = ref('2026-06')
const activityType = ref('all')
const selectedBarMetric = ref('distance')
const summary = ref({})
const timeline = ref([])
const typeStats = ref([])
const personalBests = ref({ running: [], cycling: [] })
const error = ref('')
const loading = ref(false)

const barMetrics = [
  {
    key: 'distance',
    label: '距离',
    unit: 'km',
    color: '#ef4444',
    getValue: (row) => roundChartValue(row.totalDistanceKm, 2),
    formatValue: (value) => `${Number(value || 0).toFixed(2)} km`,
  },
  {
    key: 'calories',
    label: '卡路里',
    unit: 'kcal',
    color: '#ff9d19',
    getValue: (row) => roundChartValue(row.totalCalories, 0),
    formatValue: (value) => `${Math.round(Number(value || 0)).toLocaleString('zh-CN')} kcal`,
  },
  {
    key: 'duration',
    label: '运动时长',
    unit: 'h',
    color: '#33b5ff',
    getValue: (row) => roundChartValue(Number(row.totalDurationS || 0) / 3600, 2),
    formatValue: (value) => `${Number(value || 0).toFixed(2)} h`,
  },
  {
    key: 'load',
    label: '训练负荷',
    unit: '',
    color: '#8b5cf6',
    getValue: (row) => roundChartValue(row.totalTrainingLoad, 1),
    formatValue: (value) => Number(value || 0).toFixed(1),
  },
]

const selectedLabel = computed(() => (mode.value === 'year' ? selected.value.slice(0, 4) : selected.value))
const runningAchievementKeys = ['longest_distance', 'fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon']
const cyclingAchievementKeys = ['longest_distance', 'fastest_avg_speed', 'highest_elevation_gain', 'highest_training_load']
const runningAchievements = computed(() => pickAchievements(personalBests.value.running, runningAchievementKeys))
const cyclingAchievements = computed(() => pickAchievements(personalBests.value.cycling, cyclingAchievementKeys))
const activeBarMetric = computed(() => barMetrics.find((metric) => metric.key === selectedBarMetric.value) || barMetrics[0])

const barOption = computed(() => {
  const metric = activeBarMetric.value
  const seriesName = metric.unit ? `${metric.label} ${metric.unit}` : metric.label
  return {
    color: [metric.color],
    tooltip: {
      trigger: 'axis',
      formatter: (params = []) => {
        const point = params[0]
        if (!point) return ''
        return `${point.axisValue}<br/>${seriesName}: ${metric.formatValue(point.value)}`
      },
    },
    grid: { left: 58, right: 28, top: 42, bottom: 42, containLabel: true },
    xAxis: {
      type: 'category',
      data: timeline.value.map((row) => row.period),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: {
        color: '#9ca3af',
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      name: seriesName,
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [
      {
        name: seriesName,
        type: 'bar',
        data: timeline.value.map(metric.getValue),
        barMaxWidth: 22,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
})

const typeOption = computed(() => ({
  color: ['#21d47b', '#ff9d19', '#33b5ff', '#8b5cf6', '#94a3b8'],
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, textStyle: { color: '#9ca3af' } },
  series: [
    {
      name: '运动类型',
      type: 'pie',
      radius: ['45%', '68%'],
      label: { color: '#d1d5db', formatter: '{b}: {c} 次' },
      data: typeStats.value.map((item) => ({ name: item.activity_type, value: item.activity_count })),
    },
  ],
}))

function roundChartValue(value, digits = 2) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return 0
  const factor = 10 ** digits
  return Math.round(number * factor) / factor
}

function formatDateText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayText() {
  return formatDateText(new Date())
}

function lastDayOfMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  return formatDateText(new Date(year, month, 0))
}

function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return formatDateText(date)
}

function periodFilterParams() {
  const today = todayText()
  if (mode.value === 'month') {
    const startDate = `${selected.value}-01`
    const naturalEndDate = lastDayOfMonth(selected.value)
    const endDate = selected.value === today.slice(0, 7) ? today : naturalEndDate
    return { start_date: startDate, end_date: endDate }
  }
  if (mode.value === 'year') {
    const year = selected.value.slice(0, 4)
    const startDate = `${year}-01-01`
    const endDate = year === today.slice(0, 4) ? today : `${year}-12-31`
    return { start_date: startDate, end_date: endDate }
  }
  return {}
}

function createEmptyTimelineRow(period) {
  return {
    period,
    activityCount: 0,
    totalDistanceM: 0,
    totalDistanceKm: 0,
    totalDurationS: 0,
    totalDurationMin: 0,
    totalCalories: 0,
    totalTrainingLoad: 0,
    avgHeartRateBpm: null,
  }
}

function fillTimelineRows(rows = []) {
  const byPeriod = new Map((rows || []).map((row) => [row.period, row]))
  if (mode.value === 'month') {
    const { start_date: startDate, end_date: endDate } = periodFilterParams()
    const periods = []
    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      periods.push(cursor)
    }
    return periods.map((period) => ({ ...createEmptyTimelineRow(period), ...(byPeriod.get(period) || {}) }))
  }
  if (mode.value === 'year') {
    const year = selected.value.slice(0, 4)
    const today = todayText()
    const endMonth = year === today.slice(0, 4) ? Number(today.slice(5, 7)) : 12
    return Array.from({ length: endMonth }, (_, index) => {
      const period = `${year}-${String(index + 1).padStart(2, '0')}`
      return { ...createEmptyTimelineRow(period), ...(byPeriod.get(period) || {}) }
    })
  }
  return rows || []
}

function stepDate(offset) {
  if (mode.value === 'year') {
    selected.value = `${Number(selected.value.slice(0, 4)) + offset}-01`
    return
  }
  const date = new Date(`${selected.value}-01T00:00:00`)
  date.setMonth(date.getMonth() + offset)
  selected.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function pickAchievements(items = [], keys = []) {
  const byKey = new Map((items || []).map((item) => [item.key, item]))
  return keys.map((key) => byKey.get(key) || {
    key,
    label: achievementFallbackLabel(key),
    value: null,
    unit: '',
  })
}

function achievementFallbackLabel(key) {
  const labels = {
    longest_distance: '最长距离',
    fastest_5k: '5km PB',
    fastest_10k: '10km PB',
    fastest_half_marathon: '半马 PB',
    fastest_marathon: '全马 PB',
    fastest_avg_speed: '最快均速',
    highest_elevation_gain: '最大爬升',
    highest_training_load: '最高训练负荷',
  }
  return labels[key] || key
}

function formatAchievementValue(item) {
  if (item.value === null || item.value === undefined) return '--'
  const value = Number(item.value)
  if (!Number.isFinite(value)) return '--'
  if (item.unit === 'km') return `${value.toFixed(2)} km`
  if (item.unit === 'sec/km') return formatPaceSeconds(value)
  if (item.unit === 'km/h') return `${value.toFixed(1)} km/h`
  if (item.unit === 'm') return `${value.toFixed(0)} m`
  if (item.unit === 'load') return value.toFixed(1)
  return `${value.toLocaleString('zh-CN')} ${item.unit || ''}`.trim()
}

function goToActivity(item) {
  if (item.activityId) {
    router.push(`/activities/${item.activityId}`)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const baseParams = {
      range: mode.value,
      activity_type: activityType.value,
      ...periodFilterParams(),
    }
    if (mode.value === 'year') {
      baseParams.date = selected.value.slice(0, 4)
    } else if (mode.value === 'month') {
      baseParams.date = selected.value
    }
    const [nextSummary, nextTimeline, nextTypes, nextPersonalBests] = await Promise.all([
      getSummaryStats(baseParams),
      getTimelineStats({ ...baseParams, group_by: mode.value === 'month' ? 'day' : 'month' }),
      getActivityTypeStats(baseParams),
      getPersonalBests(baseParams),
    ])
    summary.value = nextSummary || {}
    timeline.value = fillTimelineRows(nextTimeline || [])
    typeStats.value = nextTypes || []
    personalBests.value = nextPersonalBests || { running: [], cycling: [] }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '统计加载失败'
  } finally {
    loading.value = false
  }
}

watch([mode, selected, activityType], load, { immediate: true })
</script>
