import { getEnvelope, mutateEnvelope, useMockData } from '@/services/api'

const mockBrief = {
  headline: '负荷平稳',
  sections: [
    { key: 'recent', title: '近期运动', tone: 'good', text: '近期训练保持连续，本月活动数量稳定。' },
    { key: 'body', title: '身体状态', tone: 'steady', text: '当前负荷处于可控区间，注意睡眠和补水。' },
    { key: 'today', title: '今日安排', tone: 'steady', text: '建议安排 30-45 分钟轻松有氧或一次灵活性训练。' },
  ],
  metrics: [
    { label: '本月活动', value: '6', tone: 'steady' },
    { label: '本月距离', value: '42.0 km', tone: 'good' },
    { label: '近期负荷', value: '平稳', tone: 'steady' },
    { label: '平均心率', value: '142 bpm', tone: 'steady' },
  ],
  recommendation: '今天以稳定有氧为主，避免连续高强度。',
  disclaimer: 'AI 建议仅用于训练参考，不替代医疗建议。',
}

const mockAnalysis = {
  headline: '运动智能分析',
  summary: '本次运动完成稳定，整体负荷可控。',
  insights: [
    { label: '距离', value: '5.0 km', tone: 'good' },
    { label: '用时', value: '30 分钟', tone: 'steady' },
    { label: '平均心率', value: '145 bpm', tone: 'steady' },
    { label: '训练负荷', value: '中等', tone: 'steady' },
  ],
  suggestions: ['结束后补水并拉伸。', '下一次训练可保持轻松有氧。'],
  disclaimer: 'AI 分析仅用于训练参考，不替代医疗建议。',
}

export async function getAiHealth() {
  if (useMockData()) {
    return {
      status: 'fallback',
      provider: 'rules',
      model: null,
      fallbackRules: true,
    }
  }

  const envelope = await getEnvelope('/ai/health')
  return envelope.data
}

export async function getDailyBrief() {
  if (useMockData()) {
    return { data: mockBrief, meta: { ai: { provider: 'mock', fallback: true } } }
  }

  return getEnvelope('/ai/daily-brief')
}

export async function sendAiMessage(message) {
  if (useMockData()) {
    return {
      data: {
        role: 'assistant',
        content: `根据当前 mock 数据：${mockBrief.sections.map((section) => section.text).join(' ')}`,
        quickReplies: ['今天适合训练吗？', '最近负荷怎么样？', '下一次跑步怎么安排？'],
      },
      meta: { ai: { provider: 'mock', fallback: true } },
    }
  }

  return mutateEnvelope('post', '/ai/chat', { message })
}

export async function analyzeActivity(activityId) {
  if (useMockData()) {
    return { data: mockAnalysis, meta: { ai: { provider: 'mock', fallback: true } } }
  }

  return mutateEnvelope('post', '/ai/activity-analysis', { activityId })
}
