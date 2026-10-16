#!/usr/bin/env bash
# Nightly backup, run ON THE SERVER by cron from the app folder (docs/BACKUPS.md):
#   bash scripts/ops/backup.sh
#
# 1. Dumps the database (pg_dump, compressed) and packs public/uploads.
# 2. Keeps the last 3 nights on the server in ~/backups/nightly/<date>/.
# 3. Copies them to the private S3 bucket named by BACKUP_BUCKET in .env.local
#    (the bucket deletes copies after 30 days). Without BACKUP_BUCKET it only
#    keeps the copies on the server.
# 4. Writes one line per run to ~/backups/nightly/backup.log. If anything fails,
#    the site emails the site admins (POST /api/cron/backup-status).
# Never prints secrets; .env.local itself is not backed up (it belongs in a
# password manager).
set -euo pipefail
cd "$(dirname "$0")/../.."
APP_DIR=$(pwd)
ROOT=~/backups/nightly
LOG=$ROOT/backup.log
DAY=$(date -u +%Y-%m-%d)
DEST=$ROOT/$DAY
mkdir -p "$DEST"

setting() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB=$(setting DATABASE_URL | sed -E 's#.*/([^/?]+).*#\1#')
BUCKET=$(setting BACKUP_BUCKET || true)
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

failed() {
  local step="$1"
  log "FAILED at: $step"
  # Tell the site admins by email; the secret goes in a header, never on the command line output.
  curl -s -o /dev/null -X POST -H "x-cron-secret: $(setting CRON_SECRET)" -H "Content-Type: application/json" \
    -d "{\"ok\":false,\"step\":\"$step\",\"day\":\"$DAY\"}" "$(setting APP_URL)/api/cron/backup-status" || true
  exit 1
}

STEP="database dump"
sudo -u postgres pg_dump -Fc "$DB" > "$DEST/db.dump" || failed "$STEP"
[ -s "$DEST/db.dump" ] || failed "$STEP (empty file)"

STEP="uploads archive"
tar -czf "$DEST/uploads.tar.gz" -C "$APP_DIR/public" uploads || failed "$STEP"

STEP="checksums"
( cd "$DEST" && sha256sum db.dump uploads.tar.gz > SHA256SUMS ) || failed "$STEP"

# Keep the 3 most recent nights on the server.
ls -1d "$ROOT"/20* 2>/dev/null | sort | head -n -3 | xargs -r rm -rf

SIZES="db=$(du -h "$DEST/db.dump" | cut -f1) uploads=$(du -h "$DEST/uploads.tar.gz" | cut -f1)"
if [ -n "$BUCKET" ]; then
  STEP="copy to S3"
  aws s3 cp --recursive --only-show-errors --sse AES256 "$DEST" "s3://$BUCKET/$DAY/" || failed "$STEP"
  log "OK $DAY $SIZES s3=yes"
else
  log "OK $DAY $SIZES s3=no (BACKUP_BUCKET not set)"
fi
