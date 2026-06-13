<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>运动日历</h2>
        </div>
        <button v-if="isAdmin" class="primary-link" type="button" @click="openCreate">
          <Plus :size="17" />
          添加
        </button>
      </div>
      <div class="date-stepper">
        <button type="button" @click="stepMonth(-1)">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" @click="stepMonth(1)">›</button>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载日历" message="正在读取本月运动记录。" />
    <StateBlock v-else-if="error" title="日历加载失败" :message="error" action-label="重试" tone="danger" @action="load" />

    <template v-else>
      <section class="calendar-grid-panel">
        <div class="calendar-week">
          <span v-for="day in weekDays" :key="day">{{ day }}</span>
        </div>
        <div class="calendar-grid">
          <span v-for="blank in leadingBlanks" :key="`blank-${blank}`" class="calendar-blank"></span>
          <button
            v-for="day in calendar.days || []"
            :key="day.date"
            type="button"
            class="calendar-day"
            :class="{ active: selectedDate === day.date }"
            @click="selectedDate = day.date"
          >
            <b>{{ Number(day.date.slice(-2)) }}</b>
            <span class="day-icons">
              <i v-for="type in day.activityTypes" :key="type" :class="iconClass(type)"></i>
            </span>
          </button>
        </div>
      </section>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>{{ selectedDate || monthLabel }}</h2>
          </div>
        </div>
        <StateBlock
          v-if="selectedActivities.length === 0"
          title="当天暂无运动"
          message="可以点击右上角添加手动运动记录。"
        />
        <div v-else class="activity-card-grid">
          <ActivityCard
            v-for="activity in selectedActivities"
            :key="activity.id"
            :activity="activity"
            @select="router.push(`/activities/${activity.id}`)"
          />
        </div>
      </section>
    </template>

    <ManualActivityModal
      v-if="modalOpen"
      :save="createManualActivity"
      @close="modalOpen = false"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'

import ActivityCard from '@/components/ActivityCard.vue'
import ManualActivityModal from '@/components/ManualActivityModal.vue'
import StateBlock from '@/components/StateBlock.vue'
import { createManualActivity } from '@/services/activities'
import { getCalendarStats } from '@/services/stats'
import { authSession } from '@/stores/authStore'

const router = useRouter()
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const month = ref('2026-06')
const calendar = ref({ days: [] })
const selectedDate = ref('2026-06-10')
const error = ref('')
const loading = ref(false)
const modalOpen = ref(false)
const isAdmin = computed(() => authSession.user?.role === 'admin')

const monthLabel = computed(() => `${month.value.slice(0, 4)}年${Number(month.value.slice(5, 7))}月`)
const leadingBlanks = computed(() => new Date(`${month.value}-01T00:00:00`).getDay())
const selectedActivities = computed(() =>
  (calendar.value.days || []).find((day) => day.date === selectedDate.value)?.activities || [],
)

function iconClass(type) {
  if (String(type).includes('cycling')) return 'ride'
  if (String(type).includes('swim')) return 'swim'
  if (String(type).includes('strength')) return 'strength'
  return 'run'
}

function stepMonth(offset) {
  const date = new Date(`${month.value}-01T00:00:00`)
  date.setMonth(date.getMonth() + offset)
  month.value = formatMonthKey(date)
  selectedDate.value = `${month.value}-01`
}

function openCreate() {
  if (!isAdmin.value) return
  modalOpen.value = true
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

async function handleSaved(activity) {
  modalOpen.value = false
  const normalizedDate = normalizeDateKey(activity.local_start_time)
  month.value = normalizedDate.slice(0, 7)
  selectedDate.value = normalizedDate
  await load()
}

function normalizeDateKey(value) {
  if (!value) return new Date().toISOString().slice(0, 10)
  if (typeof value === 'string') {
    const normalized = value.replace(' ', 'T')
    const parsed = new Date(normalized)
    if (!Number.isNaN(parsed.getTime())) return formatDateKey(parsed)
    return value.slice(0, 10)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? formatDateKey(new Date()) : formatDateKey(parsed)
}

function formatDateKey(date) {
  return `${formatMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    calendar.value = await getCalendarStats({ month: month.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '日历加载失败'
  } finally {
    loading.value = false
  }
}

watch(month, load, { immediate: true })
</script>
