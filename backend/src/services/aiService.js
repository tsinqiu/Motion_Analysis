const config = require('../config');
const { ApiError } = require('../errors');
const activityService = require('./activityService');

const SYSTEM_PROMPT = [
  '你是一个运动数据分析助手，只回答与运动训练、恢复、训练负荷、近期运动和单次活动分析相关的问题。',
  '回答必须使用简体中文，简洁、可执行，不做医疗诊断。',
  '如果信息不足，说明依据不足，并给出保守建议。',
  '不要编造不存在的运动记录、健康指标或模型能力。'
].join('\n');

const EMPTY_OVERVIEW = {
  recentActivities: [],
  monthlySummary: {},
  yearlySummary: {},
  trainingLoad: [],
  personalBests: {}
};

function visibleOverviewFilters(user) {
  return {
    owner: 'all',
    ownerUserId: user?.id
  };
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function round(value, digits = 1) {
  const numberValue = toNumber(value);
  if (numberValue === null) return null;
  const factor = 10 ** digits;
  return Math.round(numberValue * factor) / factor;
}

function formatKm(valueM) {
  const numberValue = toNumber(valueM);
  if (numberValue === null) return '--';
  return `${round(numberValue / 1000, 1)} km`;
}

function formatDuration(valueS) {
  const seconds = toNumber(valueS);
  if (seconds === null) return '--';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function activityTypeLabel(type) {
  const labels = {
    running: '跑步',
    cycling: '骑行',
    swimming: '游泳',
    strength_training: '力量训练',
    floor_climbing: '爬楼'
  };
  return labels[type] || type || '运动';
}

function normalizeActivity(activity = {}) {
  return {
    id: activity.id,
    name: firstDefined(activity.activityName, activity.activity_name, activity.activityType, activity.activity_type, '运动记录'),
    type: firstDefined(activity.activityType, activity.activity_type),
    localStartTime: firstDefined(activity.localStartTime, activity.local_start_time),
    distanceM: toNumber(firstDefined(activity.distanceM, activity.totalDistanceM, activity.total_distance_m)),
    durationS: toNumber(firstDefined(activity.durationS, activity.totalTimerTimeS, activity.total_timer_time_s)),
    avgHeartRateBpm: toNumber(firstDefined(activity.avgHeartRateBpm, activity.avg_heart_rate_bpm)),
    maxHeartRateBpm: toNumber(firstDefined(activity.maxHeartRateBpm, activity.max_heart_rate_bpm)),
    avgPaceSecPerKm: toNumber(firstDefined(activity.avgPaceSecPerKm, activity.avg_pace_sec_per_km)),
    avgSpeedMps: toNumber(firstDefined(activity.avgSpeedMps, activity.avg_speed_mps)),
    avgCadenceSpm: toNumber(firstDefined(activity.avgCadenceSpm, activity.avg_cadence)),
    trainingLoad: toNumber(firstDefined(activity.activityTrainingLoad, activity.activity_training_load)),
    calories: toNumber(activity.calories)
  };
}

function latestLoad(overview) {
  return overview.trainingLoad?.at(-1) || {};
}

function loadTone(load) {
  const tsb = toNumber(load.tsb);
  if (tsb !== null && tsb < -15) return { tone: 'warning', label: '疲劳偏高' };
  if (tsb !== null && tsb > 8) return { tone: 'good', label: '状态较新鲜' };
  return { tone: 'steady', label: '负荷平稳' };
}

function summarizeRecentActivities(overview) {
  const recent = overview.recentActivities || [];
  if (!recent.length) {
    return '近期暂无运动记录，建议先安排一次低强度有氧或轻量力量训练。';
  }

  const totalDistanceM = recent.reduce((sum, activity) => sum + (normalizeActivity(activity).distanceM || 0), 0);
  const types = [...new Set(recent.map((activity) => activityTypeLabel(normalizeActivity(activity).type)))].slice(0, 3);
  return `近期共有 ${recent.length} 次运动，累计约 ${formatKm(totalDistanceM)}，主要类型为 ${types.join('、')}。`;
}

function buildRuleDailyBrief(overview = EMPTY_OVERVIEW) {
  const load = latestLoad(overview);
  const status = loadTone(load);
  const monthlyCount = overview.monthlySummary?.activityCount || 0;
  const monthlyDistanceKm = round((overview.monthlySummary?.totalDistanceKm || 0), 1);
  const avgHeartRate = overview.monthlySummary?.avgHeartRateBpm || null;
  const dailyLoad = round(load.dailyTrainingLoad, 1);
  const ctl = round(load.ctl, 1);
  const atl = round(load.atl, 1);
  const tsb = round(load.tsb, 1);
  const recommendation = status.tone === 'warning'
    ? '今天建议恢复优先，可选择轻松慢跑、骑行或拉伸，避免高强度间歇。'
    : status.tone === 'good'
      ? '今天可以安排一次质量训练，但保持热身充分，并关注心率漂移。'
      : '今天适合中低强度有氧或技术训练，维持节奏即可。';

  return {
    headline: status.label,
    sections: [
      {
        key: 'recent',
        title: '近期运动',
        tone: 'good',
        text: summarizeRecentActivities(overview)
      },
      {
        key: 'body',
        title: '身体状态',
        tone: status.tone,
        text: `当前 TSB ${tsb ?? '--'}，CTL ${ctl ?? '--'}，ATL ${atl ?? '--'}，整体判断为${status.label}。`
      },
      {
        key: 'today',
        title: '今日安排',
        tone: status.tone,
        text: recommendation
      }
    ],
    metrics: [
      { label: '本月活动', value: `${monthlyCount}`, tone: 'steady' },
      { label: '本月距离', value: `${monthlyDistanceKm} km`, tone: 'good' },
      { label: '近期负荷', value: dailyLoad ?? '--', tone: status.tone },
      { label: '平均心率', value: avgHeartRate ? `${avgHeartRate} bpm` : '--', tone: 'steady' }
    ],
    recommendation,
    disclaimer: 'AI 建议仅用于训练参考，不替代医疗建议。'
  };
}

function buildRuleActivityAnalysis(activity) {
  const item = normalizeActivity(activity);
  const typeLabel = activityTypeLabel(item.type);
  const load = item.trainingLoad;
  const heartRateText = item.avgHeartRateBpm ? `${item.avgHeartRateBpm} bpm` : '--';
  const loadToneValue = load !== null && load > 180 ? 'warning' : load !== null && load < 40 ? 'easy' : 'steady';
  const suggestions = [];

  if (item.distanceM) {
    suggestions.push(`本次${typeLabel}距离约 ${formatKm(item.distanceM)}，总用时 ${formatDuration(item.durationS)}。`);
  } else {
    suggestions.push(`本次${typeLabel}以时长和身体反馈为主要参考，轨迹或距离数据不足。`);
  }
  if (item.avgHeartRateBpm) {
    suggestions.push(`平均心率 ${heartRateText}，建议结合主观疲劳判断恢复需求。`);
  }
  if (loadToneValue === 'warning') {
    suggestions.push('训练负荷偏高，建议接下来 24-48 小时降低强度，优先睡眠和补水。');
  } else if (loadToneValue === 'easy') {
    suggestions.push('负荷较轻，可作为恢复或基础训练日，后续可逐步增加训练刺激。');
  } else {
    suggestions.push('负荷处于可控区间，下一次训练可以根据疲劳感选择稳定有氧或技术训练。');
  }

  return {
    headline: `${typeLabel}智能分析`,
    summary: suggestions[0],
    insights: [
      { label: '距离', value: formatKm(item.distanceM), tone: 'good' },
      { label: '用时', value: formatDuration(item.durationS), tone: 'steady' },
      { label: '平均心率', value: heartRateText, tone: 'steady' },
      { label: '训练负荷', value: load ?? '--', tone: loadToneValue }
    ],
    suggestions: suggestions.slice(1),
    disclaimer: 'AI 分析仅用于训练参考，不替代医疗建议。'
  };
}

function sanitizeQuestion(message) {
  const text = String(message || '').trim();
  if (!text) {
    throw new ApiError(400, 'message is required', 'INVALID_AI_INPUT');
  }
  if (text.length > 1000) {
    throw new ApiError(400, 'message is too long', 'INVALID_AI_INPUT');
  }
  return text;
}

function isSportsQuestion(message) {
  return /运动|跑步|骑行|游泳|训练|恢复|心率|配速|步频|负荷|疲劳|今日|安排|活动|记录|建议|Garmin|有氧|力量|拉伸/i.test(message);
}

function buildRuleChatAnswer(message, overview) {
  if (!isSportsQuestion(message)) {
    return '我目前只围绕你的运动数据、训练负荷、恢复和训练安排提供建议。可以问我“今天适合训练吗”或“最近跑步状态怎么样”。';
  }

  const brief = buildRuleDailyBrief(overview);
  return [
    brief.sections[0].text,
    brief.sections[1].text,
    brief.recommendation
  ].join('\n');
}

function extractJsonObject(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_inner) {
      return null;
    }
  }
}

function parseJsonResponse(text) {
  const parsed = extractJsonObject(text);
  if (!parsed) {
    throw new ApiError(502, 'AI response was not valid JSON', 'AI_RESPONSE_INVALID');
  }
  return parsed;
}

function normalizeDailyBriefResponse(modelBrief, overview) {
  const ruleBrief = buildRuleDailyBrief(overview);
  const source = modelBrief && typeof modelBrief === 'object' ? modelBrief : {};
  const sourceSections = Array.isArray(source.sections) ? source.sections : [];
  const sourceMetrics = Array.isArray(source.metrics) ? source.metrics : [];

  return {
    headline: source.headline || ruleBrief.headline,
    sections: ruleBrief.sections.map((fallback, index) => {
      const item = sourceSections.find((section) => section?.key === fallback.key) || sourceSections[index] || {};
      return {
        key: item.key || fallback.key,
        title: item.title || fallback.title,
        tone: item.tone || fallback.tone,
        text: item.text || fallback.text
      };
    }),
    metrics: ruleBrief.metrics.map((fallback, index) => {
      const item = sourceMetrics[index] || {};
      return {
        label: item.label || fallback.label,
        value: item.value ?? fallback.value,
        tone: item.tone || fallback.tone
      };
    }),
    recommendation: source.recommendation || ruleBrief.recommendation,
    disclaimer: source.disclaimer || ruleBrief.disclaimer
  };
}

function requireFetch() {
  if (typeof fetch !== 'function') {
    throw new ApiError(503, 'fetch is not available in this Node.js runtime', 'AI_PROVIDER_UNAVAILABLE');
  }
}

function providerSequence() {
  if (config.ai.provider === 'auto') return config.ai.providerOrder;
  if (['deepseek', 'ollama'].includes(config.ai.provider)) return [config.ai.provider];
  throw new ApiError(503, 'AI provider is not configured', 'AI_PROVIDER_UNAVAILABLE');
}

function modelForProvider(provider) {
  return provider === 'deepseek' ? config.ai.deepseekModel : config.ai.ollamaModel;
}

function providerError(provider, message, code = 'AI_PROVIDER_UNAVAILABLE') {
  const error = new ApiError(503, message, code);
  error.provider = provider;
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = config.ai.timeoutMs) {
  requireFetch();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(503, 'AI request timed out', 'AI_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callDeepSeek(messages, { json = false, maxTokens = undefined } = {}) {
  if (!config.ai.deepseekApiKey) {
    throw providerError('deepseek', 'DeepSeek API key is not configured');
  }

  try {
    const response = await fetchWithTimeout(`${config.ai.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.deepseekApiKey}`
      },
      body: JSON.stringify({
        model: config.ai.deepseekModel,
        messages,
        stream: false,
        temperature: 0.25,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch (_error) {
        detail = '';
      }
      throw providerError('deepseek', `DeepSeek returned ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message?.content || '';
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw providerError('deepseek', `DeepSeek failed: ${error.message}`);
  }
}

async function callOllama(messages, { format = undefined } = {}) {
  try {
    const response = await fetchWithTimeout(`${config.ai.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.ollamaModel,
        messages,
        stream: false,
        think: false,
        ...(format ? { format } : {}),
        options: {
          temperature: 0.25
        }
      })
    });

    if (!response.ok) {
      throw providerError('ollama', `Ollama returned ${response.status}`);
    }

    const payload = await response.json();
    return payload.message?.content || payload.response || '';
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw providerError('ollama', `Ollama failed: ${error.message}`);
  }
}

async function callAiProvider(messages, { json = false } = {}) {
  const providers = providerSequence();
  const errors = [];

  for (const provider of providers) {
    try {
      const content = provider === 'deepseek'
        ? await callDeepSeek(messages, { json })
        : await callOllama(messages, { format: json ? 'json' : undefined });
      return {
        provider,
        model: modelForProvider(provider),
        content
      };
    } catch (error) {
      errors.push(error);
    }
  }

  const lastError = errors.at(-1) || new ApiError(503, 'AI provider is not configured', 'AI_PROVIDER_UNAVAILABLE');
  lastError.providerErrors = errors.map((error) => ({
    provider: error.provider,
    code: error.code,
    message: error.message
  }));
  throw lastError;
}

async function checkDeepSeekHealth() {
  const status = {
    configured: Boolean(config.ai.deepseekApiKey),
    available: false,
    model: config.ai.deepseekModel,
    errorMessage: null
  };

  if (!status.configured) {
    status.errorMessage = 'DeepSeek API key is not configured';
    return status;
  }

  try {
    await callDeepSeek([
      { role: 'system', content: 'Reply with ok.' },
      { role: 'user', content: 'ping' }
    ], { maxTokens: 1 });
    status.available = true;
  } catch (error) {
    status.errorMessage = error.message;
  }

  return status;
}

async function checkOllamaHealth() {
  const status = {
    configured: Boolean(config.ai.ollamaBaseUrl),
    available: false,
    model: config.ai.ollamaModel,
    modelAvailable: false,
    baseUrl: config.ai.ollamaBaseUrl,
    errorMessage: null
  };

  try {
    const response = await fetchWithTimeout(
      `${config.ai.ollamaBaseUrl.replace(/\/$/, '')}/api/tags`,
      {},
      Math.min(config.ai.timeoutMs, 5000)
    );
    status.available = response.ok;
    if (response.ok) {
      const payload = await response.json();
      status.modelAvailable = Array.isArray(payload.models)
        && payload.models.some((model) => model.name === config.ai.ollamaModel || model.model === config.ai.ollamaModel);
    } else {
      status.errorMessage = `Ollama returned ${response.status}`;
    }
  } catch (error) {
    status.errorMessage = error.name === 'AbortError' ? 'Ollama health check timed out' : error.message;
  }

  return status;
}

async function getHealth() {
  const providers = providerSequence();
  const providerStatuses = {};

  for (const provider of providers) {
    providerStatuses[provider] = provider === 'deepseek'
      ? await checkDeepSeekHealth()
      : await checkOllamaHealth();
  }

  const activeProvider = providers.find((provider) => {
    const status = providerStatuses[provider];
    if (provider === 'ollama') return status.available && status.modelAvailable;
    return status.available;
  }) || 'rules';

  return {
    status: activeProvider === 'rules' ? 'fallback' : 'ok',
    provider: activeProvider,
    activeProvider,
    configuredProviders: providers,
    providerMode: config.ai.provider,
    model: activeProvider === 'rules' ? null : modelForProvider(activeProvider),
    fallbackRules: config.ai.fallbackRules,
    providers: providerStatuses
  };
}

async function getOverviewForUser(user) {
  try {
    return await activityService.getDashboardOverview(visibleOverviewFilters(user));
  } catch (_error) {
    return EMPTY_OVERVIEW;
  }
}

async function withModelFallback(builder, fallbackBuilder) {
  try {
    const result = await builder();
    return {
      data: result.data,
      meta: {
        ai: {
          provider: result.provider,
          model: result.model,
          fallback: false
        }
      }
    };
  } catch (error) {
    if (!config.ai.fallbackRules) throw error;
    return {
      data: fallbackBuilder(error),
      meta: {
        ai: {
          provider: 'rules',
          model: null,
          fallback: true,
          reason: error.code || 'AI_PROVIDER_UNAVAILABLE',
          failedProvider: error.provider || null
        }
      }
    };
  }
}

async function getDailyBrief(user) {
  const overview = await getOverviewForUser(user);
  const fallback = () => buildRuleDailyBrief(overview);

  return withModelFallback(async () => {
    const result = await callAiProvider([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          '请根据下面的运动概览生成 JSON，只输出 JSON，不要 Markdown。',
          '字段必须为 headline, sections, metrics, recommendation, disclaimer。',
          'sections 必须为 3 项，key 必须分别是 recent、body、today，每项必须包含 title、tone、text。',
          'metrics 必须为 4 项，每项必须包含 label、value、tone。',
          JSON.stringify({ overview })
        ].join('\n')
      }
    ], { json: true });
    return {
      provider: result.provider,
      model: result.model,
      data: normalizeDailyBriefResponse(parseJsonResponse(result.content), overview)
    };
  }, fallback);
}

async function chat({ message }, user) {
  const question = sanitizeQuestion(message);
  const overview = await getOverviewForUser(user);
  const fallback = () => ({
    role: 'assistant',
    content: buildRuleChatAnswer(question, overview),
    quickReplies: ['今天适合训练吗？', '最近运动负荷怎么样？', '下一次跑步怎么安排？']
  });

  return withModelFallback(async () => {
    const result = await callAiProvider([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `用户问题：${question}`,
          '下面是用户近期运动概览，请只基于这些数据回答：',
          JSON.stringify({ overview })
        ].join('\n')
      }
    ]);
    return {
      provider: result.provider,
      model: result.model,
      data: {
        role: 'assistant',
        content: result.content.trim() || fallback().content,
        quickReplies: ['今天适合训练吗？', '最近运动负荷怎么样？', '这次运动恢复多久？']
      }
    };
  }, fallback);
}

async function analyzeActivity({ activityId }, user) {
  const id = Number.parseInt(activityId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, 'activityId is required', 'INVALID_AI_INPUT');
  }

  const activity = await activityService.getActivityById(id);
  if (!activity) {
    throw new ApiError(404, 'activity not found', 'ACTIVITY_NOT_FOUND');
  }

  const fallback = () => buildRuleActivityAnalysis(activity);

  return withModelFallback(async () => {
    const result = await callAiProvider([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          '请分析这次运动，生成 JSON，只输出 JSON，不要 Markdown。',
          '字段必须为 headline, summary, insights, suggestions, disclaimer。',
          'insights 使用 label/value/tone，suggestions 为 2-4 条简短建议。',
          JSON.stringify({ activity: normalizeActivity(activity), userId: user.id })
        ].join('\n')
      }
    ], { json: true });
    return {
      provider: result.provider,
      model: result.model,
      data: parseJsonResponse(result.content)
    };
  }, fallback);
}

module.exports = {
  getHealth,
  getDailyBrief,
  chat,
  analyzeActivity
};
