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

历史批量导入仍由 `database` 目录下的脚本完成；登录用户触发的 Garmin 增量同步由后端调用这些脚本并写入数据库。后端不自动修改数据库表结构，新增模块表需要手动执行对应 SQL。

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

四期新增的运动分析接口支持训练负荷平衡、趋势、运动日历、分组统计、PB 和首页聚合。后端只返回当前数据库中已有或可靠计算的数据；没有数据来源的模块不返回对应内容。

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

历史 Garmin 导入数据归管理员所有；通过 Garmin 同步接口导入的新数据会归属到当前登录用户。普通用户只能修改或删除自己手动上传的数据。

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

## Garmin 同步和部署注意事项

Garmin 同步绑定到当前已登录的系统用户。系统用户存储在当前环境的 `Users` 表中；如果云端使用单独数据库，本地注册的系统账号不会自动出现在云端，除非迁移数据库。

Garmin 绑定状态存储在 `SyncProviderConnections`。Garmin 密码不会入库，只在 `POST /api/sync/providers/garmin/authorize` 绑定时用于生成 Garmin token 文件。

相关接口：

```text
GET  /api/sync/providers/garmin/account
POST /api/sync/providers/garmin/authorize
POST /api/sync/providers/garmin/disconnect
POST /api/sync/jobs
GET  /api/sync/jobs
GET  /api/sync/logs
```

默认同步会从当前用户最近一次 Garmin 同步时间，或本地最新 Garmin 活动日期继续检查到今天。没有本地 Garmin 历史记录时任务会直接完成并记录跳过原因；有历史记录时会跳过 `Activities.garmin_activity_id` 已存在的记录，只导入新运动，并把新运动归属到当前系统用户。

本地或云端启用同步前需要：

```text
source database/sql/06_extension_modules.sql;
source database/sql/07_profile_follow_explore_uploads.sql;
python3.11 -m pip install -r database/requirements.txt
```

Garmin 同步脚本依赖 `from __future__ import annotations` 和 `garminconnect>=0.3.5`，生产环境建议使用 Python 3.10+，优先使用 Python 3.11。部分服务器默认 `python3` 仍是 Python 3.6，会出现 `future feature annotations is not defined` 或无法安装 `garminconnect>=0.3.5`，此时需要安装新版 Python，并在 `.env` 中显式配置 `GARMIN_PYTHON_PATH=python3.11`。

生产环境建议配置持久、可写目录，不要依赖项目目录可写：

```text
GARMIN_PYTHON_PATH=python3.11
GARMIN_TOKEN_BASE_DIR=/var/lib/motion-analysis/garmin_tokens/users
GARMIN_SYNC_WORK_DIR=/var/lib/motion-analysis/garmin_sync
GARMIN_DOWNLOAD_SCRIPT=/var/www/motion-analysis/database/scripts/download_garmin_connect.py
GARMIN_IMPORT_SCRIPT=/var/www/motion-analysis/database/scripts/import_fit_files.py
```

同一个 Garmin 账号可以在本地和云端分别绑定，因为数据库和 token 目录是两套。不要让本地和云端频繁同时同步同一个 Garmin 账号，Garmin 可能会限流。

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
