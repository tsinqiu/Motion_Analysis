CREATE DATABASE IF NOT EXISTS MotionAnalysis
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE MotionAnalysis;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS FitMessages;
DROP TABLE IF EXISTS Metrics;
DROP TABLE IF EXISTS Events;
DROP TABLE IF EXISTS TrackPoints;
DROP TABLE IF EXISTS Laps;
DROP TABLE IF EXISTS Sessions;
DROP TABLE IF EXISTS Activities;
DROP TABLE IF EXISTS SourceFiles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE SourceFiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(260) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash CHAR(64) NOT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT UQ_SourceFiles_file_hash UNIQUE (file_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_file_id INT NOT NULL,
    activity_key VARCHAR(120) NOT NULL,
    activity_type VARCHAR(80) NULL,
    start_time_utc DATETIME(3) NULL,
    local_start_time DATETIME(3) NULL,
    device_manufacturer VARCHAR(100) NULL,
    device_product VARCHAR(100) NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Activities_SourceFiles
        FOREIGN KEY (source_file_id) REFERENCES SourceFiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    start_time_utc DATETIME(3) NULL,
    total_elapsed_time_s DOUBLE NULL,
    total_timer_time_s DOUBLE NULL,
    total_moving_time_s DOUBLE NULL,
    total_distance_m DOUBLE NULL,
    total_calories INT NULL,
    avg_speed_mps DOUBLE NULL,
    max_speed_mps DOUBLE NULL,
    avg_heart_rate_bpm INT NULL,
    max_heart_rate_bpm INT NULL,
    avg_cadence DOUBLE NULL,
    max_cadence DOUBLE NULL,
    avg_power_w INT NULL,
    max_power_w INT NULL,
    total_ascent_m INT NULL,
    total_descent_m INT NULL,
    raw_json JSON NULL,
    CONSTRAINT FK_Sessions_Activities
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
    avg_cadence DOUBLE NULL,
    max_cadence DOUBLE NULL,
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
    cadence DOUBLE NULL,
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
CREATE INDEX IX_Sessions_activity ON Sessions(activity_id);
CREATE UNIQUE INDEX IX_Laps_activity_index ON Laps(activity_id, lap_index);
CREATE UNIQUE INDEX IX_TrackPoints_activity_index ON TrackPoints(activity_id, sample_index);
CREATE INDEX IX_TrackPoints_activity_time ON TrackPoints(activity_id, sample_time_utc);
CREATE INDEX IX_TrackPoints_activity_distance ON TrackPoints(activity_id, distance_m);
CREATE UNIQUE INDEX IX_Events_activity_index ON Events(activity_id, event_index);
CREATE INDEX IX_Events_activity_time ON Events(activity_id, event_time_utc);
CREATE INDEX IX_FitMessages_activity_message ON FitMessages(activity_id, message_name);
