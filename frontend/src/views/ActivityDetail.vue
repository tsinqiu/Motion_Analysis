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
      message="当前活动不存在，或没有可查看的记录。"
      action-label="返回列表"
      @action="router.push('/activities')"
    />

    <template v-else>
      <section class="app-hero detail-hero" :style="{ '--sport-color': sportColor }">
        <div>
          <h2>{{ activity.activity_name || activity.activity_type }}</h2>
          <p>{{ formatDateTime(activity.local_start_time) }} 开始</p>
        </div>
        <div class="hero-actions">
          <RouterLink class="secondary-link inverse" to="/activities">返回列表</RouterLink>
          <button v-if="canManageManual" class="secondary-link inverse" type="button" @click="modalOpen = true">编辑</button>
          <button v-if="canManageManual" class="danger-link" type="button" :disabled="isDeleting" @click="removeActivity">
            {{ isDeleting ? '删除中' : '删除' }}
          </button>
        </div>
      </section>

      <div class="metric-grid">
        <MetricCard label="距离" :value="formatDistance(activity.total_distance_m)" />
        <MetricCard label="总用时" :value="formatClockDuration(activity.total_timer_time_s)" />
        <MetricCard label="平均心率" :value="`${activity.avg_heart_rate_bpm || '--'} bpm`" />
        <MetricCard label="训练负荷" :value="`${activity.activity_training_load || '--'}`" />
      </div>

      <div class="detail-grid">
        <ChartPanel title="心率曲线" eyebrow="运动详情" :option="heartRateOption" />
        <ChartPanel title="速度曲线" eyebrow="运动详情" :option="speedOption" />
        <RoutePreview :points="trackPoints" />
        <LapTable :laps="laps" />
      </div>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>跑步负荷预测</h2>
          </div>
          <button class="primary-link" type="button" @click="runPrediction">运行分析</button>
        </div>
        <StateBlock
          v-if="predictionError"
          title="模型分析失败"
          :message="predictionError"
          tone="danger"
        />
        <div v-if="prediction" class="prediction-grid">
          <span><small>负荷等级</small><b>{{ prediction.predictedTrainingLoadLevel }}</b></span>
          <span><small>疲劳风险</small><b>{{ prediction.fatigueRisk }}</b></span>
          <span><small>置信度</small><b>{{ Math.round((prediction.confidence || 0) * 100) }}%</b></span>
          <p>{{ prediction.recoveryAdvice }}</p>
        </div>
        <p v-else class="muted-copy">点击后根据当前运动记录生成训练建议。</p>
      </section>

      <ManualActivityModal
        v-if="modalOpen"
        :activity="activity"
        :save="(payload) => updateManualActivity(activity.id, payload)"
        @close="modalOpen = false"
        @saved="handleSaved"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ChartPanel from '@/components/ChartPanel.vue'
import LapTable from '@/components/LapTable.vue'
import ManualActivityModal from '@/components/ManualActivityModal.vue'
import MetricCard from '@/components/MetricCard.vue'
import RoutePreview from '@/components/RoutePreview.vue'
import StateBlock from '@/components/StateBlock.vue'
import {
  deleteManualActivity,
  getActivity,
  getHeartRateSeries,
  getLaps,
  getSpeedSeries,
  getTrackPoints,
  predictRunningLoad,
  updateManualActivity,
} from '@/services/activities'
import { authSession } from '@/stores/authStore'
import { formatClockDuration, formatDateTime, formatDistance } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()
const activity = ref(null)
const error = ref('')
const loading = ref(false)
const modalOpen = ref(false)
const isDeleting = ref(false)
const prediction = ref(null)
const predictionError = ref('')
const trackPoints = ref([])
const heartRateSeries = ref([])
const speedSeries = ref([])
const laps = ref([])

const sportColor = computed(() => {
  if (activity.value?.activity_type === '骑行') return '#ff9d19'
  if (activity.value?.activity_type === '游泳') return '#33b5ff'
  if (activity.value?.activity_type === '力量训练') return '#8b5cf6'
  return '#21d47b'
})
const canManageManual = computed(() => authSession.user?.role === 'admin' && activity.value?.is_manual)

const heartRateOption = computed(() => createLineOption('心率', 'bpm', '#ef4444', heartRateSeries.value, 'heart_rate_bpm'))
const speedOption = computed(() => createLineOption('速度', 'm/s', '#33b5ff', speedSeries.value, 'speed_mps'))

function createLineOption(name, unit, color, source, field) {
  return {
    color: [color],
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 28 },
    xAxis: {
      type: 'category',
      data: source.map((point) => point.sample_time_utc.slice(11, 16)),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'value',
      name: unit,
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#1f2937' } },
    },
    series: [
      {
        name,
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: source.map((point) => point[field]),
        areaStyle: { opacity: 0.12 },
      },
    ],
  }
}

async function loadActivity(id) {
  loading.value = true
  error.value = ''
  prediction.value = null
  predictionError.value = ''

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

async function runPrediction() {
  predictionError.value = ''
  try {
    prediction.value = await predictRunningLoad({
      distanceM: activity.value.total_distance_m,
      durationS: activity.value.total_timer_time_s,
      movingDurationS: activity.value.total_moving_time_s,
      elapsedDurationS: activity.value.total_timer_time_s,
      avgSpeedMps: activity.value.avg_speed_mps,
      maxSpeedMps: activity.value.max_speed_mps,
      avgHeartRateBpm: activity.value.avg_heart_rate_bpm,
      maxHeartRateBpm: activity.value.max_heart_rate_bpm,
      avgCadenceSpm: activity.value.avg_cadence,
      elevationGainM: activity.value.total_ascent_m,
      elevationLossM: activity.value.total_descent_m,
      normalizedPowerW: activity.value.avg_power_w,
      activityTrainingLoad: activity.value.activity_training_load,
    })
  } catch (err) {
    predictionError.value = err instanceof Error ? err.message : '模型分析失败'
  }
}

async function removeActivity() {
  if (!canManageManual.value) {
    error.value = '只有管理员可以删除手动运动记录'
    return
  }
  if (!window.confirm('确定删除这条手动运动记录吗？')) return
  isDeleting.value = true
  try {
    await deleteManualActivity(activity.value.id)
    router.push('/activities')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
  } finally {
    isDeleting.value = false
  }
}

async function handleSaved(nextActivity) {
  modalOpen.value = false
  activity.value = nextActivity
  await loadActivity(nextActivity.id)
}

watch(() => route.params.id, loadActivity, { immediate: true })
</script>
