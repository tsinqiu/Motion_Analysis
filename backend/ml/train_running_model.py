from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import mysql.connector
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


MODEL_VERSION = "running-v1"
FEATURE_NAMES = [
    "distanceM",
    "durationS",
    "movingDurationS",
    "elapsedDurationS",
    "avgSpeedMps",
    "maxSpeedMps",
    "avgHeartRateBpm",
    "maxHeartRateBpm",
    "avgCadenceSpm",
    "maxCadenceSpm",
    "elevationGainM",
    "elevationLossM",
    "avgStrideLengthCm",
    "normalizedPowerW",
]


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_rows(env_path: Path) -> list[dict[str, float]]:
    env = read_env(env_path)
    connection = mysql.connector.connect(
        host=env.get("DB_HOST", "127.0.0.1"),
        port=int(env.get("DB_PORT", "3306")),
        database=env.get("DB_NAME", "MotionAnalysis"),
        user=env.get("DB_USER", "root"),
        password=env.get("DB_PASSWORD", ""),
    )
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
          js.distance_m AS distanceM,
          js.duration_s AS durationS,
          js.moving_duration_s AS movingDurationS,
          js.elapsed_duration_s AS elapsedDurationS,
          js.avg_speed_mps AS avgSpeedMps,
          js.max_speed_mps AS maxSpeedMps,
          js.avg_heart_rate_bpm AS avgHeartRateBpm,
          js.max_heart_rate_bpm AS maxHeartRateBpm,
          js.avg_cadence_spm AS avgCadenceSpm,
          js.max_cadence_spm AS maxCadenceSpm,
          js.elevation_gain_m AS elevationGainM,
          js.elevation_loss_m AS elevationLossM,
          js.avg_stride_length_cm AS avgStrideLengthCm,
          COALESCE(js.normalized_power_w, s.normalized_power_w) AS normalizedPowerW,
          js.activity_training_load AS activityTrainingLoad
        FROM Activities a
        LEFT JOIN ActivitySummaries js ON js.activity_id = a.id
        LEFT JOIN Sessions s ON s.activity_id = a.id
        WHERE a.activity_type = 'running'
          AND js.activity_training_load IS NOT NULL
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return rows


def load_level(value: float, low_threshold: float, high_threshold: float) -> str:
    if value <= low_threshold:
        return "low"
    if value <= high_threshold:
        return "medium"
    return "high"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=str(Path(__file__).resolve().parents[1] / ".env"))
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent / "models" / "running_model.joblib"))
    args = parser.parse_args()

    rows = load_rows(Path(args.env))
    if len(rows) < 30:
        raise SystemExit(f"Need at least 30 running rows with activity_training_load, got {len(rows)}")

    loads = np.array([float(row["activityTrainingLoad"]) for row in rows], dtype=float)
    low_threshold, high_threshold = np.quantile(loads, [1 / 3, 2 / 3])
    labels = np.array([load_level(value, low_threshold, high_threshold) for value in loads])
    features = np.array(
        [[None if row[name] is None else float(row[name]) for name in FEATURE_NAMES] for row in rows],
        dtype=object,
    )

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "classifier",
                MLPClassifier(
                    hidden_layer_sizes=(16, 8),
                    activation="relu",
                    solver="adam",
                    alpha=0.001,
                    max_iter=1200,
                    random_state=42,
                ),
            ),
        ]
    )

    train_accuracy = None
    test_accuracy = None
    if len(set(labels)) > 1 and min(np.bincount(np.unique(labels, return_inverse=True)[1])) >= 2:
        x_train, x_test, y_train, y_test = train_test_split(
            features,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels,
        )
        pipeline.fit(x_train, y_train)
        train_accuracy = float(accuracy_score(y_train, pipeline.predict(x_train)))
        test_accuracy = float(accuracy_score(y_test, pipeline.predict(x_test)))
    else:
        pipeline.fit(features, labels)

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "modelVersion": MODEL_VERSION,
        "featureNames": FEATURE_NAMES,
        "pipeline": pipeline,
        "classes": list(pipeline.named_steps["classifier"].classes_),
        "thresholds": {
            "lowMax": float(low_threshold),
            "mediumMax": float(high_threshold),
        },
        "sampleCount": len(rows),
        "trainAccuracy": train_accuracy,
        "testAccuracy": test_accuracy,
    }
    joblib.dump(bundle, output_path)

    metadata = {key: value for key, value in bundle.items() if key != "pipeline"}
    metadata_path = output_path.with_name("running_model_metadata.json")
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
