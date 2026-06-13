<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载今日状态"
      message="正在读取仪表盘概览、训练负荷和最近运动。"
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
      <section class="app-hero">
        <div>
          <p class="overline">GarSync style database front-end</p>
          <h2>佳速通运动数据中枢</h2>
          <p>聚合 Garmin 运动记录、训练负荷、健康指标和数据库统计，前端只通过后端 API 读取 MySQL 数据。</p>
        </div>
        <RouterLink class="start-fab" to="/start">
          <Play :size="18" />
          开始运动
        </RouterLink>
      </section>

      <div class="today-layout">
        <section v-if="isMockMode" class="dark-panel weather-panel">
          <div>
            <span><MapPin :size="18" /> {{ weather.city }}</span>
            <strong>{{ weather.temperature }}℃</strong>
            <small>{{ weather.condition }} · 体感 {{ weather.feelsLike }}℃ · AQI {{ weather.aqi }}</small>
          </div>
          <p>{{ weather.wind }}，{{ weather.suggestion }}</p>
        </section>
        <section v-else class="dark-panel weather-panel">
          <div>
            <span><MapPin :size="18" /> 后端真实数据模式</span>
            <strong>API</strong>
            <small>当前页面读取 `/dashboard/overview`、Activities 与统计聚合接口。</small>
          </div>
          <p>天气与健康设备指标尚未有后端表和接口，这里不展示合成数据，避免和真实数据库内容混淆。</p>
        </section>

        <section class="dark-panel training-panel">
          <div class="section-heading">
            <div>
              <p class="overline">Training</p>
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
            <strong>训练安排接口待补充</strong>
            <p>当前使用后端训练负荷、统计和日历数据；专项训练计划尚未进入数据库接口。</p>
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

      <section v-if="isMockMode" class="dark-panel">
        <div class="section-heading">
          <div>
            <p class="overline">Daily health</p>
            <h2>健康指标</h2>
          </div>
          <RouterLink to="/trends">查看趋势</RouterLink>
        </div>
        <div class="health-grid">
          <article v-for="item in healthMetrics" :key="item.label" class="health-tile">
            <component :is="item.icon" :size="20" />
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
            <em>{{ item.status }} · {{ item.trend }}</em>
            <div class="progress-bar"><span :style="{ width: `${item.progress}%` }"></span></div>
          </article>
        </div>
      </section>
      <section v-else class="dark-panel">
        <div class="section-heading">
          <div>
            <p class="overline">Daily health</p>
            <h2>健康指标</h2>
          </div>
          <RouterLink to="/trends">查看真实趋势</RouterLink>
        </div>
        <StateBlock
          title="暂无健康指标接口"
          message="服务器当前已有 Garmin 活动、统计、训练负荷和扩展模块表；静息心率、HRV、睡眠等日健康指标尚未开放后端接口。"
        />
      </section>

      <div class="metric-grid">
        <MetricCard label="本月活动" :value="`${overview.monthlySummary?.activityCount || 0}`" hint="Activities 聚合" />
        <MetricCard label="本月距离" :value="formatDistance((overview.monthlySummary?.totalDistanceKm || 0) * 1000)" hint="跑步 + 骑行 + 游泳" />
        <MetricCard label="训练负荷" :value="`${overview.yearlySummary?.totalTrainingLoad || 0}`" hint="ActivitySummaries.activity_training_load" />
        <MetricCard label="平均心率" :value="`${overview.monthlySummary?.avgHeartRateBpm || '--'} bpm`" hint="Sessions.avg_heart_rate_bpm" />
      </div>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <p class="overline">Recent activities</p>
            <h2>最近运动</h2>
          </div>
          <RouterLink to="/activities">全部记录</RouterLink>
        </div>
        <div class="activity-card-grid">
          <ActivityCard
            v-for="activity in overview.recentActivities"
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
import { CalendarDays, MapPin, Play } from '@lucide/vue'

import ActivityCard from '@/components/ActivityCard.vue'
import MetricCard from '@/components/MetricCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { healthMetrics, todayPlan, weather } from '@/mock/garsync'
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
</script>
