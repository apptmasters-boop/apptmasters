# Backups

Pre-launch step P1 (see [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md), "Pre-launch").

## What, when, where

- **What:** the whole database (a `pg_dump`, compressed) and the uploaded
  files (`public/uploads`: listing photos, receipts, voice messages, profile
  photos). Today that's about 11 MB of database and 39 MB of files.
- **Not backed up:** `.env.local` (passwords and keys). It belongs in the
  owner's password manager (step P3), never in a backup.
- **When:** every night at 3:30 am New York time, by the server's scheduled
  jobs (crontab), running [`scripts/ops/backup.sh`](../scripts/ops/backup.sh).
- **Where:**
  - on the server, the last **3 nights** in `~/backups/nightly/<date>/`
    (`db.dump`, `uploads.tar.gz`, `SHA256SUMS`);
  - in a **private, encrypted S3 bucket** in the same AWS account, kept for
    **30 days**, then deleted automatically. The server may only add and read
    backups there, not delete them, so someone who broke into the server
    couldn't erase the history.
- **Cost:** about $0.03 a month.
- **If a night fails,** the site emails every site admin which step failed.
  Each run also writes one line to `~/backups/nightly/backup.log`;
  `scripts/ops/verify-live.sh` shows the last line.

## One-time setup in AWS (the owner)

Only someone signed in to the AWS account can do this. It takes 2 minutes:

1. Sign in to the AWS console, region **N. Virginia (us-east-1)**, the region of
   the server.
2. Open **CloudShell** (the `>_` icon at the top of the console).
3. Paste this whole block and press Enter:

```bash
BUCKET=apptmasters-backups-$(date +%Y%m%d%H%M%S)
REGION=us-east-1
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{"Rules":[{"ID":"keep-30-days","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":30},"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}'
# The server's permission: add and read backups in this bucket, nothing else.
aws iam create-role --role-name apptmasters-backup --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name apptmasters-backup --policy-name backups-bucket-only --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/*\"},{\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\"}]}"
aws iam create-instance-profile --instance-profile-name apptmasters-backup
aws iam add-role-to-instance-profile --instance-profile-name apptmasters-backup --role-name apptmasters-backup
sleep 15
INSTANCE=$(aws ec2 describe-instances --region "$REGION" --filters "Name=dns-name,Values=ec2-44-192-72-84.compute-1.amazonaws.com" --query "Reservations[0].Instances[0].InstanceId" --output text)
aws ec2 associate-iam-instance-profile --region "$REGION" --instance-id "$INSTANCE" --iam-instance-profile Name=apptmasters-backup
echo "Done. Bucket name: $BUCKET"
```

4. Send the developer the **bucket name** from the last line (it isn't a
   secret; no password or key is shared). The developer adds it to the
   server's `.env.local` as `BACKUP_BUCKET=...`.

No access keys are created: the server gets its permission from the AWS role
attached to it.

## Restoring

**Check that a backup can be restored** (changes nothing live): on the
server, from `/var/www/apptmasters`,

```bash
bash scripts/ops/restore-check.sh              # the newest night
bash scripts/ops/restore-check.sh 2026-10-17   # a given night
```

It restores the dump into a temporary database, compares row counts of the
main tables with the live database, unpacks the files into a temporary folder,
compares the number of files, and deletes both. It prints counts only.

**A real restore** (only after the owner decides, for example after losing
the server or a bad mistake in the data):

1. Get the night's files: on the server they're in `~/backups/nightly/<date>/`;
   otherwise `aws s3 cp --recursive s3://<bucket>/<date>/ ~/restore/`.
2. Check them: `cd ~/restore && sha256sum -c SHA256SUMS`.
3. Stop the app: `pm2 stop apptmasters`.
4. Database: restore into a new database and point the app to it, so the old
   one stays until you're sure:
   ```bash
   sudo -u postgres createdb -O apptmasters apptmasters_restored
   sudo -u postgres pg_restore --no-owner --role=apptmasters --dbname=apptmasters_restored < ~/restore/db.dump
   ```
   Then change the database name at the end of `DATABASE_URL` in `.env.local`.
5. Files: `tar -xzf ~/restore/uploads.tar.gz -C /var/www/apptmasters/public`.
6. Start again and check: `bash scripts/ops/verify-live.sh`.

On a brand-new server, first install the app as in [`README.md`](../README.md)
("Deploy"), with the `.env.local` from the password manager.
