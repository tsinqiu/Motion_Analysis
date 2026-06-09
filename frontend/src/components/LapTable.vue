<template>
  <section class="panel">
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
            <th>距离</th>
            <th>用时</th>
            <th>速度</th>
            <th>心率</th>
            <th>功率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lap in laps" :key="lap.lap_index">
            <td>#{{ lap.lap_index }}</td>
            <td>{{ formatDistance(lap.total_distance_m) }}</td>
            <td>{{ formatDuration(lap.total_timer_time_s) }}</td>
            <td>{{ lap.avg_speed_mps?.toFixed(2) || '--' }} m/s</td>
            <td>{{ lap.avg_heart_rate_bpm || '--' }} bpm</td>
            <td>{{ lap.avg_power_w || '--' }} W</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { formatDistance, formatDuration } from '@/utils/formatters'

defineProps({
  laps: {
    type: Array,
    default: () => [],
  },
})
</script>
