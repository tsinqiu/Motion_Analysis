# Backend API

Frontend integration notes:

```text
backend/docs/frontend-integration.md
```

Base URL for local frontend development:

```text
http://localhost:8080/api
```

## Auth

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Register and login return:

```json
{
  "data": {
    "user": {
      "id": 2,
      "username": "tester",
      "email": "tester@example.com",
      "role": "user"
    },
    "token": "jwt-token"
  },
  "meta": {}
}
```

Write APIs require:

```text
Authorization: Bearer <token>
```

## Activities

```text
GET /api/activities?page=1&page_size=20&activity_type=running&keyword=无锡&start_date=2026-06-01&end_date=2026-06-09&sort_by=avg_pace&sort_order=asc
GET /api/activities/:id
GET /api/activities/:id/track-points?limit=1000&offset=0
GET /api/activities/:id/heart-rate?limit=2000&offset=0
GET /api/activities/:id/speed?limit=2000&offset=0
GET /api/activities/:id/laps
GET /api/activities/:id/zones
```

`GET /api/activities` returns paged data:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 138,
    "totalPages": 7
  }
}
```

Supported query parameters:

- `page`, `page_size`: preferred pagination.
- `limit`, `offset`: backwards-compatible pagination.
- `activity_type`: activity type such as `running`; `all` is treated as no activity-type filter for frontend compatibility.
- `start_date`, `end_date`: local date range in `YYYY-MM-DD`; if both are provided, the range must be 1095 days or less.
- `keyword`: searches activity name, location, activity type, activity key, and Garmin activity id; maximum length is 100 characters.
- `source`: `garmin_import`, `manual_upload`, or `live_workout`.
- `owner`: `all`, `admin`, or `mine`; `mine` requires login.
- `sort_by`: `local_start_time`, `distance_m`, `duration_s`, `avg_heart_rate_bpm`, `max_heart_rate_bpm`, `avg_pace`, `activity_training_load`.
- `sort_order`: `asc` or `desc`.

`page_size` is capped at 200. Track point, heart-rate, and speed endpoints keep their own higher `limit` caps so the frontend can request chart data without loading the full table.

## Manual Upload

```text
POST   /api/manual-activities
GET    /api/manual-activities/:id
PUT    /api/manual-activities/:id
DELETE /api/manual-activities/:id
```

Manual upload only stores summary data. It does not automatically run ML prediction. `distanceM` may be `0` for non-distance activities such as strength training, but `durationS` must be greater than `0`.

Example body:

```json
{
  "activityType": "running",
  "activityName": "Manual Test Run",
  "localStartTime": "2026-06-09 08:00:00",
  "distanceM": 5000,
  "durationS": 1800,
  "movingDurationS": 1780,
  "elapsedDurationS": 1850,
  "avgSpeedMps": 2.8,
  "maxSpeedMps": 4.5,
  "avgHeartRateBpm": 150,
  "maxHeartRateBpm": 175,
  "avgCadenceSpm": 165,
  "maxCadenceSpm": 190,
  "elevationGainM": 30,
  "elevationLossM": 30,
  "avgStrideLengthCm": 100,
  "normalizedPowerW": 220
}
```

## Stats

```text
GET /api/stats/summary
GET /api/stats/activity-types
GET /api/stats/timeline?group_by=month
GET /api/stats/metric-trend?metric=avg_heart_rate_bpm&range=6m
GET /api/stats/calendar?month=2026-06
GET /api/stats/heart-rate-zones
GET /api/stats/personal-bests
```

Stats endpoints support the same filters as activities where relevant: `activity_type`, `start_date`, `end_date`, `keyword`, `source`, and `owner`.

`GET /api/stats/summary` also supports:

- `range=month&date=2026-06`
- `range=year&date=2026`
- `range=all`

Summary includes total count, `totalDistanceM`, `totalDistanceKm`, `totalDurationS`, `totalDurationMin`, moving duration, total calories, `fatKg`, average pace, average heart rate, average speed, longest distance, fastest pace, total training load, and `byActivityType`.

`GET /api/stats/metric-trend` supports:

```text
avg_cadence_spm
avg_heart_rate_bpm
max_heart_rate_bpm
avg_speed_mps
avg_pace_sec_per_km
distance_m
duration_s
calories
activity_training_load
vo2max
body_battery_delta
```

Trend ranges are `42d`, `3m`, `6m`, `1y`, and `2y`. Unsupported metrics return `400 UNSUPPORTED_METRIC`.

`GET /api/stats/calendar` returns one entry for each day in the requested month, including activity count, activity types, top-level totals, a `totals` object, and activity summaries. Days without activities return `activityCount=0` and `activities=[]`.

Stats endpoints are cached in memory. Cache keys include route, query parameters, and user identity. Manual activity create/update/delete clears this cache. The default TTL is configured by:

```text
STATS_CACHE_TTL_SECONDS=60
```

Heart-rate zones return professional labels:

```text
Zone 1: 轻松
Zone 2: 有氧
Zone 3: 节奏
Zone 4: 阈值
Zone 5: 高强度
```

Personal bests are grouped into `steps`, `running`, `cycling`, `swimming`, and `overall`. Groups without reliable data return an empty array; the backend does not synthesize fake records.

## Training

```text
GET /api/training/load-balance?range=3m&end_date=2026-06-10
```

`range` supports `42d`, `3m`, `6m`, `1y`, and `2y`. The endpoint returns daily training load plus CTL, ATL, and TSB values calculated from existing training load data. Each point includes the activities for that day.

Example response:

```json
{
  "data": [
    {
      "date": "2026-06-01",
      "dailyTrainingLoad": 120,
      "ctl": 82.34,
      "atl": 101.2,
      "tsb": -18.86,
      "activities": []
    }
  ],
  "meta": {
    "cache": {
      "hit": false
    }
  }
}
```

## Dashboard

```text
GET /api/dashboard/overview
```

Returns recent activities, monthly summary, yearly summary, recent training load, and personal best summaries for the first screen.

## Extension Modules

These modules persist real backend state. Garmin Connect sync is implemented;
Strava, COROS, and Apple Health remain placeholder providers and return
`adapterStatus="not_configured"`.

Sync APIs require login:

```text
GET  /api/sync/providers
PUT  /api/sync/providers/:provider/settings
GET  /api/sync/providers/:provider/account
POST /api/sync/providers/:provider/authorize
POST /api/sync/providers/:provider/disconnect
POST /api/sync/jobs
GET  /api/sync/jobs?page=1&page_size=20
GET  /api/sync/logs?page=1&page_size=20
```

Garmin account status:

```http
GET /api/sync/providers/garmin/account
Authorization: Bearer <token>
```

Example response:

```json
{
  "data": {
    "provider": "garmin",
    "exists": true,
    "status": "connected",
    "email": "runner@example.com",
    "isCn": false,
    "lastSyncAt": "2026-06-13 16:12:10.263",
    "connectedAt": "2026-06-13 16:08:00.000"
  },
  "meta": {}
}
```

Bind Garmin to the currently logged-in app user:

```http
POST /api/sync/providers/garmin/authorize
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "runner@example.com",
  "password": "garmin-password",
  "mfaCode": "123456",
  "isCn": false
}
```

`mfaCode` is only required when Garmin asks for MFA. The backend does not store
the Garmin password; it stores connection state in `SyncProviderConnections` and
Garmin token files in the configured token directory.

Start a Garmin sync:

```http
POST /api/sync/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "garmin",
  "jobType": "manual_sync"
}
```

Garmin sync checks activities from March 1 of the current year through today,
skips activity ids already present in `Activities.garmin_activity_id`, imports
new FIT/JSON data into MySQL, sets `owner_user_id` to the current app user, and
writes `SyncJobs`/`SyncLogs` rows. `activityCount` is the number of newly
imported activities.

Community read APIs are public; write APIs require login:

```text
GET    /api/community/posts?page=1&page_size=20
POST   /api/community/posts
GET    /api/community/posts/:id/comments
POST   /api/community/posts/:id/comments
POST   /api/community/posts/:id/like
DELETE /api/community/posts/:id/like
POST   /api/community/posts/:id/share
```

Explore article APIs are public:

```text
GET /api/explore/articles?type=course&keyword=base
GET /api/explore/articles/:id
GET /api/explore/recommendations
```

User settings require login:

```text
GET /api/settings
PUT /api/settings
```

Live workout APIs require login:

```text
POST /api/workouts
GET  /api/workouts/:id
POST /api/workouts/:id/track-points
POST /api/workouts/:id/pause
POST /api/workouts/:id/resume
POST /api/workouts/:id/finish
POST /api/workouts/:id/cancel
```

`finish` creates a real activity with `data_source="live_workout"`, writes summaries, and copies collected workout points into `TrackPoints`. Finishing a workout clears the stats cache.

## ML Running Prediction

```text
GET  /api/ml/health
POST /api/ml/running-prediction
```

Prediction is intentionally separate from upload. The frontend should show a separate button after upload if the user wants analysis.

`POST /api/ml/running-prediction` accepts numeric running metrics:

```json
{
  "distanceM": 5000,
  "durationS": 1800,
  "movingDurationS": 1780,
  "elapsedDurationS": 1850,
  "avgSpeedMps": 2.8,
  "maxSpeedMps": 4.5,
  "avgHeartRateBpm": 150,
  "maxHeartRateBpm": 175,
  "avgCadenceSpm": 165,
  "maxCadenceSpm": 190,
  "elevationGainM": 30,
  "elevationLossM": 30,
  "avgStrideLengthCm": 100,
  "normalizedPowerW": 220
}
```

For compatibility with the current activity-detail page, `maxCadenceSpm` defaults to `avgCadenceSpm` when omitted, and `normalizedPowerW` defaults to `avgPowerW` or `0` when omitted.

It returns:

```json
{
  "data": {
    "predictedTrainingLoadLevel": "medium",
    "fatigueRisk": "low",
    "recoveryAdvice": "string",
    "confidence": 0.82,
    "modelVersion": "running-v1"
  },
  "meta": {}
}
```

## Response Style

Successful responses use:

```json
{
  "data": {},
  "meta": {}
}
```

Stats endpoints include cache metadata:

```json
{
  "data": {},
  "meta": {
    "cache": {
      "hit": false
    }
  }
}
```

Errors return:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "limit must be an integer from 1 to 200"
  }
}
```

## Database Setup

For an existing local database, apply the phase-two migration and seed the admin user:

```powershell
cd backend
npm run seed:admin
```

`database/sql/04_auth_manual_upload.sql` must be applied once before seeding if the database was created before auth/manual upload existed.

Apply the phase-three performance indexes once:

```sql
source database/sql/05_performance_indexes.sql;
```

The script is idempotent and can be re-run safely.

Apply the extension module migration before using sync, community, explore, settings, or live workout APIs:

```sql
source database/sql/06_extension_modules.sql;
```

The extension migration uses `CREATE TABLE IF NOT EXISTS` and can be re-run safely.
