from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np


RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def risk_from_features(load_level: str, payload: dict[str, float]) -> str:
    score = RISK_ORDER.get(load_level, 1)

    avg_hr = float(payload.get("avgHeartRateBpm", 0))
    max_hr = float(payload.get("maxHeartRateBpm", 0))
    duration = float(payload.get("durationS", 0))
    elevation_gain = float(payload.get("elevationGainM", 0))

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

    payload = json.loads(sys.stdin.read() or "{}")
    bundle = joblib.load(Path(args.model))
    feature_names = bundle["featureNames"]
    model = bundle["pipeline"]

    values = np.array([[float(payload[name]) for name in feature_names]], dtype=float)
    probabilities = model.predict_proba(values)[0]
    classes = list(model.named_steps["classifier"].classes_)
    best_index = int(np.argmax(probabilities))
    load_level = str(classes[best_index])
    confidence = float(probabilities[best_index])
    fatigue_risk = risk_from_features(load_level, payload)

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
