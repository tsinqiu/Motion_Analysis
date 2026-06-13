<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载今日状态"
      message="正在读取今日概览、训练负荷和最近运动。"
    />
    <StateBlock
      v-else-if="error"
      title="今日状态加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />

    <template v-else>
      <div class="today-layout">
        <section class="dark-panel start-workout-panel">
          <div>
            <p class="overline">浏览器模拟运动</p>
            <h2>开始运动</h2>
            <p>选择运动类型，在浏览器中记录时长、距离和轨迹采样，结束后写入运动记录。</p>
          </div>
          <RouterLink class="start-fab" to="/start">
            <Play :size="18" />
            开始运动
          </RouterLink>
        </section>

        <section class="dark-panel training-panel">
          <div class="section-heading">
            <div>
              <h2>今日训练安排</h2>
            </div>
            <RouterLink to="/calendar">训练日历</RouterLink>
          </div>
          <div v-if="isMockMode" class="training-empty">
            <CalendarDays :size="28" />
            <strong>{{ todayPlan.title }}</strong>
            <p>{{ todayPlan.description }}</p>
          </div>
          <div v-else class="training-empty">
            <CalendarDays :size="28" />
            <strong>暂无训练安排</strong>
            <p>可以从最近运动和训练负荷判断今天是否适合继续训练。</p>
          </div>
          <div v-if="isMockMode" class="training-targets">
            <span><small>建议训练</small><b>{{ todayPlan.nextWorkout }}</b></span>
            <span><small>目标配速</small><b>{{ todayPlan.pace }}</b></span>
            <span><small>目标心率</small><b>{{ todayPlan.heartRateZone }}</b></span>
            <span><small>预计时长</small><b>{{ todayPlan.duration }}</b></span>
          </div>
          <div v-else class="training-targets">
            <span><small>最近负荷</small><b>{{ latestLoad.dailyTrainingLoad ?? '--' }}</b></span>
            <span><small>CTL</small><b>{{ latestLoad.ctl ?? '--' }}</b></span>
            <span><small>ATL</small><b>{{ latestLoad.atl ?? '--' }}</b></span>
            <span><small>TSB</small><b>{{ latestLoad.tsb ?? '--' }}</b></span>
          </div>
        </section>
      </div>

      <div class="metric-grid">
        <MetricCard label="本月活动" :value="`${overview.monthlySummary?.activityCount || 0}`" />
        <MetricCard label="本月距离" :value="formatDistance((overview.monthlySummary?.totalDistanceKm || 0) * 1000)" />
        <MetricCard label="训练负荷" :value="`${overview.yearlySummary?.totalTrainingLoad || 0}`" />
        <MetricCard label="平均心率" :value="`${overview.monthlySummary?.avgHeartRateBpm || '--'} bpm`" />
      </div>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>最近运动</h2>
          </div>
          <RouterLink to="/activities">全部记录</RouterLink>
        </div>
        <div class="activity-card-grid">
          <ActivityCard
            v-for="activity in recentActivities"
            :key="activity.id"
            :activity="activity"
            @select="router.push(`/activities/${activity.id}`)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, Play } from '@lucide/vue'

import ActivityCard from '@/components/ActivityCard.vue'
import MetricCard from '@/components/MetricCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { todayPlan } from '@/mock/garsync'
import { useMockData } from '@/services/api'
import { getDashboardOverview } from '@/services/dashboard'
import { formatDistance } from '@/utils/formatters'

const router = useRouter()
const isMockMode = useMockData()
const { data: overview, error, load, loading } = useAsyncData(getDashboardOverview, {
  recentActivities: [],
  monthlySummary: {},
  yearlySummary: {},
  trainingLoad: [],
})
const latestLoad = computed(() => overview.value?.trainingLoad?.at(-1) || {})
const recentActivities = computed(() => (overview.value?.recentActivities || []).slice(0, 6))
</script>
