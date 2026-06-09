const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');

function buildApp(overrides = {}) {
  const healthService = overrides.healthService || {
    checkDatabase: async () => ({ ok: true, message: 'connected' })
  };

  const activityService = overrides.activityService || {
    listActivities: async () => [{ id: 1, activityType: 'running' }],
    getActivityById: async (id) => (id === 1 ? { id: 1, activityType: 'running' } : null),
    activityExists: async (id) => id === 1,
    getTrackPoints: async () => [{ sampleIndex: 0, heartRateBpm: 150 }],
    getHeartRateSeries: async () => [{ sampleTimeUtc: '2026-06-01T00:00:00.000Z', heartRateBpm: 150 }],
    getSpeedSeries: async () => [{ sampleTimeUtc: '2026-06-01T00:00:00.000Z', speedMps: 3.2 }],
    getLaps: async () => [{ lapIndex: 0, totalDistanceM: 1000 }],
    getZones: async () => [{ zoneType: 'heart_rate', zoneIndex: 1, durationS: 300 }],
    getActivityTypeStats: async () => [{ activityType: 'running', activityCount: 1 }]
  };

  return createApp({ healthService, activityService });
}

test('GET /api/health returns service and database status', async () => {
  const response = await request(buildApp()).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database.ok, true);
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
  assert.equal(response.body.status, 'degraded');
  assert.equal(response.body.database.ok, false);
});

test('GET /api/activities validates limit', async () => {
  const response = await request(buildApp()).get('/api/activities?limit=999');

  assert.equal(response.status, 400);
  assert.match(response.body.message, /limit/);
});

test('GET /api/activities/:id returns 404 for missing activity', async () => {
  const response = await request(buildApp()).get('/api/activities/999');

  assert.equal(response.status, 404);
  assert.equal(response.body.message, 'activity not found');
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
      getActivityTypeStats: async () => []
    }
  });

  const response = await request(app).get('/api/activities/1/track-points');

  assert.equal(response.status, 200);
  assert.deepEqual(captured, {
    activityId: 1,
    paging: { limit: 1000, offset: 0 }
  });
});

test('GET /api/activities/:id/track-points returns 404 for missing activity', async () => {
  const response = await request(buildApp()).get('/api/activities/999/track-points');

  assert.equal(response.status, 404);
  assert.equal(response.body.message, 'activity not found');
});
