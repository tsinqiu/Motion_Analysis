<template>
  <article class="phone-activity-card" :class="typeClass">
    <span class="phone-activity-accent" aria-hidden="true"></span>
    <div class="phone-activity-icon">
      <component :is="typeIcon" :size="22" />
    </div>
    <div class="phone-activity-main">
      <div class="phone-activity-title">
        <strong>无锡市 {{ activity.activity_type }}</strong>
        <time>{{ dateLabel }}</time>
      </div>
      <div class="phone-activity-metrics">
        <span>
          <small>距离</small>
          <b>{{ distanceLabel }}</b>
        </span>
        <span>
          <small>运动时长</small>
          <b>{{ durationLabel }}</b>
        </span>
        <span>
          <small>{{ speedTitle }}</small>
          <b>{{ speedLabel }}</b>
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { Bike, Dumbbell, Footprints } from '@lucide/vue'
import { computed } from 'vue'

import { formatDistance, formatDuration, formatPace } from '@/utils/formatters'

const props = defineProps({
  activity: {
    type: Object,
    required: true,
  },
})

const typeClass = computed(() => {
  if (props.activity.activity_type === '骑行') return 'ride'
  if (props.activity.activity_type === '力量训练') return 'strength'
  return 'run'
})

const typeIcon = computed(() => {
  if (props.activity.activity_type === '骑行') return Bike
  if (props.activity.activity_type === '力量训练') return Dumbbell
  return Footprints
})

const dateLabel = computed(() => props.activity.local_start_time?.replace('-', '/').replace('-', '/') || '--')
const distanceLabel = computed(() => formatDistance(props.activity.total_distance_m || 0))
const durationLabel = computed(() => formatDuration(props.activity.total_timer_time_s))
const speedTitle = computed(() => (props.activity.activity_type === '骑行' ? '速度' : '配速'))
const speedLabel = computed(() => {
  if (!props.activity.avg_speed_mps) return `${props.activity.total_calories || 0} kcal`
  if (props.activity.activity_type === '骑行') return `${(props.activity.avg_speed_mps * 3.6).toFixed(1)} km/h`
  return formatPace(props.activity.avg_speed_mps)
})
</script>
