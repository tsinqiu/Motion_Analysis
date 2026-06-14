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
          <p>{{ formatDetailDateTime(activity.local_start_time) }} 开始</p>
        </div>
        <div class="hero-actions">
          <RouterLink class="secondary-link inverse" to="/activities">返回列表</RouterLink>
          <button v-if="canManageManual" class="secondary-link inverse" type="button" @click="modalOpen = true">编辑</button>
          <button v-if="canManageManual" class="danger-link" type="button" :disabled="isDeleting" @click="removeActivity">
            {{ isDeleting ? '删除中' : '删除' }}
          </button>
        </div>
      </section>

      <div class="metric-grid detail-metrics">
        <MetricCard label="距离" :value="formatDistance(activity.total_distance_m)" />
        <MetricCard label="总用时" :value="formatClockDuration(activity.total_timer_time_s)" />
        <MetricCard label="平均配速" :value="formatPace(activity.avg_speed_mps)" />
        <MetricCard label="累计爬升" :value="formatAscent(activity.total_ascent_m)" />
        <MetricCard label="平均心率" :value="`${activity.avg_heart_rate_bpm || '--'} bpm`" />
        <MetricCard label="训练负荷" :value="formatTrainingLoad(activity.activity_training_load)" />
      </div>

      <div class="detail-grid">
        <ChartPanel title="心率曲线" eyebrow="运动详情" :option="heartRateOption" />
        <ChartPanel title="配速曲线" eyebrow="运动详情" :option="paceOption" />
        <ChartPanel title="步频曲线" eyebrow="运动详情" :option="cadenceOption" />
        <ChartPanel title="海拔曲线" eyebrow="运动详情" :option="altitudeOption" />
        <ChartPanel title="垂直振幅曲线" eyebrow="运动详情" :option="verticalOscillationOption" />
        <ChartPanel title="步幅曲线" eyebrow="运动详情" :option="strideLengthOption" />
        <ChartPanel title="功率曲线" eyebrow="运动详情" :option="powerOption" />
        <RoutePreview :points="trackPoints" />
        <ZoneDistribution :points="trackPoints" />
        <SessionDetails :activity="activity" />
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
import SessionDetails from '@/components/SessionDetails.vue'
import StateBlock from '@/components/StateBlock.vue'
import ZoneDistribution from '@/components/ZoneDistribution.vue'
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
import { formatClockDuration, formatDistance, formatPace, formatPaceSeconds } from '@/utils/formatters'

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
const paceOption = computed(() => {
  const paceValues = speedSeries.value
    .map((point) => paceSecondsFromSpeed(point.speed_mps))
    .filter(Number.isFinite)
  const slowestPace = paceValues.length ? Math.max(...paceValues) : null

  return createLineOption('配速', 'min/km', '#33b5ff', speedSeries.value, 'speed_mps', {
    valueFormatter: (value) => formatPaceSeconds(paceFromDisplayValue(value, slowestPace)),
    valueMapper: (point) => {
      const paceSecPerKm = paceSecondsFromSpeed(point.speed_mps)
      if (!Number.isFinite(paceSecPerKm) || !Number.isFinite(slowestPace)) return null
      return slowestPace - paceSecPerKm
    },
    yAxis: {
      min: 0,
      axisLabel: {
        formatter: (value) => formatPaceSeconds(paceFromDisplayValue(value, slowestPace)).replace('/km', ''),
      },
    },
  })
})
const cadenceOption = computed(() => createLineOption('步频', 'spm', '#8b5cf6', trackPoints.value, 'cadence', {
  valueMapper: (point) => {
    const cadence = Number(point.cadence)
    return Number.isFinite(cadence) && cadence > 0 ? cadence * 2 : null
  },
}))
const altitudeOption = computed(() => createLineOption('海拔', 'm', '#22c55e', trackPoints.value, 'altitude_m'))
const verticalOscillationOption = computed(() => createLineOption('垂直振幅', 'mm', '#f59e0b', trackPoints.value, 'vertical_oscillation_mm'))
const strideLengthOption = computed(() => createLineOption('步幅', 'm', '#14b8a6', trackPoints.value, 'speed_mps', {
  valueMapper: (point) => {
    const speedMps = Number(point.speed_mps)
    const cadence = Number(point.cadence)
    if (!Number.isFinite(speedMps) || !Number.isFinite(cadence) || speedMps <= 0 || cadence <= 0) return null
    return Number((speedMps * 60 / (cadence * 2)).toFixed(2))
  },
}))
const powerOption = computed(() => createLineOption('功率', 'W', '#db2777', trackPoints.value, 'power_w'))

function toTimestamp(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatElapsed(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const rest = rounded % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function formatAscent(value) {
  const meters = Number(value)
  return Number.isFinite(meters) ? `${Math.round(meters)} m` : '--'
}

function formatTrainingLoad(value) {
  const load = Number(value)
  return Number.isFinite(load) ? load.toFixed(1) : '--'
}

function paceSecondsFromSpeed(speedMps) {
  const speed = Number(speedMps)
  if (!Number.isFinite(speed) || speed <= 0) return null
  const paceSecPerKm = 1000 / speed
  return paceSecPerKm <= 900 ? paceSecPerKm : null
}

function paceFromDisplayValue(value, slowestPace) {
  const displayValue = Number(value)
  if (!Number.isFinite(displayValue) || !Number.isFinite(slowestPace)) return null
  return slowestPace - displayValue
}

function formatDetailDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const dateText = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date)
  const timeText = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${dateText}（${weekday}）${timeText}`
}

function elapsedLabels(source) {
  const firstTimestamp = source.map((point) => toTimestamp(point.sample_time_utc)).find(Number.isFinite)
  return source.map((point, index) => {
    const timestamp = toTimestamp(point.sample_time_utc)
    if (Number.isFinite(timestamp) && Number.isFinite(firstTimestamp)) {
      return formatElapsed((timestamp - firstTimestamp) / 1000)
    }
    return formatElapsed(index)
  })
}

function createLineOption(name, unit, color, source, field, options = {}) {
  const values = source.map((point) => (
    options.valueMapper ? options.valueMapper(point) : point[field]
  ))
  const yAxis = {
    type: 'value',
    name: unit,
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
    ...options.yAxis,
    axisLabel: {
      color: '#9ca3af',
      ...(options.yAxis?.axisLabel || {}),
    },
  }

  return {
    color: [color],
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const item = Array.isArray(items) ? items[0] : items
        const value = item?.data
        const formattedValue = options.valueFormatter
          ? options.valueFormatter(value)
          : `${value ?? '--'} ${unit}`
        return `${item?.axisValue || ''}<br/>${item?.marker || ''}${name}: ${formattedValue}`
      },
    },
    grid: { left: 42, right: 20, top: 28, bottom: 28 },
    xAxis: {
      type: 'category',
      name: '运动时间',
      data: elapsedLabels(source),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#9ca3af' },
    },
    yAxis,
    series: [
      {
        name,
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: values,
        areaStyle: options.showArea === false ? undefined : { opacity: 0.12 },
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
