# Database

本目录维护 Garmin 运动数据分析系统的数据库结构、导入脚本和查询脚本。

真实 Garmin 导出数据、轨迹文件、导入生成的大体量 SQL 和登录 token 只用于本地开发，不提交到 GitHub。

## 目录

```text
database/
  scripts/
    download_garmin_connect.py
    import_fit_files.py
    import_to_mysql.ps1
  sql/
    01_schema.sql
    03_queries.sql
    04_auth_manual_upload.sql
    05_performance_indexes.sql
```

本地生成但不提交的路径：

```text
database/data/
database/.garmin_tokens/
database/sql/02_import_data.sql
```

## 数据源说明

导入脚本支持读取本地 Garmin FIT 与 JSON 摘要文件，并把结构化结果写入导入 SQL。原始 JSON 中可能包含用户资料、精确坐标、图片签名 URL 和设备信息，因此这些文件必须只保留在本地。

`ActivitySummaries` 和 `ActivityZones` 用于保存前端需要展示的运动摘要、训练负荷、心率区间、功率区间和运动表现指标。`TrackPoints`、`Laps` 和 `Sessions` 继续作为详情页、轨迹预览和图表数据来源。

## 本地导入流程

准备本地 Garmin 数据后，在项目根目录执行：

```powershell
python database\scripts\import_fit_files.py
```

脚本默认读取本地：

```text
database/data/fit
database/data/json
```

并生成：

```text
database/sql/02_import_data.sql
```

然后在 MySQL 中按顺序执行：

```sql
source database/sql/01_schema.sql;
source database/sql/02_import_data.sql;
source database/sql/03_queries.sql;
```

如果是在已有数据库上启用后端注册登录、用户归属和手动上传功能，再执行：

```sql
source database/sql/04_auth_manual_upload.sql;
```

然后在 `backend` 目录运行：

```powershell
npm run seed:admin
```

性能索引脚本可重复执行：

```sql
source database/sql/05_performance_indexes.sql;
```

## 数据库名

当前 SQL 使用的数据库名为：

```text
MotionAnalysis
```

`01_schema.sql` 会重建表结构，执行前请确认本地没有需要保留的旧数据。
