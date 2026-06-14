# Garmin 运动数据分析数据库系统

本项目是数据库课程大作业，主题为：

> 基于 Garmin 可穿戴设备数据的运动健康分析数据库系统设计与实现

系统围绕 Garmin 手表采集的跑步、骑行等运动数据，完成数据导入、关系型数据库设计、后端 API 封装和前端可视化展示。项目采用前后端分离结构，前端不直接连接 MySQL，而是通过后端 API 获取数据。

当前 `main` 分支已作为大作业稳定基础版本V1.0，后续只做小功能补充、文档整理、报告截图和演示优化。

---

## 1. 项目状态

- [x] 完成 GitHub 仓库初始化与三人协作分支划分。
- [x] 完成 MySQL 数据库 `MotionAnalysis` 的核心表结构设计。
- [x] 完成 Garmin FIT / JSON 数据导入脚本与查询脚本。
- [x] 完成 Node.js + Express 后端 API 服务。
- [x] 完成 Vue 3 + Vite 前端页面与真实后端 API 对接。
- [x] 完成注册登录、活动查询、运动统计、同步中心、社区、探索、设置、手动上传、开始运动等主要功能。
- [x] 已将阶段性开发成果合并至 `main`，作为 V1.0 稳定版本。
- [x] 26.6.14中午，从dev合并到main作为PPT的版本,V1.1为冻结版本，用于最终展示的素材来源

后续重点：

- [ ] 整理 ER 图、数据字典和报告素材。
- [ ] 补充系统运行截图、前后端接口截图、典型 SQL 查询截图。
- [ ] 根据答辩展示需要微调页面文案和小功能 etc.

---

## 2. 系统架构

```text
Garmin 手表 / Garmin Connect
        ↓
FIT / JSON 数据下载与解析
        ↓
MySQL 数据库 MotionAnalysis
        ↓
Node.js + Express 后端 API
        ↓
Vue 3 前端页面
        ↓
运动数据分析与可视化展示
````

系统分为三层：

```text
frontend/   前端页面与可视化
backend/    后端 API、鉴权、业务逻辑
database/   数据库结构、导入脚本、查询脚本
```

基本原则：

* 前端只调用后端 API，不直接连接 MySQL。
* 后端负责数据库访问、鉴权、数据封装和业务逻辑。
* 数据库结构通过 SQL 脚本维护。
* 真实 Garmin 原始数据、token、`.env`、数据库导出大文件不提交到 GitHub。

---

## 3. 技术栈

### 前端

* Vue 3
* Vite
* Vue Router
* Axios
* ECharts
* @lucide/vue

### 后端

* Node.js
* Express
* mysql2
* JWT
* bcryptjs
* multer
* dotenv

### 数据库

* MySQL 9.x
* InnoDB
* utf8mb4
* 主键、外键、唯一约束、索引
* 多表关联查询与聚合统计

### 数据处理

* Python
* Garmin FIT / JSON 解析
* Garmin Connect 同步脚本
* 可选 Running 模型分析拓展

### 协作

* Git
* GitHub
* 分支：`main`、`dev`、`feature/frontend`、`feature/backend`、`feature/database`

---

## 4. 项目目录结构

```text
Motion_Analysis/
│
├─ frontend/                 # Vue 前端工程
│  ├─ src/
│  ├─ public/
│  ├─ package.json
│  ├─ .env.example
│  └─ README.md
│
├─ backend/                  # Node Express 后端工程
│  ├─ src/
│  ├─ scripts/
│  ├─ docs/
│  ├─ ml/
│  ├─ package.json
│  ├─ .env.example
│  └─ README.md
│
├─ database/                 # 数据库结构、导入脚本和查询脚本
│  ├─ scripts/
│  │  ├─ download_garmin_connect.py
│  │  ├─ import_fit_files.py
│  │  └─ import_to_mysql.ps1
│  ├─ sql/
│  │  ├─ 01_schema.sql
│  │  ├─ 03_queries.sql
│  │  ├─ 04_auth_manual_upload.sql
│  │  ├─ 05_performance_indexes.sql
│  │  ├─ 06_extension_modules.sql
│  │  └─ 07_profile_follow_explore_uploads.sql
│  ├─ requirements.txt
│  └─ README.md
│
├─ docs/                     # 报告素材、ER 图、说明文档
│  └─ README.md
│
├─ .gitignore
└─ README.md                 # 项目总说明
```

本地生成但不提交的路径：

```text
database/data/
database/.garmin_tokens/
database/sql/02_import_data.sql
backend/ml/models/
.env
node_modules/
dist/
```

---

## 5. 数据库说明

当前数据库名：

```text
MotionAnalysis
```

核心数据表包括：

```text
Users
SourceFiles
Activities
ActivitySourceFiles
Sessions
ActivitySummaries
ActivityZones
Laps
TrackPoints
Events
Metrics
FitMessages
```

其中：

* `Activities` 保存运动活动主记录。
* `ActivitySummaries` 保存运动摘要、训练负荷、心率、功率、步频、海拔等分析指标。
* `TrackPoints` 保存逐点轨迹、速度、心率、步频、功率等时序数据。
* `Laps` 保存分段数据。
* `Sessions` 保存活动级 session 汇总。
* `SourceFiles` 和 `ActivitySourceFiles` 用于追踪 FIT / JSON 来源文件。
* `Users` 用于系统登录、用户归属和权限控制。

数据库脚本说明：

```text
01_schema.sql                         建库建表、主外键、基础索引
02_import_data.sql                    本地生成的数据导入脚本，不提交
03_queries.sql                        典型查询与分析 SQL
04_auth_manual_upload.sql             注册登录、用户归属、手动上传相关结构
05_performance_indexes.sql            常用查询索引
06_extension_modules.sql              同步、设置、社区、探索等扩展模块
07_profile_follow_explore_uploads.sql 用户资料、关注、探索上传等扩展结构
```

首次导入建议顺序：

```sql
source database/sql/01_schema.sql;
source database/sql/02_import_data.sql;
source database/sql/03_queries.sql;
source database/sql/04_auth_manual_upload.sql;
source database/sql/05_performance_indexes.sql;
source database/sql/06_extension_modules.sql;
source database/sql/07_profile_follow_explore_uploads.sql;
```

如果是已有数据库，只补充后续模块时，可按需要单独执行 `04`、`05`、`06`、`07` 脚本。

---

## 6. 后端说明

后端目录：

```text
backend/
```

后端使用 Node.js + Express + mysql2，默认监听：

```text
http://127.0.0.1:8080
```

本地运行：

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

需要先在 `.env` 中配置本地 MySQL 用户名、密码、数据库名等信息。

常用命令：

```powershell
npm run dev          # 开发模式启动
npm start            # 普通启动
npm run seed:admin   # 初始化管理员账号
npm test             # 后端测试
```

主要接口包括：

```text
GET  /api/health

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me

GET  /api/activities
GET  /api/activities/:id
GET  /api/activities/:id/track-points
GET  /api/activities/:id/heart-rate
GET  /api/activities/:id/speed
GET  /api/activities/:id/laps
GET  /api/activities/:id/zones

GET  /api/stats/summary
GET  /api/stats/activity-types
GET  /api/stats/timeline
GET  /api/stats/metric-trend
GET  /api/stats/calendar
GET  /api/stats/heart-rate-zones
GET  /api/stats/personal-bests

GET  /api/training/load-balance
GET  /api/dashboard/overview

POST /api/manual-activities
GET  /api/manual-activities/:id
PUT  /api/manual-activities/:id
DELETE /api/manual-activities/:id

GET  /api/sync/providers
POST /api/sync/providers/:provider/authorize
POST /api/sync/providers/:provider/disconnect
POST /api/sync/jobs
GET  /api/sync/jobs
GET  /api/sync/logs

GET  /api/community/posts
POST /api/community/posts
GET  /api/explore/articles
GET  /api/settings
PUT  /api/settings

GET  /api/ml/health
POST /api/ml/running-prediction
```

接口详细说明见：

```text
backend/docs/api.md
backend/docs/frontend-integration.md
backend/docs/deployment.md
```

---

## 7. 前端说明

前端目录：

```text
frontend/
```

本地运行：

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

默认地址：

```text
http://localhost:5173
```

构建检查：

```powershell
npm run build
```

Smoke Check：

```powershell
npm run dev -- --host 127.0.0.1
npm run smoke
```

前端环境变量示例：

```text
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK=false
```

如果后端暂时不可用，可设置：

```text
VITE_USE_MOCK=true
```

主要页面：

```text
/login                登录
/register             注册
/today                今日首页
/activities           我的运动
/activities/:id       运动详情
/calendar             运动日历
/trends               趋势分析
/training-load        训练负荷
/statistics           运动统计
/records              最佳记录
/sync                 同步中心
/community            运动圈
/explore              探索
/settings             设置
/start                开始运动
/schema               数据库结构展示
```

---

## 8. Garmin 数据与同步

系统支持两类 Garmin 数据来源：

### 1. 本地批量导入

本地准备 FIT / JSON 文件后，放入：

```text
database/data/fit
database/data/json
```

然后执行：

```powershell
python database\scripts\import_fit_files.py
```

脚本会生成：

```text
database/sql/02_import_data.sql
```

该文件可能很大，并且包含真实运动数据，不提交到 GitHub。

### 2. Garmin Connect 同步

后端支持系统用户绑定 Garmin 账号，并通过同步接口导入新活动。

注意：

* Garmin 密码不入库。
* token 文件保存在本地配置目录。
* 不要把 `database/.garmin_tokens/` 提交到仓库。
* 不建议本地和云端频繁同时同步同一个 Garmin 账号，避免触发限流。

Python 依赖安装：

```bash
python3.12 -m pip install -r database/requirements.txt
```

生产环境建议使用 Python 3.12 或 3.13。

---

## 9. 部署说明

推荐部署结构：

```text
用户浏览器
  ↓
Nginx
  ├─ 返回 frontend/dist 静态页面
  └─ 将 /api 转发给 Node Express
          ↓
        MySQL MotionAnalysis
```

前端生产环境推荐：

```text
VITE_API_BASE_URL=/api
VITE_USE_MOCK=false
```

后端生产环境建议：

```text
HOST=127.0.0.1
PORT=8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=MotionAnalysis
```

部署参考：

```text
backend/docs/deployment.md
backend/docs/nginx-motion-analysis.conf
```

MySQL 端口 `3306` 不应直接暴露到公网。

---

## 10. 协作流程

当前 `main` 已作为稳定基础版本。后续如需小功能修改，建议仍按以下流程：

```text
feature/frontend  ┐
feature/backend   ├──> dev ───> main
feature/database  ┘
```

分支说明：

```text
main                  稳定版本，用于最终展示和提交
dev                   日常集成版本
feature/frontend      前端开发分支
feature/backend       后端开发分支
feature/database      数据库开发分支
```

基本规范：

1. 修改前先同步远端：

   ```bash
   git checkout dev
   git pull origin dev
   ```

2. 切到自己的功能分支：

   ```bash
   git checkout feature/frontend
   git merge dev
   ```

3. 修改后只提交相关文件：

   ```bash
   git status
   git add frontend/xxx
   git commit -m "feat(frontend): update page"
   git push origin feature/frontend
   ```

4. 在 GitHub 上创建 PR：

   ```text
   base: dev
   compare: feature/xxx
   ```

5. `dev` 稳定后，再由负责人合并到 `main`。

如果只是最终报告、小文档或截图说明的小修改，也可以直接在 `main` 上修改，但必须确认不会影响系统运行。

---

## 11. 隐私与提交边界

禁止提交：

```text
.env
node_modules/
dist/
database/data/
database/.garmin_tokens/
database/sql/02_import_data.sql
backend/ml/models/
*.fit
*.json 原始数据
*.dump
*.sql.gz
真实数据库密码
真实服务器密钥
Garmin token
个人精确轨迹原始文件
```

仓库中只保留：

* 数据库结构脚本。
* 数据导入脚本。
* 示例配置。
* 前后端源码。
* 文档和报告素材。
* 不含隐私的截图或示意图。

---

## 12. 成员分工

### 数据库部分

负责人：zhen chen

主要内容：

* Garmin 数据下载、解析与导入。
* MySQL 表结构设计。
* 主键、外键、约束和索引设计。
* 典型 SQL 查询。
* 数据库说明文档维护。

主要目录：

```text
database/
```

---

### 后端部分

负责人：anping zou、anan shao

主要内容：

* Node.js + Express API 服务。
* MySQL 数据访问。
* JWT 登录鉴权。
* 活动、统计、同步、社区、探索、设置等接口。
* 部署文档与接口文档维护。

主要目录：

```text
backend/
```

---

### 前端部分

负责人：hao chen

主要内容：

* Vue 3 前端页面。
* 运动数据列表、详情、统计、趋势、日历、同步中心等页面。
* ECharts 可视化。
* 后端 API 对接。
* 页面展示与演示优化。

主要目录：

```text
frontend/
```

---

### Overall

负责人：kun wang

主要内容：

* 总体进度协调。
* GitHub 分支和合并管理。
* ER 图、报告、PPT、演示素材整理。
* 部署方案与最终展示统筹。

---

## 13. 报告与展示建议

数据库课程报告建议重点体现：

* 需求分析。
* 概念结构设计与 ER 图。
* 逻辑结构设计。
* 数据表结构与字段说明。
* 主外键与约束设计。
* 索引设计。
* 数据导入流程。
* 典型 SQL 查询。
* 前后端接口调用。
* 系统页面展示。
* 小组分工与协作过程。

建议补充到：

```text
docs/
```

推荐文件：

```text
docs/er_diagram.png
docs/report-materials.md
docs/screenshots/
```

---

## 14. 快速启动顺序

首次本地运行建议顺序：

```text
1. 安装 MySQL 并确认 root 或项目用户可登录。
2. 执行 database/sql/01_schema.sql 建库建表。
3. 本地生成并执行 database/sql/02_import_data.sql。
4. 执行 04、05、06、07 扩展脚本。
5. 启动 backend。
6. 启动 frontend。
7. 浏览器访问 http://localhost:5173。
```

后端：

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run seed:admin
npm run dev
```

前端：

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

数据库：

```sql
source database/sql/01_schema.sql;
source database/sql/02_import_data.sql;
source database/sql/04_auth_manual_upload.sql;
source database/sql/05_performance_indexes.sql;
source database/sql/06_extension_modules.sql;
source database/sql/07_profile_follow_explore_uploads.sql;
```

---

## 15. 说明

本项目为课程大作业，重点不只是页面效果，也包括数据库设计、数据导入、表关系、查询分析、接口封装和小组协作过程。

最终提交时，应以 `main` 分支为准。
