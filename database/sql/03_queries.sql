USE MotionAnalysis;

-- 已导入文件列表
SELECT id, file_name, file_size_bytes, imported_at
FROM SourceFiles
ORDER BY imported_at DESC;

-- 活动列表
SELECT
    a.id,
    a.activity_key,
    a.activity_type,
    a.start_time_utc,
    s.total_distance_m,
    s.total_timer_time_s,
    s.avg_heart_rate_bpm,
    s.max_heart_rate_bpm,
    s.avg_speed_mps
FROM Activities a
LEFT JOIN Sessions s ON s.activity_id = a.id
ORDER BY a.start_time_utc DESC;

-- 按运动类型统计活动数量、总距离、总时长、平均心率
SELECT
    a.activity_type,
    COUNT(*) AS activity_count,
    SUM(s.total_distance_m) AS total_distance_m,
    SUM(s.total_timer_time_s) AS total_timer_time_s,
    AVG(s.avg_heart_rate_bpm) AS avg_heart_rate_bpm
FROM Activities a
LEFT JOIN Sessions s ON s.activity_id = a.id
GROUP BY a.activity_type
ORDER BY activity_count DESC;

-- 单次活动摘要：把 @activity_id 改成目标活动 ID，默认取最新活动
SET @activity_id = (SELECT id FROM Activities ORDER BY start_time_utc DESC LIMIT 1);

SELECT
    a.id,
    a.activity_key,
    a.activity_type,
    a.start_time_utc,
    s.total_distance_m,
    s.total_elapsed_time_s,
    s.total_timer_time_s,
    s.total_moving_time_s,
    s.total_calories,
    s.avg_speed_mps,
    s.max_speed_mps,
    s.avg_heart_rate_bpm,
    s.max_heart_rate_bpm,
    s.avg_cadence,
    s.avg_power_w,
    s.max_power_w
FROM Activities a
LEFT JOIN Sessions s ON s.activity_id = a.id
WHERE a.id = @activity_id;

-- 单次活动轨迹点
SELECT
    sample_index,
    sample_time_utc,
    latitude,
    longitude,
    altitude_m,
    distance_m,
    speed_mps,
    heart_rate_bpm,
    cadence,
    power_w
FROM TrackPoints
WHERE activity_id = @activity_id
ORDER BY sample_index;

-- 单次活动心率-时间数据
SELECT sample_time_utc, heart_rate_bpm
FROM TrackPoints
WHERE activity_id = @activity_id
  AND heart_rate_bpm IS NOT NULL
ORDER BY sample_time_utc;

-- 单次活动速度-时间数据
SELECT sample_time_utc, speed_mps
FROM TrackPoints
WHERE activity_id = @activity_id
  AND speed_mps IS NOT NULL
ORDER BY sample_time_utc;

-- 单次活动分段数据
SELECT
    lap_index,
    start_time_utc,
    total_distance_m,
    total_timer_time_s,
    avg_speed_mps,
    avg_heart_rate_bpm,
    avg_power_w
FROM Laps
WHERE activity_id = @activity_id
ORDER BY lap_index;

-- 表数据量，用于说明大数据量下的执行效率
SELECT
    table_name,
    table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_rows DESC;

-- 查看当前数据库中已建立的索引
SELECT
    table_name,
    index_name,
    non_unique,
    GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;
