<template>
  <section class="panel route-panel">
    <div class="panel-heading">
      <div>
        <p class="overline">TrackPoints</p>
        <h2>地图轨迹预览</h2>
      </div>
      <span>{{ points.length }} 点</span>
    </div>

    <div class="route-map" aria-label="轨迹地图预览">
      <div class="route-grid"></div>
      <div class="route-line"></div>
      <span
        v-for="(point, index) in plottedPoints"
        :key="index"
        class="route-point"
        :style="{ left: `${point.x}%`, top: `${point.y}%` }"
      ></span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
})

const plottedPoints = computed(() => {
  const validPoints = props.points.filter((point) => point.latitude && point.longitude)
  if (validPoints.length === 0) return []

  const latitudes = validPoints.map((point) => point.latitude)
  const longitudes = validPoints.map((point) => point.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLong = Math.min(...longitudes)
  const maxLong = Math.max(...longitudes)

  return validPoints.map((point) => ({
    x: 8 + ((point.longitude - minLong) / Math.max(maxLong - minLong, 0.0001)) * 84,
    y: 8 + (1 - (point.latitude - minLat) / Math.max(maxLat - minLat, 0.0001)) * 84,
  }))
})
</script>
