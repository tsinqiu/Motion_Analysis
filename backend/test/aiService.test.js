const test = require('node:test');
const assert = require('node:assert/strict');

const ENV_KEYS = [
  'AI_PROVIDER',
  'AI_PROVIDER_ORDER',
  'AI_MODEL',
  'AI_DEEPSEEK_MODEL',
  'AI_DEEPSEEK_BASE_URL',
  'DEEPSEEK_API_KEY',
  'AI_DEEPSEEK_API_KEY',
  'AI_OLLAMA_MODEL',
  'AI_OLLAMA_BASE_URL',
  'AI_TIMEOUT_MS',
  'AI_FALLBACK_RULES'
];

const originalEnv = ENV_KEYS.reduce((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});
const originalFetch = global.fetch;

function resetAiModules() {
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/aiService')];
}

function setAiEnv(values) {
  for (const key of ENV_KEYS) {
    process.env[key] = '';
  }
  Object.assign(process.env, values);
}

function loadAiService(values, fetchImpl) {
  setAiEnv({
    AI_TIMEOUT_MS: '1000',
    AI_FALLBACK_RULES: 'true',
    ...values
  });
  global.fetch = fetchImpl;
  resetAiModules();
  const aiService = require('../src/services/aiService');
  const activityService = require('../src/services/activityService');
  activityService.getDashboardOverview = async () => ({
    recentActivities: [{ id: 1, activityType: 'running', distanceM: 5000 }],
    monthlySummary: { activityCount: 1, totalDistanceKm: 5 },
    yearlySummary: {},
    trainingLoad: [{ dailyTrainingLoad: 80, ctl: 20, atl: 24, tsb: -4 }],
    personalBests: {}
  });
  activityService.getActivityById = async (id) => (id === 1
    ? { id: 1, activityType: 'running', distanceM: 5000, durationS: 1800, avgHeartRateBpm: 145 }
    : null);
  return aiService;
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  global.fetch = originalFetch;
  resetAiModules();
});

test('aiService reports DeepSeek unavailable without API key and falls back to rules', async () => {
  let fetchCount = 0;
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: '',
    AI_DEEPSEEK_MODEL: 'deepseek-chat'
  }, async () => {
    fetchCount += 1;
    return jsonResponse({});
  });

  const health = await aiService.getHealth();
  assert.equal(health.provider, 'rules');
  assert.deepEqual(health.configuredProviders, ['deepseek']);
  assert.equal(health.providers.deepseek.configured, false);

  const result = await aiService.chat({ message: '今天适合训练吗？' }, { id: 2 });
  assert.equal(result.meta.ai.provider, 'rules');
  assert.equal(result.meta.ai.fallback, true);
  assert.equal(fetchCount, 0);
});

test('aiService calls DeepSeek chat completions when configured', async () => {
  const calls = [];
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    AI_DEEPSEEK_MODEL: 'deepseek-chat'
  }, async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      choices: [{ message: { content: 'DeepSeek 建议：今天适合轻松有氧。' } }]
    });
  });

  const result = await aiService.chat({ message: '今天适合训练吗？' }, { id: 2 });

  assert.equal(result.meta.ai.provider, 'deepseek');
  assert.equal(result.meta.ai.model, 'deepseek-chat');
  assert.equal(result.meta.ai.fallback, false);
  assert.match(result.data.content, /DeepSeek 建议/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /https:\/\/api\.deepseek\.com\/chat\/completions$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
});

test('aiService falls back when DeepSeek JSON response is invalid', async () => {
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    AI_DEEPSEEK_MODEL: 'deepseek-chat'
  }, async () => jsonResponse({
    choices: [{ message: { content: '这不是 JSON' } }]
  }));

  const brief = await aiService.getDailyBrief({ id: 2 });
  assert.equal(brief.meta.ai.provider, 'rules');
  assert.equal(brief.meta.ai.fallback, true);
  assert.equal(brief.meta.ai.reason, 'AI_RESPONSE_INVALID');

  const analysis = await aiService.analyzeActivity({ activityId: 1 }, { id: 2 });
  assert.equal(analysis.meta.ai.provider, 'rules');
  assert.equal(analysis.meta.ai.fallback, true);
  assert.equal(analysis.meta.ai.reason, 'AI_RESPONSE_INVALID');
});

test('aiService fills missing DeepSeek daily brief sections from rules', async () => {
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'test-key',
    AI_DEEPSEEK_MODEL: 'deepseek-chat'
  }, async () => jsonResponse({
    choices: [{
      message: {
        content: JSON.stringify({
          headline: '今日训练负荷较高，注意恢复',
          recommendation: '建议明天安排低强度恢复。',
          metrics: [{ label: '今日训练负荷', value: '80', tone: 'warning' }]
        })
      }
    }]
  }));

  const brief = await aiService.getDailyBrief({ id: 2 });

  assert.equal(brief.meta.ai.provider, 'deepseek');
  assert.equal(brief.meta.ai.fallback, false);
  assert.equal(brief.data.sections.length, 3);
  assert.equal(brief.data.sections[0].key, 'recent');
  assert.match(brief.data.sections[0].text, /近期共有|近期暂无运动记录/);
  assert.equal(brief.data.metrics.length, 4);
});

test('aiService auto mode tries DeepSeek first and then Ollama', async () => {
  const urls = [];
  const aiService = loadAiService({
    AI_PROVIDER: 'auto',
    AI_PROVIDER_ORDER: 'deepseek,ollama',
    DEEPSEEK_API_KEY: 'bad-key',
    AI_DEEPSEEK_MODEL: 'deepseek-chat',
    AI_OLLAMA_MODEL: 'qwen2.5:1.5b-instruct'
  }, async (url) => {
    urls.push(url);
    if (url.includes('deepseek')) {
      return jsonResponse({ error: { message: 'unauthorized' } }, 401);
    }
    return jsonResponse({ message: { content: 'Ollama 建议：保持轻松。' } });
  });

  const result = await aiService.chat({ message: '最近负荷怎么样？' }, { id: 2 });

  assert.equal(result.meta.ai.provider, 'ollama');
  assert.equal(result.meta.ai.model, 'qwen2.5:1.5b-instruct');
  assert.match(result.data.content, /Ollama 建议/);
  assert.equal(urls.some((url) => url.includes('deepseek')), true);
  assert.equal(urls.some((url) => url.includes('/api/chat')), true);
});

test('aiService deepseek mode does not call Ollama after DeepSeek failure', async () => {
  const urls = [];
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'bad-key',
    AI_DEEPSEEK_MODEL: 'deepseek-chat'
  }, async (url) => {
    urls.push(url);
    return jsonResponse({ error: { message: 'quota exceeded' } }, 402);
  });

  const result = await aiService.chat({ message: '今天怎么安排？' }, { id: 2 });

  assert.equal(result.meta.ai.provider, 'rules');
  assert.equal(result.meta.ai.fallback, true);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].includes('deepseek'), true);
  assert.equal(urls.some((url) => url.includes('/api/chat')), false);
});

test('aiService uses visible dashboard overview instead of current-user-only data', async () => {
  const aiService = loadAiService({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: ''
  }, async () => jsonResponse({}));
  const activityService = require('../src/services/activityService');
  let receivedFilters = null;
  activityService.getDashboardOverview = async (filters) => {
    receivedFilters = filters;
    return {
      recentActivities: [],
      monthlySummary: {},
      yearlySummary: {},
      trainingLoad: [],
      personalBests: {}
    };
  };

  await aiService.chat({ message: '今天适合训练吗？' }, { id: 7 });

  assert.equal(receivedFilters.owner, 'all');
  assert.equal(receivedFilters.ownerUserId, 7);
});
