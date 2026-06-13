# Frontend Integration Guide

本文档面向前端同学，说明 Vue 前端如何对接 Motion Analysis 后端。

## 基础地址

本地开发：

```text
VITE_API_BASE_URL=http://localhost:8080/api
```

服务器部署：

```text
VITE_API_BASE_URL=/api
```

线上不要写死 `http://服务器公网IP:8080/api`。正式部署时浏览器只访问 Nginx，Nginx 会把 `/api` 转发到 Node Express。

## 统一响应格式

成功响应统一为：

```json
{
  "data": {},
  "meta": {}
}
```

分页接口统一为：

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

错误响应统一为：

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "..."
  }
}
```

前端请求封装建议：

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const body = await response.json();
  if (!response.ok) {
    throw body.error || { code: 'REQUEST_FAILED', message: 'request failed' };
  }
  return body;
}
```

调用方从 `body.data` 读取业务数据，从 `body.meta` 读取分页和缓存信息。

## 鉴权

注册：

```text
POST /auth/register
```

登录：

```text
POST /auth/login
```

查看当前用户：

```text
GET /auth/me
```

登录成功后保存：

```text
data.token
```

需要登录的接口必须带：

```text
Authorization: Bearer <token>
```

当前需要登录的主要接口：

```text
POST /manual-activities
GET /manual-activities/:id
PUT /manual-activities/:id
DELETE /manual-activities/:id
GET /activities?owner=mine
GET /stats/*?owner=mine
GET /training/load-balance?owner=mine
GET /dashboard/overview?owner=mine
GET /settings
GET /sync/providers
POST /workouts
```

## 页面到接口映射

首页仪表盘：

```text
GET /dashboard/overview
```

可展示：

```text
recentActivities
monthlySummary
yearlySummary
trainingLoad
personalBests
```

运动列表页：

```text
GET /activities?page=1&page_size=20
```

常用筛选：

```text
activity_type=running
activity_type=all
start_date=2026-06-01
end_date=2026-06-30
keyword=无锡
source=garmin_import|manual_upload|live_workout
owner=all|admin|mine
sort_by=local_start_time|distance_m|duration_s|avg_heart_rate_bpm|max_heart_rate_bpm|avg_pace|activity_training_load
sort_order=asc|desc
```

`activity_type=all` is accepted by the backend and means no activity type filter. Activity list and detail responses include the fields needed by the current frontend normalizer, including distance, duration, moving duration, calories, speed, heart rate, cadence, power, elevation, training load, data source, manual flag, and owner username.

运动详情页：

```text
GET /activities/:id
GET /activities/:id/track-points?limit=1000&offset=0
GET /activities/:id/heart-rate?limit=2000&offset=0
GET /activities/:id/speed?limit=2000&offset=0
GET /activities/:id/laps
GET /activities/:id/zones
```

统计页：

```text
GET /stats/summary?range=month&date=2026-06
GET /stats/summary?range=year&date=2026
GET /stats/summary?range=all
GET /stats/activity-types
GET /stats/timeline?group_by=month
```

趋势页：

```text
GET /stats/metric-trend?metric=avg_heart_rate_bpm&range=3m
```

支持的 `metric`：

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

支持的 `range`：

```text
3m
6m
1y
42d
2y
```

没有数据来源的指标不会返回假数据。例如 `left_right_balance` 当前会返回 `UNSUPPORTED_METRIC`。

训练负荷平衡页：

```text
GET /training/load-balance?range=3m&end_date=2026-06-10
```

每个点包含：

```text
date
dailyTrainingLoad
ctl
atl
tsb
activities
```

日历页：

```text
GET /stats/calendar?month=2026-06
```

`data.days` 中每天都有一条记录；无运动日期 `activityCount=0`，`activities=[]`。
每一天也包含 `totals`，便于前端后续不再本地聚合。

最佳记录页：

```text
GET /stats/personal-bests
```

返回分组：

```text
running
cycling
swimming
steps
overall
```

数据不足的 PB 项不会出现在数组里，缺少可靠数据的分组返回空数组；后端不会返回假记录。

手动上传页：

```text
POST /manual-activities
PUT /manual-activities/:id
DELETE /manual-activities/:id
```

手动上传只保存活动摘要，不会自动调用模型预测。上传成功后，如果用户点击“预测”，前端再单独调用：

```text
POST /ml/running-prediction
```

同步页：

```text
GET  /sync/providers
PUT  /sync/providers/:provider/settings
POST /sync/providers/:provider/authorize
POST /sync/providers/:provider/disconnect
POST /sync/jobs
GET  /sync/jobs
GET  /sync/logs
```

当前后端只保存授权状态、同步设置、任务和日志；第三方 adapter 未配置时返回 `adapterStatus=not_configured`，不会导入假活动。

运动圈：

```text
GET    /community/posts
POST   /community/posts
GET    /community/posts/:id/comments
POST   /community/posts/:id/comments
POST   /community/posts/:id/like
DELETE /community/posts/:id/like
POST   /community/posts/:id/share
```

探索：

```text
GET /explore/articles
GET /explore/articles/:id
GET /explore/recommendations
```

用户设置：

```text
GET /settings
PUT /settings
```

真实开始运动：

```text
POST /workouts
POST /workouts/:id/track-points
POST /workouts/:id/pause
POST /workouts/:id/resume
POST /workouts/:id/finish
POST /workouts/:id/cancel
```

`finish` 后会生成真实活动，来源为 `live_workout`，后续可用活动详情、轨迹、心率、速度接口查看。

## 前端显示建议

- 跑步卡片优先显示 `avgPaceSecPerKm`。
- 骑行卡片优先显示速度，可用 `avgSpeedMps * 3.6` 转为 `km/h`。
- 统计接口返回的是全部筛选结果，不受活动列表分页影响。
- 统计接口 `meta.cache.hit` 只用于调试或性能观察，不需要展示给普通用户。
- 日期字段当前按普通字符串返回，前端可直接格式化显示。
- `owner=mine` 必须登录；未登录会返回 `401 AUTH_REQUIRED`。

## 常见错误处理

建议前端统一按 `error.code` 处理：

```text
AUTH_REQUIRED: 跳转登录或提示登录
INVALID_TOKEN: 清除 token 并重新登录
INVALID_QUERY: 检查筛选、分页、日期、排序参数
INVALID_MANUAL_ACTIVITY: 检查手动上传表单
INVALID_ML_INPUT: 检查预测输入
UNSUPPORTED_METRIC: 当前指标没有数据来源，隐藏该趋势项
ROUTE_NOT_FOUND: 检查接口路径和请求方法
```

## 部署对接

本地：

```text
VITE_API_BASE_URL=http://localhost:8080/api
```

线上：

```text
VITE_API_BASE_URL=/api
```

服务器部署细节见：

```text
backend/docs/deployment.md
backend/docs/nginx-motion-analysis.conf
```
