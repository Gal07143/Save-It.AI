# SAVE-IT.AI Comprehensive Fix & Enhancement Plan

## Executive Summary

This plan addresses all critical, high, and medium priority issues identified in the code review, organized into 6 phases. Each phase builds on the previous, prioritizing security and stability first.

---

## Phase 1: Critical Security Fixes (Foundation)

### 1.1 Fix Authentication & Authorization Gaps

**Files to modify:**
- `backend/app/api/routers/admin.py`
- `backend/app/api/routers/system.py`
- `backend/app/api/routers/sites.py`
- `backend/app/api/routers/meters.py`

**Changes:**
1. Add `require_admin` dependency to all admin endpoints:
   - `create_organization` (line 23)
   - `list_organizations` (line 33)
   - `get_organization` (line 40)
   - `create_user` (line 48)
   - `list_users` (line 67)
   - `get_user` (line 75)
   - `reset_demo_data` (line 137)

2. Add authorization checks to resource endpoints:
   - `create_site` - validate user can create in specified org
   - `update_site` - validate user owns site
   - `create_meter` - validate user owns parent site
   - `update_meter` - validate user owns meter

3. Fix GDPR export endpoint (`system.py:154`) - require user to be the subject or admin

### 1.2 Fix Password Hashing

**File:** `backend/app/api/routers/admin.py`

**Change:**
```python
# Replace line 51:
# password_hash = hashlib.sha256(user.password.encode()).hexdigest()

# With:
from backend.app.api.routers.auth import get_password_hash
password_hash = get_password_hash(user.password)
```

### 1.3 Fix SECRET_KEY Persistence

**File:** `backend/app/api/routers/auth.py`

**Change:**
```python
# Replace line 24:
SECRET_KEY = os.getenv("SESSION_SECRET")
if not SECRET_KEY:
    raise RuntimeError("SESSION_SECRET environment variable must be set")
```

**File:** `backend/app/core/config.py`
- Add validation that SESSION_SECRET is set on startup

### 1.4 Fix Public Status Page Tokens

**File:** `backend/app/api/routers/public.py`

**Changes:**
1. Generate cryptographically secure tokens instead of `org_{id}`
2. Store token hash in database
3. Add token rotation capability

### 1.5 Fix CORS Configuration

**File:** `backend/app/main.py`

**Change:**
```python
# Replace lines 124-129:
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Phase 2: Database & Performance Fixes

### 2.1 Fix N+1 Query Problems

**File:** `backend/app/routers/devices_v2.py`

**Change lines 64-79:**
```python
# Use eager loading instead of individual queries
from sqlalchemy.orm import joinedload

devices = db.query(Device).options(
    joinedload(Device.model),
    joinedload(Device.product),
    joinedload(Device.gateway)
).filter(...).all()
```

### 2.2 Add Database Indexes

**New migration file:** `backend/alembic/versions/xxx_add_missing_indexes.py`

```python
# Add indexes for:
- api_keys.key_hash (already has unique, confirm index)
- meter_readings.timestamp (for range queries)
- meter_readings.meter_id (foreign key)
- bills.billing_period_start, bills.billing_period_end
- assets.site_id, assets.parent_id
- notifications.user_id, notifications.created_at
- audit_logs.created_at, audit_logs.user_id
```

### 2.3 Fix Transaction Handling

**File:** `backend/app/services/device_onboarding.py`

**Change lines 94-98:**
```python
try:
    self.db.add(device)
    if model_id:
        self._propagate_model_datapoints(device.id, model_id)
    self.db.commit()
except Exception:
    self.db.rollback()
    raise
```

### 2.4 Add Query Pagination Limits

**Files:** All router files with list endpoints

**Pattern:**
```python
@router.get("/items")
def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),  # Add max limit
    db: Session = Depends(get_db)
):
    return db.query(Item).offset(skip).limit(limit).all()
```

---

## Phase 3: Frontend Security & Stability

### 3.1 Move Auth Token to HttpOnly Cookies

**Backend changes:**
- `backend/app/api/routers/auth.py` - Set cookie on login response
- Add cookie-based token extraction in auth middleware

**Frontend changes:**
- `frontend/src/contexts/AuthContext.tsx` - Remove localStorage usage
- `frontend/src/services/api.ts` - Remove manual token header injection
- Configure fetch with `credentials: 'include'`

### 3.2 Fix TypeScript Type Safety

**File:** `frontend/src/services/api.ts`

**Changes:**
1. Create `frontend/src/types/index.ts` with all API types
2. Replace all `any` types with proper interfaces
3. Add proper error type narrowing

**Files with `any` to fix:**
- `Integrations.tsx` (8 instances)
- `DeviceConfig.tsx` (4 instances)
- `DigitalTwinBuilder.tsx` (3 instances)
- `DeviceOnboardingWizard.tsx` (6 instances)
- `Devices.tsx` (1 instance)

### 3.3 Add Error Boundaries & Error States

**New file:** `frontend/src/components/QueryErrorBoundary.tsx`

**Changes to pages:**
- Add `isError` handling to all `useQuery` calls
- Add error UI component for failed queries
- Wrap async-heavy components with error boundaries

### 3.4 Add Missing Key Props

**Files:**
- `Dashboard.tsx:269,282,313` - Add keys to notification/action maps
- `Devices.tsx:157` - Add `device.id` as key

---

## Phase 4: Code Quality & Maintainability

### 4.1 Backend Code Cleanup

**Create utility modules:**
- `backend/app/utils/password.py` - Centralize password hashing
- `backend/app/utils/ip.py` - Centralize `_get_client_ip()` function
- `backend/app/dependencies/auth.py` - Centralize auth dependencies

**Fix error handling:**
- Standardize HTTPException usage across all routers
- Add proper error logging before raising exceptions
- Create error response schema for consistency

### 4.2 Frontend Code Cleanup

**Extract shared components:**
- `LoadingSpinner.tsx` - Remove duplication from App.tsx
- `ModalOverlay.tsx` - Standardize modal backdrop
- `Button.tsx` - Standardize button styles

**Remove dead code:**
- `Devices.tsx:27` - Remove `_editDeviceId`
- `FileUpload.tsx:25` - Remove `_isUploading`
- `Bills.tsx:27` - Remove `_currentSite`
- `App.tsx:13,27` - Remove unused imports

### 4.3 Standardize API Responses

**Create response wrapper:**
```python
# backend/app/schemas/response.py
class APIResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T]
    error: Optional[str]
    meta: Optional[dict]  # pagination info
```

---

## Phase 5: Testing & CI/CD

### 5.1 Add Backend Test Suite

**New directory:** `backend/tests/`

```
backend/tests/
├── conftest.py           # Fixtures (test db, client, auth)
├── test_auth.py          # Authentication tests
├── test_admin.py         # Admin endpoint tests
├── test_sites.py         # Site CRUD tests
├── test_meters.py        # Meter CRUD tests
├── test_analysis.py      # Analysis endpoint tests
├── test_security.py      # Security-specific tests
└── test_integration.py   # End-to-end flows
```

**Test coverage targets:**
- Auth flows: 100%
- Admin endpoints: 100%
- Core CRUD: 80%
- Analysis: 70%

### 5.2 Add Frontend Test Suite

**New files:**
```
frontend/src/
├── __tests__/
│   ├── AuthContext.test.tsx
│   ├── api.test.ts
│   └── components/
│       ├── ConfirmDialog.test.tsx
│       └── ErrorBoundary.test.tsx
```

### 5.3 Add CI/CD Pipeline

**New file:** `.github/workflows/ci.yml`

```yaml
jobs:
  backend-tests:
    - Install dependencies
    - Run pytest with coverage
    - Upload coverage report

  frontend-tests:
    - Install dependencies
    - Run TypeScript check
    - Run tests
    - Build production bundle

  security-scan:
    - Run bandit (Python security)
    - Run npm audit
    - Run SAST scanner
```

---

## Phase 6: Production Readiness

### 6.1 Configuration Management

**Changes:**
- Add startup validation for required env vars
- Create `.env.example` with all required variables
- Add configuration documentation

**Required variables:**
```
DATABASE_URL=
SESSION_SECRET=
ALLOWED_ORIGINS=
OPENAI_API_KEY=
SENDGRID_API_KEY= (optional)
```

### 6.2 Logging & Monitoring

**Backend changes:**
- Add structured JSON logging
- Add correlation IDs to all requests
- Add health check endpoints for all dependencies

**New file:** `backend/app/core/logging.py`

### 6.3 Database Migrations

**Ensure all schema changes are tracked:**
- Review current models vs migrations
- Generate migrations for any drift
- Add migration tests

### 6.4 Documentation

**Create:**
- `docs/API.md` - API documentation
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/DEVELOPMENT.md` - Developer setup guide

---

## Implementation Order

| Week | Phase | Priority Items |
|------|-------|----------------|
| 1 | Phase 1 | All critical security fixes |
| 2 | Phase 2 | N+1 queries, indexes, transactions |
| 3 | Phase 3 | Frontend security, TypeScript fixes |
| 4 | Phase 4 | Code cleanup, standardization |
| 5-6 | Phase 5 | Test suite, CI/CD |
| 7 | Phase 6 | Production readiness |

---

## Verification Plan

### After Phase 1:
- [ ] All admin endpoints require authentication
- [ ] Cannot create users with SHA256 passwords
- [ ] App fails to start without SESSION_SECRET
- [ ] CORS rejects unauthorized origins

### After Phase 2:
- [ ] Device list query uses ≤5 database queries
- [ ] All list endpoints enforce max limit
- [ ] Failed device onboarding rolls back cleanly

### After Phase 3:
- [ ] No auth token in localStorage
- [ ] TypeScript build has 0 `any` warnings
- [ ] All pages show error UI on query failure

### After Phase 4:
- [ ] No code duplication warnings
- [ ] All API responses follow standard format
- [ ] No dead code warnings

### After Phase 5:
- [ ] Backend test coverage ≥80%
- [ ] CI pipeline passes on all PRs
- [ ] Security scan finds 0 critical issues

### After Phase 6:
- [ ] App starts with only required env vars
- [ ] All logs are structured JSON
- [ ] Health endpoint checks all dependencies

---

## Files Summary

**Backend files to modify:** 25+
**Frontend files to modify:** 15+
**New files to create:** 20+
**Tests to write:** 50+

**Key files:**
- `backend/app/api/routers/admin.py` - Critical auth fixes
- `backend/app/api/routers/auth.py` - SECRET_KEY fix
- `backend/app/main.py` - CORS fix
- `backend/app/routers/devices_v2.py` - N+1 fix
- `frontend/src/contexts/AuthContext.tsx` - Cookie auth
- `frontend/src/services/api.ts` - Type safety
