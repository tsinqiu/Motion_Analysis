USE MotionAnalysis;

-- 已导入来源文件：FIT 与 Garmin JSON TXT 都在这里
SELECT
    id,
    source_type,
    file_name,
    file_size_bytes,
    imported_at
FROM SourceFiles
ORDER BY imported_at DESC, source_type, file_name;

-- 活动与来源文件对应关系：文件名随意，真正靠内容匹配
SELECT
    a.id AS activity_id,
    a.garmin_activity_id,
    a.activity_type,
    a.local_start_time,
    a.match_status,
    GROUP_CONCAT(CONCAT(sf.source_type, ':', sf.file_name) ORDER BY sf.source_type SEPARATOR ' | ') AS sources,
    MIN(asf.match_score) AS best_match_score
FROM Activities a
JOIN ActivitySourceFiles asf ON asf.activity_id = a.id
JOIN SourceFiles sf ON sf.id = asf.source_file_id
GROUP BY a.id
ORDER BY a.local_start_time DESC;

-- 活动列表：FIT 过程汇总 + Garmin JSON 平台摘要
SELECT
    a.id,
    a.garmin_activity_id,
    a.activity_name,
    a.activity_type,
    a.local_start_time,
    ROUND(s.total_distance_m / 1000, 2) AS fit_distance_km,
    ROUND(js.distance_m / 1000, 2) AS json_distance_km,
    s.total_timer_time_s AS fit_timer_time_s,
    js.moving_duration_s AS json_moving_time_s,
    js.activity_training_load,
    js.aerobic_training_effect,
    js.anaerobic_training_effect,
    js.training_effect_label,
    js.vo2max,
    js.body_battery_delta
FROM Activities a
LEFT JOIN Sessions s ON s.activity_id = a.id
LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
ORDER BY a.local_start_time DESC;

-- 按运动类型统计：优先使用 JSON 摘要字段，因为它补充了 movingDuration 和训练负荷
SELECT
    a.activity_type,
    COUNT(*) AS activity_count,
    ROUND(SUM(js.distance_m) / 1000, 2) AS total_distance_km,
    ROUND(SUM(js.duration_s) / 60, 1) AS total_duration_min,
    ROUND(SUM(js.moving_duration_s) / 60, 1) AS total_moving_min,
    ROUND(AVG(js.avg_heart_rate_bpm), 1) AS avg_heart_rate_bpm,
    ROUND(SUM(js.activity_training_load), 1) AS total_training_load
FROM Activities a
LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
GROUP BY a.activity_type
ORDER BY activity_count DESC;

-- 单次活动摘要：默认取最新活动
SET @activity_id = (SELECT id FROM Activities ORDER BY local_start_time DESC LIMIT 1);

SELECT
    a.id,
    a.garmin_activity_id,
    a.activity_name,
    a.activity_type,
    a.local_start_time,
    a.location_name,
    s.total_elapsed_time_s AS fit_elapsed_time_s,
    s.total_timer_time_s AS fit_timer_time_s,
    js.elapsed_duration_s AS json_elapsed_time_s,
    js.duration_s AS json_duration_s,
    js.moving_duration_s AS json_moving_time_s,
    js.distance_m,
    js.calories,
    js.avg_heart_rate_bpm,
    js.max_heart_rate_bpm,
    s.avg_cadence AS fit_single_leg_cadence,
    js.avg_cadence_spm AS json_steps_per_minute,
    js.avg_power_w,
    js.max_power_w,
    js.normalized_power_w,
    js.activity_training_load,
    js.aerobic_training_effect,
    js.anaerobic_training_effect,
    js.training_effect_label,
    js.vo2max,
    js.body_battery_delta,
    js.water_estimated_ml
FROM Activities a
LEFT JOIN Sessions s ON s.activity_id = a.id
LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
WHERE a.id = @activity_id;

-- 单次活动心率/功率分区
SELECT
    zone_type,
    zone_index,
    duration_s,
    ROUND(duration_s / 60, 2) AS duration_min,
    source_field
FROM ActivityZones
WHERE activity_id = @activity_id
ORDER BY zone_type, zone_index;

-- 单次活动分段数据，来自 FIT
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

-- 单次活动轨迹点，来自 FIT
SELECT
    sample_index,
    sample_time_utc,
    latitude,
    longitude,
    altitude_m,
    distance_m,
    speed_mps,
    heart_rate_bpm,
    cadence AS fit_single_leg_cadence,
    power_w
FROM TrackPoints
WHERE activity_id = @activity_id
ORDER BY sample_index;

-- 表数据量
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
