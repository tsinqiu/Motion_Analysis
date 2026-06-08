# Backend

本目录用于后端 API 服务。当前阶段数据库导入已先行完成，后端后续负责把 MySQL 中的运动数据封装成接口，供前端调用。

建议接口优先覆盖：

- 活动列表：读取 `Activities` + `Sessions`
- 活动详情：读取单次活动摘要
- 轨迹点：读取 `TrackPoints`
- 心率曲线：读取 `TrackPoints.sample_time_utc` 和 `heart_rate_bpm`
- 速度曲线：读取 `TrackPoints.sample_time_utc` 和 `speed_mps`
- 分段数据：读取 `Laps`

真实数据库账号、密码和连接串不要提交到 GitHub。只保留示例配置。
