# Kubernetes Deployment Guide

This guide covers deploying Save-It.AI to a Kubernetes cluster.

## Prerequisites

- Kubernetes cluster 1.24+
- kubectl configured for your cluster
- Helm 3+ (for cert-manager and ingress controller)
- Container registry access

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Configure Secrets

```bash
# Create secrets from template
cp k8s/secrets.yaml k8s/secrets-local.yaml

# Edit with your values (base64 encoded)
# Generate base64 values:
echo -n "your-session-secret" | base64
echo -n "postgresql://user:pass@host:5432/saveit" | base64

# Apply secrets
kubectl apply -f k8s/secrets-local.yaml
```

### 3. Apply Configuration

```bash
# ConfigMap
kubectl apply -f k8s/configmap.yaml

# Deployments
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Services
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-service.yaml

# Ingress
kubectl apply -f k8s/ingress.yaml

# Autoscaling
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
```

### 4. Apply All at Once

```bash
kubectl apply -f k8s/
```

## Manifests Overview

| File | Purpose |
|------|---------|
| `namespace.yaml` | Isolated saveit namespace |
| `configmap.yaml` | Non-sensitive configuration |
| `secrets.yaml` | Template for secrets |
| `backend-deployment.yaml` | Backend pods with security context |
| `backend-service.yaml` | Backend ClusterIP service |
| `frontend-deployment.yaml` | Frontend pods (nginx) |
| `frontend-service.yaml` | Frontend ClusterIP service |
| `ingress.yaml` | TLS termination and routing |
| `hpa.yaml` | Horizontal Pod Autoscaler |
| `pdb.yaml` | Pod Disruption Budget |

## External Dependencies

### PostgreSQL

Option 1: Managed Database (Recommended)
```bash
# AWS RDS, GCP Cloud SQL, or Azure Database for PostgreSQL
# Update DATABASE_URL in secrets
```

Option 2: In-Cluster PostgreSQL
```bash
# Using Bitnami Helm chart
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgres bitnami/postgresql \
  --namespace saveit \
  --set auth.database=saveit \
  --set auth.username=saveit \
  --set persistence.size=20Gi
```

### Redis

Option 1: Managed Redis
```bash
# AWS ElastiCache, GCP Memorystore, or Azure Cache for Redis
```

Option 2: In-Cluster Redis
```bash
helm install redis bitnami/redis \
  --namespace saveit \
  --set architecture=standalone \
  --set auth.enabled=false
```

### Ingress Controller

```bash
# nginx ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

### TLS with cert-manager

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

## Configuration

### Update Domain

Edit `k8s/ingress.yaml`:
```yaml
spec:
  tls:
    - hosts:
        - your-domain.com
        - api.your-domain.com
      secretName: saveit-tls
  rules:
    - host: api.your-domain.com
    # ...
    - host: your-domain.com
```

### Resource Limits

Edit deployments to adjust resource limits:
```yaml
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

### Scaling Configuration

Edit `k8s/hpa.yaml`:
```yaml
spec:
  minReplicas: 2      # Minimum pods
  maxReplicas: 10     # Maximum pods
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70  # Scale at 70% CPU
```

## Operations

### View Pod Status

```bash
# All pods in namespace
kubectl get pods -n saveit

# Pod details
kubectl describe pod <pod-name> -n saveit

# Pod logs
kubectl logs <pod-name> -n saveit

# Follow logs
kubectl logs -f <pod-name> -n saveit
```

### Health Checks

```bash
# Check readiness
kubectl get pods -n saveit -o wide

# Port forward for local access
kubectl port-forward svc/saveit-backend 8000:8000 -n saveit

# Test health endpoint
curl http://localhost:8000/api/v1/health/ready
```

### Scaling

```bash
# Manual scale
kubectl scale deployment saveit-backend --replicas=5 -n saveit

# Check HPA status
kubectl get hpa -n saveit

# Describe HPA for scaling events
kubectl describe hpa saveit-backend-hpa -n saveit
```

### Rolling Update

```bash
# Update image
kubectl set image deployment/saveit-backend \
  backend=saveit/backend:v1.2.0 -n saveit

# Watch rollout
kubectl rollout status deployment/saveit-backend -n saveit

# Rollback if needed
kubectl rollout undo deployment/saveit-backend -n saveit
```

### Database Migrations

```bash
# Run migrations via job
kubectl run migrate --rm -it \
  --image=saveit/backend:latest \
  --restart=Never \
  --namespace=saveit \
  --env-from=configmap/saveit-config \
  --env-from=secret/saveit-secrets \
  -- alembic upgrade head
```

## Monitoring

### Prometheus Integration

Add annotations to deployments for scraping:
```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
```

### View Metrics

```bash
# Port forward to backend
kubectl port-forward svc/saveit-backend 8000:8000 -n saveit

# Fetch metrics
curl http://localhost:8000/metrics
```

## Troubleshooting

### Pod Won't Start

```bash
# Check events
kubectl get events -n saveit --sort-by='.lastTimestamp'

# Check pod status
kubectl describe pod <pod-name> -n saveit

# Common issues:
# - ImagePullBackOff: Check registry credentials
# - CrashLoopBackOff: Check logs and environment variables
# - Pending: Check resource availability
```

### Connection Issues

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup saveit-backend.saveit.svc.cluster.local

# Test connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://saveit-backend.saveit.svc.cluster.local:8000/api/v1/health
```

### Database Connection

```bash
# Check secret is mounted
kubectl exec -it <backend-pod> -n saveit -- env | grep DATABASE

# Test connection from pod
kubectl exec -it <backend-pod> -n saveit -- \
  python -c "from app.core.database import engine; print(engine.connect())"
```

### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n saveit

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify TLS certificate
kubectl get certificate -n saveit
kubectl describe certificate saveit-tls -n saveit
```

## Security Checklist

- [ ] Secrets are not committed to git
- [ ] Use managed secrets (AWS Secrets Manager, GCP Secret Manager)
- [ ] Network policies restrict pod-to-pod communication
- [ ] Pod security contexts enforce non-root
- [ ] Resource limits prevent runaway pods
- [ ] TLS certificates automatically renewed
- [ ] Ingress rate limiting enabled
- [ ] Audit logging enabled on cluster

## Production Recommendations

1. **Use managed databases** - RDS, Cloud SQL for reliability
2. **Multi-AZ deployment** - Pod anti-affinity spreads replicas
3. **Backup strategy** - Regular database backups to object storage
4. **Monitoring** - Prometheus + Grafana for metrics
5. **Logging** - Centralized logging with ELK or Loki
6. **Alerting** - PagerDuty/Opsgenie for critical alerts
