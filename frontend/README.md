# Frontend

本目录用于 Vue 前端。前端不直接连接数据库，只调用后端 API。

建议页面：

- 运动活动列表
- 单次运动详情
- 地图轨迹展示
- 心率 / 速度曲线
- 按运动类型统计

后端 API 未完成前，可以先用 mock 数据开发页面。

## API 地址

本地开发使用：

```text
VITE_API_BASE_URL=http://localhost:8080/api
```

服务器部署时使用：

```text
VITE_API_BASE_URL=/api
```

线上由 Nginx 把 `/api` 请求转发给 Node Express，前端不要写死 `http://服务器公网IP:8080/api`。

完整接口对接说明见：

```text
backend/docs/frontend-integration.md
```

后端接口返回统一格式：

```json
{
  "data": {},
  "meta": {}
}
```

错误格式：

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "..."
  }
}
```
