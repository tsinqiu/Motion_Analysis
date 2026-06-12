# Garmin 运动数据分析数据库管理系统前端

本目录是 Motion Analysis 的 Vue 前端工程，定位为 GarSync 风格的 Garmin 运动数据分析数据库管理系统前端。前端只调用后端 API，不直接连接 MySQL；后端接口或数据库未就绪时，默认使用合成 mock 数据完成页面展示和本地验收。

本目录 README 只维护前端说明；根目录 `README.md` 是项目总说明，不由前端实现自动修改。

## 技术栈

- Vue 3
- Vite
- Vue Router
- Axios
- ECharts
- @lucide/vue

## 功能页面

- `/today`：今日首页，展示天气、训练安排、健康指标、最近运动和开始运动入口。
- `/activities`：我的运动，支持类型筛选、关键词、日期、排序、分页和手动添加。
- `/activities/:id`：运动详情，展示摘要、轨迹、心率、速度、分段、手动编辑和跑步负荷预测。
- `/calendar`：运动日历，按月展示每日运动图标，点击日期查看当天活动。
- `/trends`：趋势分析，支持运动类型、时间范围和指标切换。
- `/training-load`：训练负荷平衡，展示 CTL、ATL、TSB 曲线与状态建议。
- `/statistics`：运动统计，支持按月、按年、全部汇总。
- `/records`：最佳记录，展示步数、跑步、骑行和游泳个人最佳。
- `/sync`：同步中心，展示第三方平台连接状态与本地模拟同步流程。
- `/explore`：探索内容，展示训练课程和运动知识样例。
- `/community`：运动圈，展示本地模拟运动动态。
- `/settings`：设置与隐私，展示单位、隐私和同步偏好。
- `/start`：开始运动，模拟实时记录并可保存为手动运动。
- `/schema`：数据库结构，按 dev 分支 `database/sql/01_schema.sql` 展示表、字段、关系和索引口径。

`/` 会重定向到 `/today`。`/analytics` 保留为兼容重定向，实际进入 `/statistics`。旧的独立预览页已经移除，视频参考中的能力已迁移为正式业务页面。

## 本地运行

```powershell
npm install
npm run dev
```

默认地址为：

```text
http://localhost:5173
```

## 构建检查

```powershell
npm run build
```

## 本地 Smoke Check

先启动开发服务：

```powershell
npm run dev -- --host 127.0.0.1
```

再在另一个终端检查主要路由：

```powershell
npm run smoke
```

当前 smoke 路由包括 `/`、`/today`、`/activities`、`/activities/1001`、`/calendar`、`/trends`、`/training-load`、`/statistics`、`/records`、`/schema`。

## 环境变量

复制 `.env.example` 为 `.env` 后可按需修改。`.env` 只用于本地，不要提交。

```text
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK=true
```

`VITE_USE_MOCK=true` 时使用 `src/mock` 中的合成运动数据；设置为 `false` 时通过 `src/services` 调用后端 API。

生产部署到 Nginx 同源环境时推荐使用：

```text
VITE_API_BASE_URL=/api
VITE_USE_MOCK=false
```

不要把真实服务器账号、数据库账号、私钥、个人邮箱、真实 `.env` 或个人轨迹原始文件写入前端源码。

## 后端 dev API 对接

后端 `dev` 分支当前约定本地地址为 `http://localhost:8080/api`，成功响应统一为：

```json
{
  "data": {},
  "meta": {}
}
```

前端 `src/services` 会解包 `data/meta`，并把后端 camelCase 字段转换为页面组件使用的字段，不在组件里直接处理数据库连接或 MySQL 细节。

当前已接入或预留的主要接口：

- `GET /activities?page=1&page_size=50`
- `GET /activities/:id`
- `GET /activities/:id/track-points?limit=1000&offset=0`
- `GET /activities/:id/heart-rate?limit=2000&offset=0`
- `GET /activities/:id/speed?limit=2000&offset=0`
- `GET /activities/:id/laps`
- `GET /activities/:id/zones`
- `GET /dashboard/overview`
- `GET /stats/summary`
- `GET /stats/activity-types`
- `GET /stats/timeline`
- `GET /stats/metric-trend`
- `GET /stats/calendar`
- `GET /stats/heart-rate-zones`
- `GET /stats/personal-bests`
- `GET /training/load-balance`
- `POST /auth/login`
- `POST /manual-activities`
- `GET /manual-activities/:id`
- `PUT /manual-activities/:id`
- `DELETE /manual-activities/:id`
- `POST /ml/running-prediction`

同步中心、探索、运动圈、天气、健康指标和设置页当前为前端合成样例或本地状态；后续如后端提供真实接口，可继续在 `src/services` 中接入。

## Nginx + Express 部署对接

推荐部署链路：

```text
用户浏览器
  -> http://服务器公网IP
  -> Nginx
     -> 返回 frontend/dist 的 Vue 页面
     -> 将 /api/* 转发给 Node Express
        -> MySQL MotionAnalysis
```

前端生产构建只需要把 API 地址设为同源 `/api`，这样浏览器请求会变成：

```text
GET http://服务器公网IP/api/activities
GET http://服务器公网IP/api/activities/1001
GET http://服务器公网IP/api/stats/activity-types
```

Nginx 示例配置在 `backend/docs/nginx-motion-analysis.conf`。其中 `location /` 使用 `try_files $uri $uri/ /index.html;`，用于支持 Vue Router history 模式，避免刷新 `/activities`、`/calendar`、`/trends`、`/statistics` 等前端路由时出现 404。

## 隐私与数据边界

- mock 坐标、活动编号、健康指标、天气、社区动态均为合成样例。
- 前端不提交真实 FIT/JSON/GPX/TCX、数据库 dump、签名 URL、服务器地址、密钥或本机路径。
- 数据库结构页只做只读展示，不提供 MySQL 全表任意增删改。
- 手动运动 CRUD 只走后端 `/manual-activities` 安全接口；mock 模式下仅保存在当前前端会话内。

Frontend: Hao Chen
