# Inguumel Mobile (Expo + Odoo API)

Production-grade Expo (managed) TypeScript starter integrated with the Odoo API contract.

## Terminal commands

```bash
# Install dependencies
npm install

# Start dev server
npx expo start

# Point to stage API (e.g. local or staging server)
API_BASE_URL=http://192.168.1.100:8069 npx expo start

# Type-check
npx tsc --noEmit

# Run on iOS / Android
npx expo start --ios
npx expo start --android
```

## File tree (relevant)

```
InguumelMobile/
├── App.tsx                    # Entry: NavigationContainer + Stack, auth callbacks
├── app.config.js              # Env-based API URL (API_BASE_URL, EXPO_PUBLIC_API_BASE_URL)
├── app.json
├── babel.config.js             # module-resolver alias: ~ -> ./src
├── package.json
├── tsconfig.json
└── src/
    ├── api/
    │   ├── client.ts           # Axios instance, interceptors, 401 → logout, DEV logging
    │   ├── endpoints.ts         # login, getAimags, getSoums, getWarehouses, getMxmProducts, cart, checkout
    │   └── index.ts
    ├── constants/
    │   ├── config.ts           # baseURL, env, isDev, API_TIMEOUT_MS (from Constants.expoConfig.extra)
    │   ├── device.ts           # DEVICE_ID, CLIENT_VERSION (X-Device-Id, X-Client-Version)
    │   └── index.ts
    ├── store/
    │   ├── authStore.ts        # token, user, login(), logout(), hydrate()
    │   ├── locationStore.ts    # aimag_id, sum_id, setLocation(), hydrate(); resets cart on set
    │   ├── cartStore.ts        # cart_id, lines, setCart(), resetCart()
    │   └── index.ts
    ├── screens/
    │   ├── InitScreen.tsx      # Hydrates stores → replace to Login / LocationSelect / Home
    │   ├── LoginScreen.tsx     # email/password → login → LocationSelect
    │   ├── LocationSelectScreen.tsx  # aimags → soums → warehouses (persist in AsyncStorage) → Home
    │   ├── HomeProductsScreen.tsx    # Products list, add-to-cart, Cart header button
    │   ├── CartScreen.tsx      # Placeholder: cart_id, lines count; Checkout (Idempotency-Key); Logout
    │   └── index.ts
    ├── components/
    │   ├── Loading.tsx
    │   └── index.ts
    ├── types/
    │   ├── api.ts              # ApiResponse, AppError, LoginData, ProductItem, CartData, etc.
    │   └── index.ts
    └── utils/
        ├── errors.ts           # normalizeError() → AppError
        └── index.ts
```

## Flow

- **Init** → hydrate auth + location → replace to **Login** | **LocationSelect** | **Home**
- **Login** → POST `/api/v1/auth/login` → save token → replace **LocationSelect**
- **LocationSelect** → GET aimags/soums/warehouses → persist aimag/soum/warehouse (AsyncStorage only) → replace **Home**
- **Home** → GET products, add-to-cart → header "Cart (n)" → **Cart**
- **Cart** → Checkout (Idempotency-Key) → order_id; Logout → clear token → **Login**

## Config

- **API URL**: `app.json` `extra.apiBaseUrl` or env `API_BASE_URL` / `EXPO_PUBLIC_API_BASE_URL` (see `app.config.js`).
- **Prod**: `https://api.inguumel.mn`. **Stage**: `http://<STAGE_IP>:8069` (set via env when running `npx expo start`).

## Troubleshooting

### Expo Go networking (HTTP stage)

- **iOS**: Expo Go allows HTTP if the stage URL is `http://<IP>:8069`. Ensure device and dev machine are on the same network; use your machine’s LAN IP (e.g. `http://192.168.1.100:8069`).
- **Android**: By default cleartext (HTTP) is blocked. For a dev build you can allow cleartext in network security config; in Expo Go, hitting an HTTP API from a device may fail. Prefer HTTPS for stage or use a tunnel (e.g. ngrok) so the app uses `https://...`.

### 401 / logout redirect

- On any 401, the API client calls `onUnauthorized` (authStore.logout) and the response is rejected. The UI should redirect to Login (e.g. after hydrate on next app open, or via a global listener). InitScreen sends unauthenticated users to Login; after logout, call `navigation.reset({ index: 0, routes: [{ name: 'Login' }] })` (as in CartScreen).

### Idempotency-Key

- Checkout and payment (QPay) require `Idempotency-Key` header. The client sets it only for `POST /api/v1/cart/checkout` (and can be extended for payment) and clears it after the request. CartScreen generates a unique key per checkout attempt.

### DEV request/response logging

- When `extra.env === 'development'` (or NODE_ENV / EXPO_PUBLIC_ENV), the API client logs each request and response in the console. Set `env` in `extra` or via env so stage builds can disable logging in production.

### Path alias `~/*`

- Imports use `~/*` → `./src/*` (tsconfig + babel-plugin-module-resolver). If Metro fails to resolve `~`, ensure `babel.config.js` is present and run `npx expo start --clear`.
