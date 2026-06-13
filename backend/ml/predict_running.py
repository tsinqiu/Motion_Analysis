from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import joblib
import numpy as np


RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def load_payload() -> dict[str, object]:
    raw = sys.stdin.read() or "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON payload: {error.msg}") from error

    if not isinstance(payload, dict):
        raise ValueError("prediction payload must be a JSON object")

    return payload


def numeric_feature(payload: dict[str, object], name: str) -> float:
    if name not in payload:
        raise ValueError(f"missing required feature: {name}")

    try:
        value = float(payload[name])
    except (TypeError, ValueError) as error:
        raise ValueError(f"invalid numeric feature: {name}") from error

    if not np.isfinite(value):
        raise ValueError(f"invalid numeric feature: {name}")

    return value


def risk_from_features(load_level: str, payload: dict[str, float]) -> str:
    score = RISK_ORDER.get(load_level, 1)

    avg_hr = payload.get("avgHeartRateBpm", 0)
    max_hr = payload.get("maxHeartRateBpm", 0)
    duration = payload.get("durationS", 0)
    elevation_gain = payload.get("elevationGainM", 0)

    if avg_hr >= 165 or max_hr >= 190:
        score += 1
    if duration >= 5400:
        score += 1
    if elevation_gain >= 500:
        score += 1

    if score <= 1:
        return "low"
    if score <= 3:
        return "medium"
    return "high"


def advice_for(load_level: str, fatigue_risk: str) -> str:
    if fatigue_risk == "high":
        return "本次跑步负荷或心率压力偏高，建议优先安排休息、低强度恢复跑或拉伸，避免连续高强度训练。"
    if load_level == "high":
        return "本次训练负荷较高，建议下一次训练降低强度，并关注睡眠、补水和主观疲劳感。"
    if fatigue_risk == "medium":
        return "本次跑步有一定疲劳压力，建议后续训练保持中低强度，并观察心率恢复情况。"
    return "本次跑步负荷相对可控，可以按计划继续训练，但仍建议保持充分恢复。"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    args = parser.parse_args()

    try:
        payload = load_payload()
        bundle = joblib.load(Path(args.model))
        feature_names = bundle["featureNames"]
        model = bundle["pipeline"]

        normalized_payload = {
            name: numeric_feature(payload, name)
            for name in feature_names
        }
        values = np.array([[normalized_payload[name] for name in feature_names]], dtype=float)
        probabilities = model.predict_proba(values)[0]
        classes = list(model.named_steps["classifier"].classes_)
        best_index = int(np.argmax(probabilities))
        load_level = str(classes[best_index])
        confidence = float(probabilities[best_index])
        fatigue_risk = risk_from_features(load_level, normalized_payload)
    except (
        KeyError,
        ValueError,
        TypeError,
        AttributeError,
        FileNotFoundError,
        OSError,
        pickle.UnpicklingError,
    ) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
    except Exception as error:
        print(f"unexpected prediction error: {error}", file=sys.stderr)
        raise SystemExit(1) from error

    result = {
        "predictedTrainingLoadLevel": load_level,
        "fatigueRisk": fatigue_risk,
        "recoveryAdvice": advice_for(load_level, fatigue_risk),
        "confidence": round(confidence, 4),
        "modelVersion": bundle.get("modelVersion", "running-v1"),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
