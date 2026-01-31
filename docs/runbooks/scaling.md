# Scaling Runbook

Procedures for scaling Save-It.AI services.

## Scaling Overview

| Component | Horizontal | Vertical | Auto-scaling |
|-----------|------------|----------|--------------|
| Backend | Yes | Yes | HPA enabled |
| Frontend | Yes | Yes | HPA enabled |
| PostgreSQL | Read replicas | Yes | Manual |
| Redis | Cluster mode | Yes | Manual |

## Horizontal Pod Autoscaler (HPA)

### Current Configuration

```yaml
# Backend HPA
minReplicas: 2
maxReplicas: 10
targetCPUUtilization: 70%
targetMemoryUtilization: 80%

# Frontend HPA
minReplicas: 2
maxReplicas: 5
targetCPUUtilization: 70%
```

### Check HPA Status

```bash
# View all HPAs
kubectl get hpa -n saveit

# Detailed view
kubectl describe hpa saveit-backend-hpa -n saveit

# Watch scaling in real-time
kubectl get hpa -n saveit -w
```

### Modify HPA Limits

```bash
# Increase max replicas
kubectl patch hpa saveit-backend-hpa -n saveit \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 20}]'

# Change target CPU utilization
kubectl patch hpa saveit-backend-hpa -n saveit \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/metrics/0/resource/target/averageUtilization", "value": 60}]'
```

## Manual Scaling

### Scale Backend

```bash
# Kubernetes
kubectl scale deployment saveit-backend --replicas=5 -n saveit

# Docker Compose
docker-compose up -d --scale backend=3
```

### Scale Frontend

```bash
# Kubernetes
kubectl scale deployment saveit-frontend --replicas=3 -n saveit
```

### Verify Scaling

```bash
# Check pod status
kubectl get pods -n saveit -o wide

# Check resource usage
kubectl top pods -n saveit

# Check service endpoints
kubectl get endpoints saveit-backend -n saveit
```

## Vertical Scaling

### Increase Pod Resources

```bash
# Edit deployment
kubectl edit deployment saveit-backend -n saveit

# Or patch directly
kubectl patch deployment saveit-backend -n saveit --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/limits/memory",
    "value": "2Gi"
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/limits/cpu",
    "value": "2000m"
  }
]'
```

### Resource Recommendations

| Load Level | Backend CPU | Backend Memory | Replicas |
|------------|-------------|----------------|----------|
| Low (<100 RPS) | 500m | 512Mi | 2 |
| Medium (100-500 RPS) | 1000m | 1Gi | 3-5 |
| High (500-2000 RPS) | 2000m | 2Gi | 5-10 |
| Peak (>2000 RPS) | 2000m | 2Gi | 10-20 |

## Database Scaling

### Connection Pool Tuning

```python
# backend/app/core/database.py
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,        # Increase for more connections
    max_overflow=40,     # Additional connections when pool exhausted
    pool_pre_ping=True,
)
```

### Add Read Replicas

```bash
# AWS RDS
aws rds create-db-instance-read-replica \
  --db-instance-identifier saveit-read-1 \
  --source-db-instance-identifier saveit-prod

# Update application to use replica for reads
# Set READ_DATABASE_URL environment variable
```

### PostgreSQL Connection Limits

```bash
# Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check max connections
psql -c "SHOW max_connections;"

# Increase (requires restart)
# ALTER SYSTEM SET max_connections = 200;
```

### PgBouncer for Connection Pooling

```yaml
# Deploy PgBouncer
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  template:
    spec:
      containers:
        - name: pgbouncer
          image: bitnami/pgbouncer:latest
          env:
            - name: POSTGRESQL_HOST
              value: postgres
            - name: PGBOUNCER_POOL_MODE
              value: transaction
            - name: PGBOUNCER_MAX_CLIENT_CONN
              value: "1000"
```

## Redis Scaling

### Check Redis Memory

```bash
kubectl exec -it redis-0 -n saveit -- redis-cli INFO memory
```

### Increase Memory Limit

```bash
kubectl patch statefulset redis -n saveit --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources/limits/memory",
    "value": "2Gi"
  }
]'
```

### Redis Cluster Mode

For high availability and scaling:

```bash
helm upgrade redis bitnami/redis \
  --namespace saveit \
  --set architecture=replication \
  --set replica.replicaCount=3
```

## Load Testing

### Before Scaling

Run load tests to identify bottlenecks:

```bash
# Install k6
brew install k6

# Run load test
k6 run --vus 100 --duration 5m loadtest.js
```

### Sample Load Test Script

```javascript
// loadtest.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const res = http.get('https://api.saveit.ai/api/v1/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

### Monitor During Load Test

```bash
# Watch resource usage
kubectl top pods -n saveit -w

# Watch HPA
kubectl get hpa -n saveit -w

# Check response times
kubectl logs -f -l app.kubernetes.io/name=saveit-backend -n saveit | \
  grep "duration_ms"
```

## Scaling for Events

### Pre-scaling for Expected Load

```bash
# Scale up before event
kubectl scale deployment saveit-backend --replicas=10 -n saveit

# Temporarily increase HPA limits
kubectl patch hpa saveit-backend-hpa -n saveit \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 25}]'
```

### Post-event Cleanup

```bash
# Let HPA scale down naturally
# Or manually reduce
kubectl scale deployment saveit-backend --replicas=2 -n saveit

# Restore HPA limits
kubectl patch hpa saveit-backend-hpa -n saveit \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 10}]'
```

## Scaling Checklist

### Before Scaling Up

- [ ] Identify bottleneck (CPU, memory, database, network)
- [ ] Check current resource utilization
- [ ] Verify cluster has available capacity
- [ ] Check database connection limits
- [ ] Review cost implications

### After Scaling Up

- [ ] Verify new pods are healthy
- [ ] Check load balancing is working
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Check database connection count

### Before Scaling Down

- [ ] Verify load has decreased
- [ ] Check for scheduled jobs/events
- [ ] Ensure minimum replicas for HA
- [ ] Monitor after scale-down

## Troubleshooting

### Pods Not Scaling Up

```bash
# Check HPA events
kubectl describe hpa saveit-backend-hpa -n saveit

# Common issues:
# - Metrics server not running
# - Resource requests not set
# - Max replicas reached
```

### Pods Stuck in Pending

```bash
# Check cluster capacity
kubectl describe nodes | grep -A 5 "Allocated resources"

# Check for resource quota
kubectl get resourcequota -n saveit

# Check pod events
kubectl describe pod <pending-pod> -n saveit
```

### Slow Scale-up

```bash
# Check scale-up policies
kubectl get hpa saveit-backend-hpa -n saveit -o yaml | grep -A 20 behavior

# Increase scale-up rate
kubectl patch hpa saveit-backend-hpa -n saveit --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/behavior/scaleUp/stabilizationWindowSeconds",
    "value": 0
  }
]'
```

### Database Connection Exhaustion

```bash
# Check current connections
psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Kill idle connections
psql -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '5 minutes';
"
```
