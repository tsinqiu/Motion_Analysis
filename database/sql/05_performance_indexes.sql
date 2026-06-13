USE MotionAnalysis;

SET @schema_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_Activities_source_start ON Activities(data_source, local_start_time)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Activities' AND INDEX_NAME = 'IX_Activities_source_start'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_Activities_owner_start ON Activities(owner_user_id, local_start_time)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'Activities' AND INDEX_NAME = 'IX_Activities_owner_start'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_ActivitySummaries_distance ON ActivitySummaries(distance_m)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ActivitySummaries' AND INDEX_NAME = 'IX_ActivitySummaries_distance'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_ActivitySummaries_duration ON ActivitySummaries(duration_s)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ActivitySummaries' AND INDEX_NAME = 'IX_ActivitySummaries_duration'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_ActivitySummaries_avg_hr ON ActivitySummaries(avg_heart_rate_bpm)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ActivitySummaries' AND INDEX_NAME = 'IX_ActivitySummaries_avg_hr'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_ActivitySummaries_max_hr ON ActivitySummaries(max_heart_rate_bpm)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ActivitySummaries' AND INDEX_NAME = 'IX_ActivitySummaries_max_hr'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX IX_ActivitySummaries_avg_speed ON ActivitySummaries(avg_speed_mps)',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'ActivitySummaries' AND INDEX_NAME = 'IX_ActivitySummaries_avg_speed'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
