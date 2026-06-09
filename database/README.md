# Database

本目录维护 Garmin 运动数据分析系统的数据库部分，包含 FIT 解析、SQL 建表、数据导入和查询脚本。

推荐使用 VS Code + Database Client 插件快速上手。

## 目录

```text
database/
  data/
    fit/      # 当前主流程导入使用的 FIT 文件
    json/     # Garmin Connect 导出的活动摘要，扩展名是 txt，内容中包含 JSON
    gpx/      # 轨迹对照样例
    tcx/      # 轨迹对照样例
    reports/  # 纯文本运动报告
  scripts/
    import_fit_files.py
  sql/
    01_schema.sql
    02_import_data.sql
    03_queries.sql
```

## 数据源说明

当前数据库主流程同时读取：

- `database/data/fit`：FIT 文件，适合导入逐秒轨迹点、分圈、事件、心率、速度、功率等训练过程数据。
- `database/data/json`：Garmin Connect 活动摘要。文件扩展名虽然是 `.txt`，且文件名可以随意，但内容中从第一个 `{` 开始是 JSON。

导入脚本不会依赖 JSON/TXT 文件名，而是根据活动开始时间、运动类型、距离和时长把 JSON 摘要与 FIT 文件对应起来。这里的 JSON 来自 Garmin Connect 活动接口，包含一些 FIT 解析主流程暂未完整覆盖的活动摘要和平台侧信息，例如：

- 训练效果：`aerobicTrainingEffect`、`anaerobicTrainingEffect`、`trainingEffectLabel`、`activityTrainingLoad`、`vO2MaxValue`。
- 分区统计：`hrZone`、`powerZone`，以及 `metadata.hrTimeInZone_*`、`metadata.powerTimeInZone_*`。
- 身体与强度信息：`differenceBodyBattery`、`waterEstimated`、`moderateIntensityMinutes`、`vigorousIntensityMinutes`。
- 跑步动态：`avgStrideLength`、`avgVerticalOscillation`、`avgGroundContactTime`、`avgVerticalRatio`。
- 平台元数据：Garmin 活动 `id`、`activityUUID`、`privacy`、`owner*`、`originalFileUrl`、`locationName`、起终点经纬度、`splitSummaries`。

这些字段已经在新结构中落到 `ActivitySummaries` 和 `ActivityZones`：

- `ActivitySummaries`：移动时间、训练效果、训练负荷、VO2max、Body Battery、补水估算、跑步动态、JSON 双脚步频等。
- `ActivityZones`：心率区间和功率区间停留时间。
- `ActivitySourceFiles`：记录每个活动对应的 FIT 与 Garmin JSON TXT 来源文件，以及内容匹配分数。

如果需要保留 FIT 解析出的原始消息，可运行：

```powershell
python database\scripts\import_fit_files.py --include-raw-json --include-fit-messages
```

默认模式会导入结构化字段和 JSON 摘要核心字段，但不会把每一条 FIT 原始消息都写入 `FitMessages`，这样体积更小。

## 运行顺序

在项目根目录下执行：

```powershell
python database\scripts\import_fit_files.py
```

脚本会读取：

```text
database/data/fit
database/data/json
```

并重新生成：

```text
database/sql/02_import_data.sql
```

然后在 MySQL 中按顺序执行：

```sql
source database/sql/01_schema.sql;
source database/sql/02_import_data.sql;
source database/sql/03_queries.sql;
```

如果是在已有数据库上启用后端二期的注册登录、用户归属和手动上传功能，再执行一次：

```sql
source database/sql/04_auth_manual_upload.sql;
```

然后在 `backend` 目录运行：

```powershell
npm run seed:admin
```

## 数据库名

当前 SQL 使用的数据库名为：

```text
MotionAnalysis
```

`01_schema.sql` 会重建表结构，执行前请确认没有需要保留的旧数据。
