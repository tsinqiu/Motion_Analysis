<template>
  <div class="page-stack">
    <section class="app-hero">
      <div>
        <p class="overline">Start workout</p>
        <h2>开始运动</h2>
        <p>模拟实时记录页：计时、距离、心率、暂停/继续/结束和保存手动运动。当前不读取真实 GPS。</p>
      </div>
    </section>

    <section class="sport-start-grid">
      <button
        v-for="sport in startSportTypes"
        :key="sport.label"
        type="button"
        :class="{ active: selectedSport.label === sport.label }"
        :style="{ '--sport-color': sport.color }"
        @click="selectedSport = sport"
      >
        <component :is="sport.icon" :size="22" />
        {{ sport.label }}
      </button>
    </section>

    <section class="recording-panel dark-panel">
      <div class="recording-time">{{ formatClockDuration(elapsed) }}</div>
      <div class="recording-metrics">
        <span><small>距离</small><b>{{ distanceKm.toFixed(2) }} km</b></span>
        <span><small>配速/速度</small><b>{{ paceText }}</b></span>
        <span><small>心率</small><b>{{ heartRate }} bpm</b></span>
        <span><small>卡路里</small><b>{{ calories }} kcal</b></span>
      </div>
      <div class="recording-actions">
        <button class="primary-link" type="button" @click="toggleRecording">
          {{ running ? '暂停' : elapsed ? '继续' : '开始' }}
        </button>
        <button class="secondary-link" type="button" :disabled="!elapsed" @click="finish">结束并保存</button>
      </div>
      <p v-if="saved" class="success-copy">运动已保存为手动记录，可在“我的运动”和“运动日历”中查看。</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { startSportTypes } from '@/mock/garsync'
import { createManualActivity } from '@/services/activities'
import { formatClockDuration } from '@/utils/formatters'

const selectedSport = ref(startSportTypes[0])
const elapsed = ref(0)
const running = ref(false)
const saved = ref(false)
let timer = null

const distanceKm = computed(() => {
  const multiplier = selectedSport.value.type === 'cycling' ? 0.008 : selectedSport.value.type === 'swimming' ? 0.00055 : 0.0032
  return elapsed.value * multiplier
})
const heartRate = computed(() => Math.round(118 + Math.min(48, elapsed.value / 18)))
const calories = computed(() => Math.round(elapsed.value * (selectedSport.value.type === 'cycling' ? 0.22 : 0.16)))
const paceText = computed(() => {
  if (selectedSport.value.type === 'cycling') return `${(distanceKm.value / Math.max(elapsed.value / 3600, 0.01)).toFixed(1)} km/h`
  const secondsPerKm = elapsed.value / Math.max(distanceKm.value, 0.01)
  return `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, '0')} /km`
})

function toggleRecording() {
  running.value = !running.value
  saved.value = false
}

async function finish() {
  running.value = false
  await createManualActivity({
    activityName: selectedSport.value.label,
    activityType: selectedSport.value.type,
    localStartTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    locationName: '本地模拟',
    distanceM: Math.round(distanceKm.value * 1000),
    durationS: elapsed.value,
    calories: calories.value,
    avgHeartRateBpm: heartRate.value,
    maxHeartRateBpm: heartRate.value + 12,
    activityTrainingLoad: Math.round(elapsed.value / 60),
  })
  saved.value = true
  elapsed.value = 0
}

watch(running, (active) => {
  window.clearInterval(timer)
  if (active) {
    timer = window.setInterval(() => {
      elapsed.value += 1
    }, 1000)
  }
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>
