#!/usr/bin/env bash
# Proves a backup can be restored, run ON THE SERVER from the app folder (docs/BACKUPS.md):
#   bash scripts/ops/restore-check.sh                 # the newest night kept on the server
#   bash scripts/ops/restore-check.sh 2026-10-17      # a given night on the server
#   bash scripts/ops/restore-check.sh --github        # the newest night, downloaded fresh from GitHub and decrypted
#
# Restores the database dump into a temporary database, compares row counts
# with the live database for the main tables, unpacks the uploads into a
# temporary folder and compares the number of files, then deletes both.
# The live database and files are only read. Prints counts only, never data.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=~/backups/nightly
setting() { grep "^$1=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
LIVE=$(setting DATABASE_URL | sed -E 's#.*/([^/?]+).*#\1#')
TMPDB=apptmasters_restore_check
WORK=$(mktemp -d)
cleanup() { sudo -u postgres dropdb --if-exists "$TMPDB" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

if [ "${1:-}" = "--github" ]; then
  # A fresh download, as after losing the server: clone, join the parts, decrypt.
  PASS=$(setting BACKUP_PASSPHRASE)
  GIT_SSH_COMMAND="ssh -F /dev/null -i $HOME/.ssh/github_backups -o IdentitiesOnly=yes" \
    git clone -q --depth 1 "$(setting BACKUP_REPO)" "$WORK/repo"
  DAY=$(ls -1d "$WORK/repo"/20* | sort | tail -1 | xargs basename)
  SRC=$WORK/plain
  mkdir -p "$SRC"
  for f in db.dump uploads.tar.gz; do
    cat "$WORK/repo/$DAY/$f.gpg.part"* | gpg --batch --quiet --decrypt --pinentry-mode loopback --passphrase-fd 3 \
      -o "$SRC/$f" 3< <(printf %s "$PASS")
  done
  cp "$WORK/repo/$DAY/SHA256SUMS" "$SRC/"
  echo "Backup of $DAY, downloaded from GitHub and decrypted"
else
  DAY=${1:-$(ls -1d "$ROOT"/20* | sort | tail -1 | xargs basename)}
  SRC=$ROOT/$DAY
  echo "Backup of $DAY, on the server"
fi

( cd "$SRC" && sha256sum -c --quiet SHA256SUMS ) && echo "checksums: OK"

sudo -u postgres dropdb --if-exists "$TMPDB"
sudo -u postgres createdb "$TMPDB"
# Read through stdin: the postgres user cannot open files in the ubuntu home folder.
# Warnings (e.g. about the public schema) do not stop the check: the counts below decide.
sudo -u postgres pg_restore --no-owner --no-privileges --dbname="$TMPDB" < "$SRC/db.dump" 2> "$WORK/restore.log" \
  || echo "pg_restore warnings: $(grep -c . "$WORK/restore.log") lines (not shown)"

count() { sudo -u postgres psql -At -d "$1" -c "select count(*) from \"$2\""; }
ALL_MATCH=yes
for table in User Apartment ApartmentMember Listing ListingMessage Expense RentPayment; do
  live=$(count "$LIVE" "$table"); restored=$(count "$TMPDB" "$table")
  [ "$live" = "$restored" ] && mark="same" || { mark="DIFFERENT (changed since the backup?)"; ALL_MATCH=no; }
  echo "$table: live $live, restored $restored, $mark"
done

mkdir -p "$WORK/files"
tar -xzf "$SRC/uploads.tar.gz" -C "$WORK/files"
echo "upload files: live $(find public/uploads -type f | wc -l), restored $(find "$WORK/files/uploads" -type f | wc -l)"
echo "restore check finished (all table counts the same: $ALL_MATCH); temporary copies deleted"
