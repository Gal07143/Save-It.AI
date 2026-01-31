# Incident Response Runbook

Procedures for handling production incidents in Save-It.AI.

## Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **SEV1** | Complete service outage | 15 minutes | All users unable to access platform |
| **SEV2** | Major feature unavailable | 30 minutes | Authentication broken, data not saving |
| **SEV3** | Degraded performance | 2 hours | Slow response times, partial failures |
| **SEV4** | Minor issue | Next business day | UI bugs, non-critical errors |

## Escalation Path

1. **On-call Engineer** - First responder
2. **Team Lead** - Escalate if not resolved in 30 min
3. **Engineering Manager** - SEV1/SEV2 incidents
4. **VP Engineering** - Customer-impacting SEV1

## Initial Response

### 1. Acknowledge the Incident

```bash
# Check alerting system
# Acknowledge in PagerDuty/Opsgenie

# Create incident channel (Slack)
/incident create "Brief description"
```

### 2. Assess Impact

```bash
# Check service health
curl https://api.saveit.ai/api/v1/health/ready

# Check error rates (Grafana/Prometheus)
# Query: rate(http_requests_total{status=~"5.."}[5m])

# Check active users
# Query: sum(rate(http_requests_total[5m]))
```

### 3. Communicate

- Post initial update in incident channel
- For SEV1/SEV2: Notify stakeholders
- Update status page if customer-facing

## Common Incidents

### Application Not Responding

**Symptoms:** 503 errors, health checks failing

**Diagnosis:**
```bash
# Kubernetes
kubectl get pods -n saveit
kubectl describe pod <pod-name> -n saveit
kubectl logs <pod-name> -n saveit --tail=100

# Docker Compose
docker-compose ps
docker-compose logs --tail=100 backend
```

**Resolution:**
```bash
# Restart pods
kubectl rollout restart deployment/saveit-backend -n saveit

# Docker
docker-compose restart backend
```

### Database Connection Failures

**Symptoms:** "Connection refused" or "Too many connections" errors

**Diagnosis:**
```bash
# Check database connectivity
kubectl exec -it <backend-pod> -n saveit -- \
  python -c "from app.core.database import engine; print(engine.connect())"

# Check connection count
psql -h <host> -U saveit -c "SELECT count(*) FROM pg_stat_activity;"
```

**Resolution:**
```bash
# Restart backend to reset connection pool
kubectl rollout restart deployment/saveit-backend -n saveit

# If connection limit reached, terminate idle connections
psql -h <host> -U saveit -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';
"
```

### High Memory Usage

**Symptoms:** OOMKilled pods, slow responses

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n saveit

# Check for memory leaks in logs
kubectl logs <pod-name> -n saveit | grep -i memory
```

**Resolution:**
```bash
# Scale up temporarily
kubectl scale deployment saveit-backend --replicas=5 -n saveit

# Restart to clear memory
kubectl rollout restart deployment/saveit-backend -n saveit
```

### High CPU Usage

**Symptoms:** Slow responses, request timeouts

**Diagnosis:**
```bash
# Check CPU usage
kubectl top pods -n saveit

# Check HPA status
kubectl get hpa -n saveit
```

**Resolution:**
```bash
# Scale up
kubectl scale deployment saveit-backend --replicas=5 -n saveit

# Or increase HPA max
kubectl patch hpa saveit-backend-hpa -n saveit \
  --type='json' -p='[{"op": "replace", "path": "/spec/maxReplicas", "value":15}]'
```

### SSL Certificate Expired

**Symptoms:** Browser security warnings, TLS handshake failures

**Diagnosis:**
```bash
# Check certificate expiry
echo | openssl s_client -connect api.saveit.ai:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check cert-manager
kubectl get certificate -n saveit
kubectl describe certificate saveit-tls -n saveit
```

**Resolution:**
```bash
# Force certificate renewal
kubectl delete secret saveit-tls -n saveit
# cert-manager will automatically request new certificate

# Or manually trigger
kubectl annotate certificate saveit-tls -n saveit \
  cert-manager.io/issue-temporary-certificate="true"
```

### Redis Connection Issues

**Symptoms:** Rate limiting not working, cache misses

**Diagnosis:**
```bash
# Check Redis connectivity
kubectl exec -it <backend-pod> -n saveit -- \
  redis-cli -h redis -p 6379 ping
```

**Resolution:**
```bash
# Application falls back to in-memory rate limiting
# Restart Redis if needed
kubectl rollout restart deployment/redis -n saveit
```

### MQTT Broker Down

**Symptoms:** IoT devices not reporting, device status stale

**Diagnosis:**
```bash
# Check MQTT port
kubectl exec -it <backend-pod> -n saveit -- \
  nc -zv localhost 1883

# Check MQTT logs
kubectl logs <backend-pod> -n saveit | grep -i mqtt
```

**Resolution:**
```bash
# Restart backend (embedded broker)
kubectl rollout restart deployment/saveit-backend -n saveit
```

## Post-Incident

### 1. Resolve Incident

```bash
# Verify service restored
curl https://api.saveit.ai/api/v1/health/ready

# Verify in monitoring
# Check error rate dropped to baseline
```

### 2. Document

- Update incident channel with resolution
- Close incident in tracking system
- Update status page

### 3. Post-Mortem (SEV1/SEV2)

Within 48 hours, create post-mortem document:

1. **Timeline** - What happened when
2. **Root Cause** - Why it happened
3. **Impact** - Users affected, duration
4. **Resolution** - How it was fixed
5. **Action Items** - Prevent recurrence

## Useful Commands

### Quick Health Check

```bash
# All services health
for svc in backend frontend; do
  echo "=== $svc ==="
  kubectl get pods -n saveit -l app.kubernetes.io/name=saveit-$svc
done
```

### Recent Errors

```bash
# Last 5 minutes of errors
kubectl logs -n saveit -l app.kubernetes.io/name=saveit-backend \
  --since=5m | grep -i error
```

### Database Quick Check

```bash
# Connection count and longest query
psql -h <host> -U saveit -c "
SELECT
  count(*) as connections,
  max(now() - query_start) as longest_query
FROM pg_stat_activity
WHERE datname = 'saveit';
"
```

### Network Debug Pod

```bash
kubectl run debug --rm -it --image=nicolaka/netshoot --restart=Never -n saveit
```

## Contacts

| Role | Contact |
|------|---------|
| On-call | Check PagerDuty schedule |
| Database Admin | dba@company.com |
| Infrastructure | infra@company.com |
| Security | security@company.com |
