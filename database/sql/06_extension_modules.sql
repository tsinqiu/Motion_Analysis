USE MotionAnalysis;

CREATE TABLE IF NOT EXISTS UserSettings (
    user_id INT PRIMARY KEY,
    distance_unit VARCHAR(20) NOT NULL DEFAULT 'km',
    weight_unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    temperature_unit VARCHAR(20) NOT NULL DEFAULT 'c',
    pace_unit VARCHAR(30) NOT NULL DEFAULT 'min_per_km',
    default_privacy VARCHAR(30) NOT NULL DEFAULT 'private',
    hide_map_endpoints BOOLEAN NOT NULL DEFAULT TRUE,
    health_sync BOOLEAN NOT NULL DEFAULT FALSE,
    sync_preferences_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT FK_UserSettings_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SyncProviderConnections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'not_connected',
    auto_sync BOOLEAN NOT NULL DEFAULT FALSE,
    sync_direction VARCHAR(20) NOT NULL DEFAULT 'import',
    last_sync_at DATETIME(3) NULL,
    connected_at DATETIME(3) NULL,
    disconnected_at DATETIME(3) NULL,
    raw_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT UQ_SyncProviderConnections_user_provider UNIQUE (user_id, provider),
    CONSTRAINT FK_SyncProviderConnections_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SyncJobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    job_type VARCHAR(40) NOT NULL DEFAULT 'manual_sync',
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    started_at DATETIME(3) NULL,
    finished_at DATETIME(3) NULL,
    activity_count INT NOT NULL DEFAULT 0,
    error_message VARCHAR(1000) NULL,
    raw_json JSON NULL,
    KEY IX_SyncJobs_user_provider_time (user_id, provider, requested_at),
    CONSTRAINT FK_SyncJobs_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS SyncLogs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id BIGINT NULL,
    user_id INT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message VARCHAR(1000) NOT NULL,
    raw_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY IX_SyncLogs_user_time (user_id, created_at),
    CONSTRAINT FK_SyncLogs_job
        FOREIGN KEY (job_id) REFERENCES SyncJobs(id) ON DELETE SET NULL,
    CONSTRAINT FK_SyncLogs_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS CommunityPosts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_id INT NULL,
    content TEXT NOT NULL,
    visibility VARCHAR(30) NOT NULL DEFAULT 'public',
    image_path VARCHAR(1000) NULL,
    image_original_name VARCHAR(260) NULL,
    image_mime_type VARCHAR(120) NULL,
    image_size_bytes BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY IX_CommunityPosts_visibility_time (visibility, created_at),
    CONSTRAINT FK_CommunityPosts_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_CommunityPosts_activity
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS CommunityComments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY IX_CommunityComments_post_time (post_id, created_at),
    CONSTRAINT FK_CommunityComments_post
        FOREIGN KEY (post_id) REFERENCES CommunityPosts(id) ON DELETE CASCADE,
    CONSTRAINT FK_CommunityComments_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS CommunityLikes (
    post_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT FK_CommunityLikes_post
        FOREIGN KEY (post_id) REFERENCES CommunityPosts(id) ON DELETE CASCADE,
    CONSTRAINT FK_CommunityLikes_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS CommunityShares (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    channel VARCHAR(40) NOT NULL DEFAULT 'copy_link',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY IX_CommunityShares_post (post_id),
    CONSTRAINT FK_CommunityShares_post
        FOREIGN KEY (post_id) REFERENCES CommunityPosts(id) ON DELETE CASCADE,
    CONSTRAINT FK_CommunityShares_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ExploreArticles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(500) NULL,
    cover_url VARCHAR(1000) NULL,
    tags_json JSON NULL,
    difficulty VARCHAR(40) NULL,
    duration_min INT NULL,
    content MEDIUMTEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    published_at DATETIME(3) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY IX_ExploreArticles_type_status_time (type, status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS WorkoutSessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_type VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    started_at DATETIME(3) NOT NULL,
    paused_at DATETIME(3) NULL,
    paused_duration_s INT NOT NULL DEFAULT 0,
    finished_at DATETIME(3) NULL,
    activity_id INT NULL,
    raw_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY IX_WorkoutSessions_user_status (user_id, status, started_at),
    CONSTRAINT FK_WorkoutSessions_user
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_WorkoutSessions_activity
        FOREIGN KEY (activity_id) REFERENCES Activities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS WorkoutTrackPoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workout_session_id BIGINT NOT NULL,
    sample_index INT NOT NULL,
    sample_time_utc DATETIME(3) NOT NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    altitude_m DOUBLE NULL,
    distance_m DOUBLE NULL,
    speed_mps DOUBLE NULL,
    heart_rate_bpm INT NULL,
    cadence DOUBLE NULL,
    power_w INT NULL,
    raw_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT UQ_WorkoutTrackPoints_session_index UNIQUE (workout_session_id, sample_index),
    KEY IX_WorkoutTrackPoints_session_time (workout_session_id, sample_time_utc),
    CONSTRAINT FK_WorkoutTrackPoints_session
        FOREIGN KEY (workout_session_id) REFERENCES WorkoutSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
