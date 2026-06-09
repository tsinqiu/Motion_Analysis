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

## 本地数据库

如果本地还没有 `MotionAnalysis` 数据库，先在项目根目录的 `database` 目录中导入现有 SQL：

```powershell
.\scripts\import_to_mysql.ps1 -Mysql "D:/study/MySQL/mysql-9.7.0-winx64/bin/mysql.exe"
```

后端只读取数据库，不负责导入 Garmin 文件，也不修改数据库表结构。

## 接口

接口说明见：

```text
backend/docs/api.md
```

当前接口包括：

- `GET /api/health`
- `GET /api/activities`
- `GET /api/activities/:id`
- `GET /api/activities/:id/track-points`
- `GET /api/activities/:id/heart-rate`
- `GET /api/activities/:id/speed`
- `GET /api/activities/:id/laps`
- `GET /api/activities/:id/zones`
- `GET /api/stats/activity-types`

真实数据库账号、密码和连接串不要提交到 GitHub。只保留 `.env.example`。
