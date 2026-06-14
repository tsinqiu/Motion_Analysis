<template>
  <section class="panel lap-panel wide">
    <div class="panel-heading">
      <div>
        <p class="overline">Laps</p>
        <h2>分段数据</h2>
      </div>
      <div v-if="isRunning" class="lap-mode-toggle" aria-label="分段距离">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          type="button"
          :class="{ active: lapMode === option.value }"
          @click="lapMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="table-wrap compact">
      <table>
        <thead>
          <tr>
            <th>分段</th>
            <th>距离 km</th>
            <th>用时</th>
            <th>速度 m/s</th>
            <th>心率 bpm</th>
            <th>功率 W</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lap in displayLaps" :key="lap.lap_index">
            <td>{{ lap.lap_index }}</td>
            <td>{{ formatDistanceKm(lap.total_distance_m) }}</td>
            <td>{{ formatLapDuration(lap.total_timer_time_s) }}</td>
            <td>{{ lap.avg_speed_mps?.toFixed(2) || '--' }}</td>
            <td>{{ formatNumber(lap.avg_heart_rate_bpm, 0) }}</td>
            <td>{{ formatNumber(lap.avg_power_w, 0) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  activity: {
    type: Object,
    default: null,
  },
  laps: {
    type: Array,
    default: () => [],
  },
})

const modeOptions = [
  { value: 'lap', label: '原始分段' },
  { value: '5k', label: '5 km' },
]
const lapMode = ref('lap')

const isRunning = computed(() => {
  const type = props.activity?.activity_type || ''
  const rawType = props.activity?.raw_activity_type || ''
  return type.includes('跑步') || rawType.includes('running')
})

const displayLaps = computed(() => {
  if (!isRunning.value || lapMode.value !== '5k') {
    return props.laps.map((lap) => ({
      ...lap,
      lap_index: `#${lap.lap_index}`,
    }))
  }

  return buildDistanceGroups(props.laps, 5000)
})

watch(isRunning, (nextIsRunning) => {
  if (!nextIsRunning) lapMode.value = 'lap'
})

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function weightedAverage(items, field) {
  let weightedSum = 0
  let weightSum = 0

  items.forEach((item) => {
    const value = positiveNumber(item[field])
    const weight = positiveNumber(item.total_timer_time_s)
    if (value === null || weight === null) return

    weightedSum += value * weight
    weightSum += weight
  })

  return weightSum > 0 ? weightedSum / weightSum : null
}

function buildDistanceGroups(sourceLaps, targetDistanceM) {
  const groups = []
  let current = []
  let currentDistance = 0

  sourceLaps.forEach((lap) => {
    const distance = positiveNumber(lap.total_distance_m) || 0
    current.push(lap)
    currentDistance += distance

    if (currentDistance >= targetDistanceM) {
      groups.push(createDistanceGroup(current, groups.length, currentDistance))
      current = []
      currentDistance = 0
    }
  })

  if (current.length) {
    groups.push(createDistanceGroup(current, groups.length, currentDistance))
  }

  return groups
}

function createDistanceGroup(groupLaps, index, distanceM) {
  const durationS = groupLaps.reduce((sum, lap) => sum + (positiveNumber(lap.total_timer_time_s) || 0), 0)
  return {
    lap_index: `${index * 5}-${index * 5 + Math.round(distanceM / 1000)} km`,
    total_distance_m: distanceM,
    total_timer_time_s: durationS,
    avg_speed_mps: durationS > 0 ? distanceM / durationS : null,
    avg_heart_rate_bpm: weightedAverage(groupLaps, 'avg_heart_rate_bpm'),
    avg_power_w: weightedAverage(groupLaps, 'avg_power_w'),
  }
}

function formatDistanceKm(value) {
  const distance = Number(value)
  return Number.isFinite(distance) ? (distance / 1000).toFixed(2) : '--'
}

function formatLapDuration(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0) return '--'

  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function formatNumber(value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '--'
  return number.toFixed(digits)
}
</script>
