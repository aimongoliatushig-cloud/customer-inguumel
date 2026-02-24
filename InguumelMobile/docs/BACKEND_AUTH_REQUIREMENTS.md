# Backend auth requirements (mobile API)

The React Native app uses **Bearer token only** for API auth. It no longer sends any `Cookie` or `session_id` header.

## Required backend behavior

1. **`/api/v1/mxm/orders` (and all mxm protected routes)**  
   - Authenticate via **Bearer token only** (header `Authorization: Bearer <token>`).  
   - Use the same token validation as `/api/v1/auth/login` and other token-protected endpoints.  
   - Do **not** rely on `request.session` or `session_id` cookie.

2. **Cookie header**  
   - If the client sends a `Cookie` header (e.g. from a shared HTTP client), the backend must **not** fail when the session is expired or missing.  
   - In that case: ignore the cookie and validate the Bearer token instead.  
   - Do not require or prefer session cookie over Bearer for mxm endpoints.

## Acceptance

- After login, `GET /api/v1/mxm/orders?warehouse_id=1` with `Authorization: Bearer <token>` returns **200** and list data.
- Navigating OrderDetail and going back triggers orders refresh without 401 and without logout.
