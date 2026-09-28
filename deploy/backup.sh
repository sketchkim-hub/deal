#!/usr/bin/env bash
# DB backup (keeps 14 days). macOS/Linux crontab: 10 4 * * * /path/to/deal/deploy/backup.sh
# Windows: copying data\db.json somewhere safe (e.g. OneDrive/Google Drive folder) once a day is enough.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
cp data/db.json "backups/db-$(date +%Y%m%d).json"
find backups -name 'db-*.json' -mtime +14 -delete
