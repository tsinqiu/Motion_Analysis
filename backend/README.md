# Backend

本目录是后端 API 服务，使用 Node.js + Express + mysql2，负责把 MySQL 数据库 `MotionAnalysis` 中的运动数据封装成接口供前端调用。

## 本地运行

安装依赖：

```powershell
npm install
```

复制示例环境变量：

```powershell
Copy-Item .env.example .env
```

修改 `.env` 中的 MySQL 用户名和密码，然后启动：

```powershell
npm run dev
```

默认监听：

```text
http://127.0.0.1:8080
```

前端本地 API 地址：

```text
http://localhost:8080/api
```

生产部署时，后端只监听服务器本机地址：

```text
http://127.0.0.1:8080
```

由 Nginx 对公网提供页面和 `/api` 反向代理。部署说明见：

```text
backend/docs/deployment.md
```

## 本地数据库

如果本地还没有 `MotionAnalysis` 数据库，先在项目根目录的 `database` 目录中导入现有 SQL：

```powershell
.\scripts\import_to_mysql.ps1 -Mysql "D:/study/MySQL/mysql-9.7.0-winx64/bin/mysql.exe"
```

后端只读取数据库，不负责导入 Garmin 文件，也不修改数据库表结构。

如果数据库是在二期鉴权/手动上传功能之前创建的，需要先执行：

```text
database/sql/04_auth_manual_upload.sql
```

然后初始化管理员账号并把已有 Garmin 数据归属给管理员：

```powershell
npm run seed:admin
```

管理员账号默认来自 `.env`：

```text
ADMIN_USERNAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

三期性能优化新增了常用查询索引。如果数据库已存在，再执行：

```text
database/sql/05_performance_indexes.sql
```

该脚本是幂等的，重复执行不会因为索引已存在而失败。

## 接口

接口说明见：

```text
backend/docs/api.md
```

前端对接说明见：

```text
backend/docs/frontend-integration.md
```

当前接口包括：

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/activities`
- `GET /api/activities/:id`
- `GET /api/activities/:id/track-points`
- `GET /api/activities/:id/heart-rate`
- `GET /api/activities/:id/speed`
- `GET /api/activities/:id/laps`
- `GET /api/activities/:id/zones`
- `GET /api/stats/summary`
- `GET /api/stats/activity-types`
- `GET /api/stats/timeline`
- `GET /api/stats/metric-trend`
- `GET /api/stats/calendar`
- `GET /api/stats/heart-rate-zones`
- `GET /api/stats/personal-bests`
- `GET /api/training/load-balance`
- `GET /api/dashboard/overview`
- `POST /api/manual-activities`
- `GET /api/manual-activities/:id`
- `PUT /api/manual-activities/:id`
- `DELETE /api/manual-activities/:id`
- `GET /api/ml/health`
- `POST /api/ml/running-prediction`

活动列表和统计接口支持 `start_date`、`end_date`、`activity_type`、`keyword`、`source`、`owner` 等查询参数，日期格式为 `YYYY-MM-DD`。活动列表支持 `page`、`page_size`、`limit`、`offset`、`sort_by` 和 `sort_order`。

四期新增的运动分析接口支持训练负荷平衡、趋势、运动日历、分组统计、PB 和首页聚合。后端只返回当前数据库中已有或可可靠计算的数据；没有数据来源的模块不返回对应内容。

成功响应统一使用：

```json
{
  "data": {},
  "meta": {}
}
```

分页接口使用 `data` 返回列表，`meta` 返回 `page`、`pageSize`、`total`、`totalPages`。错误响应保持：

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "..."
  }
}
```

## 注册登录和手动上传

开放注册默认创建普通用户。所有写数据接口都需要：

```text
Authorization: Bearer <token>
```

手动上传首版只保存活动摘要数据，不保存逐秒轨迹点。上传成功后不会自动调用模型预测，前端可以单独提供“预测”按钮调用 `POST /api/ml/running-prediction`。

现有 Garmin 导入数据归管理员所有；普通用户只能修改或删除自己手动上传的数据。

## 查询校验和统计缓存

后端会校验分页、排序、日期、关键词、来源、归属和手动上传数值，前端传入非法参数时返回 `400`。主要限制包括：

- `page_size` 最大 200。
- `keyword` 最大 100 字符。
- 日期格式必须是 `YYYY-MM-DD`，已传入的日期范围最大 1095 天。
- `sort_by`、`sort_order`、`owner`、`source` 必须来自后端白名单。

统计接口使用轻量内存缓存，默认 TTL 为 60 秒，可通过 `.env` 调整：

```text
STATS_CACHE_TTL_SECONDS=60
```

手动上传、修改、删除活动后会清空统计缓存，避免用户写入后长时间看到旧统计。`GET /api/health` 会返回统计缓存是否启用、TTL 和当前缓存条目数。

## Running 模型拓展

ML 拓展是额外功能，不影响主业务接口。首版只服务 `running`，根据跑步指标预测训练负荷等级、疲劳风险和恢复建议。

安装 Python 依赖：

```powershell
python -m pip install -r ml/requirements.txt
```

训练模型：

```powershell
python ml/train_running_model.py
```

训练完成后会生成：

```text
backend/ml/models/running_model.joblib
backend/ml/models/running_model_metadata.json
```

如果模型文件不存在，`GET /api/ml/health` 会返回不可用状态，主业务接口仍可正常使用。

真实数据库账号、密码和连接串不要提交到 GitHub。只保留 `.env.example`。
