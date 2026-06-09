# Backend API

Base URL for local frontend development:

```text
http://localhost:8080/api
```

## Endpoints

```text
GET  /api/health
GET  /api/activities?activity_type=running&start_date=2026-06-01&end_date=2026-06-09&sort_by=local_start_time&sort_order=desc&limit=50&offset=0
GET  /api/activities/:id
GET  /api/activities/:id/track-points?limit=1000&offset=0
GET  /api/activities/:id/heart-rate?limit=2000&offset=0
GET  /api/activities/:id/speed?limit=2000&offset=0
GET  /api/activities/:id/laps
GET  /api/activities/:id/zones
GET  /api/stats/summary?activity_type=running&start_date=2026-06-01&end_date=2026-06-09
GET  /api/stats/activity-types?start_date=2026-06-01&end_date=2026-06-09
GET  /api/stats/timeline?group_by=day&activity_type=running
GET  /api/ml/health
POST /api/ml/running-prediction
```

## Query Parameters

- `activity_type`: optional activity type, for example `running`.
- `start_date`, `end_date`: optional local date range in `YYYY-MM-DD` format.
- `limit`, `offset`: pagination controls.
- `sort_by`: `local_start_time`, `distance_m`, `duration_s`, or `activity_training_load`.
- `sort_order`: `asc` or `desc`.
- `group_by`: `day` or `month` for `/api/stats/timeline`.

## ML Running Prediction

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
  "fatigueRisk": "medium",
  "recoveryAdvice": "string",
  "confidence": 0.82,
  "modelVersion": "running-v1"
}
```

## Response Style

The API returns plain JSON business data. It does not wrap successful responses in `code/message/data`.

Errors return:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "limit must be an integer from 1 to 200"
  }
}
```

## Database and ML

The backend reads from the local MySQL database named `MotionAnalysis`.
It does not import Garmin files or modify the database schema.

The ML extension is optional. Train the running model before using prediction:

```powershell
cd backend
python -m pip install -r ml/requirements.txt
python ml/train_running_model.py
```
