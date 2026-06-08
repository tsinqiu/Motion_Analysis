# Database

本目录维护 Garmin 运动数据分析系统的数据库部分，当前已合并 `towncz/motion-analysis` 中的 FIT 解析、SQL 建表、数据导入和查询脚本。
推荐使用VSCODE+Database Client插件快速上手

## 目录

```text
database/
  data/
    fit/      # 正式导入使用的 FIT 文件
    gpx/      # 对照样例，不作为主流程依赖
    tcx/      # 对照样例，不作为主流程依赖
    json/     # 对照样例，不作为主流程依赖
    reports/  # 纯文本运动报告
  scripts/
    import_fit_files.py
  sql/
    01_schema.sql
    02_import_data.sql
    03_queries.sql
```

## 运行顺序

在项目根目录 `大作业` 下执行：

```powershell
python database\scripts\import_fit_files.py
```

脚本会读取：

```text
database/data/fit
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

## 数据库名

当前 SQL 使用的数据库名为：

```text
MotionAnalysis
```

`01_schema.sql` 会重建表结构，执行前请确认没有需要保留的旧数据。
