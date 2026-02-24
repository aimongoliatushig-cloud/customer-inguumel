# Auth flow – test checklist

Bearer-only auth with Odoo. Single deterministic flow; no cookies.

## 1. Login → Orders OK

- [ ] Open app, log in with valid phone + PIN.
- [ ] Navigate to Orders tab.
- [ ] Orders list loads (no 401, no “session expired”).
- [ ] Pull-to-refresh works.

## 2. Manually remove token → Orders → redirected to Login

- [ ] Log in, go to Orders.
- [ ] Clear token (e.g. dev: clear AsyncStorage key `@inguumel_access_token`, or use a “Clear token” dev button).
- [ ] Navigate to Orders (or trigger any authenticated request).
- [ ] App shows Login screen (single message: “Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.”).
- [ ] No duplicate alerts, no loop.

## 3. Background app → resume → token still attached

- [ ] Log in, go to any tab (e.g. Orders or Home).
- [ ] Send app to background (home button / app switch).
- [ ] Wait a few seconds, bring app back to foreground.
- [ ] No unexpected logout.
- [ ] Requests still use Bearer token (e.g. refresh Orders or load products).

## Optional

- [ ] On 401 from any protected endpoint, exactly one modal: “Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.” and redirect to Login.
- [ ] Orders tab: no token → “Нэвтрэх” CTA (not “Алдаа гарлаа”).
- [ ] Network error on Orders → retry UI, not generic “Алдаа гарлаа” for 401.
