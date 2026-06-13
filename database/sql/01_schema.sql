CREATE DATABASE IF NOT EXISTS MotionAnalysis
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE MotionAnalysis;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS FitMessages;
DROP TABLE IF EXISTS Metrics;
DROP TABLE IF EXISTS ActivityZones;
DROP TABLE IF EXISTS ActivitySummaries;
DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS TrackPoints;
DROP TABLE IF EXISTS Laps;
DROP TABLE IF EXISTS Sessions;
DROP TABLE IF EXISTS ActivitySourceFiles;
DROP TABLE IF EXISTS Activities;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS SourceFiles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT UQ_Users_email UNIQUE (email),
    CONSTRAINT UQ_Users_username UNIQUE (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SourceFiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_type VARCHAR(40) NOT NULL COMMENT 'fit/json/report/gpx/tcx 等来源类型。',
    file_name VARCHAR(260) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash CHAR(64) NOT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT UQ_SourceFiles_file_hash UNIQUE (file_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_key VARCHAR(120) NOT NULL,
    garmin_activity_id VARCHAR(80) NULL,
    activity_name VARCHAR(200) NULL,
    activity_type VARCHAR(80) NULL,
    sport_code INT NULL,
    sub_sport_code INT NULL,
    start_time_utc DATETIME(3) NULL,
    local_start_time DATETIME(3) NULL,
    location_name VARCHAR(200) NULL,
    start_latitude DOUBLE NULL,
    start_longitude DOUBLE NULL,
    end_latitude DOUBLE NULL,
    end_longitude DOUBLE NULL,
    owner_user_id INT NULL,
    data_source VARCHAR(40) NOT NULL DEFAULT 'garmin_import',
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    match_status VARCHAR(40) NOT NULL DEFAULT 'imported' COMMENT 'matched_fit_json / fit_only / json_only 等。',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    raw_json JSON NULL,
    CONSTRAINT UQ_Activities_activity_key UNIQUE (activity_key),
    CONSTRAINT UQ_Activities_garmin_activity_id UNIQUE (garmin_activity_id),
    CONSTRAINT FK_Activities_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ActivitySourceFiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    source_file_id INT NOT NULL,
    source_role VARCHAR(40) NOT NULL COMMENT 'fit / garmin_json / report / route 等。',
    match_score DOUBLE NULL COMMENT '内容匹配得分；文件名随意时用于追溯匹配依据。',
    match_note VARCHAR(400) NULL,
    CONSTRAINT UQ_ActivitySourceFiles_activity_source UNIQUE (activity_id, source_file_id, source_role),
    CONSTRAINT FK_ActivitySourceFiles_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE,
    CONSTRAINT FK_ActivitySourceFiles_SourceFiles
        FOREIGN KEY (source_file_id) REFERENCES SourceFiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    start_time_utc DATETIME(3) NULL,
    total_elapsed_time_s DOUBLE NULL,
    total_timer_time_s DOUBLE NULL,
    total_moving_time_s DOUBLE NULL COMMENT 'FIT session field 59; Garmin Connect 的 movingDuration 当前来自 JSON，FIT 中可能为空。',
    total_distance_m DOUBLE NULL,
    total_calories INT NULL,
    avg_speed_mps DOUBLE NULL,
    max_speed_mps DOUBLE NULL,
    avg_heart_rate_bpm INT NULL,
    max_heart_rate_bpm INT NULL,
    avg_cadence DOUBLE NULL COMMENT 'FIT/Garmin 跑步步频口径：单腿/单脚 cadence。',
    max_cadence DOUBLE NULL COMMENT 'FIT/Garmin 跑步步频口径：单腿/单脚 cadence。',
    avg_power_w INT NULL,
    max_power_w INT NULL,
    normalized_power_w INT NULL COMMENT '标准化功率 Normalized Power，单位 W；FIT session field 34。',
    total_ascent_m INT NULL,
    total_descent_m INT NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Sessions_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ActivitySummaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    garmin_activity_id VARCHAR(80) NULL,
    duration_s DOUBLE NULL COMMENT 'Garmin Connect duration，通常对应总时长/计时时间。',
    moving_duration_s DOUBLE NULL COMMENT 'Garmin Connect movingDuration，截图中的移动时间。',
    elapsed_duration_s DOUBLE NULL COMMENT 'Garmin Connect elapsedDuration，截图中的全程耗时。',
    distance_m DOUBLE NULL,
    calories DOUBLE NULL,
    avg_speed_mps DOUBLE NULL,
    max_speed_mps DOUBLE NULL,
    avg_heart_rate_bpm INT NULL,
    max_heart_rate_bpm INT NULL,
    avg_cadence_spm DOUBLE NULL COMMENT 'Garmin JSON 双脚步频，steps per minute。',
    max_cadence_spm DOUBLE NULL COMMENT 'Garmin JSON 双脚步频，steps per minute。',
    avg_power_w INT NULL,
    max_power_w INT NULL,
    normalized_power_w INT NULL COMMENT '标准化功率 Normalized Power，单位 W。',
    intensity_factor DOUBLE NULL,
    training_stress_score DOUBLE NULL,
    max_20min_power_w INT NULL,
    aerobic_training_effect DOUBLE NULL,
    anaerobic_training_effect DOUBLE NULL,
    training_effect_label VARCHAR(120) NULL,
    activity_training_load DOUBLE NULL,
    vo2max DOUBLE NULL,
    body_battery_delta INT NULL,
    water_estimated_ml DOUBLE NULL,
    moderate_intensity_minutes INT NULL,
    vigorous_intensity_minutes INT NULL,
    avg_stride_length_cm DOUBLE NULL,
    avg_vertical_oscillation_cm DOUBLE NULL,
    avg_ground_contact_time_ms DOUBLE NULL,
    avg_vertical_ratio DOUBLE NULL,
    avg_respiration_rate DOUBLE NULL,
    max_respiration_rate DOUBLE NULL,
    min_respiration_rate DOUBLE NULL,
    elevation_gain_m DOUBLE NULL,
    elevation_loss_m DOUBLE NULL,
    min_elevation_m DOUBLE NULL,
    max_elevation_m DOUBLE NULL,
    original_file_url VARCHAR(1000) NULL,
    manufacturer VARCHAR(100) NULL,
    raw_json JSON NULL,
    CONSTRAINT UQ_ActivitySummaries_activity UNIQUE (activity_id),
    CONSTRAINT FK_ActivitySummaries_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ActivityZones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    zone_type VARCHAR(40) NOT NULL COMMENT 'heart_rate / power',
    zone_index INT NOT NULL,
    duration_s DOUBLE NOT NULL,
    source_field VARCHAR(80) NULL COMMENT 'hrZone/powerZone/metadata 等来源字段。',
    CONSTRAINT UQ_ActivityZones_activity_type_index UNIQUE (activity_id, zone_type, zone_index),
    CONSTRAINT FK_ActivityZones_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Laps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    lap_index INT NOT NULL,
    start_time_utc DATETIME(3) NULL,
    total_elapsed_time_s DOUBLE NULL,
    total_timer_time_s DOUBLE NULL,
    total_distance_m DOUBLE NULL,
    avg_speed_mps DOUBLE NULL,
    max_speed_mps DOUBLE NULL,
    avg_heart_rate_bpm INT NULL,
    max_heart_rate_bpm INT NULL,
    avg_cadence DOUBLE NULL COMMENT 'FIT/Garmin 跑步步频口径：单腿/单脚 cadence。',
    max_cadence DOUBLE NULL COMMENT 'FIT/Garmin 跑步步频口径：单腿/单脚 cadence。',
    avg_power_w INT NULL,
    max_power_w INT NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Laps_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE TrackPoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    sample_index INT NOT NULL,
    sample_time_utc DATETIME(3) NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    altitude_m DOUBLE NULL,
    distance_m DOUBLE NULL,
    speed_mps DOUBLE NULL,
    heart_rate_bpm INT NULL,
    cadence DOUBLE NULL COMMENT 'FIT/Garmin 跑步步频口径：单腿/单脚 cadence。',
    power_w INT NULL,
    accumulated_power_w INT NULL,
    vertical_oscillation_mm DOUBLE NULL,
    stance_time_ms DOUBLE NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_TrackPoints_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    event_index INT NOT NULL,
    event_time_utc DATETIME(3) NULL,
    event_type VARCHAR(80) NULL,
    event VARCHAR(80) NULL,
    event_group INT NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Events_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    metric_type VARCHAR(80) NOT NULL,
    metric_name VARCHAR(120) NOT NULL,
    metric_value_float DOUBLE NULL,
    metric_value_text VARCHAR(400) NULL,
    unit VARCHAR(40) NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Metrics_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE FitMessages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    message_index INT NOT NULL,
    global_message_num INT NOT NULL,
    message_name VARCHAR(80) NOT NULL,
    local_message_num INT NULL,
    message_time_utc DATETIME(3) NULL,
    raw_json JSON NOT NULL,
    CONSTRAINT FK_FitMessages_Activities
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IX_Activities_type_start ON Activities(activity_type, start_time_utc);
CREATE INDEX IX_Activities_local_start ON Activities(local_start_time);
CREATE INDEX IX_Activities_owner_source ON Activities(owner_user_id, data_source);
CREATE INDEX IX_ActivitySourceFiles_source_role ON ActivitySourceFiles(source_role);
CREATE INDEX IX_Sessions_activity ON Sessions(activity_id);
CREATE INDEX IX_ActivitySummaries_load ON ActivitySummaries(activity_training_load);
CREATE INDEX IX_ActivityZones_activity_type ON ActivityZones(activity_id, zone_type);
CREATE UNIQUE INDEX IX_Laps_activity_index ON Laps(activity_id, lap_index);
CREATE UNIQUE INDEX IX_TrackPoints_activity_index ON TrackPoints(activity_id, sample_index);
CREATE INDEX IX_TrackPoints_activity_time ON TrackPoints(activity_id, sample_time_utc);
CREATE INDEX IX_TrackPoints_activity_distance ON TrackPoints(activity_id, distance_m);
CREATE UNIQUE INDEX IX_Events_activity_index ON Events(activity_id, event_index);
CREATE INDEX IX_Events_activity_time ON Events(activity_id, event_time_utc);
CREATE INDEX IX_FitMessages_activity_message ON FitMessages(activity_id, message_name);
