<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载运动详情"
      message="正在读取活动摘要、轨迹点、心率、速度和分段数据。"
    />
    <StateBlock
      v-else-if="error"
      title="运动详情加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="loadActivity(route.params.id)"
    />
    <StateBlock
      v-else-if="!activity"
      title="未找到该活动"
      message="当前活动 ID 不存在，或后端接口没有返回对应记录。"
      action-label="返回列表"
      @action="router.push('/activities')"
    />

    <template v-else>
    <section class="hero-panel detail-hero">
      <div>
        <p class="overline">{{ activity.activity_key }}</p>
        <h2>{{ activity.activity_type }} 详情</h2>
        <p>{{ activity.local_start_time }} 开始，数据来自 Sessions、TrackPoints 与 Laps。</p>
      </div>
      <RouterLink class="secondary-link" to="/activities">返回列表</RouterLink>
    </section>

    <div class="metric-grid">
      <MetricCard label="距离" :value="formatDistance(activity.total_distance_m)" hint="Sessions.total_distance_m" />
      <MetricCard label="总用时" :value="formatDuration(activity.total_timer_time_s)" hint="Sessions.total_timer_time_s" />
      <MetricCard label="平均心率" :value="`${activity.avg_heart_rate_bpm || '--'} bpm`" hint="Sessions.avg_heart_rate_bpm" />
      <MetricCard label="平均配速" :value="formatPace(activity.avg_speed_mps)" hint="由速度换算" />
    </div>

    <div class="detail-grid">
      <ChartPanel title="心率曲线" eyebrow="heart-rate API" :option="heartRateOption" />
      <ChartPanel title="速度曲线" eyebrow="speed API" :option="speedOption" />
      <RoutePreview :points="trackPoints" />
      <LapTable :laps="laps" />
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ChartPanel from '@/components/ChartPanel.vue'
import LapTable from '@/components/LapTable.vue'
import MetricCard from '@/components/MetricCard.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import StateBlock from '@/components/StateBlock.vue'
import {
  getActivity,
  getHeartRateSeries,
  getLaps,
  getSpeedSeries,
  getTrackPoints,
} from '@/services/activities'
import { formatDistance, formatDuration, formatPace } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()
const activity = ref(null)
const error = ref('')
const loading = ref(false)
const trackPoints = ref([])
const heartRateSeries = ref([])
const speedSeries = ref([])
const laps = ref([])

const heartRateOption = computed(() => createLineOption('心率', 'bpm', '#21d47b', heartRateSeries.value, 'heart_rate_bpm'))
const speedOption = computed(() => createLineOption('速度', 'm/s', '#2563eb', speedSeries.value, 'speed_mps'))

function createLineOption(name, unit, color, source, field) {
  return {
    color: [color],
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 28 },
    xAxis: {
      type: 'category',
      data: source.map((point) => point.sample_time_utc.slice(11, 16)),
      axisLine: { lineStyle: { color: '#d7dde8' } },
      axisLabel: { color: '#687385' },
    },
    yAxis: {
      type: 'value',
      name: unit,
      axisLabel: { color: '#687385' },
      splitLine: { lineStyle: { color: '#ecf0f5' } },
    },
    series: [
      {
        name,
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: source.map((point) => point[field]),
        areaStyle: { opacity: 0.1 },
      },
    ],
  }
}

async function loadActivity(id) {
  loading.value = true
  error.value = ''

  try {
    const nextActivity = await getActivity(id)
    activity.value = nextActivity || null

    if (!nextActivity) {
      trackPoints.value = []
      heartRateSeries.value = []
      speedSeries.value = []
      laps.value = []
      return
    }

    const [points, heartRate, speed, lapRows] = await Promise.all([
      getTrackPoints(id),
      getHeartRateSeries(id),
      getSpeedSeries(id),
      getLaps(id),
    ])

    trackPoints.value = points
    heartRateSeries.value = heartRate
    speedSeries.value = speed
    laps.value = lapRows
  } catch (err) {
    error.value = err instanceof Error ? err.message : '详情加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, loadActivity, { immediate: true })
</script>
