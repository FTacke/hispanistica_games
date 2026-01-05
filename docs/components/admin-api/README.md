# admin-api Component

**Purpose:** REST API for admin user management (CRUD operations on users).

**Scope:** Admin-only HTTP API endpoints for managing user accounts. Does NOT include auth logic (see [auth](../auth/)) or admin UI pages.

---

## Responsibility

1. **User CRUD** - List, create, read, update users
2. **Password Reset** - Admin-initiated password resets
3. **Access Control** - Admin-only (requires `Role.ADMIN`)
4. **Input Validation** - Email format, role whitelist, uniqueness constraints

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/routes/admin.py` | Admin REST API blueprint |
| `static/js/auth/admin_users.js` | Frontend JavaScript for admin UI |
| `templates/auth/admin_users.html` | Admin user management page |

---

## API Endpoints

**Base URL:** `/api/admin`

### GET /api/admin/users
**Purpose:** List all users  
**Auth:** `@jwt_required() + @require_role(Role.ADMIN)`  
**Response:**
```json
{
  "users": [
    {
      "user_id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "is_active": true,
      "created_at": "2025-01-24T10:00:00Z",
      "last_login_at": "2025-01-24T12:00:00Z"
    }
  ]
}
```

### POST /api/admin/users
**Purpose:** Create new user  
**Auth:** `@jwt_required() + @require_role(Role.ADMIN)`  
**Request:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepass123",
  "role": "user"
}
```
**Response:** `201 Created` + user object with `user_id`  
**Validation:**
- Username unique
- Email unique (if provided)
- Role must be: user, editor, admin
- Password min 1 char (no strict policy)

### GET /api/admin/users/<user_id>
**Purpose:** Get user details  
**Auth:** `@jwt_required() + @require_role(Role.ADMIN)`  
**Response:** Single user object

### PATCH /api/admin/users/<user_id>
**Purpose:** Update user  
**Auth:** `@jwt_required() + @require_role(Role.ADMIN)`  
**Request:** Partial user object (only fields to update)
```json
{
  "email": "newemail@example.com",
  "is_active": false,
  "role": "editor"
}
```
**Response:** `200 OK` + updated user object

### POST /api/admin/users/<user_id>/reset-password
**Purpose:** Admin-initiated password reset  
**Auth:** `@jwt_required() + @require_role(Role.ADMIN)`  
**Request:**
```json
{
  "new_password": "newpass123"
}
```
**Response:** `200 OK` + `{"message": "Password reset successful"}`  
**Side Effect:** Sets `must_reset_password=true` to force user to change password on next login

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 400 Bad Request | Invalid input, missing required fields |
| 401 Unauthorized | JWT missing/expired |
| 403 Forbidden | User lacks admin role |
| 404 Not Found | User ID not found |
| 409 Conflict | Username/email already exists |
| 500 Internal Server Error | Database error, unexpected exception |

**Error Format:**
```json
{
  "error": "Error message"
}
```

---

## Security

**Authorization:** All endpoints require `@jwt_required()` + `@require_role(Role.ADMIN)`  
**CSRF Protection:** JWT in HTTP-only cookie (SameSite=Lax)  
**Input Sanitization:** SQLAlchemy ORM prevents SQL injection  
**Rate Limiting:** Inherited from global limiter (200/hour)

---

## Frontend Integration

**Admin UI:** `GET /auth/admin_users` (page, not API)  
**JavaScript:** `static/js/auth/admin_users.js`  
- Fetches user list on page load
- Provides forms for create, edit, delete
- Calls `/api/admin/users` endpoints

---

## Related Components

- **[auth](../auth/)** - Provides authentication, Role enum
- **[database](../database/)** - User model, database operations
- **[frontend-ui](../frontend-ui/)** - Admin UI templates

---

**See Also:**
- Auth Component: [../auth/README.md](../auth/README.md)
- Main README: [../../README.md](../../README.md)
