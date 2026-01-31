# Authentication API

Save-It.AI uses JWT tokens for authentication. Tokens can be provided via:
- **HTTP-only cookies** (recommended for browser clients)
- **Authorization header** (for API clients)

Base URL: `/api/v1/auth`

## Endpoints

### Register

Create a new user account and organization.

```
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "organization_name": "Acme Corp"  // optional
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": 86400,
  "user": {
    "id": 1,
    "organization_id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "org_admin",
    "is_active": true,
    "mfa_enabled": false,
    "created_at": "2024-01-24T10:30:00Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Email already registered

### Login

Authenticate and receive access token.

```
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": 86400,
  "user": {
    "id": 1,
    "organization_id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "org_admin",
    "is_active": true,
    "mfa_enabled": false,
    "last_login_at": "2024-01-24T10:30:00Z",
    "created_at": "2024-01-20T08:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid email or password
- `403` - Account locked or disabled

**Account Lockout:**
After 5 failed login attempts, the account is locked for 15 minutes.

### Get Current User

Get the authenticated user's profile.

```
GET /api/v1/auth/me
```

**Headers:**
```
Authorization: Bearer <access_token>
```

Or use the `access_token` cookie (set automatically on login).

**Response:**
```json
{
  "id": 1,
  "organization_id": 1,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "role": "org_admin",
  "is_active": true,
  "mfa_enabled": false,
  "last_login_at": "2024-01-24T10:30:00Z",
  "created_at": "2024-01-20T08:00:00Z"
}
```

**Status Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Account disabled

### Logout

Clear the authentication cookie.

```
POST /api/v1/auth/logout
```

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

### Request Password Reset

Request a password reset email.

```
POST /api/v1/auth/password-reset?email=user@example.com
```

**Response:**
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

Note: Always returns success to prevent email enumeration.

## Authentication Methods

### Cookie-based (Browser)

After login, an HTTP-only cookie named `access_token` is automatically set. This is the recommended method for browser-based applications.

Cookie properties:
- `httpOnly: true` - Not accessible via JavaScript
- `secure: true` - HTTPS only (in production)
- `sameSite: lax` - CSRF protection
- `maxAge: 86400` - 24 hours

### Bearer Token (API)

For programmatic API access, include the token in the Authorization header:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Token Structure

JWT payload contains:
```json
{
  "sub": "1",          // User ID
  "exp": 1706176200    // Expiration timestamp
}
```

Tokens expire after 24 hours.

## CSRF Protection

For browser clients using cookies, include the CSRF token in mutation requests:

1. Get the CSRF token from the `csrf_token` cookie
2. Include it in the `X-CSRF-Token` header for POST, PUT, DELETE requests

```javascript
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1];

fetch('/api/v1/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({ name: 'New Site' })
});
```

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Platform administrator (all organizations) |
| `org_admin` | Organization administrator |
| `site_manager` | Site-level management |
| `viewer` | Read-only access |

## Error Responses

All authentication errors follow this format:

```json
{
  "detail": "Error message describing the issue"
}
```

Common error messages:
- `"Not authenticated"` - No token provided
- `"Invalid or expired token"` - Token is invalid or has expired
- `"Invalid email or password"` - Login credentials incorrect
- `"Account is disabled"` - User account deactivated
- `"Account is temporarily locked due to too many failed login attempts"` - Account locked
