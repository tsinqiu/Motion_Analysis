USE MotionAnalysis;

SET @schema_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE Users ADD COLUMN bio VARCHAR(50) NULL AFTER status',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'Users'
    AND COLUMN_NAME = 'bio'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS UserFollows (
    follower_user_id INT NOT NULL,
    following_user_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_user_id, following_user_id),
    KEY IX_UserFollows_following (following_user_id, created_at),
    CONSTRAINT FK_UserFollows_follower
        FOREIGN KEY (follower_user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_UserFollows_following
        FOREIGN KEY (following_user_id) REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE ExploreArticles ADD COLUMN user_id INT NULL AFTER id',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ExploreArticles'
    AND COLUMN_NAME = 'user_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE ExploreArticles ADD COLUMN video_path VARCHAR(1000) NULL AFTER cover_url',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ExploreArticles'
    AND COLUMN_NAME = 'video_path'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE ExploreArticles ADD COLUMN video_original_name VARCHAR(260) NULL AFTER video_path',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ExploreArticles'
    AND COLUMN_NAME = 'video_original_name'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE ExploreArticles ADD COLUMN video_mime_type VARCHAR(120) NULL AFTER video_original_name',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ExploreArticles'
    AND COLUMN_NAME = 'video_mime_type'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE ExploreArticles ADD COLUMN video_size_bytes BIGINT NULL AFTER video_mime_type',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'ExploreArticles'
    AND COLUMN_NAME = 'video_size_bytes'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
