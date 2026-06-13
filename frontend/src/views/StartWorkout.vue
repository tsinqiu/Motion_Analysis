<template>
  <div class="page-stack">
    <section class="app-hero">
      <div>
        <h2>开始运动</h2>
        <p>记录计时、距离、心率采样，结束后保存为一条运动记录。</p>
      </div>
    </section>

    <section class="sport-start-grid">
      <button
        v-for="sport in startSportTypes"
        :key="sport.label"
        type="button"
        :class="{ active: selectedSport.label === sport.label }"
        :disabled="Boolean(workout)"
        :style="{ '--sport-color': sport.color }"
        @click="selectedSport = sport"
      >
        <component :is="sport.icon" :size="22" />
        {{ sport.label }}
      </button>
    </section>

    <section class="recording-panel dark-panel">
      <span class="status-chip" :class="workout ? 'good' : 'neutral'">{{ workout ? '记录中' : '未开始' }}</span>
      <div class="recording-time">{{ formatClockDuration(elapsed) }}</div>
      <div class="recording-metrics">
        <span><small>距离</small><b>{{ distanceKm.toFixed(2) }} km</b></span>
        <span><small>配速/速度</small><b>{{ paceText }}</b></span>
        <span><small>心率</small><b>{{ heartRate }} bpm</b></span>
        <span><small>卡路里</small><b>{{ calories }} kcal</b></span>
      </div>
      <div class="recording-actions">
        <button class="primary-link" type="button" :disabled="busy || saved" @click="toggleRecording">
          {{ running ? '暂停' : elapsed ? '继续' : '开始' }}
        </button>
        <button class="secondary-link" type="button" :disabled="busy || !workout || elapsed < 1" @click="finish">
          结束并保存
        </button>
        <button class="danger-link" type="button" :disabled="busy || !workout" @click="cancel">
          取消
        </button>
      </div>
      <p class="muted-copy">当前不读取 GPS 坐标，只记录时间、距离、速度、心率等采样指标。</p>
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="saved" class="success-copy">运动已保存，可在“运动记录”查看。</p>
      <RouterLink v-if="savedActivityId" class="secondary-link" :to="`/activities/${savedActivityId}`">查看活动详情</RouterLink>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { startSportTypes } from '@/mock/garsync'
import {
  appendWorkoutTrackPoints,
  cancelWorkout,
  createWorkout,
  finishWorkout,
  pauseWorkout,
  resumeWorkout,
} from '@/services/workouts'
import { formatClockDuration, formatPaceSeconds } from '@/utils/formatters'

const selectedSport = ref(startSportTypes[0])
const elapsed = ref(0)
const running = ref(false)
const saved = ref(false)
const busy = ref(false)
const error = ref('')
const workout = ref(null)
const savedActivityId = ref('')
const startedAt = ref('')
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
  return formatPaceSeconds(secondsPerKm)
})

function sqlDate(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23)
}

function buildTrackPoints() {
  const duration = Math.max(1, elapsed.value)
  const interval = duration < 15 ? Math.max(1, Math.floor(duration / 3) || 1) : 5
  const count = Math.min(100, Math.max(1, Math.floor(duration / interval)))
  const start = startedAt.value ? new Date(startedAt.value.replace(' ', 'T')) : new Date()
  return Array.from({ length: count }, (_, index) => {
    const seconds = Math.min(duration, (index + 1) * interval)
    const sampleTime = new Date(start)
    sampleTime.setSeconds(start.getSeconds() + seconds)
    const distanceM = Math.round(distanceKm.value * 1000 * (seconds / duration))
    return {
      sampleIndex: index,
      sampleTimeUtc: sqlDate(sampleTime),
      distanceM,
      speedMps: Number((distanceM / Math.max(seconds, 1)).toFixed(2)),
      heartRateBpm: Math.round(118 + Math.min(48, seconds / 18)),
      cadence: selectedSport.value.type === 'cycling' ? 86 : 176,
      powerW: selectedSport.value.type === 'cycling' ? 160 : null,
    }
  })
}

async function ensureWorkout() {
  if (workout.value) return workout.value
  startedAt.value = sqlDate(new Date())
  workout.value = await createWorkout({
    activityType: selectedSport.value.type,
    startedAt: startedAt.value,
  })
  return workout.value
}

async function toggleRecording() {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    const current = await ensureWorkout()
    if (running.value) {
      await pauseWorkout(current.id)
      running.value = false
    } else {
      if (elapsed.value > 0) await resumeWorkout(current.id)
      running.value = true
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '开始运动失败'
  } finally {
    busy.value = false
  }
}

async function finish() {
  if (!workout.value) return
  busy.value = true
  running.value = false
  error.value = ''
  try {
    const points = buildTrackPoints()
    if (points.length) {
      await appendWorkoutTrackPoints(workout.value.id, points)
    }
    const result = await finishWorkout(workout.value.id, {
      activityName: selectedSport.value.label,
      locationName: '浏览器记录',
      distanceM: Math.round(distanceKm.value * 1000),
      durationS: Math.max(1, elapsed.value),
      calories: calories.value,
    })
    savedActivityId.value = result?.activity?.id || result?.activityId || ''
    saved.value = true
    workout.value = null
    elapsed.value = 0
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存运动失败'
  } finally {
    busy.value = false
  }
}

async function cancel() {
  if (!workout.value) return
  busy.value = true
  running.value = false
  error.value = ''
  try {
    await cancelWorkout(workout.value.id)
    workout.value = null
    elapsed.value = 0
    savedActivityId.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消运动失败'
  } finally {
    busy.value = false
  }
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
