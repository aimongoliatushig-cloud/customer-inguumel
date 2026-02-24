# Order Detail Screen – Which File Renders & Proof

## Which screen file actually renders order detail

**File:** `src/screens/OrderDetailScreen.tsx`  
**Route name:** `OrderDetail`  
**Navigation config:** `src/navigation/OrdersStackNavigator.tsx`  
- Import: `import { OrderDetailScreen } from '~/screens/OrderDetailScreen';`  
- Mapping: `<Stack.Screen name="OrderDetail" component={OrderDetailScreen} ... />`  
**Entry points:**  
- `OrdersScreen.tsx`: `navigation.navigate('OrderDetail', { orderId: id })`  
- `OrderInfoScreen.tsx`: references `screen: 'OrderDetail'`

---

## Proof checklist (do this to verify)

1. **Logs**  
   At the top of `OrderDetailScreen`, the following run on every render:
   - `[OrderDetailScreen] RENDER` + ISO timestamp  
   - `[OrderDetailScreen] FILE` + `src/screens/OrderDetailScreen.tsx`  
   - `[OrderDetailScreen] route.name` + `OrderDetail`  
   - `[OrderDetailScreen] route.params` + JSON of params  

2. **Visible UI**  
   Red bar at top of the screen: **"DEBUG: UI PATCH ACTIVE"**  
   If this does **not** show when you open an order, you are not on the screen from `OrderDetailScreen.tsx` (e.g. wrong route or cached bundle).

3. **Kill caches and reinstall**
   ```bash
   # Stop Metro (Ctrl+C)
   # Delete app from device/simulator
   npx expo start -c
   # Reinstall: open on device/simulator (Expo Go or dev build)
   ```

---

## Proof to capture

After the above:

- **Screenshot:** Order Detail screen with the red **"DEBUG: UI PATCH ACTIVE"** bar visible at the top.  
- **Terminal:** Metro/Expo logs showing at least one line like:
  ```text
  [OrderDetailScreen] RENDER 2026-02-02T...
  [OrderDetailScreen] FILE src/screens/OrderDetailScreen.tsx
  [OrderDetailScreen] route.name OrderDetail
  [OrderDetailScreen] route.params {"orderId":123,...}
  ```

If the debug bar does not appear after cache clear and reinstall, the Order Detail UI is coming from another screen or bundle (e.g. different navigator or entry).
