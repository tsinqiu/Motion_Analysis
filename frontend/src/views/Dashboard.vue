<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载运动概览"
      message="正在读取活动列表、轨迹点、心率和速度序列。"
    />
    <StateBlock
      v-else-if="error"
      title="概览加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <StateBlock
      v-else-if="activities.length === 0"
      title="暂无运动数据"
      message="后端接口或 mock 数据暂时没有返回活动记录。"
    />

    <div v-else class="dashboard-grid">
      <section class="hero-panel">
        <div>
          <p class="overline">Motion Analysis</p>
          <h2>Garmin 运动数据分析数据库管理系统</h2>
          <p>前端展示 Activities、Sessions、TrackPoints、Laps 等数据库结构化数据，只通过后端 API 访问数据，不直接连接 MySQL。</p>
        </div>
        <div class="hero-actions">
          <RouterLink class="primary-link" to="/activities">查看活动</RouterLink>
          <RouterLink class="secondary-link inverse" to="/schema">数据库结构</RouterLink>
          <RouterLink class="secondary-link inverse" to="/mobile-preview">移动端效果</RouterLink>
        </div>
      </section>

      <MetricCard label="活动数量" :value="`${activities.length}`" hint="当前数据源" />
      <MetricCard label="总距离" :value="formatDistance(totalDistance)" hint="跑步 + 骑行" />
      <MetricCard label="平均心率" :value="`${avgHeartRate} bpm`" hint="Sessions.avg_heart_rate_bpm" />

      <ChartPanel class="wide" title="心率与速度趋势" eyebrow="TrackPoints" :option="trendOption" />
      <RoutePreview :points="trackPoints" />

      <section class="panel wide">
        <div class="panel-heading">
          <div>
            <p class="overline">Activities + Sessions</p>
            <h2>最近运动</h2>
          </div>
        </div>
        <ActivityTable :activities="activities" @select="goToActivity" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import ActivityTable from '@/components/ActivityTable.vue'
import ChartPanel from '@/components/ChartPanel.vue'
import MetricCard from '@/components/MetricCard.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getActivities, getSpeedSeries, getTrackPoints, getHeartRateSeries } from '@/services/activities'
import { formatDistance } from '@/utils/formatters'

const router = useRouter()

const { data, error, load, loading } = useAsyncData(async () => {
  const activityRows = await getActivities()
  const firstActivityId = activityRows[0]?.id

  if (!firstActivityId) {
    return {
      activities: activityRows,
      heartRateSeries: [],
      speedSeries: [],
      trackPoints: [],
    }
  }

  const [points, heartRate, speed] = await Promise.all([
    getTrackPoints(firstActivityId),
    getHeartRateSeries(firstActivityId),
    getSpeedSeries(firstActivityId),
  ])

  return {
    activities: activityRows,
    heartRateSeries: heartRate,
    speedSeries: speed,
    trackPoints: points,
  }
})

const activities = computed(() => data.value?.activities || [])
const trackPoints = computed(() => data.value?.trackPoints || [])
const heartRateSeries = computed(() => data.value?.heartRateSeries || [])
const speedSeries = computed(() => data.value?.speedSeries || [])

const totalDistance = computed(() =>
  activities.value.reduce((sum, activity) => sum + (activity.total_distance_m || 0), 0),
)

const avgHeartRate = computed(() => {
  const values = activities.value
    .map((activity) => activity.avg_heart_rate_bpm)
    .filter(Boolean)
  if (values.length === 0) return '--'
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
})

const trendOption = computed(() => ({
  color: ['#21d47b', '#2563eb'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 8, textStyle: { color: '#5b6577' } },
  grid: { left: 42, right: 24, top: 42, bottom: 28 },
  xAxis: {
    type: 'category',
    data: heartRateSeries.value.map((point) => point.sample_time_utc.slice(11, 16)),
    axisLine: { lineStyle: { color: '#d7dde8' } },
    axisLabel: { color: '#687385' },
  },
  yAxis: [
    { type: 'value', name: 'bpm', axisLabel: { color: '#687385' }, splitLine: { lineStyle: { color: '#ecf0f5' } } },
    { type: 'value', name: 'm/s', axisLabel: { color: '#687385' }, splitLine: { show: false } },
  ],
  series: [
    {
      name: '心率',
      type: 'line',
      smooth: true,
      data: heartRateSeries.value.map((point) => point.heart_rate_bpm),
      areaStyle: { opacity: 0.08 },
    },
    {
      name: '速度',
      type: 'line',
      smooth: true,
      yAxisIndex: 1,
      data: speedSeries.value.map((point) => point.speed_mps),
    },
  ],
}))

function goToActivity(activity) {
  router.push(`/activities/${activity.id}`)
}
</script>
