# Backend API

Base URL for local frontend development:

```text
http://localhost:8080/api
```

## Endpoints

```text
GET /api/health
GET /api/activities?activity_type=running&limit=50&offset=0
GET /api/activities/:id
GET /api/activities/:id/track-points?limit=1000&offset=0
GET /api/activities/:id/heart-rate
GET /api/activities/:id/speed
GET /api/activities/:id/laps
GET /api/activities/:id/zones
GET /api/stats/activity-types
```

## Response style

The API returns plain JSON business data. It does not wrap responses in `code/message/data`.

Errors return:

```json
{
  "message": "activity not found"
}
```

## Database

The backend reads from the local MySQL database named `MotionAnalysis`.
It does not import Garmin files or modify the database schema.
