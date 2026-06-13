<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>类型</th>
          <th>开始时间</th>
          <th>距离</th>
          <th>时长</th>
          <th>均心率</th>
          <th>配速</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="activity in activities" :key="activity.id" @click="$emit('select', activity)">
          <td>
            <span class="type-pill">{{ activity.activity_type }}</span>
          </td>
          <td>{{ activity.local_start_time }}</td>
          <td>{{ formatDistance(activity.total_distance_m) }}</td>
          <td>{{ formatDuration(activity.total_timer_time_s) }}</td>
          <td>{{ activity.avg_heart_rate_bpm || '--' }} bpm</td>
          <td>{{ formatPace(activity.avg_speed_mps) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { formatDistance, formatDuration, formatPace } from '@/utils/formatters'

defineProps({
  activities: {
    type: Array,
    required: true,
  },
})

defineEmits(['select'])
</script>
