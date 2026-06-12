<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Sports statistics</p>
          <h2>运动统计</h2>
        </div>
        <button class="secondary-link" type="button">分享</button>
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

    <StateBlock v-if="loading" title="正在加载统计" message="正在读取 summary、timeline 和 activity-types。" />
    <StateBlock v-else-if="error" title="统计加载失败" :message="error" action-label="重试" tone="danger" @action="load" />

    <template v-else>
      <div class="metric-grid">
        <MetricCard label="总距离" :value="formatDistance((summary.totalDistanceKm || 0) * 1000)" hint="按当前周期汇总" />
        <MetricCard label="卡路里" :value="formatCalories(summary.totalCalories)" hint="ActivitySummaries.calories" />
        <MetricCard label="脂肪消耗" :value="formatFatKg(summary.totalCalories)" hint="按 7700 kcal/kg 估算" />
        <MetricCard label="运动时长" :value="formatClockDuration(summary.totalDurationS)" hint="Sessions.total_timer_time_s" />
      </div>
      <ChartPanel title="周期柱状统计" eyebrow="timeline API" :option="barOption" />
      <ChartPanel title="运动类型占比" eyebrow="activity-types API" :option="typeOption" />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import ChartPanel from '@/components/ChartPanel.vue'
import MetricCard from '@/components/MetricCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import { getActivityTypeStats, getSummaryStats, getTimelineStats } from '@/services/activities'
import { formatCalories, formatClockDuration, formatDistance, formatFatKg } from '@/utils/formatters'

const tabs = [
  { label: '按月', value: 'month' },
  { label: '按年', value: 'year' },
  { label: '全部', value: 'all' },
]

const mode = ref('month')
const selected = ref('2026-06')
const summary = ref({})
const timeline = ref([])
const typeStats = ref([])
const error = ref('')
const loading = ref(false)

const selectedLabel = computed(() => (mode.value === 'year' ? selected.value.slice(0, 4) : selected.value))

const barOption = computed(() => ({
  color: ['#ef4444', '#21d47b', '#ff9d19', '#33b5ff'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, textStyle: { color: '#9ca3af' } },
  grid: { left: 52, right: 22, top: 46, bottom: 36 },
  xAxis: {
    type: 'category',
    data: timeline.value.map((row) => row.period),
    axisLine: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#9ca3af' },
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  series: [
    { name: '距离 km', type: 'bar', data: timeline.value.map((row) => Number(row.totalDistanceKm || 0).toFixed(2)) },
    { name: '卡路里', type: 'bar', data: timeline.value.map((row) => row.totalCalories || 0) },
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
  selected.value = date.toISOString().slice(0, 7)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const date = mode.value === 'year' ? selected.value.slice(0, 4) : selected.value
    const [nextSummary, nextTimeline, nextTypes] = await Promise.all([
      getSummaryStats({ range: mode.value, date }),
      getTimelineStats({ group_by: mode.value === 'month' ? 'day' : 'month', range: mode.value, date }),
      getActivityTypeStats({ range: mode.value, date }),
    ])
    summary.value = nextSummary || {}
    timeline.value = nextTimeline || []
    typeStats.value = nextTypes || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '统计加载失败'
  } finally {
    loading.value = false
  }
}

watch([mode, selected], load, { immediate: true })
</script>
