<template>
  <article
    class="activity-card"
    :class="sportClass"
    :style="{ '--sport-color': sportColor }"
    role="button"
    tabindex="0"
    @click="$emit('select', activity)"
    @keydown.enter="$emit('select', activity)"
    @keydown.space.prevent="$emit('select', activity)"
  >
    <div class="activity-card-main">
      <span class="activity-accent" aria-hidden="true"></span>
      <span class="activity-icon" aria-hidden="true">
        <component :is="sportIcon" :size="22" />
      </span>
      <span class="activity-copy">
        <span class="activity-title">
          <strong>{{ displayTitle }}</strong>
          <time>{{ formatDateTime(activity.local_start_time) }}</time>
        </span>
        <span class="activity-subtitle">
          {{ activity.activity_type }}
        </span>
      </span>
    </div>

    <div class="activity-metrics">
      <span>
        <small>距离</small>
        <b>{{ formatDistance(activity.total_distance_m) }}</b>
      </span>
      <span>
        <small>时长</small>
        <b>{{ formatClockDuration(activity.total_timer_time_s) }}</b>
      </span>
      <span>
        <small>{{ speedLabel }}</small>
        <b>{{ speedValue }}</b>
      </span>
      <span>
        <small>卡路里</small>
        <b>{{ formatCalories(activity.total_calories) }}</b>
      </span>
    </div>

    <div v-if="$slots.actions" class="activity-card-actions">
      <slot name="actions" />
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Activity, Bike, Dumbbell, Waves } from '@lucide/vue'

import {
  formatCalories,
  formatClockDuration,
  formatDateTime,
  formatDistance,
  formatPace,
  formatSpeed,
} from '@/utils/formatters'

const props = defineProps({
  activity: {
    type: Object,
    required: true,
  },
})

defineEmits(['select'])

const sportClass = computed(() => {
  if (props.activity.raw_activity_type?.includes('cycling') || props.activity.activity_type === '骑行') return 'ride'
  if (props.activity.raw_activity_type?.includes('swim') || props.activity.activity_type === '游泳') return 'swim'
  if (props.activity.raw_activity_type === 'strength_training' || props.activity.activity_type === '力量训练') return 'strength'
  return 'run'
})

const sportColor = computed(() => ({
  run: '#21d47b',
  ride: '#ff9d19',
  swim: '#33b5ff',
  strength: '#8b5cf6',
}[sportClass.value] || '#94a3b8'))

const sportIcon = computed(() => ({
  run: Activity,
  ride: Bike,
  swim: Waves,
  strength: Dumbbell,
}[sportClass.value] || Activity))

const displayTitle = computed(() => (
  props.activity.is_manual
    ? props.activity.activity_name || props.activity.location_name || props.activity.activity_type
    : props.activity.location_name || props.activity.activity_name || props.activity.activity_type
))

const speedLabel = computed(() => (sportClass.value === 'ride' ? '速度' : '配速'))
const speedValue = computed(() => (sportClass.value === 'ride'
  ? formatSpeed(props.activity.avg_speed_mps)
  : formatPace(props.activity.avg_speed_mps)))
</script>
