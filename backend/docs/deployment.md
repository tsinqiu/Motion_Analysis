# Deployment Guide

This guide describes the first production deployment shape:

```text
User browser
  -> http://SERVER_PUBLIC_IP
  -> Nginx :80
       /        -> Vue dist files
       /api/... -> Node Express on 127.0.0.1:8080
                    -> MySQL on 127.0.0.1:3306
```

## Server Layout

Recommended paths:

```text
/var/www/motion-analysis/
  backend/
  frontend/dist/
  database/
```

If the server uses a panel-managed site directory, the equivalent project path
can be:

```text
/www/wwwroot/motion-analysis/
```

The Node API should bind to `127.0.0.1:8080`. Do not expose port `8080` to the public internet.

## Updating From GitHub `dev`

On the cloud server, keep environment files out of Git and pull code from the
remote `dev` branch:

```bash
cd /www/wwwroot/motion-analysis
git status --short
cp backend/.env /root/motion-analysis-backend.env.backup.$(date +%Y%m%d%H%M%S)
cp frontend/.env.production /root/motion-analysis-frontend.env.production.backup.$(date +%Y%m%d%H%M%S) 2>/dev/null || true

git fetch origin
git checkout dev
git reset --hard origin/dev
```

`frontend/.env.production` is commonly untracked on the server. It can stay
untracked; for this Nginx + Express same-origin deployment it should normally
contain:

```text
VITE_API_BASE_URL=/api
VITE_USE_MOCK=false
```

After pulling code:

```bash
cd /www/wwwroot/motion-analysis/backend
npm install
pm2 restart motion-analysis-api --update-env
curl http://127.0.0.1:8080/api/health

cd /www/wwwroot/motion-analysis/frontend
npm install
npm run build

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

Use `npm install` when the deployment host is updating in place and needs to
refresh `package-lock.json` dependencies such as Leaflet. Use `npm ci` only when
the server working tree is clean and the lock file is already the intended one.

## Backend Environment

Copy the production example and fill in real secrets:

```bash
cd /var/www/motion-analysis/backend
cp .env.production.example .env
```

Use these deployment defaults:

```text
HOST=127.0.0.1
PORT=8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=MotionAnalysis
DB_USER=motion_api
CORS_ORIGIN=http://SERVER_PUBLIC_IP
```

Use a long random `JWT_SECRET`. Do not commit `.env`.

## MySQL

Create a dedicated API user instead of using `root`:

```sql
CREATE USER IF NOT EXISTS 'motion_api'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON MotionAnalysis.* TO 'motion_api'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Import the database scripts in this order:

```sql
source database/sql/01_schema.sql;
source database/sql/02_import_data.sql;
source database/sql/04_auth_manual_upload.sql;
source database/sql/05_performance_indexes.sql;
source database/sql/06_extension_modules.sql;
source database/sql/07_profile_follow_explore_uploads.sql;
```

For an existing cloud database, back up MySQL first, then run only the migration
scripts that are missing for that environment. The migration scripts from
`04_auth_manual_upload.sql` through `07_profile_follow_explore_uploads.sql` are
written to be re-runnable; seeing `1` printed by MySQL usually means the guarded
column or index already exists.

Then seed the admin user:

```bash
cd /var/www/motion-analysis/backend
npm run seed:admin
```

Keep MySQL bound to localhost or blocked by firewall. Do not expose port `3306` publicly.

## Garmin Sync

Garmin sync is available through the authenticated sync APIs. It depends on the
Python scripts under `database/scripts/`, so production deployments must either
deploy the repository `database/` directory beside `backend/`, or point the
script paths to another copied location.

Install Python dependencies on the server. Use Python 3.12+; Python 3.12 or
3.13 is recommended. Some older cloud images provide Python 3.6 as `python3`,
which cannot run the Garmin scripts. Python 3.11 also cannot install the
required `garminconnect>=0.3.5` release because that package requires Python
3.12+.

```bash
cd /var/www/motion-analysis
python3.12 -m pip install -r database/requirements.txt
python3.12 database/scripts/download_garmin_connect.py --help
```

Use writable, persistent directories for Garmin tokens and sync work files.
These directories must be writable by the Node/PM2 user:

```bash
sudo mkdir -p /var/lib/motion-analysis/garmin_tokens/users
sudo mkdir -p /var/lib/motion-analysis/garmin_sync
sudo chown -R $USER:$USER /var/lib/motion-analysis
```

Production `.env` values:

```text
GARMIN_PYTHON_PATH=python3.12
GARMIN_DOWNLOAD_SCRIPT=/var/www/motion-analysis/database/scripts/download_garmin_connect.py
GARMIN_IMPORT_SCRIPT=/var/www/motion-analysis/database/scripts/import_fit_files.py
GARMIN_TOKEN_BASE_DIR=/var/lib/motion-analysis/garmin_tokens/users
GARMIN_SYNC_WORK_DIR=/var/lib/motion-analysis/garmin_sync
GARMIN_JSON_MODE=summary
GARMIN_SYNC_TIMEOUT_MS=900000
```

The Garmin password is never stored in MySQL. It is only used during
`POST /api/sync/providers/garmin/authorize` to create Garmin token files under
`GARMIN_TOKEN_BASE_DIR`. The same Garmin account can be bound again on a cloud
deployment because local and cloud databases/token directories are separate.

Avoid running frequent sync jobs for the same Garmin account from both local and
cloud environments at the same time, because Garmin may rate-limit requests.

If dependency installation reports that no matching
`garminconnect>=0.3.5,<0.4.0` distribution exists, first check
`python3 --version`. On Python 3.11 or older, install a newer Python and point
`GARMIN_PYTHON_PATH` to it instead of relaxing the dependency version.

## Node Process

Install production dependencies:

```bash
cd /var/www/motion-analysis/backend
npm ci --omit=dev
```

Install PM2 globally if the server does not already have it:

```bash
npm install -g pm2
```

Start and persist the API process:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Useful commands:

```bash
pm2 status
pm2 logs motion-analysis-api
pm2 restart motion-analysis-api
pm2 stop motion-analysis-api
```

## Frontend Build

For production, the frontend should use:

```text
VITE_API_BASE_URL=/api
```

After the frontend is built, copy the generated `dist` directory to:

```text
/var/www/motion-analysis/frontend/dist
```

## Nginx

Use `backend/docs/nginx-motion-analysis.conf` as the base Nginx site config.

Example setup:

```bash
sudo cp backend/docs/nginx-motion-analysis.conf /etc/nginx/sites-available/motion-analysis
sudo ln -s /etc/nginx/sites-available/motion-analysis /etc/nginx/sites-enabled/motion-analysis
sudo nginx -t
sudo systemctl reload nginx
```

If the server has a domain or HTTPS later, update `server_name`, SSL config, and `CORS_ORIGIN`.

## Verification

Test Node locally on the server:

```bash
curl http://127.0.0.1:8080/api/health
```

Expected result:

```text
data.status = ok
data.database.ok = true
```

Test Nginx proxy:

```bash
curl http://SERVER_PUBLIC_IP/api/health
```

Open the frontend:

```text
http://SERVER_PUBLIC_IP
```

Vue route refresh should not return 404, because Nginx uses `try_files ... /index.html`.

## Security Checklist

- Public internet only needs port `80` for this first deployment.
- Do not expose Node port `8080`.
- Do not expose MySQL port `3306`.
- Do not commit `.env`.
- Use a dedicated MySQL user, not `root`.
- Use a strong `JWT_SECRET` and admin password.
