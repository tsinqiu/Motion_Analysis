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
import StateBlock from '@/components/StateBlock.vue'
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
const summary = ref({})
const timeline = ref([])
const typeStats = ref([])
const personalBests = ref({ running: [], cycling: [] })
const error = ref('')
const loading = ref(false)

const selectedLabel = computed(() => (mode.value === 'year' ? selected.value.slice(0, 4) : selected.value))
const runningAchievementKeys = ['longest_distance', 'fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon']
const cyclingAchievementKeys = ['longest_distance', 'fastest_avg_speed', 'highest_elevation_gain', 'highest_training_load']
const runningAchievements = computed(() => pickAchievements(personalBests.value.running, runningAchievementKeys))
const cyclingAchievements = computed(() => pickAchievements(personalBests.value.cycling, cyclingAchievementKeys))

const barOption = computed(() => ({
  color: ['#ef4444', '#21d47b', '#ff9d19', '#33b5ff'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, textStyle: { color: '#9ca3af' } },
  grid: { left: 58, right: 62, top: 46, bottom: 36, containLabel: true },
  xAxis: {
    type: 'category',
    data: timeline.value.map((row) => row.period),
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  yAxis: [
    {
      type: 'value',
      name: '距离 km',
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    {
      type: 'value',
      name: '卡路里',
      axisLabel: { color: '#9ca3af' },
      splitLine: { show: false },
    },
  ],
  series: [
    { name: '距离 km', type: 'bar', yAxisIndex: 0, data: timeline.value.map((row) => Number(row.totalDistanceKm || 0).toFixed(2)) },
    { name: '卡路里', type: 'bar', yAxisIndex: 1, data: timeline.value.map((row) => row.totalCalories || 0) },
  ],
}))

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
    const date = mode.value === 'year' ? selected.value.slice(0, 4) : selected.value
    const [nextSummary, nextTimeline, nextTypes, nextPersonalBests] = await Promise.all([
      getSummaryStats({ range: mode.value, date }),
      getTimelineStats({ group_by: mode.value === 'month' ? 'day' : 'month', range: mode.value, date }),
      getActivityTypeStats({ range: mode.value, date }),
      getPersonalBests({ range: mode.value, date }),
    ])
    summary.value = nextSummary || {}
    timeline.value = nextTimeline || []
    typeStats.value = nextTypes || []
    personalBests.value = nextPersonalBests || { running: [], cycling: [] }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '统计加载失败'
  } finally {
    loading.value = false
  }
}

watch([mode, selected], load, { immediate: true })
</script>
