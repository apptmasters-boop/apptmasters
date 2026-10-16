#!/usr/bin/env bash
# Nightly backup, run ON THE SERVER by cron from the app folder (docs/BACKUPS.md):
#   bash scripts/ops/backup.sh
#
# 1. Dumps the database (pg_dump, compressed) and packs public/uploads.
# 2. Keeps the last 3 nights on the server in ~/backups/nightly/<date>/.
# 3. Encrypts them (gpg, AES-256, with BACKUP_PASSPHRASE from .env.local),
#    checks they decrypt, and pushes the last 7 nights to the private GitHub
#    repository BACKUP_REPO (owner's choice, 2026-10-16: on GitHub, no extra
#    fees). The repository keeps one commit, replaced every night, so it never
#    grows. Without BACKUP_REPO it only keeps the copies on the server.
# 4. Writes one line per run to ~/backups/nightly/backup.log. If anything fails,
#    the site emails the site admins (POST /api/cron/backup-status).
# Never prints secrets; .env.local itself is not backed up (it belongs in the
# owner's password manager, and holds the passphrase needed to restore).
set -euo pipefail
cd "$(dirname "$0")/../.."
APP_DIR=$(pwd)
ROOT=~/backups/nightly
LOG=$ROOT/backup.log
REPO_DIR=~/backups/github-repo
KEEP_LOCAL=3
KEEP_GITHUB=7
DAY=$(date -u +%Y-%m-%d)
DEST=$ROOT/$DAY
mkdir -p "$DEST"

setting() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB=$(setting DATABASE_URL | sed -E 's#.*/([^/?]+).*#\1#')
REPO=$(setting BACKUP_REPO || true)
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

failed() {
  local step="$1"
  log "FAILED at: $step"
  # Tell the site admins by email; the secret goes in a header.
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

# Keep the most recent nights on the server.
ls -1d "$ROOT"/20* 2>/dev/null | sort | head -n -"$KEEP_LOCAL" | xargs -r rm -rf

SIZES="db=$(du -h "$DEST/db.dump" | cut -f1) uploads=$(du -h "$DEST/uploads.tar.gz" | cut -f1)"
if [ -z "$REPO" ]; then
  log "OK $DAY $SIZES github=no (BACKUP_REPO not set)"
  exit 0
fi

# The passphrase reaches gpg through a file descriptor, never the command line.
PASS=$(setting BACKUP_PASSPHRASE || true)
[ -n "$PASS" ] || failed "encryption (BACKUP_PASSPHRASE not set)"
encrypt() { gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-fd 3 -o "$2" "$1" 3< <(printf %s "$PASS"); }
decrypt() { gpg --batch --quiet --decrypt --pinentry-mode loopback --passphrase-fd 3 "$1" 3< <(printf %s "$PASS"); }

STEP="encryption"
OUT=$REPO_DIR/$DAY
rm -rf "$OUT" && mkdir -p "$OUT"
for f in db.dump uploads.tar.gz; do
  encrypt "$DEST/$f" "$OUT/$f.gpg" || failed "$STEP"
  # Prove it decrypts to the same file before relying on it.
  [ "$(decrypt "$OUT/$f.gpg" | sha256sum | cut -d' ' -f1)" = "$(sha256sum "$DEST/$f" | cut -d' ' -f1)" ] || failed "$STEP (check)"
  # GitHub refuses files over 100 MB: store parts of at most 45 MB.
  { split -b 45m -d "$OUT/$f.gpg" "$OUT/$f.gpg.part" && rm "$OUT/$f.gpg"; } || failed "$STEP (split)"
done
cp "$DEST/SHA256SUMS" "$OUT/SHA256SUMS"

STEP="push to GitHub"
export GIT_SSH_COMMAND="ssh -F /dev/null -i $HOME/.ssh/github_backups -o IdentitiesOnly=yes"
ls -1d "$REPO_DIR"/20* 2>/dev/null | sort | head -n -"$KEEP_GITHUB" | xargs -r rm -rf
# One commit holding the last nights replaces the previous one (chained with &&
# so that any failing command, the push included, reports the failure).
( cd "$REPO_DIR" \
  && git checkout -q --orphan nightly \
  && git add -A \
  && git -c user.name="Apartment Masters server" -c user.email="backups@apptmasters.com" commit -q -m "Backups up to $DAY" \
  && { git branch -q -D main 2>/dev/null || true; } \
  && git branch -q -m main \
  && git push -q -f origin main \
  && git reflog expire --expire=now --all \
  && git gc -q --prune=now ) || failed "$STEP"

log "OK $DAY $SIZES github=yes"
