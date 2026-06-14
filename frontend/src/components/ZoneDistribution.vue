<template>
  <section class="panel zone-panel wide">
    <div class="panel-heading">
      <div>
        <p class="overline">Zones</p>
        <h2>区间分布</h2>
      </div>
    </div>

    <div class="zone-grid">
      <div class="zone-block">
        <div class="zone-block-heading">
          <h3>心率区间</h3>
        </div>
        <div class="zone-list">
          <div v-for="row in heartRateRows" :key="row.label" class="zone-row">
            <span class="zone-dot" :style="{ background: row.color }"></span>
            <span class="zone-label">{{ row.label }}</span>
            <div class="zone-bar" aria-hidden="true">
              <span :style="{ width: `${row.percent}%`, background: row.color }"></span>
            </div>
            <span class="zone-time">{{ formatDuration(row.durationS) }}</span>
            <span class="zone-percent">{{ row.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <div v-if="powerRows.length" class="zone-block">
        <div class="zone-block-heading">
          <h3>功率区间</h3>
        </div>
        <div class="zone-list">
          <div v-for="row in powerRows" :key="row.label" class="zone-row">
            <span class="zone-dot" :style="{ background: row.color }"></span>
            <span class="zone-label">{{ row.label }}</span>
            <div class="zone-bar" aria-hidden="true">
              <span :style="{ width: `${row.percent}%`, background: row.color }"></span>
            </div>
            <span class="zone-time">{{ formatDuration(row.durationS) }}</span>
            <span class="zone-percent">{{ row.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { formatDuration } from '@/utils/formatters'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
})

const ZONE_COLORS = ['#94a3b8', '#33b5ff', '#21d47b', '#ff9d19', '#ef4444']
const HEART_RATE_ZONES = [
  { label: '132-148 bpm', min: 132, max: 148 },
  { label: '149-170 bpm', min: 149, max: 170 },
  { label: '171-176 bpm', min: 171, max: 176 },
  { label: '177-186 bpm', min: 177, max: 186 },
  { label: '186+ bpm', min: 186, max: Infinity },
]
const POWER_ZONES = [
  { label: '231-284 W', min: 231, max: 284 },
  { label: '285-319 W', min: 285, max: 319 },
  { label: '320-355 W', min: 320, max: 355 },
  { label: '356-408 W', min: 356, max: 408 },
  { label: '408+ W', min: 408, max: Infinity },
]

function toTimestamp(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function valueInZone(value, zone) {
  return value >= zone.min && value <= zone.max
}

function durationForPoint(point, nextPoint) {
  const current = toTimestamp(point.sample_time_utc)
  const next = toTimestamp(nextPoint?.sample_time_utc)
  if (Number.isFinite(current) && Number.isFinite(next) && next > current) {
    return Math.min((next - current) / 1000, 10)
  }
  return 1
}

function buildRows(zones, field) {
  const durations = zones.map(() => 0)

  props.points.forEach((point, index) => {
    const value = Number(point[field])
    if (!Number.isFinite(value) || value <= 0) return

    const zoneIndex = zones.findIndex((zone) => valueInZone(value, zone))
    if (zoneIndex < 0) return

    durations[zoneIndex] += durationForPoint(point, props.points[index + 1])
  })

  const total = durations.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return []

  return zones.map((zone, index) => ({
    ...zone,
    color: ZONE_COLORS[index],
    durationS: durations[index],
    percent: total ? (durations[index] / total) * 100 : 0,
  }))
}

const heartRateRows = computed(() => buildRows(HEART_RATE_ZONES, 'heart_rate_bpm'))
const powerRows = computed(() => buildRows(POWER_ZONES, 'power_w'))
</script>
