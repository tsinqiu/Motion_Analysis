<template>
  <section class="panel lap-panel wide">
    <div class="panel-heading">
      <div>
        <p class="overline">Laps</p>
        <h2>分段数据</h2>
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
          <tr v-for="lap in laps" :key="lap.lap_index">
            <td>#{{ lap.lap_index }}</td>
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
defineProps({
  laps: {
    type: Array,
    default: () => [],
  },
})

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
