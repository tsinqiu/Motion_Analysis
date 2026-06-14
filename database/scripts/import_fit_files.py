from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import struct
from pathlib import Path


FIT_EPOCH = dt.datetime(1989, 12, 31, tzinfo=dt.timezone.utc)

BASE_TYPES = {
    0x00: (1, None, None),
    0x01: (1, "b", -0x80),
    0x02: (1, "B", 0xFF),
    0x03: (2, "h", -0x8000),
    0x04: (2, "H", 0xFFFF),
    0x05: (4, "i", -0x80000000),
    0x06: (4, "I", 0xFFFFFFFF),
    0x07: (1, "B", 0x00),
    0x08: (4, "f", None),
    0x09: (8, "d", None),
    0x0A: (1, "B", 0xFF),
    0x0B: (2, "h", -0x8000),
    0x0C: (2, "H", 0xFFFF),
    0x0D: (4, "i", -0x80000000),
    0x0E: (4, "I", 0xFFFFFFFF),
    0x0F: (8, "q", -0x8000000000000000),
    0x10: (8, "Q", 0x0000000000000000),
    0x13: (1, "B", 0xFF),
}

MESSAGE_NAMES = {
    0: "file_id",
    12: "sport",
    18: "session",
    19: "lap",
    20: "record",
    21: "event",
    23: "device_info",
    34: "activity",
    49: "file_creator",
    78: "hrv",
}

FIELD_NAMES = {
    0: {0: "type", 1: "manufacturer", 2: "product", 3: "serial_number", 4: "time_created", 5: "number", 8: "product_name"},
    12: {0: "sport", 1: "sub_sport", 3: "name"},
    18: {
        253: "timestamp", 2: "start_time", 5: "sport", 6: "sub_sport",
        7: "total_elapsed_time", 8: "total_timer_time", 9: "total_distance",
        11: "total_calories", 14: "avg_speed", 15: "max_speed",
        16: "avg_heart_rate", 17: "max_heart_rate", 18: "avg_cadence",
        19: "max_cadence", 20: "avg_power", 21: "max_power",
        22: "total_ascent", 23: "total_descent", 29: "num_laps",
        34: "normalized_power", 59: "total_moving_time",
        124: "enhanced_avg_speed", 125: "enhanced_max_speed",
    },
    19: {
        253: "timestamp", 2: "start_time", 7: "total_elapsed_time",
        8: "total_timer_time", 9: "total_distance", 13: "avg_speed",
        14: "max_speed", 15: "avg_heart_rate", 16: "max_heart_rate",
        17: "avg_cadence", 18: "max_cadence", 19: "avg_power",
        20: "max_power", 21: "total_ascent", 22: "total_descent",
        110: "enhanced_avg_speed", 111: "enhanced_max_speed",
    },
    20: {
        253: "timestamp", 0: "position_lat", 1: "position_long",
        2: "altitude", 3: "heart_rate", 4: "cadence", 5: "distance",
        6: "speed", 7: "power", 13: "temperature", 29: "accumulated_power",
        39: "vertical_oscillation", 53: "fractional_cadence",
        73: "enhanced_speed", 78: "enhanced_altitude", 83: "stance_time",
    },
    21: {253: "timestamp", 0: "event", 1: "event_type", 2: "data16", 3: "data", 4: "event_group"},
    34: {253: "timestamp", 0: "total_timer_time", 1: "num_sessions", 2: "type", 3: "event", 4: "event_type", 5: "local_timestamp"},
}

SPORTS = {
    0: "generic",
    1: "running",
    2: "cycling",
    3: "transition",
    4: "fitness_equipment",
    5: "swimming",
    13: "training",
    17: "walking",
}

EVENTS = {
    0: "timer",
    3: "workout",
    4: "workout_step",
    5: "power_down",
    7: "off_course",
    8: "session",
    9: "lap",
    10: "course_point",
    21: "front_gear_change",
    22: "rear_gear_change",
}

EVENT_TYPES = {
    0: "start",
    1: "stop",
    2: "consecutive_depreciated",
    3: "marker",
    4: "stop_all",
    5: "begin_depreciated",
    6: "end_depreciated",
    7: "end_all_depreciated",
    8: "stop_disable",
    9: "stop_disable_all",
}


def fit_time(value):
    if value is None:
        return None
    return FIT_EPOCH + dt.timedelta(seconds=float(value))


def iso(value):
    if isinstance(value, dt.datetime):
        return value.astimezone(dt.timezone.utc).replace(tzinfo=None).isoformat(timespec="milliseconds")
    return None


def sql_string(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def sql_datetime(value):
    if isinstance(value, dt.datetime) and value.tzinfo is None:
        text = value.isoformat(timespec="milliseconds")
    else:
        text = iso(value)
    return "NULL" if text is None else f"'{text.replace('T', ' ')}'"


def sql_number(value):
    if value is None:
        return "NULL"
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return "NULL"
    return str(value)


def sql_int(value):
    if value is None:
        return "NULL"
    return str(int(value))


def sql_json(obj):
    return sql_string(raw_json(obj)) if obj is not None else "NULL"


def field_name(global_num, field_num):
    return FIELD_NAMES.get(global_num, {}).get(field_num, f"field_{field_num}")


def read_scalar(raw, base_type, endian):
    base_key = base_type & 0x1F
    if base_key not in BASE_TYPES:
        return None
    size, fmt, invalid = BASE_TYPES[base_key]
    if len(raw) < size:
        return None
    if fmt is None:
        return None
    if fmt in ("B", "b"):
        value = struct.unpack(fmt, raw[:size])[0]
    else:
        prefix = "<" if endian == "little" else ">"
        value = struct.unpack(prefix + fmt, raw[:size])[0]
    if invalid is not None and value == invalid:
        return None
    return value


def read_field(raw, base_type, endian):
    base_key = base_type & 0x1F
    size = BASE_TYPES.get(base_key, (len(raw), None, None))[0]
    if size <= 0 or len(raw) <= size:
        return read_scalar(raw, base_type, endian)
    values = []
    for offset in range(0, len(raw), size):
        part = raw[offset:offset + size]
        if len(part) == size:
            values.append(read_scalar(part, base_type, endian))
    values = [v for v in values if v is not None]
    return values if values else None


def is_fit_timestamp_field(global_num, field_num):
    return (
        (global_num == 0 and field_num == 4)
        or (global_num in (18, 19) and field_num in (253, 2))
        or (global_num in (20, 21) and field_num == 253)
        or (global_num == 34 and field_num in (253, 5))
    )


def convert_value(global_num, field_num, value):
    if value is None:
        return None
    if isinstance(value, list):
        return [convert_value(global_num, field_num, item) for item in value]
    if is_fit_timestamp_field(global_num, field_num):
        return iso(fit_time(value))
    if global_num == 20 and field_num in (0, 1):
        if value == 0x7FFFFFFF:
            return None
        return value * 180 / (2 ** 31)
    if field_num in (5, 9) and global_num in (18, 19, 20):
        return value / 100
    if field_num in (6, 14, 15, 73, 110, 111, 124, 125) and global_num in (18, 19, 20):
        return value / 1000
    if field_num in (2, 78) and global_num == 20:
        return value / 5 - 500
    if field_num in (7, 8) and global_num in (18, 19):
        return value / 1000
    if field_num == 59 and global_num == 18:
        return value / 1000
    if field_num == 0 and global_num == 34:
        return value / 1000
    if field_num == 39 and global_num == 20:
        return value / 10
    if field_num == 83 and global_num == 20:
        return value / 10
    if field_num == 0 and global_num == 12:
        return SPORTS.get(value, str(value))
    if field_num == 5 and global_num == 18:
        return SPORTS.get(value, str(value))
    if field_num == 0 and global_num == 21:
        return EVENTS.get(value, str(value))
    if field_num == 1 and global_num == 21:
        return EVENT_TYPES.get(value, str(value))
    return value


def parse_fit(path: Path):
    data = path.read_bytes()
    header_size = data[0]
    data_size = struct.unpack("<I", data[4:8])[0]
    magic = data[8:12]
    if magic != b".FIT":
        raise ValueError(f"{path} is not a FIT file")
    pos = header_size
    end = header_size + data_size
    definitions = {}
    messages = []
    msg_index = 0

    while pos < end:
        header = data[pos]
        pos += 1
        if header & 0x80:
            local_num = (header >> 5) & 0x03
            definition = definitions.get(local_num)
            if definition is None:
                break
        else:
            local_num = header & 0x0F
            is_definition = bool(header & 0x40)
            has_developer = bool(header & 0x20)
            if is_definition:
                pos += 1
                arch = data[pos]
                pos += 1
                endian = "big" if arch else "little"
                prefix = ">" if endian == "big" else "<"
                global_num = struct.unpack(prefix + "H", data[pos:pos + 2])[0]
                pos += 2
                field_count = data[pos]
                pos += 1
                fields = []
                for _ in range(field_count):
                    fields.append((data[pos], data[pos + 1], data[pos + 2]))
                    pos += 3
                developer_fields = []
                if has_developer:
                    dev_count = data[pos]
                    pos += 1
                    for _ in range(dev_count):
                        developer_fields.append((data[pos], data[pos + 1], data[pos + 2]))
                        pos += 3
                definitions[local_num] = {
                    "global_num": global_num,
                    "fields": fields,
                    "developer_fields": developer_fields,
                    "endian": endian,
                }
                continue
            definition = definitions.get(local_num)
            if definition is None:
                break

        global_num = definition["global_num"]
        values = {}
        raw_values = {}
        for num, size, base_type in definition["fields"]:
            raw = data[pos:pos + size]
            pos += size
            raw_value = read_field(raw, base_type, definition["endian"])
            name = field_name(global_num, num)
            raw_values[name] = raw_value
            values[name] = convert_value(global_num, num, raw_value)
        for _num, size, _idx in definition["developer_fields"]:
            pos += size
        messages.append({
            "message_index": msg_index,
            "global_num": global_num,
            "message_name": MESSAGE_NAMES.get(global_num, f"message_{global_num}"),
            "local_num": local_num,
            "values": values,
            "raw_values": raw_values,
        })
        msg_index += 1
    return messages


def first_message(messages, name):
    for message in messages:
        if message["message_name"] == name:
            return message["values"]
    return {}


def messages_named(messages, name):
    return [m for m in messages if m["message_name"] == name]


def as_dt(value):
    if not value:
        return None
    return dt.datetime.fromisoformat(str(value))


def get_num(values, *names):
    for name in names:
        value = values.get(name)
        if isinstance(value, (int, float)):
            return value
    return None


def get_nested_num(values, *path):
    current = values
    for name in path:
        if not isinstance(current, dict):
            return None
        current = current.get(name)
    return current if isinstance(current, (int, float)) else None


def first_num(*values):
    for value in values:
        if isinstance(value, (int, float)):
            return value
    return None


def get_int(values, *names):
    value = get_num(values, *names)
    return None if value is None else int(value)


def get_text(values, name):
    value = values.get(name)
    if value is None:
        return None
    return str(value)


def get_cadence(values):
    cadence = get_num(values, "cadence")
    if cadence is None:
        return None
    fractional = get_num(values, "fractional_cadence")
    if fractional is None:
        return cadence
    return cadence + fractional / 128


def garmin_id_from_name(path: Path):
    match = re.search(r"_(\d+)$", path.stem)
    return match.group(1) if match else None


def rows_for_file(path: Path):
    messages = parse_fit(path)
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    file_id = first_message(messages, "file_id")
    sport = first_message(messages, "sport")
    sessions = messages_named(messages, "session")
    records = messages_named(messages, "record")
    laps = messages_named(messages, "lap")
    events = messages_named(messages, "event")

    session_values = sessions[0]["values"] if sessions else {}
    first_record = records[0]["values"] if records else {}
    activity_type = (
        get_text(sport, "sport")
        or get_text(session_values, "sport")
        or infer_type_from_name(path.name)
    )
    start_time = as_dt(session_values.get("start_time") or first_record.get("timestamp"))
    activity_key = start_time.isoformat() if start_time else path.stem
    activity_raw = {
        "file_id": file_id,
        "sport": sport,
        "parser_note": "Generated from FIT messages only.",
    }
    return {
        "path": path,
        "hash": file_hash,
        "garmin_id": garmin_id_from_name(path),
        "messages": messages,
        "activity": {
            "key": activity_key,
            "type": activity_type,
            "start": start_time,
            "raw": activity_raw,
        },
        "sessions": sessions,
        "laps": laps,
        "records": records,
        "events": events,
    }


def infer_type_from_name(name):
    lower = name.lower()
    if "run" in lower:
        return "running"
    if "ride" in lower:
        return "cycling"
    if "str" in lower or "strength" in lower:
        return "strength_training"
    return None


def parse_json_datetime(value):
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    parsed = dt.datetime.fromisoformat(text)
    if parsed.tzinfo is not None:
        return parsed.astimezone(dt.timezone.utc).replace(tzinfo=None)
    return parsed


def local_to_utc(value):
    parsed = parse_json_datetime(value)
    if parsed is None:
        return None
    return parsed - dt.timedelta(hours=8)


def json_activity_type(summary):
    activity_type = summary.get("activityTypeDTO")
    if isinstance(activity_type, dict):
        type_key = activity_type.get("typeKey")
        if type_key:
            return str(type_key)
    sport_type = summary.get("sportType")
    if sport_type:
        return str(sport_type)
    sport = summary.get("sport")
    if sport == 1:
        return "running"
    if sport == 2:
        return "cycling"
    if sport == 10:
        return "strength_training"
    return None


def normalized_activity_type(value):
    if not value:
        return None
    text = str(value)
    if "running" in text:
        return "running"
    if "cycling" in text or "biking" in text:
        return "cycling"
    if "strength" in text:
        return "strength_training"
    return text


def normalize_garmin_json(data):
    summary = data.get("summaryDTO") if isinstance(data.get("summaryDTO"), dict) else {}
    metadata = data.get("metadataDTO") if isinstance(data.get("metadataDTO"), dict) else {}
    activity_type = data.get("activityTypeDTO") if isinstance(data.get("activityTypeDTO"), dict) else {}
    normalized = dict(data)

    def first_not_none(*values):
        for value in values:
            if value is not None:
                return value
        return None

    aliases = {
        "id": data.get("id") or data.get("activityId"),
        "name": data.get("name") or data.get("activityName"),
        "sportType": data.get("sportType") or activity_type.get("typeKey"),
        "sport": data.get("sport") or activity_type.get("parentTypeId"),
        "subSport": data.get("subSport") or activity_type.get("typeId"),
        "startTimeLocal": data.get("startTimeLocal") or summary.get("startTimeLocal"),
        "startTimeGMT": data.get("startTimeGMT") or summary.get("startTimeGMT"),
        "duration": data.get("duration") or summary.get("duration"),
        "movingDuration": data.get("movingDuration") or summary.get("movingDuration"),
        "elapsedDuration": data.get("elapsedDuration") or summary.get("elapsedDuration"),
        "distance": data.get("distance") or summary.get("distance"),
        "calories": data.get("calories") or summary.get("calories"),
        "avgSpeed": data.get("avgSpeed") or summary.get("averageSpeed"),
        "maxSpeed": data.get("maxSpeed") or summary.get("maxSpeed"),
        "avgHeartRate": data.get("avgHeartRate") or summary.get("averageHR"),
        "maxHeartRate": data.get("maxHeartRate") or summary.get("maxHR"),
        "avgCadenceSpm": data.get("avgCadenceSpm") or summary.get("averageRunCadence"),
        "maxCadenceSpm": data.get("maxCadenceSpm") or summary.get("maxRunCadence"),
        "activityTrainingLoad": first_not_none(data.get("activityTrainingLoad"), summary.get("activityTrainingLoad")),
        "anaerobicTrainingEffect": first_not_none(data.get("anaerobicTrainingEffect"), summary.get("anaerobicTrainingEffect")),
        "trainingEffectLabel": first_not_none(data.get("trainingEffectLabel"), summary.get("trainingEffectLabel")),
        "differenceBodyBattery": first_not_none(data.get("differenceBodyBattery"), summary.get("differenceBodyBattery")),
        "vO2MaxValue": first_not_none(data.get("vO2MaxValue"), summary.get("vO2MaxValue")),
        "avgStrideLength": data.get("avgStrideLength") or summary.get("strideLength"),
        "elevationGain": data.get("elevationGain") or summary.get("elevationGain"),
        "elevationLoss": data.get("elevationLoss") or summary.get("elevationLoss"),
        "minElevation": data.get("minElevation") or summary.get("minElevation"),
        "maxElevation": data.get("maxElevation") or summary.get("maxElevation"),
        "startLatitude": data.get("startLatitude") or summary.get("startLatitude"),
        "startLongitude": data.get("startLongitude") or summary.get("startLongitude"),
        "endLatitude": data.get("endLatitude") or summary.get("endLatitude"),
        "endLongitude": data.get("endLongitude") or summary.get("endLongitude"),
        "manufacturer": data.get("manufacturer") or metadata.get("manufacturer"),
    }
    for key, value in aliases.items():
        if value is not None:
            normalized[key] = value
    return normalized


def read_garmin_json(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    start = text.find("{")
    if start < 0:
        raise ValueError(f"{path} does not contain JSON")
    data = normalize_garmin_json(json.loads(text[start:]))
    start_utc = parse_json_datetime(data.get("startTimeGMT") or data.get("createdAt") or data.get("updatedAt"))
    if start_utc is None:
        start_utc = local_to_utc(data.get("startTimeLocal"))
    return {
        "path": path,
        "hash": hashlib.sha256(path.read_bytes()).hexdigest(),
        "data": data,
        "garmin_id": str(data.get("id") or garmin_id_from_name(path)) if (data.get("id") or garmin_id_from_name(path)) is not None else None,
        "activity_type": normalized_activity_type(json_activity_type(data)),
        "start_utc": start_utc,
        "local_start": parse_json_datetime(data.get("startTimeLocal")),
        "distance_m": get_num(data, "distance"),
        "duration_s": get_num(data, "duration"),
    }


def compatible_activity_types(left, right):
    if not left or not right:
        return True
    return normalized_activity_type(left) == normalized_activity_type(right)


def fit_primary_session(item):
    return item["sessions"][0]["values"] if item["sessions"] else {}


def fit_match_score(fit_item, json_item):
    fit_activity = fit_item["activity"]
    fit_start = fit_activity.get("start")
    json_start = json_item.get("start_utc")
    if fit_start is None or json_start is None:
        return None
    if not compatible_activity_types(fit_activity.get("type"), json_item.get("activity_type")):
        return None
    session = fit_primary_session(fit_item)
    score = abs((fit_start - json_start).total_seconds())
    fit_distance = get_num(session, "total_distance")
    json_distance = json_item.get("distance_m")
    if fit_distance is not None and json_distance is not None:
        score += abs(fit_distance - json_distance) / 10
    fit_duration = get_num(session, "total_timer_time")
    json_duration = json_item.get("duration_s")
    if fit_duration is not None and json_duration is not None:
        score += abs(fit_duration - json_duration)
    return score


def merge_activities(fit_items, json_items):
    unmatched_json = list(json_items)
    merged = []
    for fit_item in fit_items:
        fit_garmin_id = fit_item.get("garmin_id")
        if fit_garmin_id:
            json_item = next((item for item in unmatched_json if item.get("garmin_id") == fit_garmin_id), None)
            if json_item:
                unmatched_json.remove(json_item)
                merged.append({"fit": fit_item, "json": json_item, "match_score": 0})
                continue
        candidates = []
        for json_item in unmatched_json:
            score = fit_match_score(fit_item, json_item)
            if score is not None:
                time_delta = abs((fit_item["activity"]["start"] - json_item["start_utc"]).total_seconds())
                if time_delta <= 180:
                    candidates.append((score, json_item))
        if candidates:
            candidates.sort(key=lambda item: item[0])
            score, json_item = candidates[0]
            unmatched_json.remove(json_item)
            merged.append({"fit": fit_item, "json": json_item, "match_score": score})
        else:
            merged.append({"fit": fit_item, "json": None, "match_score": None})
    for json_item in unmatched_json:
        merged.append({"fit": None, "json": json_item, "match_score": None})
    return merged


def raw_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def emit_insert_values(lines, table, columns, rows, batch_size=200):
    for idx in range(0, len(rows), batch_size):
        batch = rows[idx:idx + batch_size]
        if not batch:
            continue
        lines.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES")
        lines.append(",\n".join("(" + ", ".join(row) + ")" for row in batch) + ";")


def maybe_raw_json(obj, include_raw_json):
    return sql_string(raw_json(obj)) if include_raw_json else "NULL"


def source_file_sql(path, source_type):
    return (
        "INSERT INTO SourceFiles (source_type, file_name, file_path, file_size_bytes, file_hash) VALUES ("
        + ", ".join([
            sql_string(source_type),
            sql_string(path.name),
            sql_string(str(path)),
            sql_int(path.stat().st_size),
            sql_string(hashlib.sha256(path.read_bytes()).hexdigest()),
        ])
        + ") ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);"
    )


def canonical_activity(row):
    fit_item = row.get("fit")
    json_item = row.get("json")
    j = json_item["data"] if json_item else {}
    fit_activity = fit_item["activity"] if fit_item else {}
    garmin_id = json_item.get("garmin_id") if json_item else None
    start_utc = json_item.get("start_utc") if json_item else fit_activity.get("start")
    local_start = json_item.get("local_start") if json_item else None
    activity_type = json_item.get("activity_type") if json_item else fit_activity.get("type")
    activity_key = f"garmin:{garmin_id}" if garmin_id else f"fit:{fit_activity.get('key')}"
    if fit_item and json_item:
        match_status = "matched_fit_json"
    elif fit_item:
        match_status = "fit_only"
    else:
        match_status = "json_only"
    return {
        "key": activity_key,
        "garmin_id": garmin_id,
        "name": j.get("name") or j.get("activityName"),
        "type": activity_type,
        "sport_code": get_int(j, "sport"),
        "sub_sport_code": get_int(j, "subSport"),
        "start_utc": start_utc,
        "local_start": local_start,
        "location": j.get("locationName"),
        "start_latitude": get_num(j, "startLatitude"),
        "start_longitude": get_num(j, "startLongitude"),
        "end_latitude": get_num(j, "endLatitude"),
        "end_longitude": get_num(j, "endLongitude"),
        "match_status": match_status,
        "raw": {"fit_activity": fit_activity, "json_activity": j} if fit_item and json_item else (j or fit_activity),
    }


def emit_activity_source(lines, path, source_type, source_role, match_score=None, match_note=None):
    lines.append(source_file_sql(path, source_type))
    lines.append("SET @source_file_id = LAST_INSERT_ID();")
    lines.append(
        "INSERT INTO ActivitySourceFiles (activity_id, source_file_id, source_role, match_score, match_note) VALUES ("
        + ", ".join([
            "@activity_id",
            "@source_file_id",
            sql_string(source_role),
            sql_number(match_score),
            sql_string(match_note),
        ])
        + ");"
    )


def emit_fit_rows(lines, item, include_fit_messages=False, include_raw_json=False):
    session_rows = []
    for message in item["sessions"]:
        v = message["values"]
        session_rows.append([
            "@activity_id",
            sql_datetime(as_dt(v.get("start_time"))),
            sql_number(get_num(v, "total_elapsed_time")),
            sql_number(get_num(v, "total_timer_time")),
            sql_number(get_num(v, "total_moving_time")),
            sql_number(get_num(v, "total_distance")),
            sql_int(get_int(v, "total_calories")),
            sql_number(get_num(v, "enhanced_avg_speed", "avg_speed")),
            sql_number(get_num(v, "enhanced_max_speed", "max_speed")),
            sql_int(get_int(v, "avg_heart_rate")),
            sql_int(get_int(v, "max_heart_rate")),
            sql_number(get_num(v, "avg_cadence")),
            sql_number(get_num(v, "max_cadence")),
            sql_int(get_int(v, "avg_power")),
            sql_int(get_int(v, "max_power")),
            sql_int(get_int(v, "normalized_power")),
            sql_int(get_int(v, "total_ascent")),
            sql_int(get_int(v, "total_descent")),
            maybe_raw_json(v, include_raw_json),
        ])
    emit_insert_values(lines, "Sessions", [
        "activity_id", "start_time_utc", "total_elapsed_time_s", "total_timer_time_s",
        "total_moving_time_s", "total_distance_m", "total_calories", "avg_speed_mps",
        "max_speed_mps", "avg_heart_rate_bpm", "max_heart_rate_bpm", "avg_cadence",
        "max_cadence", "avg_power_w", "max_power_w", "normalized_power_w",
        "total_ascent_m", "total_descent_m", "raw_json",
    ], session_rows, 50)

    lap_rows = []
    for idx, message in enumerate(item["laps"]):
        v = message["values"]
        lap_rows.append([
            "@activity_id", sql_int(idx), sql_datetime(as_dt(v.get("start_time"))),
            sql_number(get_num(v, "total_elapsed_time")),
            sql_number(get_num(v, "total_timer_time")),
            sql_number(get_num(v, "total_distance")),
            sql_number(get_num(v, "enhanced_avg_speed", "avg_speed")),
            sql_number(get_num(v, "enhanced_max_speed", "max_speed")),
            sql_int(get_int(v, "avg_heart_rate")),
            sql_int(get_int(v, "max_heart_rate")),
            sql_number(get_num(v, "avg_cadence")),
            sql_number(get_num(v, "max_cadence")),
            sql_int(get_int(v, "avg_power")),
            sql_int(get_int(v, "max_power")),
            maybe_raw_json(v, include_raw_json),
        ])
    emit_insert_values(lines, "Laps", [
        "activity_id", "lap_index", "start_time_utc", "total_elapsed_time_s", "total_timer_time_s",
        "total_distance_m", "avg_speed_mps", "max_speed_mps", "avg_heart_rate_bpm",
        "max_heart_rate_bpm", "avg_cadence", "max_cadence", "avg_power_w", "max_power_w", "raw_json",
    ], lap_rows, 100)

    record_rows = []
    for idx, message in enumerate(item["records"]):
        v = message["values"]
        record_rows.append([
            "@activity_id", sql_int(idx), sql_datetime(as_dt(v.get("timestamp"))),
            sql_number(get_num(v, "position_lat")),
            sql_number(get_num(v, "position_long")),
            sql_number(get_num(v, "enhanced_altitude", "altitude")),
            sql_number(get_num(v, "distance")),
            sql_number(get_num(v, "enhanced_speed", "speed")),
            sql_int(get_int(v, "heart_rate")),
            sql_number(get_cadence(v)),
            sql_int(get_int(v, "power")),
            sql_int(get_int(v, "accumulated_power")),
            sql_number(get_num(v, "vertical_oscillation")),
            sql_number(get_num(v, "stance_time")),
            maybe_raw_json(v, include_raw_json),
        ])
    emit_insert_values(lines, "TrackPoints", [
        "activity_id", "sample_index", "sample_time_utc", "latitude", "longitude", "altitude_m",
        "distance_m", "speed_mps", "heart_rate_bpm", "cadence", "power_w", "accumulated_power_w",
        "vertical_oscillation_mm", "stance_time_ms", "raw_json",
    ], record_rows, 200)

    event_rows = []
    for idx, message in enumerate(item["events"]):
        v = message["values"]
        event_rows.append([
            "@activity_id", sql_int(idx), sql_datetime(as_dt(v.get("timestamp"))),
            sql_string(v.get("event_type")),
            sql_string(v.get("event")),
            sql_int(get_int(v, "event_group")),
            maybe_raw_json(v, include_raw_json),
        ])
    emit_insert_values(lines, "Events", [
        "activity_id", "event_index", "event_time_utc", "event_type", "event", "event_group", "raw_json",
    ], event_rows, 100)

    if include_fit_messages:
        msg_rows = []
        for message in item["messages"]:
            v = message["values"]
            msg_rows.append([
                "@activity_id",
                sql_int(message["message_index"]),
                sql_int(message["global_num"]),
                sql_string(message["message_name"]),
                sql_int(message["local_num"]),
                sql_datetime(as_dt(v.get("timestamp") or v.get("start_time"))),
                sql_string(raw_json(v)),
            ])
        emit_insert_values(lines, "FitMessages", [
            "activity_id", "message_index", "global_message_num", "message_name",
            "local_message_num", "message_time_utc", "raw_json",
        ], msg_rows, 200)


def zone_duration(value):
    if isinstance(value, (int, float)):
        return value
    if not isinstance(value, dict):
        return None
    for key in (
        "duration",
        "durationInSeconds",
        "seconds",
        "timeInZone",
        "timeInZoneSeconds",
        "secsInZone",
        "value",
    ):
        item = value.get(key)
        if isinstance(item, (int, float)):
            return item
    return None


def collect_zone_values(payload):
    if isinstance(payload, list):
        durations = [zone_duration(item) for item in payload]
        durations = [item for item in durations if item is not None]
        if durations:
            return durations
        for item in payload:
            nested = collect_zone_values(item)
            if nested:
                return nested
    if isinstance(payload, dict) and "_error" not in payload:
        zone_keys = sorted(
            [key for key in payload if re.search(r"zone", str(key), re.IGNORECASE)],
            key=lambda item: str(item),
        )
        durations = [zone_duration(payload[key]) for key in zone_keys]
        durations = [item for item in durations if item is not None]
        if durations:
            return durations
        for value in payload.values():
            nested = collect_zone_values(value)
            if nested:
                return nested
    return []


def append_zone_rows(zone_rows, activity_id, zone_type, values, source_field):
    for idx, value in enumerate(values):
        if isinstance(value, (int, float)) and value:
            zone_rows.append([
                activity_id,
                sql_string(zone_type),
                sql_int(idx),
                sql_number(value),
                sql_string(source_field),
            ])


def emit_json_summary_rows(lines, item):
    j = item["data"]
    lines.append(
        "INSERT INTO ActivitySummaries ("
        "activity_id, garmin_activity_id, duration_s, moving_duration_s, elapsed_duration_s, "
        "distance_m, calories, avg_speed_mps, max_speed_mps, avg_heart_rate_bpm, max_heart_rate_bpm, "
        "avg_cadence_spm, max_cadence_spm, avg_power_w, max_power_w, normalized_power_w, "
        "intensity_factor, training_stress_score, max_20min_power_w, aerobic_training_effect, "
        "anaerobic_training_effect, training_effect_label, activity_training_load, vo2max, "
        "body_battery_delta, water_estimated_ml, moderate_intensity_minutes, vigorous_intensity_minutes, "
        "avg_stride_length_cm, avg_vertical_oscillation_cm, avg_ground_contact_time_ms, avg_vertical_ratio, "
        "avg_respiration_rate, max_respiration_rate, min_respiration_rate, elevation_gain_m, elevation_loss_m, "
        "min_elevation_m, max_elevation_m, original_file_url, manufacturer, raw_json"
        ") VALUES ("
        + ", ".join([
            "@activity_id",
            sql_string(item.get("garmin_id")),
            sql_number(get_num(j, "duration")),
            sql_number(get_num(j, "movingDuration")),
            sql_number(get_num(j, "elapsedDuration")),
            sql_number(get_num(j, "distance")),
            sql_number(get_num(j, "calories")),
            sql_number(get_num(j, "avgSpeed")),
            sql_number(get_num(j, "maxSpeed")),
            sql_int(get_int(j, "avgHeartRate")),
            sql_int(get_int(j, "maxHeartRate")),
            sql_number(get_num(j, "avgCadenceSpm")),
            sql_number(get_num(j, "maxCadenceSpm")),
            sql_int(get_int(j, "avgPower")),
            sql_int(get_int(j, "maxPower")),
            sql_int(get_int(j, "normPower")),
            sql_number(get_num(j, "intensityFactor")),
            sql_number(get_num(j, "trainingStressScore")),
            sql_int(get_int(j, "max20MinPower")),
            sql_number(get_num(j, "aerobicTrainingEffect")),
            sql_number(get_num(j, "anaerobicTrainingEffect")),
            sql_string(j.get("trainingEffectLabel")),
            sql_number(first_num(
                get_num(j, "activityTrainingLoad"),
                get_nested_num(j, "summaryDTO", "activityTrainingLoad"),
            )),
            sql_number(get_num(j, "vO2MaxValue")),
            sql_int(get_int(j, "differenceBodyBattery")),
            sql_number(get_num(j, "waterEstimated")),
            sql_int(get_int(j, "moderateIntensityMinutes")),
            sql_int(get_int(j, "vigorousIntensityMinutes")),
            sql_number(get_num(j, "avgStrideLength")),
            sql_number(get_num(j, "avgVerticalOscillation")),
            sql_number(get_num(j, "avgGroundContactTime")),
            sql_number(get_num(j, "avgVerticalRatio")),
            sql_number(get_num(j, "avgRespirationRate")),
            sql_number(get_num(j, "maxRespirationRate")),
            sql_number(get_num(j, "minRespirationRate")),
            sql_number(get_num(j, "elevationGain")),
            sql_number(get_num(j, "elevationLoss")),
            sql_number(get_num(j, "minElevation")),
            sql_number(get_num(j, "maxElevation")),
            sql_string(j.get("originalFileUrl")),
            sql_string(j.get("manufacturer")),
            sql_json(j),
        ])
        + ");"
    )

    zone_rows = []
    append_zone_rows(zone_rows, "@activity_id", "heart_rate", j.get("hrZone") or [], "hrZone")
    append_zone_rows(zone_rows, "@activity_id", "power", j.get("powerZone") or [], "powerZone")
    extras = j.get("_garminConnectExtras") if isinstance(j.get("_garminConnectExtras"), dict) else {}
    if not j.get("hrZone"):
        append_zone_rows(
            zone_rows,
            "@activity_id",
            "heart_rate",
            collect_zone_values(extras.get("hrTimeInZones")),
            "_garminConnectExtras.hrTimeInZones",
        )
    if not j.get("powerZone"):
        append_zone_rows(
            zone_rows,
            "@activity_id",
            "power",
            collect_zone_values(extras.get("powerTimeInZones")),
            "_garminConnectExtras.powerTimeInZones",
        )
    emit_insert_values(lines, "ActivityZones", [
        "activity_id", "zone_type", "zone_index", "duration_s", "source_field",
    ], zone_rows, 100)


def build_sql(activities, include_fit_messages=False, include_raw_json=False):
    lines = [
        "USE MotionAnalysis;",
        "SET FOREIGN_KEY_CHECKS = 1;",
    ]
    for row in activities:
        fit_item = row.get("fit")
        json_item = row.get("json")
        activity = canonical_activity(row)
        label = activity["key"]
        lines.extend([
            f"SELECT 'Importing activity {label}' AS status;",
            "START TRANSACTION;",
            "SET @source_file_id = NULL;",
            "SET @activity_id = NULL;",
        ])
        lines.append(
            "INSERT INTO Activities (activity_key, garmin_activity_id, activity_name, activity_type, sport_code, "
            "sub_sport_code, start_time_utc, local_start_time, location_name, start_latitude, start_longitude, "
            "end_latitude, end_longitude, match_status, raw_json) VALUES ("
            + ", ".join([
                sql_string(activity["key"]),
                sql_string(activity["garmin_id"]),
                sql_string(activity["name"]),
                sql_string(activity["type"]),
                sql_int(activity["sport_code"]),
                sql_int(activity["sub_sport_code"]),
                sql_datetime(activity["start_utc"]),
                sql_datetime(activity["local_start"]),
                sql_string(activity["location"]),
                sql_number(activity["start_latitude"]),
                sql_number(activity["start_longitude"]),
                sql_number(activity["end_latitude"]),
                sql_number(activity["end_longitude"]),
                sql_string(activity["match_status"]),
                maybe_raw_json(activity["raw"], include_raw_json),
            ])
            + ");"
        )
        lines.append("SET @activity_id = LAST_INSERT_ID();")
        if fit_item:
            emit_activity_source(lines, fit_item["path"], "fit", "fit", row.get("match_score"), "matched by start time, type, distance and duration" if json_item else "fit only")
            emit_fit_rows(lines, fit_item, include_fit_messages, include_raw_json)
        if json_item:
            emit_activity_source(lines, json_item["path"], "garmin_json_txt", "garmin_json", row.get("match_score"), "matched by content; file name ignored" if fit_item else "json only")
            emit_json_summary_rows(lines, json_item)
        lines.extend(["COMMIT;"])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fit-dir", default="database/data/fit")
    parser.add_argument("--json-dir", default="database/data/json")
    parser.add_argument("--out", default="database/sql/02_import_data.sql")
    parser.add_argument("--no-json", action="store_true", help="Only import FIT files.")
    parser.add_argument(
        "--include-fit-messages",
        action="store_true",
        help="Store every parsed FIT message as raw JSON. Useful for debugging, but much slower and larger.",
    )
    parser.add_argument(
        "--include-raw-json",
        action="store_true",
        help="Store raw JSON beside structured rows. Useful for traceability, but increases database size.",
    )
    args = parser.parse_args()

    fit_dir = Path(args.fit_dir)
    fit_files = sorted(fit_dir.glob("*.fit"))
    if not fit_files:
        raise SystemExit(f"No FIT files found in {fit_dir}")
    parsed_fit = [rows_for_file(path) for path in fit_files]
    parsed_json = []
    if not args.no_json:
        json_dir = Path(args.json_dir)
        parsed_json = [
            read_garmin_json(path)
            for pattern in ("*.txt", "*.json")
            for path in sorted(json_dir.glob(pattern))
        ]
    activities = merge_activities(parsed_fit, parsed_json)
    Path(args.out).write_text(
        build_sql(
            activities,
            include_fit_messages=args.include_fit_messages,
            include_raw_json=args.include_raw_json,
        ),
        encoding="utf-8",
    )
    for item in parsed_fit:
        print(
            f"{item['path'].name}: "
            f"sessions={len(item['sessions'])}, laps={len(item['laps'])}, "
            f"records={len(item['records'])}, events={len(item['events'])}, "
            f"messages={len(item['messages'])}"
        )
    print(f"JSON summaries={len(parsed_json)}, merged activities={len(activities)}")
    for row in activities:
        activity = canonical_activity(row)
        fit_name = row["fit"]["path"].name if row.get("fit") else "-"
        json_name = row["json"]["path"].name if row.get("json") else "-"
        score = row.get("match_score")
        score_text = "none" if score is None else f"{score:.3f}"
        print(f"{activity['match_status']}: {activity['key']} fit={fit_name} json={json_name} score={score_text}")
    mode = "debug/full" if args.include_fit_messages or args.include_raw_json else "lean/structured"
    print(f"Wrote {args.out} ({mode} mode)")


if __name__ == "__main__":
    main()
