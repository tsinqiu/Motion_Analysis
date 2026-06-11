# Garmin 运动数据分析数据库管理系统前端

本目录是 Motion Analysis 的 Vue 前端工程，用于展示 Garmin 运动数据分析数据库管理系统中的活动、摘要、轨迹点、分段和统计结果。前端只调用后端 API，不直接连接 MySQL；后端 API 未完成前默认使用 mock 数据开发页面。

本目录 README 只维护前端说明；根目录 `README.md` 是项目总说明，不由前端实现自动修改。

## 技术栈

- Vue 3
- Vite
- Vue Router
- Axios
- ECharts
- @lucide/vue

## 页面骨架

- 首页概览：活动总览、趋势图、轨迹预览、最近运动。
- 活动列表：展示 `Activities` + `Sessions` 的列表数据。
- 运动详情：展示单次活动摘要、心率曲线、速度曲线、轨迹点和分段。
- 统计分析：展示运动类型占比和聚合统计。
- 移动端效果：复现暗色 Garmin 风格的活动列表、训练负荷、趋势、统计、今日状态和运动日历交互。

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

## 环境变量

复制 `.env.example` 为 `.env` 后可按需修改。`.env` 只用于本地，不要提交。

```text
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK=true
```

`VITE_USE_MOCK=true` 时使用 `src/mock` 中的模拟数据；设置为 `false` 时通过 `src/services` 调用后端 API。

当前 mock 数据只用于前端开发，坐标、活动编号和运动指标均为合成样例，不包含真实个人轨迹。

生产部署到 Nginx 同源环境时推荐使用：

```text
VITE_API_BASE_URL=/api
VITE_USE_MOCK=false
```

可以参考 `.env.production.example`。不要把真实服务器账号、数据库账号、私钥或个人邮箱写入环境文件。

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
- `POST /ml/running-prediction`

鉴权、手动上传和模型预测接口已经在服务层预留，当前页面仍以活动管理、详情和统计展示为主。

## 移动端效果说明

`/mobile-preview` 用于展示视频参考中的深色移动端运动数据体验。页面仍然只消费前端 mock/API 层数据，活动列表来自 `Activities` + `Sessions` 字段，训练负荷、趋势、统计和日历为合成展示数据，不包含真实轨迹或个人运动记录。

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

Nginx 示例配置在 `backend/docs/nginx-motion-analysis.conf`。其中 `location /` 使用 `try_files $uri $uri/ /index.html;`，用于支持 Vue Router history 模式，避免刷新 `/activities` 或 `/analytics` 时出现 404。

后端 Express 默认监听服务器本机 `127.0.0.1:8080`，并建议统一保留 `/api` 前缀，例如：

```text
GET /api/activities
GET /api/activities/:id
GET /api/activities/:id/track-points
GET /api/activities/:id/heart-rate
GET /api/activities/:id/speed
GET /api/activities/:id/laps
GET /api/dashboard/overview
GET /api/stats/activity-types
```

如果后端实际只暴露 `/activities` 这类无 `/api` 前缀的路由，需要同步调整 Nginx `proxy_pass` 规则；当前推荐保留 `/api` 前缀，前后端约定最清晰。

部署后建议检查：

```text
http://服务器公网IP/
http://服务器公网IP/activities
http://服务器公网IP/api/activities
```

首页和活动页应能直接刷新，`/api/activities` 应返回 JSON。

## 本地协作说明

当前前端开发以 `feature/frontend` 分支为目标；如果 GitHub clone 不稳定，可以先使用下载包本地开发，恢复连接后再把 `frontend/` 变更迁移回真实 Git checkout。不要提交 `.env`、真实个人轨迹、邮箱、密钥或本机路径。

Frontend: Hao Chen
