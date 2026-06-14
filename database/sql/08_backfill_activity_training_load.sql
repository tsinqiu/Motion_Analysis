USE MotionAnalysis;

SELECT
  COUNT(*) AS rows_with_json_training_load,
  SUM(activity_training_load IS NULL OR activity_training_load = 0) AS rows_eligible_for_backfill
FROM ActivitySummaries
WHERE raw_json IS NOT NULL
  AND COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.activityTrainingLoad')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.summaryDTO.activityTrainingLoad')), 'null')
  ) REGEXP '^-?[0-9]+(\\.[0-9]+)?$';

UPDATE ActivitySummaries
SET activity_training_load = CAST(
  COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.activityTrainingLoad')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.summaryDTO.activityTrainingLoad')), 'null')
  ) AS DECIMAL(12, 4)
)
WHERE (activity_training_load IS NULL OR activity_training_load = 0)
  AND raw_json IS NOT NULL
  AND COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.activityTrainingLoad')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.summaryDTO.activityTrainingLoad')), 'null')
  ) REGEXP '^-?[0-9]+(\\.[0-9]+)?$';

SELECT
  ROW_COUNT() AS backfilled_rows,
  COUNT(activity_training_load) AS rows_with_training_load
FROM ActivitySummaries;
