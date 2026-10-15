#!/usr/bin/env bash
# Post-deploy check, run ON THE SERVER from the app folder after `npm run build`:
#   bash scripts/ops/verify-live.sh
#
# Restarts the app, then calls the main household APIs as a real member of a
# real household with a login token that expires after 60 seconds. The token
# and the member's details are never printed. Reports status codes and any new
# lines in the error log.
set -e
cd "$(dirname "$0")/../.."

pm2 restart apptmasters >/dev/null
ERRLOG=~/.pm2/logs/apptmasters-error.log
BEFORE=$(wc -l < "$ERRLOG")
sleep 8

DB=$(grep "^DATABASE_URL" .env.local | sed -E 's#.*/([^/?"]+).*#\1#')
# Any active member of a household with at least two active members.
ROW=$(sudo -u postgres psql -At -d "$DB" -c "select m.\"apartmentId\", u.id, u.email from \"ApartmentMember\" m join \"User\" u on u.id = m.\"userId\" where m.status = 'ACTIVE' and m.\"apartmentId\" in (select \"apartmentId\" from \"ApartmentMember\" where status = 'ACTIVE' group by 1 having count(*) > 1) limit 1")
APT=$(echo "$ROW" | cut -d'|' -f1)
MEMBER_ID=$(echo "$ROW" | cut -d'|' -f2)
MEMBER_EMAIL=$(echo "$ROW" | cut -d'|' -f3)
TOKEN=$(MEMBER_ID="$MEMBER_ID" MEMBER_EMAIL="$MEMBER_EMAIL" node -e 'require("dotenv").config({ path: ".env.local", quiet: true }); console.log(require("jsonwebtoken").sign({ userId: process.env.MEMBER_ID, email: process.env.MEMBER_EMAIL }, process.env.JWT_SECRET, { expiresIn: 60 }))')
AUTH="Authorization: Bearer $TOKEN"
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

for path in "" /home /cleaning /grocery /shopping /balance /ledger /rent/summary; do
  echo "GET /api/apartments/<apt>$path: $(code -H "$AUTH" "http://localhost:3000/api/apartments/$APT$path")"
done
for page in "" /household /shopping /cleaning /money /rent; do
  echo "page /apartment/<apt>$page: $(code "http://localhost:3000/apartment/$APT$page")"
done
echo "public site: $(code https://apptmasters.com/)"

NEW=$(( $(wc -l < "$ERRLOG") - BEFORE ))
echo "new error-log lines: $NEW"
[ "$NEW" -gt 0 ] && tail -n "$NEW" "$ERRLOG" | cut -c1-200
exit 0
