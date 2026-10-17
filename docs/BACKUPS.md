# Backups

Pre-launch step P1 (see [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md), "Pre-launch").
Owner's choice (2026-10-16): the copy outside the server goes to a **private
GitHub repository, encrypted**, with no extra fees.

## What, when, where

- **What:** the whole database (a `pg_dump`, compressed) and the uploaded
  files (`public/uploads`: listing photos, receipts, voice messages, profile
  photos). Today that's about 11 MB of database and 39 MB of files.
- **Not backed up:** `.env.local` (passwords and keys). It belongs in the
  owner's password manager (step P3). **It holds `BACKUP_PASSPHRASE`, without
  which the GitHub copies can't be opened.**
- **When:** every night at 7:30 UTC (3:30 am New York in summer, 2:30 am in
  winter), by the server's scheduled jobs (crontab), running
  [`scripts/ops/backup.sh`](../scripts/ops/backup.sh).
- **Where:**
  - on the server, the last **3 nights** in `~/backups/nightly/<date>/`
    (`db.dump`, `uploads.tar.gz`, `SHA256SUMS`), not encrypted (the server
    holds the live data anyway);
  - in the **private repository `apptmasters-boop/apptmasters-backups`**, the
    last **7 nights**, **encrypted** (gpg, AES-256) with `BACKUP_PASSPHRASE`, so
    GitHub and anyone with access to the repository see only unreadable files.
    Each file is stored in parts of at most 45 MB (GitHub's limit is 100 MB).
    The repository holds a single commit, replaced every night, so it doesn't
    grow.
  - The server pushes with its own key (`~/.ssh/github_backups`), a deploy key
    that can write to the backups repository only. It can't reach the app's code
    repository or anything else.
- **Cost:** none.
- **If a night fails,** the site emails every site admin which step failed.
  Each run also writes one line to `~/backups/nightly/backup.log`;
  `scripts/ops/verify-live.sh` shows the last line. Every night the script
  also checks that the encrypted files decrypt back to the same data.

## Checking that a backup can be restored

On the server, from `/var/www/apptmasters` (changes nothing live):

```bash
bash scripts/ops/restore-check.sh              # the newest night kept on the server
bash scripts/ops/restore-check.sh 2026-10-17   # a given night on the server
bash scripts/ops/restore-check.sh --github     # the newest night, downloaded from GitHub and decrypted
```

It restores the dump into a temporary database, compares row counts of the
main tables with the live database, unpacks the files into a temporary folder,
compares the number of files, and deletes both. It prints counts only.

## A real restore

Only after the owner decides (for example after losing the server, or a bad
mistake in the data).

1. **Get the files.**
   - From the server: `~/backups/nightly/<date>/`.
   - From GitHub (on any machine with access to the repository and the
     passphrase from the password manager):
     ```bash
     git clone --depth 1 git@github.com:apptmasters-boop/apptmasters-backups.git
     cd apptmasters-backups/<date>
     cat db.dump.gpg.part* | gpg --decrypt -o db.dump              # asks for BACKUP_PASSPHRASE
     cat uploads.tar.gz.gpg.part* | gpg --decrypt -o uploads.tar.gz
     sha256sum -c SHA256SUMS
     ```
2. Stop the app: `pm2 stop apptmasters`.
3. **Database:** restore into a new database and point the app to it, so the
   old one stays until you're sure:
   ```bash
   sudo -u postgres createdb -O apptmasters apptmasters_restored
   sudo -u postgres pg_restore --no-owner --role=apptmasters --dbname=apptmasters_restored < db.dump
   ```
   Then change the database name at the end of `DATABASE_URL` in `.env.local`.
4. **Files:** `tar -xzf uploads.tar.gz -C /var/www/apptmasters/public`.
5. Start again and check: `bash scripts/ops/verify-live.sh`.

On a brand-new server, first install the app as in [`README.md`](../README.md)
("Deploy"), with the `.env.local` from the password manager.

## The scheduled jobs' log (found 2026-10-17)

Every scheduled job on the server ends with `>> /var/log/apptmasters-cron.log`.
That file didn't exist, and the server's user (`ubuntu`) may not create files in
`/var/log`, so the shell refused to start **every** job: the first nightly
backup (2026-10-17) and, since they were set up, the hourly voice-file
cleanup, the unconfirmed sign-up cleanup, the rent reminders and the cleaning
penalties. Cron discarded the error ("No MTA installed").

Fix (owner's OK, 2026-10-17): the file was created and given to `ubuntu`:
`sudo install -o ubuntu -g ubuntu -m 644 /dev/null /var/log/apptmasters-cron.log`.
The backup line was then run in cron's minimal environment and worked.
`scripts/ops/verify-live.sh` now prints the state of that log, and says so if
it's missing.

## How it was set up (2026-10-16)

1. The private repository `apptmasters-boop/apptmasters-backups` was created.
2. On the server: a new key `~/.ssh/github_backups`, added to that repository
   as a deploy key **with write access** (that repository only).
3. `.env.local` on the server got `BACKUP_REPO` (the repository's address) and
   `BACKUP_PASSPHRASE` (a long random password made on the server, never shown
   or sent anywhere).
4. The repository was cloned to `~/backups/github-repo`.
5. Crontab line (owner's OK, 2026-10-16):
   `30 7 * * * cd /var/www/apptmasters && bash scripts/ops/backup.sh >> /var/log/apptmasters-cron.log 2>&1`
