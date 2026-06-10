const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const statsCache = require('../src/cache/statsCache');

function buildApp(overrides = {}) {
  const healthService = overrides.healthService || {
    checkDatabase: async () => ({ ok: true, message: 'connected' })
  };

  const activityService = overrides.activityService || {
    listActivities: async () => ({ items: [{ id: 1, activityType: 'running' }], page: 1, pageSize: 50, total: 1, totalPages: 1 }),
    getActivityById: async (id) => (id === 1 ? { id: 1, activityType: 'running' } : null),
    activityExists: async (id) => id === 1,
    getTrackPoints: async () => [{ sampleIndex: 0, heartRateBpm: 150 }],
    getHeartRateSeries: async () => [{ sampleTimeUtc: '2026-06-01T00:00:00.000Z', heartRateBpm: 150 }],
    getSpeedSeries: async () => [{ sampleTimeUtc: '2026-06-01T00:00:00.000Z', speedMps: 3.2 }],
    getLaps: async () => [{ lapIndex: 0, totalDistanceM: 1000 }],
    getZones: async () => [{ zoneType: 'heart_rate', zoneIndex: 1, durationS: 300 }],
    getActivityTypeStats: async () => [{ activityType: 'running', activityCount: 1 }],
    getSummaryStats: async () => ({ activityCount: 1, totalDistanceKm: 5 }),
    getTimelineStats: async () => [{ period: '2026-06-01', activityCount: 1 }],
    getMetricTrend: async () => [{ date: '2026-06-01', value: 150, sampleCount: 1, activities: [] }],
    getCalendarStats: async () => ({ month: '2026-06', days: [] }),
    getHeartRateZones: async () => [{ zone: 'Zone 1', label: '轻松' }],
    getLoadBalance: async () => [{ date: '2026-06-01', dailyTrainingLoad: 100, ctl: 20, atl: 50, tsb: -30, activities: [] }],
    getPersonalBests: async () => ({ running: [], cycling: [], overall: [] }),
    getDashboardOverview: async () => ({ recentActivities: [], monthlySummary: {}, yearlySummary: {}, trainingLoad: [], personalBests: {} })
  };

  const mlService = overrides.mlService || {
    FEATURE_NAMES: [
      'distanceM',
      'durationS',
      'movingDurationS',
      'elapsedDurationS',
      'avgSpeedMps',
      'maxSpeedMps',
      'avgHeartRateBpm',
      'maxHeartRateBpm',
      'avgCadenceSpm',
      'maxCadenceSpm',
      'elevationGainM',
      'elevationLossM',
      'avgStrideLengthCm',
      'normalizedPowerW'
    ],
    getHealth: async () => ({ status: 'ok', modelVersion: 'running-v1' }),
    runPrediction: async () => ({
      predictedTrainingLoadLevel: 'medium',
      fatigueRisk: 'medium',
      recoveryAdvice: 'keep recovery balanced',
      confidence: 0.82,
      modelVersion: 'running-v1'
    })
  };

  const authService = overrides.authService || {
    register: async ({ username, email }) => ({ user: { id: 2, username, email, role: 'user' }, token: 'registered-token' }),
    login: async ({ email }) => ({ user: { id: 2, username: 'tester', email, role: 'user' }, token: 'login-token' }),
    verifyToken: async (token) => {
      if (token === 'valid-user-token') {
        return { id: 2, username: 'tester', email: 'tester@example.com', role: 'user', status: 'active' };
      }
      if (token === 'valid-admin-token') {
        return { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', status: 'active' };
      }
      const error = new Error('invalid token');
      error.statusCode = 401;
      error.code = 'INVALID_TOKEN';
      throw error;
    }
  };

  const manualActivityService = overrides.manualActivityService || {
    createManualActivity: async () => ({ id: 10, activityType: 'running', isManual: true }),
    getManualActivity: async () => ({ id: 10, activityType: 'running', isManual: true }),
    updateManualActivity: async () => ({ id: 10, activityType: 'running', isManual: true }),
    deleteManualActivity: async () => ({ deleted: true, id: 10 })
  };

  return createApp({ healthService, activityService, mlService, authService, manualActivityService });
}

const manualPayload = {
  activityType: 'running',
  activityName: 'Manual Test Run',
  localStartTime: '2026-06-09 08:00:00',
  distanceM: 5000,
  durationS: 1800,
  movingDurationS: 1780,
  elapsedDurationS: 1850,
  avgSpeedMps: 2.8,
  maxSpeedMps: 4.5,
  avgHeartRateBpm: 150,
  maxHeartRateBpm: 175,
  avgCadenceSpm: 165,
  maxCadenceSpm: 190,
  elevationGainM: 30,
  elevationLossM: 30,
  avgStrideLengthCm: 100,
  normalizedPowerW: 220
};

test('GET /api/health returns service and database status', async () => {
  const response = await request(buildApp()).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.database.ok, true);
  assert.equal(typeof response.body.data.cache.stats.size, 'number');
});

test('GET /api/health reports degraded database state', async () => {
  const response = await request(
    buildApp({
      healthService: {
        checkDatabase: async () => ({ ok: false, message: 'connection failed' })
      }
    })
  ).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'degraded');
  assert.equal(response.body.data.database.ok, false);
});

test('GET /api/activities validates limit', async () => {
  const response = await request(buildApp()).get('/api/activities?limit=999');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_QUERY');
  assert.match(response.body.error.message, /limit/);
});

test('GET /api/activities passes filters and sort options', async () => {
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async (filters) => {
        captured = filters;
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
      },
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => ({}),
      getTimelineStats: async () => []
    }
  });

  const response = await request(app).get(
    '/api/activities?activity_type=running&start_date=2026-06-01&end_date=2026-06-09&sort_by=distance_m&sort_order=asc&limit=20&offset=5'
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, []);
  assert.deepEqual(response.body.meta, { page: 1, pageSize: 20, total: 0, totalPages: 0 });
  assert.deepEqual(captured, {
    activityType: 'running',
    startDate: '2026-06-01',
    endDate: '2026-06-09',
    keyword: undefined,
    source: undefined,
    owner: 'all',
    ownerUserId: undefined,
    limit: 20,
    offset: 5,
    page: 1,
    pageSize: 20,
    sortBy: 'distance_m',
    sortOrder: 'asc'
  });
});

test('GET /api/activities/:id returns 404 for missing activity', async () => {
  const response = await request(buildApp()).get('/api/activities/999');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.message, 'activity not found');
});

test('GET /api/activities/:id/track-points uses default paging', async () => {
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async () => [],
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async (activityId, paging) => {
        captured = { activityId, paging };
        return [];
      },
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => ({}),
      getTimelineStats: async () => []
    }
  });

  const response = await request(app).get('/api/activities/1/track-points');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, []);
  assert.deepEqual(captured, {
    activityId: 1,
    paging: { limit: 1000, offset: 0 }
  });
});

test('GET /api/activities/:id/track-points returns 404 for missing activity', async () => {
  const response = await request(buildApp()).get('/api/activities/999/track-points');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.message, 'activity not found');
});

test('GET /api/stats/summary passes date filters', async () => {
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async () => [],
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
    getActivityTypeStats: async () => [],
    getSummaryStats: async (filters) => {
      captured = filters;
      return { activityCount: 2 };
    },
      getTimelineStats: async () => [],
      getMetricTrend: async () => [],
      getCalendarStats: async () => ({ month: '2026-06', days: [] }),
      getLoadBalance: async () => [],
      getDashboardOverview: async () => ({})
    }
  });

  const response = await request(app).get('/api/stats/summary?start_date=2026-06-01&end_date=2026-06-09');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { activityCount: 2 });
  assert.deepEqual(captured, {
    activityType: undefined,
    startDate: '2026-06-01',
    endDate: '2026-06-09',
    keyword: undefined,
    source: undefined,
    owner: 'all',
    ownerUserId: undefined
  });
});

test('GET /api/stats/summary passes range filters', async () => {
  statsCache.clear();
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async () => [],
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async (filters) => {
        captured = filters;
        return { activityCount: 3 };
      },
      getTimelineStats: async () => [],
      getMetricTrend: async () => [],
      getCalendarStats: async () => ({ month: '2026-06', days: [] }),
      getHeartRateZones: async () => [],
      getLoadBalance: async () => [],
      getPersonalBests: async () => ({ running: [], cycling: [], overall: [] }),
      getDashboardOverview: async () => ({})
    }
  });

  const response = await request(app).get('/api/stats/summary?range=month&date=2026-06');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { activityCount: 3 });
  assert.equal(captured.range, 'month');
  assert.equal(captured.date, '2026-06');
  statsCache.clear();
});

test('GET /api/stats/timeline validates group_by', async () => {
  const response = await request(buildApp()).get('/api/stats/timeline?group_by=year');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_QUERY');
});

test('GET /api/stats/metric-trend returns trend points', async () => {
  statsCache.clear();
  let captured;
  const app = buildApp({
    activityService: {
      ...buildApp().locals?.activityService,
      listActivities: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => ({}),
      getTimelineStats: async () => [],
      getMetricTrend: async (filters) => {
        captured = filters;
        return [{ date: '2026-06-01', value: 150, sampleCount: 1, activities: [] }];
      },
      getCalendarStats: async () => ({ month: '2026-06', days: [] }),
      getHeartRateZones: async () => [],
      getLoadBalance: async () => [],
      getPersonalBests: async () => ({ running: [], cycling: [], overall: [] }),
      getDashboardOverview: async () => ({})
    }
  });

  const response = await request(app).get(
    '/api/stats/metric-trend?metric=avg_heart_rate_bpm&range=6m&end_date=2026-06-10'
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].value, 150);
  assert.equal(captured.metric, 'avg_heart_rate_bpm');
  assert.equal(captured.range, '6m');
  assert.equal(captured.endDate, '2026-06-10');
  statsCache.clear();
});

test('GET /api/stats/metric-trend rejects unsupported metric', async () => {
  const response = await request(buildApp()).get('/api/stats/metric-trend?metric=left_right_balance');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'UNSUPPORTED_METRIC');
});

test('GET /api/stats/calendar returns month calendar data', async () => {
  statsCache.clear();
  const response = await request(buildApp()).get('/api/stats/calendar?month=2026-06');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.month, '2026-06');
  assert.deepEqual(response.body.data.days, []);
  statsCache.clear();
});

test('GET /api/stats/calendar requires valid month', async () => {
  const response = await request(buildApp()).get('/api/stats/calendar?month=2026');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_QUERY');
});

test('GET /api/training/load-balance returns training series', async () => {
  statsCache.clear();
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => ({}),
      getTimelineStats: async () => [],
      getMetricTrend: async () => [],
      getCalendarStats: async () => ({ month: '2026-06', days: [] }),
      getHeartRateZones: async () => [],
      getLoadBalance: async (filters) => {
        captured = filters;
        return [{ date: '2026-06-01', dailyTrainingLoad: 100, ctl: 20, atl: 50, tsb: -30, activities: [] }];
      },
      getPersonalBests: async () => ({ running: [], cycling: [], overall: [] }),
      getDashboardOverview: async () => ({})
    }
  });

  const response = await request(app).get('/api/training/load-balance?range=1y&end_date=2026-06-10');

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].tsb, -30);
  assert.equal(captured.range, '1y');
  assert.equal(captured.endDate, '2026-06-10');
  statsCache.clear();
});

test('GET /api/training/load-balance validates range', async () => {
  const response = await request(buildApp()).get('/api/training/load-balance?range=2y');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_QUERY');
});

test('GET /api/dashboard/overview returns aggregated dashboard data', async () => {
  statsCache.clear();
  const response = await request(buildApp()).get('/api/dashboard/overview');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.recentActivities, []);
  assert.deepEqual(response.body.data.trainingLoad, []);
  statsCache.clear();
});

test('GET /api/ml/health returns model status', async () => {
  const response = await request(buildApp()).get('/api/ml/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.modelVersion, 'running-v1');
});

test('POST /api/ml/running-prediction validates missing feature', async () => {
  const response = await request(buildApp()).post('/api/ml/running-prediction').send({ distanceM: 5000 });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_ML_INPUT');
});

test('POST /api/ml/running-prediction returns running analysis result', async () => {
  const payload = {
    distanceM: 5000,
    durationS: 1800,
    movingDurationS: 1780,
    elapsedDurationS: 1850,
    avgSpeedMps: 2.8,
    maxSpeedMps: 4.5,
    avgHeartRateBpm: 150,
    maxHeartRateBpm: 175,
    avgCadenceSpm: 165,
    maxCadenceSpm: 190,
    elevationGainM: 30,
    elevationLossM: 30,
    avgStrideLengthCm: 100,
    normalizedPowerW: 220
  };

  const response = await request(buildApp()).post('/api/ml/running-prediction').send(payload);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.predictedTrainingLoadLevel, 'medium');
  assert.equal(response.body.data.fatigueRisk, 'medium');
  assert.equal(response.body.data.modelVersion, 'running-v1');
});

test('POST /api/ml/running-prediction allows local API origin', async () => {
  const payload = {
    distanceM: 5000,
    durationS: 1800,
    movingDurationS: 1780,
    elapsedDurationS: 1850,
    avgSpeedMps: 2.8,
    maxSpeedMps: 4.5,
    avgHeartRateBpm: 150,
    maxHeartRateBpm: 175,
    avgCadenceSpm: 165,
    maxCadenceSpm: 190,
    elevationGainM: 30,
    elevationLossM: 30,
    avgStrideLengthCm: 100,
    normalizedPowerW: 220
  };

  const response = await request(buildApp())
    .post('/api/ml/running-prediction')
    .set('Origin', 'http://127.0.0.1:8080')
    .send(payload);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.predictedTrainingLoadLevel, 'medium');
});

test('POST /api/auth/register returns user and token', async () => {
  const response = await request(buildApp())
    .post('/api/auth/register')
    .send({ username: 'tester', email: 'tester@example.com', password: 'password123' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.token, 'registered-token');
  assert.equal(response.body.data.user.email, 'tester@example.com');
});

test('GET /api/auth/me requires token', async () => {
  const response = await request(buildApp()).get('/api/auth/me');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('GET /api/activities owner=mine requires login', async () => {
  const response = await request(buildApp()).get('/api/activities?owner=mine');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('GET /api/activities owner=mine passes user id', async () => {
  let captured;
  const app = buildApp({
    activityService: {
      listActivities: async (filters) => {
        captured = filters;
        return { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 };
      },
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => ({}),
      getTimelineStats: async () => [],
      getHeartRateZones: async () => [],
      getPersonalBests: async () => ({})
    }
  });

  const response = await request(app)
    .get('/api/activities?owner=mine&keyword=Manual')
    .set('Authorization', 'Bearer valid-user-token');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, []);
  assert.equal(captured.owner, 'mine');
  assert.equal(captured.ownerUserId, 2);
  assert.equal(captured.keyword, 'Manual');
});

test('POST /api/manual-activities requires login', async () => {
  const response = await request(buildApp()).post('/api/manual-activities').send(manualPayload);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('POST /api/manual-activities creates manual activity without running ML prediction', async () => {
  let capturedPayload;
  let predictionCalled = false;
  const app = buildApp({
    manualActivityService: {
      createManualActivity: async (payload, user) => {
        capturedPayload = { payload, user };
        return { id: 99, activityType: payload.activityType, isManual: true };
      },
      getManualActivity: async () => ({}),
      updateManualActivity: async () => ({}),
      deleteManualActivity: async () => ({})
    },
    mlService: {
      FEATURE_NAMES: [],
      getHealth: async () => ({}),
      runPrediction: async () => {
        predictionCalled = true;
        return {};
      }
    }
  });

  const response = await request(app)
    .post('/api/manual-activities')
    .set('Authorization', 'Bearer valid-user-token')
    .send(manualPayload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 99);
  assert.equal(capturedPayload.user.id, 2);
  assert.equal(capturedPayload.payload.activityType, 'running');
  assert.equal(predictionCalled, false);
});

test('GET /api/activities returns unified paged response', async () => {
  const response = await request(buildApp()).get('/api/activities?page=1&page_size=5');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, [{ id: 1, activityType: 'running' }]);
  assert.deepEqual(response.body.meta, {
    page: 1,
    pageSize: 50,
    total: 1,
    totalPages: 1
  });
});

test('GET /api/stats/summary uses stats cache for repeated query', async () => {
  statsCache.clear();
  let calls = 0;
  const app = buildApp({
    activityService: {
      listActivities: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => {
        calls += 1;
        return { activityCount: calls };
      },
      getTimelineStats: async () => [],
      getHeartRateZones: async () => [],
      getPersonalBests: async () => ({})
    }
  });

  const first = await request(app).get('/api/stats/summary?activity_type=running');
  const second = await request(app).get('/api/stats/summary?activity_type=running');

  assert.equal(first.body.data.activityCount, 1);
  assert.equal(second.body.data.activityCount, 1);
  assert.equal(first.body.meta.cache.hit, false);
  assert.equal(second.body.meta.cache.hit, true);
  assert.equal(calls, 1);
  statsCache.clear();
});

test('POST /api/manual-activities clears stats cache', async () => {
  statsCache.clear();
  let calls = 0;
  const app = buildApp({
    activityService: {
      listActivities: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }),
      getActivityById: async () => null,
      activityExists: async () => true,
      getTrackPoints: async () => [],
      getHeartRateSeries: async () => [],
      getSpeedSeries: async () => [],
      getLaps: async () => [],
      getZones: async () => [],
      getActivityTypeStats: async () => [],
      getSummaryStats: async () => {
        calls += 1;
        return { activityCount: calls };
      },
      getTimelineStats: async () => [],
      getHeartRateZones: async () => [],
      getPersonalBests: async () => ({})
    }
  });

  await request(app).get('/api/stats/summary?activity_type=running');
  await request(app)
    .post('/api/manual-activities')
    .set('Authorization', 'Bearer valid-user-token')
    .send(manualPayload);
  const afterWrite = await request(app).get('/api/stats/summary?activity_type=running');

  assert.equal(afterWrite.body.data.activityCount, 2);
  assert.equal(calls, 2);
  statsCache.clear();
});
