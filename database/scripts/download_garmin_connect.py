from __future__ import annotations

import argparse
import getpass
import json
import os
import time
import re
import zipfile
from datetime import datetime
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from typing import Any

from garminconnect import Garmin
from garminconnect.exceptions import GarminConnectAuthenticationError


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "garmin_downloads"
DEFAULT_TOKEN_DIR = Path(__file__).resolve().parents[1] / ".garmin_tokens"


def safe_name(value: str | None) -> str:
    text = value or "activity"
    text = re.sub(r"[^\w.-]+", "_", text, flags=re.UNICODE).strip("_")
    return text or "activity"


def get_activity_id(activity: dict[str, Any]) -> str | None:
    for key in ("activityId", "activity_id", "id"):
        value = activity.get(key)
        if value is not None:
            return str(value)
    return None


def activity_start(activity: dict[str, Any]) -> str:
    value = (
        activity.get("startTimeLocal")
        or activity.get("startTimeGMT")
        or activity.get("beginTimestamp")
        or activity.get("createdAt")
    )
    if not value:
        return "unknown_time"
    value = str(value).replace("T", "_").replace("Z", "")
    return re.sub(r"[:\s]+", "", value)[:17]


def activity_type(activity: dict[str, Any]) -> str:
    value = activity.get("activityType")
    if isinstance(value, dict):
        return safe_name(value.get("typeKey") or value.get("typeId"))
    return safe_name(str(value)) if value else "activity"


def output_stem(activity: dict[str, Any], activity_id: str) -> str:
    return f"{activity_start(activity)}_{activity_type(activity)}_{activity_id}"


def dump_json(path: Path, payload: Any, force: bool) -> bool:
    if path.exists() and not force:
        return False
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return True


def load_id_file(path: Path | None) -> set[str]:
    if path is None:
        return set()
    if not path.exists():
        return set()
    text = path.read_text(encoding="utf-8-sig").strip()
    if not text:
        return set()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = [line.strip() for line in text.splitlines()]
    if not isinstance(payload, list):
        raise SystemExit("--skip-activity-ids-file must contain a JSON array or one id per line")
    return {str(item).strip() for item in payload if str(item).strip()}


def fetch_optional(label: str, func):
    try:
        return func()
    except Exception as exc:
        return {"_error": str(exc)}


EXTRA_FETCHERS = {
    "details": lambda client, activity_id: client.get_activity_details(activity_id),
    "hr-zones": lambda client, activity_id: client.get_activity_hr_in_timezones(activity_id),
    "power-zones": lambda client, activity_id: client.get_activity_power_in_timezones(activity_id),
    "split-summaries": lambda client, activity_id: client.get_activity_split_summaries(activity_id),
    "splits": lambda client, activity_id: client.get_activity_splits(activity_id),
    "typed-splits": lambda client, activity_id: client.get_activity_typed_splits(activity_id),
    "weather": lambda client, activity_id: client.get_activity_weather(activity_id),
    "gear": lambda client, activity_id: client.get_activity_gear(activity_id),
    "exercise-sets": lambda client, activity_id: client.get_activity_exercise_sets(activity_id),
}

EXTRA_JSON_KEYS = {
    "details": "details",
    "hr-zones": "hrTimeInZones",
    "power-zones": "powerTimeInZones",
    "split-summaries": "splitSummaries",
    "splits": "splits",
    "typed-splits": "typedSplits",
    "weather": "weather",
    "gear": "gear",
    "exercise-sets": "exerciseSets",
}


def parse_extras(value: str) -> list[str]:
    if value == "all":
        return list(EXTRA_FETCHERS)
    items = [item.strip() for item in value.split(",") if item.strip()]
    unknown = [item for item in items if item not in EXTRA_FETCHERS]
    if unknown:
        raise SystemExit(f"Unknown --extras value(s): {', '.join(unknown)}")
    return items


def fetch_activity_json(
    client: Garmin,
    activity_id: str,
    json_mode: str,
    extras: list[str],
    retries: int,
    wait_seconds: float,
    extra_sleep_seconds: float,
) -> dict[str, Any]:
    summary = garmin_call(
        f"JSON summary for {activity_id}",
        retries,
        wait_seconds,
        lambda: client.get_activity(activity_id),
    )
    if json_mode == "summary":
        return summary

    enriched = dict(summary)
    enriched["_downloadMode"] = "enriched"
    enriched["_garminConnectExtras"] = {}
    for extra in extras:
        json_key = EXTRA_JSON_KEYS[extra]
        enriched["_garminConnectExtras"][json_key] = garmin_call(
            f"{json_key} JSON for {activity_id}",
            retries,
            wait_seconds,
            lambda extra=extra: fetch_optional(
                extra,
                lambda: EXTRA_FETCHERS[extra](client, activity_id),
            ),
        )
        if extra_sleep_seconds > 0:
            time.sleep(extra_sleep_seconds)
    return enriched


def extract_fit(original_bytes: bytes) -> bytes:
    if original_bytes[:4] == b".FIT" or original_bytes[8:12] == b".FIT":
        return original_bytes
    with zipfile.ZipFile(BytesIO(original_bytes)) as archive:
        fit_names = [name for name in archive.namelist() if name.lower().endswith(".fit")]
        if not fit_names:
            raise ValueError("original download did not contain a .fit file")
        return archive.read(fit_names[0])


def garmin_call(label: str, retries: int, wait_seconds: float, func):
    for attempt in range(retries + 1):
        try:
            return func()
        except Exception as exc:
            message = str(exc)
            is_rate_limited = "429" in message or "rate limit" in message.lower()
            if not is_rate_limited or attempt >= retries:
                raise
            delay = max(wait_seconds, 1.0) * (attempt + 1) * 5
            print(f"{label} was rate-limited by Garmin. Waiting {delay:.0f}s before retry...")
            time.sleep(delay)


def login(token_dir: Path, is_cn: bool) -> Garmin:
    token_dir.mkdir(parents=True, exist_ok=True)
    if any(token_dir.iterdir()):
        client = Garmin(is_cn=is_cn)
        try:
            client.login(str(token_dir))
            return client
        except Exception as exc:
            print(f"Cached Garmin token could not be used: {exc}")

    non_interactive = os.getenv("GARMIN_NON_INTERACTIVE") == "1"
    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    if non_interactive and (not email or not password):
        raise SystemExit("Garmin credentials are required when cached tokens cannot be used.")
    email = email or input("Garmin email: ").strip()
    password = password or getpass.getpass("Garmin password: ")
    mfa_code = os.getenv("GARMIN_MFA_CODE")
    if non_interactive and mfa_code is None:
        prompt_mfa = lambda: (_ for _ in ()).throw(SystemExit("Garmin MFA code is required."))
    else:
        prompt_mfa = lambda: mfa_code or input("Garmin MFA code: ").strip()
    client = Garmin(
        email=email,
        password=password,
        is_cn=is_cn,
        prompt_mfa=prompt_mfa,
    )
    try:
        client.login(str(token_dir))
    except GarminConnectAuthenticationError as exc:
        message = str(exc)
        print("\nGarmin login failed.")
        if "429" in message or "rate limited" in message.lower():
            print("Garmin is rate-limiting this IP. Stop retrying for now and try again later.")
        if "401" in message or "Invalid Username or Password" in message:
            print("Garmin also reported invalid username/password. Check the account, password, and whether you need --cn.")
        print(f"Original error: {message}")
        raise SystemExit(2) from exc
    return client


def fetch_activities(
    client: Garmin,
    limit: int,
    batch_size: int,
    activity_type_filter: str | None,
) -> list[dict[str, Any]]:
    activities: list[dict[str, Any]] = []
    start = 0
    while len(activities) < limit:
        page_size = min(batch_size, limit - len(activities))
        page = client.get_activities(start=start, limit=page_size, activitytype=activity_type_filter)
        if not page:
            break
        if not isinstance(page, list):
            raise TypeError(f"unexpected activities response: {type(page)!r}")
        activities.extend(page)
        if len(page) < page_size:
            break
        start += len(page)
    return activities


def fetch_activities_by_date(
    client: Garmin,
    start_date: str,
    end_date: str,
    activity_type_filter: str | None,
) -> list[dict[str, Any]]:
    return client.get_activities_by_date(start_date, end_date, activitytype=activity_type_filter)


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def fetch_activities_by_date_chunks(
    client: Garmin,
    start_date: str,
    end_date: str,
    activity_type_filter: str | None,
    chunk_days: int,
    chunk_sleep: float,
    retries: int,
) -> list[dict[str, Any]]:
    start = parse_date(start_date)
    end = parse_date(end_date)
    if start > end:
        raise SystemExit("--start-date must be before or equal to --end-date")

    activities: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        chunk_start_text = current.strftime("%Y-%m-%d")
        chunk_end_text = chunk_end.strftime("%Y-%m-%d")
        print(f"Fetching activities from {chunk_start_text} to {chunk_end_text}...")
        page = garmin_call(
            f"Activity list {chunk_start_text}..{chunk_end_text}",
            retries,
            chunk_sleep,
            lambda: fetch_activities_by_date(
                client,
                chunk_start_text,
                chunk_end_text,
                activity_type_filter,
            ),
        )
        for item in page:
            activity_id = get_activity_id(item)
            if activity_id and activity_id in seen_ids:
                continue
            if activity_id:
                seen_ids.add(activity_id)
            activities.append(item)
        current = chunk_end + timedelta(days=1)
        if chunk_sleep > 0 and current <= end:
            time.sleep(chunk_sleep)
    return activities


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Garmin Connect activity JSON and FIT files.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--token-dir", type=Path, default=DEFAULT_TOKEN_DIR)
    parser.add_argument("--limit", type=int, default=100, help="Number of recent activities to scan.")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--start-date", help="YYYY-MM-DD. Use with --end-date to download by date range.")
    parser.add_argument("--end-date", help="YYYY-MM-DD. Defaults to today when --start-date is set.")
    parser.add_argument("--chunk-days", type=int, default=14, help="Date-range chunk size for --start-date downloads.")
    parser.add_argument("--chunk-sleep", type=float, default=10.0, help="Seconds to wait between date chunks.")
    parser.add_argument("--activity-type", help="Optional Garmin activity type filter, e.g. running or cycling.")
    parser.add_argument(
        "--json-mode",
        choices=("summary", "enriched"),
        default="enriched",
        help="summary downloads only get_activity; enriched also downloads details, zones, splits, weather, gear and exercise sets.",
    )
    parser.add_argument(
        "--extras",
        default="all",
        help="Comma-separated enriched extras: details,hr-zones,power-zones,split-summaries,splits,typed-splits,weather,gear,exercise-sets, or all.",
    )
    parser.add_argument("--skip-fit", action="store_true")
    parser.add_argument("--skip-json", action="store_true")
    parser.add_argument("--sleep", type=float, default=1.5, help="Seconds to wait between activities.")
    parser.add_argument("--extra-sleep", type=float, default=0.5, help="Seconds to wait between enriched JSON extra endpoints.")
    parser.add_argument("--retries", type=int, default=2, help="Retries for Garmin 429 rate-limit responses.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing JSON/FIT files.")
    parser.add_argument("--cn", action="store_true", help="Use Garmin China endpoint.")
    parser.add_argument("--login-only", action="store_true", help="Only validate login/token cache, then exit.")
    parser.add_argument("--skip-activity-ids-file", type=Path, help="JSON array or newline file of Garmin activity ids to skip.")
    parser.add_argument("--summary-out", type=Path, help="Write a machine-readable download summary JSON file.")
    args = parser.parse_args()

    if args.limit <= 0:
        raise SystemExit("--limit must be positive")
    if args.batch_size <= 0:
        raise SystemExit("--batch-size must be positive")
    if args.chunk_days <= 0:
        raise SystemExit("--chunk-days must be positive")
    extras = parse_extras(args.extras)

    fit_dir = args.out_dir / "fit"
    json_dir = args.out_dir / "json"
    fit_dir.mkdir(parents=True, exist_ok=True)
    json_dir.mkdir(parents=True, exist_ok=True)

    client = login(args.token_dir, args.cn)
    if args.login_only:
        print("Garmin login ok.")
        if args.summary_out:
            args.summary_out.parent.mkdir(parents=True, exist_ok=True)
            dump_json(args.summary_out, {"login": "ok"}, force=True)
        return

    if args.start_date:
        end_date = args.end_date or datetime.now().strftime("%Y-%m-%d")
        activities = fetch_activities_by_date_chunks(
            client,
            args.start_date,
            end_date,
            args.activity_type,
            args.chunk_days,
            args.chunk_sleep,
            args.retries,
        )
    else:
        activities = fetch_activities(client, args.limit, args.batch_size, args.activity_type)

    print(f"Found {len(activities)} activities.")
    skip_activity_ids = load_id_file(args.skip_activity_ids_file)
    downloaded_json = 0
    downloaded_fit = 0
    skipped = 0
    skipped_known = 0
    downloaded_activity_ids: list[str] = []

    for index, item in enumerate(activities, start=1):
        activity_id = get_activity_id(item)
        if not activity_id:
            print(f"[{index}/{len(activities)}] skipped activity without id")
            skipped += 1
            continue

        if activity_id in skip_activity_ids:
            print(f"[{index}/{len(activities)}] skipped known activity {activity_id}")
            skipped_known += 1
            continue

        stem = output_stem(item, activity_id)
        json_path = json_dir / f"{stem}.json"
        fit_path = fit_dir / f"{stem}.fit"
        print(f"[{index}/{len(activities)}] {activity_id} -> {stem}")

        if not args.skip_json:
            if args.force or not json_path.exists():
                summary = fetch_activity_json(
                    client,
                    activity_id,
                    args.json_mode,
                    extras,
                    args.retries,
                    args.sleep,
                    args.extra_sleep,
                )
                dump_json(json_path, summary, force=True)
                downloaded_json += 1
            else:
                skipped += 1

        if not args.skip_fit:
            if args.force or not fit_path.exists():
                original = garmin_call(
                    f"FIT download for {activity_id}",
                    args.retries,
                    args.sleep,
                    lambda: client.download_activity(activity_id, Garmin.ActivityDownloadFormat.ORIGINAL),
                )
                fit_path.write_bytes(extract_fit(original))
                downloaded_fit += 1
            else:
                skipped += 1

        downloaded_activity_ids.append(activity_id)
        if args.sleep > 0 and index < len(activities):
            time.sleep(args.sleep)

    print(
        f"Done. json={downloaded_json}, fit={downloaded_fit}, skipped_existing_or_missing={skipped}, skipped_known={skipped_known}"
    )
    print(f"JSON dir: {json_dir}")
    print(f"FIT dir: {fit_dir}")
    if args.summary_out:
        args.summary_out.parent.mkdir(parents=True, exist_ok=True)
        dump_json(
            args.summary_out,
            {
                "found": len(activities),
                "downloadedJson": downloaded_json,
                "downloadedFit": downloaded_fit,
                "skippedExistingOrMissing": skipped,
                "skippedKnown": skipped_known,
                "downloadedActivityIds": downloaded_activity_ids,
                "jsonDir": str(json_dir),
                "fitDir": str(fit_dir),
            },
            force=True,
        )


if __name__ == "__main__":
    main()
