#!/usr/bin/env bash
# Proves a backup can be restored, run ON THE SERVER from the app folder (docs/BACKUPS.md):
#   bash scripts/ops/restore-check.sh            # the newest night in ~/backups/nightly
#   bash scripts/ops/restore-check.sh 2026-10-17 # a given night
#
# Restores the database dump into a temporary database, compares row counts
# with the live database for the main tables, unpacks the uploads into a
# temporary folder and compares the number of files, then deletes both.
# The live database and files are only read. Prints counts only, never data.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=~/backups/nightly
DAY=${1:-$(ls -1d "$ROOT"/20* | sort | tail -1 | xargs basename)}
SRC=$ROOT/$DAY
LIVE=$(grep "^DATABASE_URL=" .env.local | sed -E 's#.*/([^/?"]+).*#\1#')
TMPDB=apptmasters_restore_check
TMPDIR=$(mktemp -d)
cleanup() { sudo -u postgres dropdb --if-exists "$TMPDB" >/dev/null 2>&1 || true; rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "Backup of $DAY"
( cd "$SRC" && sha256sum -c --quiet SHA256SUMS ) && echo "checksums: OK"

sudo -u postgres dropdb --if-exists "$TMPDB"
sudo -u postgres createdb "$TMPDB"
# Read through stdin: the postgres user cannot open files in the ubuntu home folder.
# Warnings (e.g. about the public schema) do not stop the check: the counts below decide.
sudo -u postgres pg_restore --no-owner --no-privileges --dbname="$TMPDB" < "$SRC/db.dump" 2> "$TMPDIR/restore.log" \
  || echo "pg_restore warnings: $(grep -c . "$TMPDIR/restore.log") lines (not shown)"

count() { sudo -u postgres psql -At -d "$1" -c "select count(*) from \"$2\""; }
ALL_MATCH=yes
for table in User Apartment ApartmentMember Listing ListingMessage Expense RentPayment; do
  live=$(count "$LIVE" "$table"); restored=$(count "$TMPDB" "$table")
  [ "$live" = "$restored" ] && mark="same" || { mark="DIFFERENT (changed since the backup?)"; ALL_MATCH=no; }
  echo "$table: live $live, restored $restored, $mark"
done

tar -xzf "$SRC/uploads.tar.gz" -C "$TMPDIR"
echo "upload files: live $(find public/uploads -type f | wc -l), restored $(find "$TMPDIR/uploads" -type f | wc -l)"
echo "restore check finished (all table counts the same: $ALL_MATCH); temporary copies deleted"
