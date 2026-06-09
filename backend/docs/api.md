# Backend API

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
  "user": {
    "id": 2,
    "username": "tester",
    "email": "tester@example.com",
    "role": "user"
  },
  "token": "jwt-token"
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
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 138,
  "totalPages": 7
}
```

Supported query parameters:

- `page`, `page_size`: preferred pagination.
- `limit`, `offset`: backwards-compatible pagination.
- `activity_type`: activity type such as `running`.
- `start_date`, `end_date`: local date range in `YYYY-MM-DD`.
- `keyword`: searches activity name, location, and activity type.
- `source`: `garmin_import` or `manual_upload`.
- `owner`: `all`, `admin`, or `mine`; `mine` requires login.
- `sort_by`: `local_start_time`, `distance_m`, `duration_s`, `avg_heart_rate_bpm`, `max_heart_rate_bpm`, `avg_pace`, `activity_training_load`.
- `sort_order`: `asc` or `desc`.

## Manual Upload

```text
POST   /api/manual-activities
GET    /api/manual-activities/:id
PUT    /api/manual-activities/:id
DELETE /api/manual-activities/:id
```

Manual upload only stores summary data. It does not automatically run ML prediction.

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
GET /api/stats/heart-rate-zones
GET /api/stats/personal-bests
```

Stats endpoints support the same filters as activities where relevant: `activity_type`, `start_date`, `end_date`, `keyword`, `source`, and `owner`.

Summary includes total count, total distance, total duration, average pace, average heart rate, longest distance, fastest pace, and total training load.

Heart-rate zones return professional labels:

```text
Zone 1: 轻松
Zone 2: 有氧
Zone 3: 节奏
Zone 4: 阈值
Zone 5: 高强度
```

Personal bests currently focus on running: longest distance, fastest 5km pace, fastest 10km pace, highest training load, and highest average heart rate.

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

It returns:

```json
{
  "predictedTrainingLoadLevel": "medium",
  "fatigueRisk": "low",
  "recoveryAdvice": "string",
  "confidence": 0.82,
  "modelVersion": "running-v1"
}
```

## Response Style

Successful responses return plain JSON business data.

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
