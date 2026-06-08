# AGENTS.md

本文件面向后续开发者和 Codex。README 面向作业介绍；本文件面向实现约束。当前项目阶段是：**优先完成 FIT 文件解析和 MySQL 入库**。不要过早把重点转到前端、云端、趋势、健康度或运动日历。

## 1. 当前优先级

当前只做数据底座：

1. 读取 `Data` 目录中的 FIT 文件。
2. 解析 FIT 中尽可能多的结构化数据。
3. 设计 MySQL 表结构。
4. 将解析结果稳定写入数据库。
5. 编写基础 SQL 查询验证结果。

暂缓内容：

- Web 页面。
- App 展示。
- 云端部署。
- 文件上传接口。
- 趋势分析。
- 健康度评估。
- 运动日历统计。

这些内容可以在文档中作为后续扩展保留，但当前实现不要优先投入。

## 2. 数据源规则

- 正式数据源只使用 FIT 文件。
- `Data` 目录中的 GPX、TCX、JSON 和纯文本报告只允许作为样例对照。
- 不要让正式导入流程依赖 GPX、TCX、JSON 或 TXT。
- 不要写死活动数量、文件名或运动类型集合。
- 后续 `Data` 目录会继续增加更多 FIT 文件，导入程序必须按目录扫描或按文件列表处理。

## 3. FIT 解析重点

优先解析这些 FIT 消息：

- `file_id`：文件类型、设备信息、创建时间。
- `sport`：运动类型。
- `session`：整次活动摘要。
- `lap`：圈或分段摘要。
- `record`：逐点采样数据。
- `event`：开始、暂停、恢复、结束等事件。

`record` 是最重要的数据来源，必须优先稳定解析。后续所有轨迹、心率曲线、速度曲线、功率曲线都依赖它。

重点字段：

- `timestamp`
- `position_lat`
- `position_long`
- `distance`
- `speed` / `enhanced_speed`
- `altitude` / `enhanced_altitude`
- `heart_rate`
- `cadence`
- `power`
- `vertical_oscillation`
- `stance_time`

字段缺失时写 NULL，不要写 0。不同运动类型字段不同是正常情况。

## 4. 单位和数据处理

保存到数据库时尽量保存标准化、可计算的数值：

- 时间：保存 UTC 时间，必要时额外保存本地时间。
- 经纬度：保存十进制度数。
- 距离：保存为米。
- 速度：保存为 m/s。
- 海拔：保存为米。
- 心率：保存为 bpm。
- 功率：保存为 W。
- 时长：保存为秒。

注意：

- FIT 时间戳起点是 `1989-12-31 UTC`。
- 经纬度原始值是 semicircles，转换为 `value * 180 / 2^31`。
- 如果使用现成 FIT 解析库，先确认库是否已经完成单位换算，避免重复缩放。
- 不要只保存 `4:32 /km` 这类格式化文本；配速应由速度或距离/时间计算。

## 5. 推荐工程结构

当前阶段只需要和导入数据库有关的代码：

```text
src/
  parsers/
    fit_parser.*
  db/
    schema.sql
    queries.sql
  services/
    import_service.*
  scripts/
    import_fit_files.*
```

暂时不要新增正式的 `web/`、`app/`、云端部署代码或复杂分析模块，除非用户明确要求进入下一阶段。

不要新增 `gpx_parser`、`tcx_parser`、`json_parser` 作为主流程模块。需要校验时，可以写临时脚本或测试工具。

## 6. 中间结构

FIT 解析器输出统一中间结构，导入服务只接收这个结构：

```text
FitActivity
  sourceFile
  activity
  session
  laps
  records
  events
  metrics
```

建议含义：

- `sourceFile`：文件名、大小、哈希、导入时间、保存路径。
- `activity`：运动类型、开始时间、设备信息、外部活动标识。
- `session`：总距离、总时长、平均/最大心率、平均/最大速度、热量等。
- `laps`：分段序号、开始时间、距离、用时、心率、速度、功率等。
- `records`：采样时间、经纬度、海拔、距离、速度、心率、步频、功率等。
- `events`：开始、停止、暂停、恢复等。
- `metrics`：心率区间、功率区间、训练负荷等扩展指标。

如果某类数据暂时解析不到，可以先保留表和字段设计，导入时允许为空。

## 7. MySQL 设计约束

建议表：

- `SourceFiles`
- `Activities`
- `Sessions`
- `Laps`
- `TrackPoints`
- `Events`
- `Metrics`

`TrackPoints` 是核心表，字段建议：

- `id`
- `activity_id`
- `sample_time_utc`
- `sample_time_local`
- `latitude`
- `longitude`
- `altitude_m`
- `distance_m`
- `speed_mps`
- `heart_rate_bpm`
- `cadence`
- `power_w`
- `vertical_oscillation_mm`
- `stance_time_ms`

建议索引：

- `SourceFiles(file_hash)`
- `Activities(activity_type, start_time_utc)`
- `TrackPoints(activity_id, sample_time_utc)`
- `TrackPoints(activity_id, distance_m)`
- `Laps(activity_id, lap_index)`
- `Events(activity_id, event_time_utc)`

导入规则：

- 原始 FIT 文件只保存，不修改。
- 导入过程必须可重复执行。
- 优先用文件哈希识别重复 FIT。
- 重复导入同一 FIT 时，不应产生重复活动、重复分段或重复轨迹点。
- 数据库连接字符串通过配置或环境变量提供，不要写死。
- 默认只导入结构化字段，不导入 `FitMessages` 全量原始消息。
- 默认不写每行 `raw_json`，避免导入 SQL 和数据库体积快速膨胀。
- 只有调试、追溯字段遗漏或课程展示需要时，才开启完整原始消息导入。

当前导入脚本的效率相关参数：

- 默认模式：`python scripts/import_fit_files.py --fit-dir Data/fit --out db/import_data.sql`
- 完整消息模式：追加 `--include-fit-messages`
- 行级原始 JSON 模式：追加 `--include-raw-json`

默认模式用于正式导入；后两个选项只用于调试或追溯。

## 8. 当前阶段查询要求

当前至少准备这些 SQL 查询：

- 已导入文件列表。
- 活动列表。
- 单次活动摘要。
- 单次活动轨迹点。
- 单次活动心率-时间数据。
- 单次活动速度-时间数据。
- 单次活动分段数据。
- 按运动类型统计活动数量、总距离、总时长、平均心率。

这些查询优先写在 `db/queries.sql` 中。当前不要求做 API 包装。

## 9. 验证清单

每次实现解析或导入后，至少验证：

- 能识别 `Data` 目录中的所有 FIT 样例。
- 跑步 FIT 能解析位置、速度、心率、步频、功率。
- 骑行 FIT 能解析位置、速度、心率、海拔。
- 力量训练 FIT 缺少位置时不会失败。
- 同一活动的 `TrackPoints` 按时间递增。
- 重复导入同一 FIT 不产生重复数据。
- 解析出的距离、时长、平均心率与样例报告大体一致。

## 10. 后续扩展边界

以下内容属于后续阶段，当前只在 README 中简要提及，不主动实现：

- FIT 文件上传页面或接口。
- Web/App 可视化。
- 云端部署。
- 运动趋势分析。
- 健康度评估。
- 运动日历。
- 更复杂的训练建议或算法。

如果用户后续明确要求实现这些功能，再基于已经入库的数据继续扩展。

## 11. 文档维护规则

- README 写给不熟悉开发的人，避免过深技术细节。
- AGENTS 写给后续实现，保留字段、表、导入规则和验证要求。
- 如果实现路线变化，先更新 AGENTS，再同步 README 中的高层描述。
- 当前阶段文档应强调“FIT 解析入库优先”，不要把云端和前端写成当前必须完成的重点。
