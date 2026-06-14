<template>
  <div class="page-stack">
    <StateBlock
      v-if="error"
      title="今日状态加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="reloadToday"
    />

    <template v-else>
      <div class="today-layout">
        <section class="dark-panel start-workout-panel compact">
          <div>
            <p class="overline">浏览器模拟运动</p>
            <h2>开始运动</h2>
            <p>快速记录一次浏览器运动，并写入运动记录。</p>
          </div>
          <RouterLink class="start-fab" to="/start">
            <Play :size="18" />
            开始运动
          </RouterLink>
        </section>

        <section class="dark-panel training-panel ai-brief-panel">
          <div class="section-heading">
            <div>
              <p class="overline">AI Brief</p>
              <h2>智能运动简报</h2>
            </div>
            <span class="ai-mode-pill" :class="{ fallback: aiFallback }">{{ aiModeLabel }}</span>
          </div>
          <div class="ai-brief-copy">
            <strong>{{ aiHeadline }}</strong>
            <p>{{ aiRecommendation }}</p>
          </div>
          <div class="ai-brief-sections">
            <span
              v-for="section in aiSections"
              :key="section.key"
              :class="section.tone"
            >
              <small>{{ section.title }}</small>
              <b>{{ section.text }}</b>
            </span>
          </div>
          <p v-if="aiError" class="ai-brief-error">
            {{ aiError }}
            <button type="button" @click="loadAiBrief">重新生成</button>
          </p>
          <div class="training-targets">
            <span
              v-for="metric in aiMetrics"
              :key="metric.label"
              :class="metric.tone"
            >
              <small>{{ metric.label }}</small>
              <b>{{ metric.value }}</b>
            </span>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Play } from '@lucide/vue'

import ActivityCard from '@/components/ActivityCard.vue'
import MetricCard from '@/components/MetricCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getDailyBrief } from '@/services/ai'
import { getDashboardOverview } from '@/services/dashboard'
import { formatDistance } from '@/utils/formatters'

const router = useRouter()
const defaultOverview = {
  recentActivities: [],
  monthlySummary: {},
  yearlySummary: {},
  trainingLoad: [],
}
const defaultBrief = {
  headline: '正在生成智能运动简报',
  sections: [
    { key: 'recent', title: '近期运动', tone: 'steady', text: '正在读取最近运动记录。' },
    { key: 'body', title: '身体状态', tone: 'steady', text: '正在分析训练负荷和恢复状态。' },
    { key: 'today', title: '今日安排', tone: 'steady', text: '正在生成今日训练建议。' },
  ],
  metrics: [
    { label: '最近负荷', value: '--', tone: 'steady' },
    { label: 'CTL', value: '--', tone: 'steady' },
    { label: 'ATL', value: '--', tone: 'steady' },
    { label: 'TSB', value: '--', tone: 'steady' },
  ],
  recommendation: '正在读取近期运动、训练负荷和今日状态，请稍候。',
}

const sectionDefaults = [
  { key: 'recent', title: '近期运动', tone: 'steady', text: '已读取最近运动记录，可结合活动频率、距离和类型判断训练连续性。' },
  { key: 'body', title: '身体状态', tone: 'steady', text: '已读取训练负荷指标，可结合 CTL、ATL、TSB 判断恢复状态。' },
  { key: 'today', title: '今日安排', tone: 'steady', text: '建议结合近期负荷安排训练强度，避免连续高强度刺激。' },
]

function normalizeBrief(brief) {
  const source = brief && typeof brief === 'object' ? brief : {}
  const sections = Array.isArray(source.sections) ? source.sections : []
  const metrics = Array.isArray(source.metrics) ? source.metrics : defaultBrief.metrics

  return {
    headline: source.headline || defaultBrief.headline,
    recommendation: source.recommendation || defaultBrief.recommendation,
    sections: sectionDefaults.map((fallback, index) => {
      const item = sections[index] || {}
      return {
        key: item.key || fallback.key,
        title: item.title || fallback.title,
        tone: item.tone || fallback.tone,
        text: item.text || fallback.text,
      }
    }),
    metrics: metrics.map((metric, index) => ({
      label: metric.label || defaultBrief.metrics[index]?.label || '指标',
      value: metric.value ?? defaultBrief.metrics[index]?.value ?? '--',
      tone: metric.tone || defaultBrief.metrics[index]?.tone || 'steady',
    })),
  }
}

async function loadAiBrief() {
  aiLoading.value = true
  aiError.value = ''
  aiBrief.value = normalizeBrief(defaultBrief)
  aiMeta.value = { ai: { fallback: true, provider: 'loading' } }
  try {
    const briefEnvelope = await getDailyBrief()
    aiBrief.value = normalizeBrief(briefEnvelope.data)
    aiMeta.value = briefEnvelope.meta || {}
  } catch (err) {
    aiBrief.value = normalizeBrief({
      ...defaultBrief,
      headline: '智能简报暂时不可用',
      recommendation: '已保留基础训练提示，可稍后重新生成。',
      sections: sectionDefaults,
    })
    aiMeta.value = { ai: { fallback: true, provider: 'rules' } }
    aiError.value = err instanceof Error ? err.message : '智能简报生成失败'
  } finally {
    aiLoading.value = false
  }
}

async function reloadToday() {
  await Promise.all([load(), loadAiBrief()])
}

const { data: overviewData, error, load } = useAsyncData(getDashboardOverview, defaultOverview)
const aiBrief = ref(normalizeBrief(defaultBrief))
const aiMeta = ref({ ai: { fallback: true, provider: 'loading' } })
const aiLoading = ref(true)
const aiError = ref('')

const overview = computed(() => overviewData.value || defaultOverview)
const aiFallback = computed(() => aiLoading.value || aiMeta.value?.ai?.fallback !== false)
const aiModeLabel = computed(() => {
  if (aiLoading.value) return '生成中'
  if (aiFallback.value) return '规则模式'
  const provider = aiMeta.value?.ai?.provider
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'ollama') return '本地 Ollama'
  return 'AI 模型'
})
const aiHeadline = computed(() => (aiLoading.value ? defaultBrief.headline : aiBrief.value.headline))
const aiRecommendation = computed(() => (aiLoading.value ? defaultBrief.recommendation : aiBrief.value.recommendation))
const aiSections = computed(() => (aiLoading.value ? defaultBrief.sections : aiBrief.value.sections))
const aiMetrics = computed(() => aiBrief.value.metrics)
const recentActivities = computed(() => (overview.value?.recentActivities || []).slice(0, 6))

onMounted(loadAiBrief)
</script>
