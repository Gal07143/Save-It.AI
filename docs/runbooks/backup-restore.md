# Backup and Restore Runbook

Procedures for backing up and restoring Save-It.AI data.

## Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full database | Daily 2 AM UTC | 30 days | S3/GCS |
| Incremental | Hourly | 7 days | S3/GCS |
| Transaction logs | Continuous | 7 days | S3/GCS |

## Automated Backups

Automated backups run via the BackupService. Configuration:

```bash
# Environment variables
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=saveit-backups
BACKUP_RETENTION_DAYS=30
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

### Verify Automated Backups

```bash
# Check backup job status
kubectl get cronjobs -n saveit

# List recent backups
aws s3 ls s3://saveit-backups/database/ --recursive | tail -10

# Verify backup integrity
aws s3 cp s3://saveit-backups/database/backup-2024-01-24.sql.gz - | \
  gunzip | head -100
```

## Manual Backup

### Docker Compose

```bash
# Full backup
docker-compose exec postgres pg_dump -U saveit saveit > backup.sql

# Compressed backup
docker-compose exec postgres pg_dump -U saveit saveit | gzip > backup.sql.gz

# Backup specific tables
docker-compose exec postgres pg_dump -U saveit saveit \
  -t users -t organizations > users_backup.sql
```

### Kubernetes

```bash
# Create backup job
kubectl run backup --rm -it \
  --image=postgres:15 \
  --restart=Never \
  --namespace=saveit \
  --env="PGPASSWORD=$DB_PASSWORD" \
  -- pg_dump -h $DB_HOST -U saveit saveit > backup.sql

# Or use port-forward
kubectl port-forward svc/postgres 5433:5432 -n saveit &
pg_dump -h localhost -p 5433 -U saveit saveit > backup.sql
```

### Cloud Provider

```bash
# AWS RDS
aws rds create-db-snapshot \
  --db-instance-identifier saveit-prod \
  --db-snapshot-identifier saveit-manual-$(date +%Y%m%d)

# GCP Cloud SQL
gcloud sql backups create \
  --instance=saveit-prod \
  --description="Manual backup $(date)"
```

## Upload to Cloud Storage

```bash
# AWS S3
aws s3 cp backup.sql.gz s3://saveit-backups/manual/backup-$(date +%Y%m%d).sql.gz

# GCP GCS
gsutil cp backup.sql.gz gs://saveit-backups/manual/backup-$(date +%Y%m%d).sql.gz
```

## Restore Procedures

### Pre-Restore Checklist

- [ ] Verify you have the correct backup file
- [ ] Confirm target environment (DO NOT restore prod backup to wrong environment)
- [ ] Notify team of planned restore
- [ ] Stop application traffic (maintenance mode)
- [ ] Create backup of current state before restore

### Docker Compose Restore

```bash
# Stop backend to prevent writes
docker-compose stop backend

# Restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U saveit saveit

# From compressed backup
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U saveit saveit

# Restart backend
docker-compose start backend

# Verify
docker-compose exec backend python -c "from app.core.database import engine; print(engine.connect())"
```

### Kubernetes Restore

```bash
# Scale down backend
kubectl scale deployment saveit-backend --replicas=0 -n saveit

# Restore (using port-forward)
kubectl port-forward svc/postgres 5433:5432 -n saveit &
gunzip -c backup.sql.gz | psql -h localhost -p 5433 -U saveit saveit

# Scale up backend
kubectl scale deployment saveit-backend --replicas=2 -n saveit

# Verify health
kubectl exec -it <backend-pod> -n saveit -- \
  curl http://localhost:8000/api/v1/health/ready
```

### Cloud Provider Restore

```bash
# AWS RDS - Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier saveit-restored \
  --db-snapshot-identifier saveit-manual-20240124

# GCP Cloud SQL
gcloud sql backups restore BACKUP_ID \
  --restore-instance=saveit-restored \
  --backup-instance=saveit-prod
```

### Point-in-Time Recovery (PITR)

```bash
# AWS RDS - Restore to specific time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier saveit-prod \
  --target-db-instance-identifier saveit-pitr \
  --restore-time 2024-01-24T10:30:00Z

# GCP Cloud SQL
gcloud sql instances clone saveit-prod saveit-pitr \
  --point-in-time 2024-01-24T10:30:00Z
```

## Partial Restore

### Restore Specific Tables

```bash
# Extract specific tables from backup
pg_restore -t users -t organizations backup.dump > partial.sql

# Or from SQL dump
grep -A 1000000 "^COPY users" backup.sql | \
  sed '/^\\\.$/q' > users_data.sql
```

### Restore to Different Database

```bash
# Create new database
createdb -h localhost -U saveit saveit_restore

# Restore to new database
gunzip -c backup.sql.gz | psql -h localhost -U saveit saveit_restore

# Verify data
psql -h localhost -U saveit saveit_restore -c "SELECT count(*) FROM users;"
```

## Backup Validation

### Monthly Restore Test

Perform monthly to verify backup integrity:

```bash
# 1. Download recent backup
aws s3 cp s3://saveit-backups/database/backup-latest.sql.gz ./

# 2. Restore to test database
createdb -h localhost -U saveit saveit_test
gunzip -c backup-latest.sql.gz | psql -h localhost -U saveit saveit_test

# 3. Verify row counts
psql -h localhost -U saveit saveit_test -c "
SELECT
  'users' as table_name, count(*) as rows FROM users
UNION ALL
SELECT 'organizations', count(*) FROM organizations
UNION ALL
SELECT 'sites', count(*) FROM sites
UNION ALL
SELECT 'meters', count(*) FROM meters;
"

# 4. Run sample queries
psql -h localhost -U saveit saveit_test -c "
SELECT id, email FROM users LIMIT 5;
SELECT id, name FROM organizations LIMIT 5;
"

# 5. Clean up
dropdb -h localhost -U saveit saveit_test
```

## Backup Encryption

### Encrypt Backup

```bash
# Encrypt before upload
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# Upload encrypted file
aws s3 cp backup.sql.gz.gpg s3://saveit-backups/encrypted/
```

### Decrypt Backup

```bash
# Download and decrypt
aws s3 cp s3://saveit-backups/encrypted/backup.sql.gz.gpg ./
gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
```

## Disaster Recovery

### Complete Environment Recovery

1. **Provision infrastructure** (Terraform/CloudFormation)
2. **Deploy Kubernetes manifests**
3. **Restore database from latest backup**
4. **Update DNS to new environment**
5. **Verify all services healthy**
6. **Enable traffic**

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Pod failure | 5 min | 0 (stateless) |
| Node failure | 10 min | 0 |
| Database failure | 30 min | 1 hour |
| Region failure | 4 hours | 1 hour |

## Troubleshooting

### Backup Failed

```bash
# Check backup job logs
kubectl logs job/backup-job -n saveit

# Common issues:
# - Disk space: Check storage usage
# - Permissions: Verify S3/GCS credentials
# - Network: Check connectivity to storage
```

### Restore Failed

```bash
# Check for constraint violations
# Temporarily disable triggers
psql -c "SET session_replication_role = replica;"
# Restore
# Re-enable triggers
psql -c "SET session_replication_role = DEFAULT;"
```

### Corrupted Backup

```bash
# Verify backup integrity
gunzip -t backup.sql.gz

# If corrupted, try previous backup
aws s3 ls s3://saveit-backups/database/ --recursive | sort -r | head -5
```
