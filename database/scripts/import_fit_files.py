from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
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
    0x10: (8, "Q", 0xFFFFFFFFFFFFFFFF),
    0x11: (8, "Q", 0xFFFFFFFFFFFFFFFF),
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
        34: "total_moving_time", 124: "enhanced_avg_speed", 125: "enhanced_max_speed",
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


def convert_value(global_num, field_num, value):
    if value is None:
        return None
    if isinstance(value, list):
        return [convert_value(global_num, field_num, item) for item in value]
    if field_num in (253, 2, 4) and global_num in (0, 18, 19, 20, 21, 34):
        return iso(fit_time(value))
    if global_num == 20 and field_num in (0, 1):
        return value * 180 / (2 ** 31)
    if field_num in (5, 9) and global_num in (18, 19, 20):
        return value / 100
    if field_num in (6, 14, 15, 73, 110, 111, 124, 125) and global_num in (18, 19, 20):
        return value / 1000
    if field_num in (2, 78) and global_num == 20:
        return value / 5 - 500
    if field_num in (7, 8, 34) and global_num in (18, 19):
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


def get_int(values, *names):
    value = get_num(values, *names)
    return None if value is None else int(value)


def get_text(values, name):
    value = values.get(name)
    if value is None:
        return None
    return str(value)


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


def build_sql(files, include_fit_messages=False, include_raw_json=False):
    lines = [
        "USE MotionAnalysis;",
        "SET FOREIGN_KEY_CHECKS = 1;",
    ]
    for item in files:
        path = item["path"]
        sf_hash = item["hash"]
        size = path.stat().st_size
        lines.extend([
            f"SELECT 'Importing {path.name}' AS status;",
            "START TRANSACTION;",
            f"SET @old_source_file_id = (SELECT id FROM SourceFiles WHERE file_hash = '{sf_hash}' LIMIT 1);",
            "DELETE FROM SourceFiles WHERE id = @old_source_file_id;",
            "SET @source_file_id = NULL;",
            "SET @activity_id = NULL;",
            "INSERT INTO SourceFiles (file_name, file_path, file_size_bytes, file_hash) VALUES ("
            + ", ".join([sql_string(path.name), sql_string(str(path)), sql_int(size), sql_string(sf_hash)])
            + ");",
            "SET @source_file_id = LAST_INSERT_ID();",
        ])
        activity = item["activity"]
        lines.append(
            "INSERT INTO Activities (source_file_id, activity_key, activity_type, start_time_utc, raw_json) VALUES ("
            + ", ".join([
                "@source_file_id",
                sql_string(activity["key"]),
                sql_string(activity["type"]),
                sql_datetime(activity["start"]),
                maybe_raw_json(activity["raw"], include_raw_json),
            ])
            + ");"
        )
        lines.append("SET @activity_id = LAST_INSERT_ID();")

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
                sql_int(get_int(v, "total_ascent")),
                sql_int(get_int(v, "total_descent")),
                maybe_raw_json(v, include_raw_json),
            ])
        emit_insert_values(lines, "Sessions", [
            "activity_id", "start_time_utc", "total_elapsed_time_s", "total_timer_time_s",
            "total_moving_time_s", "total_distance_m", "total_calories", "avg_speed_mps",
            "max_speed_mps", "avg_heart_rate_bpm", "max_heart_rate_bpm", "avg_cadence",
            "max_cadence", "avg_power_w", "max_power_w", "total_ascent_m", "total_descent_m", "raw_json",
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
                sql_number(get_num(v, "cadence")),
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

        lines.extend(["COMMIT;"])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fit-dir", default="database/data/fit")
    parser.add_argument("--out", default="database/sql/02_import_data.sql")
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
    files = sorted(fit_dir.glob("*.fit"))
    if not files:
        raise SystemExit(f"No FIT files found in {fit_dir}")
    parsed = [rows_for_file(path) for path in files]
    Path(args.out).write_text(
        build_sql(
            parsed,
            include_fit_messages=args.include_fit_messages,
            include_raw_json=args.include_raw_json,
        ),
        encoding="utf-8",
    )
    for item in parsed:
        print(
            f"{item['path'].name}: "
            f"sessions={len(item['sessions'])}, laps={len(item['laps'])}, "
            f"records={len(item['records'])}, events={len(item['events'])}, "
            f"messages={len(item['messages'])}"
        )
    mode = "debug/full" if args.include_fit_messages or args.include_raw_json else "lean/structured"
    print(f"Wrote {args.out} ({mode} mode)")


if __name__ == "__main__":
    main()
