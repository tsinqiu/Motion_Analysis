<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载移动端效果"
      message="正在读取 Activities、Sessions 和统计 mock 数据。"
    />
    <StateBlock
      v-else-if="error"
      title="移动端效果加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />

    <div v-else class="mobile-preview-page">
      <section class="mobile-preview-copy panel">
        <p class="overline">Garmin mobile pattern</p>
        <h2>视频同款暗色运动数据体验</h2>
        <p>
          面向数据库管理系统的前端展示层：活动列表来自 Activities + Sessions，图表和日历使用合成样例数据，
          保持移动端深色卡片、横向筛选、底部导航和切页动效。
        </p>

        <div class="mobile-screen-switch" aria-label="移动端页面切换">
          <button
            v-for="screen in screens"
            :key="screen.id"
            type="button"
            :class="{ active: activeScreen === screen.id }"
            @click="activeScreen = screen.id"
          >
            <component :is="screen.icon" :size="16" aria-hidden="true" />
            {{ screen.label }}
          </button>
        </div>

        <div class="mobile-schema-map">
          <span>Activities</span>
          <span>Sessions</span>
          <span>TrackPoints</span>
          <span>Laps</span>
        </div>
      </section>

      <section class="phone-stage" aria-label="移动端效果预览">
        <div class="phone-frame">
          <div class="phone-screen">
            <div class="phone-statusbar" aria-hidden="true">
              <span>12:31</span>
              <span>5G</span>
              <Battery :size="17" />
            </div>

            <header class="phone-header">
              <button class="phone-icon-button" type="button" aria-label="返回上一页">
                <ChevronLeft v-if="activeScreen !== 'activities'" :size="22" />
                <Calendar v-else :size="22" />
              </button>
              <div class="phone-title">
                <ChevronDown :size="20" />
                <strong>{{ activeScreenLabel }}</strong>
              </div>
              <button class="phone-icon-button" type="button" aria-label="设置">
                <Settings :size="22" />
              </button>
            </header>

            <div class="phone-screen-tabs" aria-label="预览模块">
              <button
                v-for="screen in screens"
                :key="screen.id"
                type="button"
                :class="{ active: activeScreen === screen.id }"
                @click="activeScreen = screen.id"
              >
                <component :is="screen.icon" :size="15" aria-hidden="true" />
                {{ screen.label }}
              </button>
            </div>

            <Transition name="phone-panel" mode="out-in">
              <div :key="activeScreen" class="phone-scroll">
                <template v-if="activeScreen === 'activities'">
                  <div class="phone-filter-row">
                    <button
                      v-for="filter in activityFilters"
                      :key="filter"
                      type="button"
                      :class="{ active: activeFilter === filter }"
                      @click="activeFilter = filter"
                    >
                      {{ filter }}
                    </button>
                  </div>

                  <div class="phone-activity-list">
                    <MobileActivityCard
                      v-for="activity in visibleActivities"
                      :key="activity.id"
                      :activity="activity"
                      tabindex="0"
                      @click="openActivity(activity)"
                    />
                  </div>
                </template>

                <template v-else-if="activeScreen === 'balance'">
                  <div class="phone-date-rail">
                    <button type="button" aria-label="上一周期"><ChevronLeft :size="20" /></button>
                    <strong>2025/12/08 - 2026/06/08</strong>
                    <button type="button" aria-label="下一周期"><ChevronRight :size="20" /></button>
                  </div>
                  <div class="phone-range-row">
                    <button
                      v-for="range in ranges"
                      :key="range"
                      type="button"
                      :class="{ active: activeRange === range }"
                      @click="activeRange = range"
                    >
                      {{ range }}
                    </button>
                  </div>
                  <section class="phone-dark-card chart-card">
                    <MobileChart :option="trainingBalanceOption" label="训练负荷平衡" :height="310" />
                  </section>
                  <section class="phone-dark-card today-state-card">
                    <div class="phone-card-title">
                      <h3>今日状态</h3>
                      <span>灰色地带</span>
                    </div>
                    <div class="state-metrics">
                      <span><small>体能 (CTL)</small><b class="blue">204</b></span>
                      <span><small>疲劳 (ATL)</small><b class="purple">211</b></span>
                      <span><small>状态 (TSB)</small><b>-7</b></span>
                    </div>
                    <p>您目前处于中性状态。建议按照计划继续训练，或适当增加强度以进入最佳提升窗口。</p>
                  </section>
                </template>

                <template v-else-if="activeScreen === 'trends'">
                  <div class="phone-filter-row">
                    <button
                      v-for="filter in activityFilters"
                      :key="filter"
                      type="button"
                      :class="{ active: activeFilter === filter }"
                      @click="activeFilter = filter"
                    >
                      {{ filter }}
                    </button>
                  </div>
                  <div class="phone-date-rail">
                    <button type="button" aria-label="上一周期"><ChevronLeft :size="20" /></button>
                    <strong>2025/06/08 - 2026/06/08</strong>
                    <button type="button" aria-label="下一周期"><ChevronRight :size="20" /></button>
                  </div>
                  <div class="phone-range-row">
                    <button
                      v-for="range in ranges"
                      :key="range"
                      type="button"
                      :class="{ active: activeRange === range }"
                      @click="activeRange = range"
                    >
                      {{ range }}
                    </button>
                  </div>
                  <section class="phone-dark-card chart-card">
                    <MobileChart :option="trendMetricOption" :label="activeMetric.label" :height="260" />
                  </section>
                  <div class="phone-metric-grid">
                    <MobileMetricTile
                      v-for="metric in metricTiles"
                      :key="metric.id"
                      :icon="metric.icon"
                      :label="metric.label"
                      :unit="metric.unit"
                      :active="selectedMetric === metric.id"
                      @click="selectedMetric = metric.id"
                    />
                  </div>
                </template>

                <template v-else-if="activeScreen === 'stats'">
                  <div class="phone-sub-tabs">
                    <button type="button" class="active">按月</button>
                    <button type="button">按年</button>
                    <button type="button">全部</button>
                  </div>
                  <div class="phone-date-rail">
                    <button type="button" aria-label="上一月"><ChevronLeft :size="20" /></button>
                    <strong>2026/06</strong>
                    <button type="button" aria-label="下一月"><ChevronRight :size="20" /></button>
                  </div>
                  <section class="phone-dark-card stats-summary">
                    <span><small>骑行</small><b>68 km</b></span>
                    <span><small>跑步</small><b>64 km</b></span>
                    <span><small>游泳</small><b>0 km</b></span>
                    <span><small>卡路里</small><b>6,060 千卡</b></span>
                    <span><small>脂肪消耗</small><b>0.39 kg</b></span>
                    <span><small>运动时长</small><b>8 小时</b></span>
                  </section>
                  <section class="phone-dark-card chart-card">
                    <h3><Flame :size="16" /> 卡路里 (千卡)</h3>
                    <MobileChart :option="monthlyCaloriesOption" label="月度卡路里" :height="170" />
                  </section>
                  <section class="phone-dark-card chart-card">
                    <h3><Bike :size="16" /> 骑行 (km)</h3>
                    <MobileChart :option="monthlyRideOption" label="月度骑行距离" :height="170" />
                  </section>
                </template>

                <template v-else-if="activeScreen === 'today'">
                  <section class="phone-weather-card">
                    <div>
                      <span><MapPin :size="18" /> 滨湖, 江苏省</span>
                      <strong>21°</strong>
                    </div>
                    <small><CloudSun :size="18" /> AQI 28</small>
                  </section>
                  <div class="phone-today-heading">
                    <h3>训练</h3>
                    <span><CalendarDays :size="15" /> 训练日历</span>
                  </div>
                  <section class="phone-dark-card today-empty">
                    <Calendar :size="22" />
                    <span>今日无训练安排</span>
                  </section>
                  <div class="phone-today-heading">
                    <h3>状态</h3>
                    <span><Activity :size="15" /> 健康指标</span>
                  </div>
                  <div class="health-grid">
                    <article v-for="item in healthItems" :key="item.label" class="phone-dark-card health-card">
                      <component :is="item.icon" :size="20" aria-hidden="true" />
                      <span>{{ item.label }}</span>
                      <b>{{ item.value }}</b>
                      <div v-if="item.progress" class="health-progress"><span :style="{ width: item.progress }"></span></div>
                    </article>
                  </div>
                </template>

                <template v-else>
                  <div class="phone-date-rail calendar-title">
                    <button type="button" aria-label="上一月"><ChevronLeft :size="20" /></button>
                    <strong>2026年5月</strong>
                    <button type="button" aria-label="下一月"><ChevronRight :size="20" /></button>
                  </div>
                  <section class="phone-dark-card phone-calendar">
                    <div class="calendar-week">
                      <span v-for="day in weekDays" :key="day">{{ day }}</span>
                    </div>
                    <div class="calendar-grid">
                      <button
                        v-for="day in calendarDays"
                        :key="day.key"
                        type="button"
                        :class="{ active: day.active, muted: day.muted }"
                      >
                        <small>{{ day.day }}</small>
                        <component v-if="day.icon" :is="day.icon" :size="17" aria-hidden="true" />
                      </button>
                    </div>
                  </section>
                  <div class="calendar-selected">
                    <span>星期四, 5月 28</span>
                    <button type="button" aria-label="新增运动">+</button>
                  </div>
                  <MobileActivityCard :activity="calendarActivity" />
                </template>
              </div>
            </Transition>

            <button v-if="activeScreen === 'today'" class="phone-start-button" type="button">
              <Footprints :size="20" />
              开始运动
            </button>

            <nav class="phone-bottom-nav" aria-label="手机底部导航">
              <button
                v-for="item in bottomNav"
                :key="item.id"
                type="button"
                :class="{ active: item.screen === activeScreen }"
                @click="activeScreen = item.screen"
              >
                <component :is="item.icon" :size="21" aria-hidden="true" />
                <span>{{ item.label }}</span>
              </button>
            </nav>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import {
  Activity,
  BarChart3,
  Battery,
  Bed,
  Bike,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Compass,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Heart,
  Map as MapIcon,
  MapPin,
  RefreshCcw,
  Scale,
  Settings,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Waves,
  Weight,
  Zap,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import MobileActivityCard from '@/components/mobile/MobileActivityCard.vue'
import MobileChart from '@/components/mobile/MobileChart.vue'
import MobileMetricTile from '@/components/mobile/MobileMetricTile.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getActivities } from '@/services/activities'

const router = useRouter()

const screens = [
  { id: 'activities', label: '我的运动', icon: Footprints },
  { id: 'balance', label: '训练负荷', icon: Scale },
  { id: 'trends', label: '趋势', icon: TrendingUp },
  { id: 'stats', label: '运动统计', icon: BarChart3 },
  { id: 'today', label: '今日', icon: CalendarDays },
  { id: 'calendar', label: '运动日历', icon: Calendar },
]

const bottomNav = [
  { id: 'mine', label: '我的运动', icon: Footprints, screen: 'activities' },
  { id: 'sync', label: '同步', icon: RefreshCcw, screen: 'balance' },
  { id: 'today', label: '今日', icon: Calendar, screen: 'today' },
  { id: 'explore', label: '探索', icon: Compass, screen: 'trends' },
  { id: 'circle', label: '运动圈', icon: Users, screen: 'calendar' },
]

const activityFilters = ['全部', '跑步', '骑行', '游泳', '其他']
const ranges = ['42天', '3个月', '6个月', '1年', '2年']
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const activeScreen = ref('activities')
const activeFilter = ref('全部')
const activeRange = ref('6个月')
const selectedMetric = ref('heart')

const { data, error, load, loading } = useAsyncData(async () => getActivities())

const activities = computed(() => data.value || [])
const activeScreenLabel = computed(() => screens.find((screen) => screen.id === activeScreen.value)?.label || '我的运动')

const visibleActivities = computed(() => {
  if (activeFilter.value === '全部') return activities.value
  if (activeFilter.value === '其他') return activities.value.filter((activity) => activity.activity_type === '力量训练')
  return activities.value.filter((activity) => activity.activity_type === activeFilter.value)
})

const metricTiles = [
  { id: 'efficiency', label: '效率因子', unit: 'EF', icon: Zap, color: '#f6b234' },
  { id: 'vo2', label: 'VO2 Max', unit: '', icon: TrendingUp, color: '#56b6ff' },
  { id: 'ftp', label: 'FTP', unit: 'W', icon: Gauge, color: '#92f063' },
  { id: 'cadence', label: '平均频率', unit: 'rpm', icon: Timer, color: '#f6b234' },
  { id: 'balance', label: '左右平衡', unit: '%', icon: Scale, color: '#92f063' },
  { id: 'heart', label: '平均心率', unit: 'bpm', icon: Heart, color: '#ff4545' },
  { id: 'ascent', label: '总爬升', unit: 'm', icon: MapIcon, color: '#56b6ff' },
  { id: 'calories', label: '消耗', unit: 'kcal', icon: Flame, color: '#ff8e29' },
  { id: 'power', label: '强度系数', unit: 'IF', icon: Activity, color: '#ba48ff' },
]

const activeMetric = computed(() => metricTiles.find((metric) => metric.id === selectedMetric.value) || metricTiles[0])

const healthItems = [
  { label: '静息心率', value: '44 bpm', icon: Heart },
  { label: 'HRV 状态', value: 'hrv_status_unbalanced', icon: Activity },
  { label: '身体电量', value: '79%', icon: Battery, progress: '79%' },
  { label: '睡眠分数', value: '68', icon: Bed, progress: '68%' },
  { label: '最大摄氧量 (跑步)', value: '64.0', icon: TrendingUp },
  { label: '乳酸阈值心率', value: '184 bpm', icon: Heart },
  { label: '恢复时间', value: '--', icon: Timer },
  { label: '身体重量', value: '79%', icon: Weight },
]

const calendarDays = Array.from({ length: 35 }, (_, index) => {
  const day = index - 2
  const activityMap = new Map([
    [4, Footprints],
    [6, Bike],
    [8, Dumbbell],
    [11, Footprints],
    [13, Bike],
    [16, Footprints],
    [19, Dumbbell],
    [22, Bike],
    [24, Footprints],
    [28, Footprints],
  ])

  return {
    key: index,
    day: day > 0 ? day : '',
    muted: day <= 0,
    active: day === 28,
    icon: activityMap.get(day),
  }
})

const calendarActivity = computed(() => activities.value.find((activity) => activity.activity_type === '跑步') || activities.value[0] || {
  id: 0,
  activity_type: '跑步',
  local_start_time: '2026-05-28 19:43',
  total_distance_m: 9120,
  total_timer_time_s: 2475,
  avg_speed_mps: 3.85,
  total_calories: 620,
})

const loadLabels = ['12/08', '01/13', '02/19', '03/27', '05/03', '06/08']
const ctlData = [58, 46, 52, 83, 148, 204]
const atlData = [28, 42, 55, 91, 184, 211]
const tsbData = [30, 4, -3, -18, -36, -7]

const trainingBalanceOption = computed(() => ({
  backgroundColor: 'transparent',
  color: ['#1e9bff', '#bd34d1', '#ef4444'],
  tooltip: { trigger: 'axis', confine: true },
  legend: { show: false },
  grid: [
    { left: 42, right: 56, top: 20, height: 125 },
    { left: 42, right: 56, top: 175, height: 95 },
  ],
  xAxis: [
    { type: 'category', data: loadLabels, gridIndex: 0, axisLabel: { color: '#b8c0cb' }, axisLine: { lineStyle: { color: '#49515c' } } },
    { type: 'category', data: loadLabels, gridIndex: 1, axisLabel: { color: '#b8c0cb' }, axisLine: { lineStyle: { color: '#49515c' } } },
  ],
  yAxis: [
    { type: 'value', gridIndex: 0, axisLabel: { color: '#b8c0cb' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } } },
    { type: 'value', gridIndex: 1, axisLabel: { color: '#b8c0cb' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } } },
  ],
  series: [
    { name: '体能 (CTL)', type: 'line', smooth: true, data: ctlData, areaStyle: { opacity: 0.14 }, symbolSize: 4 },
    { name: '疲劳 (ATL)', type: 'line', smooth: true, data: atlData, symbolSize: 4 },
    { name: '状态 (TSB)', type: 'line', smooth: true, xAxisIndex: 1, yAxisIndex: 1, data: tsbData, areaStyle: { opacity: 0.1 }, symbolSize: 4 },
  ],
}))

const trendMetricOption = computed(() => {
  const metric = activeMetric.value
  const seriesMap = {
    efficiency: [1.62, 1.7, 1.84, 1.76, 1.93, 1.88],
    vo2: [51, 52, 53, 55, 57, 58],
    ftp: [214, 219, 224, 231, 237, 242],
    cadence: [174, 178, 181, 176, 184, 183],
    balance: [49, 50, 50, 51, 50, 50],
    heart: [132, 150, 143, 166, 148, 171],
    ascent: [46, 86, 142, 64, 208, 118],
    calories: [420, 610, 758, 530, 960, 720],
    power: [0.72, 0.78, 0.83, 0.81, 0.88, 0.86],
  }

  return {
    backgroundColor: 'transparent',
    color: [metric.color],
    tooltip: { trigger: 'axis', confine: true },
    grid: { left: 42, right: 18, top: 28, bottom: 36 },
    xAxis: {
      type: 'category',
      data: ['06/08', '09/16', '12/25', '04/04', '05/22', '06/08'],
      axisLabel: { color: '#c3c8d1' },
      axisLine: { lineStyle: { color: '#454c55' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#c3c8d1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,.07)' } },
    },
    series: [
      {
        name: metric.label,
        type: 'line',
        smooth: true,
        data: seriesMap[metric.id],
        areaStyle: { opacity: 0.14 },
        symbolSize: 5,
      },
    ],
  }
})

const monthlyCaloriesOption = computed(() => makeBarOption([180, 420, 560, 680, 894, 730, 610, 410], '#ff4b3e'))
const monthlyRideOption = computed(() => makeBarOption([0, 0, 18, 0, 42, 0, 8, 0], '#ff9b1a'))

function makeBarOption(values, color) {
  return {
    backgroundColor: 'transparent',
    color: [color],
    tooltip: { trigger: 'axis', confine: true },
    grid: { left: 34, right: 14, top: 12, bottom: 24 },
    xAxis: {
      type: 'category',
      data: ['1', '5', '10', '15', '20', '25', '30', ''],
      axisLabel: { color: '#aab1bd' },
      axisLine: { lineStyle: { color: '#444b54' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#aab1bd' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } },
    },
    series: [{ type: 'bar', barWidth: 12, data: values, itemStyle: { borderRadius: [5, 5, 0, 0] } }],
  }
}

function openActivity(activity) {
  router.push(`/activities/${activity.id}`)
}
</script>
