# Server Deployment Notes

This note records the production migration for the Motion Analysis project.

## Server

- Public IP: `47.112.190.14`
- OS: Alibaba Cloud Linux 3
- Panel: BT Panel / Aliyun custom image
- App path: `/www/wwwroot/motion-analysis`
- Git branch deployed: `dev`
- Public URL: `http://47.112.190.14`
- Health check: `http://47.112.190.14/api/health`

## Runtime Layout

```text
Browser
  -> Nginx :80
       /        -> /www/wwwroot/motion-analysis/frontend/dist
       /api/... -> Node Express on 127.0.0.1:8080
                    -> MySQL on 127.0.0.1:3306
```

## Installed Components

- Node.js 20 installed under `/usr/local/lib/nodejs`
- PM2 installed globally and linked into `/usr/local/bin/pm2`
- Python 3.11 installed from system packages
- Backend ML virtualenv: `/www/wwwroot/motion-analysis/backend/.venv`
- Nginx config: `/www/server/panel/vhost/nginx/motion-analysis.conf`
- Backend env file: `/www/wwwroot/motion-analysis/backend/.env`

## Database

- MySQL version on server: `5.7.40-log`
- Database name: `MotionAnalysis`
- App database user: `motion_api`
- App DB/admin generated credentials are stored on the server only:

```bash
cat /root/motion-analysis-deploy-info.txt
```

Do not commit `.env` or paste credentials into docs.

Initial import result:

```text
Activities: 186
TrackPoints: 332699
ActivitySummaries: 186
Users: 1
```

## Important Compatibility Notes

The server uses MySQL 5.7, while the schema originally used MySQL 8 collation:

```text
utf8mb4_0900_ai_ci
```

For this deployment, the schema import used a temporary MySQL 5.7-compatible copy with:

```text
utf8mb4_unicode_ci
```

The ML model was serialized with `scikit-learn 1.7.2`. Newer versions can load the file but fail during prediction. Keep:

```text
scikit-learn==1.7.2
```

in `backend/ml/requirements.txt`.

## Common Commands

Check API:

```bash
curl http://127.0.0.1:8080/api/health
curl http://47.112.190.14/api/health
```

Check PM2:

```bash
pm2 status
pm2 logs motion-analysis-api
pm2 restart motion-analysis-api --update-env
pm2 save
```

Check Nginx:

```bash
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
/www/server/nginx/sbin/nginx -s reload -c /www/server/nginx/conf/nginx.conf
```

Check database row counts:

```bash
mysql -uroot -p MotionAnalysis --table --execute="
SELECT 'Activities' AS table_name, COUNT(*) AS row_count FROM Activities
UNION ALL SELECT 'TrackPoints', COUNT(*) FROM TrackPoints
UNION ALL SELECT 'ActivitySummaries', COUNT(*) FROM ActivitySummaries
UNION ALL SELECT 'Users', COUNT(*) FROM Users;
"
```

Run ML prediction smoke test:

```bash
curl -H 'Content-Type: application/json' \
  --data '{"distanceM":5000,"durationS":1500,"movingDurationS":1480,"elapsedDurationS":1520,"avgSpeedMps":3.33,"maxSpeedMps":5.2,"avgHeartRateBpm":150,"maxHeartRateBpm":178,"avgCadenceSpm":170,"maxCadenceSpm":188,"elevationGainM":30,"elevationLossM":30,"avgStrideLengthCm":110,"normalizedPowerW":0}' \
  http://127.0.0.1:8080/api/ml/running-prediction
```

## Security Cleanup

Remove the temporary Codex SSH key from the server after deployment work is done:

```bash
sed -i '/codex-motion-analysis-deploy/d' ~/.ssh/authorized_keys
```

Because the MySQL root password was shared during setup, rotate it after confirming the app is stable. The app itself uses the lower-privilege `motion_api` user.
