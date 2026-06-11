# Garmin Connect batch download

Install dependencies:

```powershell
pip install -r requirements.txt
```

Run the commands below from the `database/` directory unless you intentionally
override paths. All generated Garmin files stay under `database/data/`, which is
ignored by git and should remain local.

Download the latest 100 Garmin Connect activities as JSON summaries and FIT files:

```powershell
python scripts\download_garmin_connect.py --limit 100
```

Download by date range:

```powershell
python scripts\download_garmin_connect.py --start-date 2026-06-01 --end-date 2026-06-08
```

Bulk download a longer range in safer chunks:

```powershell
python scripts\download_garmin_connect.py --start-date 2026-03-01 --end-date 2026-06-08 --cn --chunk-days 7 --chunk-sleep 20 --sleep 3 --retries 3
```

For large backfills, prefer 7 to 14 day chunks and keep `--sleep` at 3 seconds or more.

Download only running activities:

```powershell
python scripts\download_garmin_connect.py --activity-type running --limit 100
```

The default JSON mode is `enriched`, which stores the activity summary plus extra Garmin Connect responses under `_garminConnectExtras`, including details, heart-rate zones, power zones, splits, weather, gear, and exercise sets when Garmin returns them.

For large downloads with less rate-limit pressure, use summary-only JSON:

```powershell
python scripts\download_garmin_connect.py --start-date 2026-03-01 --end-date 2026-06-08 --cn --json-mode summary --chunk-days 7 --chunk-sleep 20 --sleep 3 --retries 3
```

To enrich files that already exist, rerun with `--json-mode enriched --force`.

Files are written to an isolated test-download directory by default:

```text
data/garmin_downloads/json/
data/garmin_downloads/fit/
```

After checking the files, you can copy the wanted `.json` and `.fit` files into `data/json/` and `data/fit/`, or run the downloader with `--out-dir data` when you are ready to write into the normal import folders.

The first run asks for your Garmin email, password, and MFA code if Garmin requires one.
Login tokens are cached in `.garmin_tokens/`, so later runs can reuse the session.
