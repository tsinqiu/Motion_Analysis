<template>
  <section class="panel session-detail-panel wide">
    <div class="panel-heading">
      <div>
        <p class="overline">Session</p>
        <h2>详情</h2>
      </div>
    </div>

    <div class="session-detail-grid">
      <article v-for="item in detailItems" :key="item.label" class="session-detail-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { formatCalories, formatClockDuration, formatPace, formatSpeed } from '@/utils/formatters'

const props = defineProps({
  activity: {
    type: Object,
    required: true,
  },
})

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function formatMeters(value) {
  const meters = numberValue(value)
  return meters === null ? '--' : `${Math.round(meters)} m`
}

function formatBpm(value) {
  const bpm = numberValue(value)
  return bpm === null ? '--' : `${Math.round(bpm)} bpm`
}

function formatCadence(value) {
  const cadence = numberValue(value)
  if (cadence === null) return '--'
  const fullCadence = cadence < 130 ? cadence * 2 : cadence
  return `${Math.round(fullCadence)} spm`
}

function formatPower(value) {
  const power = numberValue(value)
  return power === null ? '--' : `${Math.round(power)} W`
}

const detailItems = computed(() => [
  { label: '总用时', value: formatClockDuration(props.activity.total_timer_time_s) },
  { label: '移动时间', value: formatClockDuration(props.activity.total_moving_time_s) },
  { label: '总历时', value: formatClockDuration(props.activity.total_elapsed_time_s) },
  { label: '卡路里', value: formatCalories(props.activity.total_calories) },
  { label: '平均配速', value: formatPace(props.activity.avg_speed_mps) },
  { label: '最高速度', value: formatSpeed(props.activity.max_speed_mps) },
  { label: '平均心率', value: formatBpm(props.activity.avg_heart_rate_bpm) },
  { label: '最高心率', value: formatBpm(props.activity.max_heart_rate_bpm) },
  { label: '平均步频', value: formatCadence(props.activity.avg_cadence) },
  { label: '最高步频', value: formatCadence(props.activity.max_cadence) },
  { label: '平均功率', value: formatPower(props.activity.avg_power_w) },
  { label: '标准化功率', value: formatPower(props.activity.normalized_power_w) },
  { label: '最高功率', value: formatPower(props.activity.max_power_w) },
  { label: '累计爬升', value: formatMeters(props.activity.total_ascent_m) },
  { label: '累计下降', value: formatMeters(props.activity.total_descent_m) },
  { label: '训练负荷', value: numberValue(props.activity.activity_training_load)?.toFixed(1) || '--' },
])
</script>
