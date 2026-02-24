import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '~/state/AppContext';
import { locationStore } from '~/store/locationStore';
import { authStore } from '~/store/authStore';
import {
  getMxmOrders,
  getPosOnlineOrders,
  getOrderDelivery,
  type MxmOrderItem,
  type PosOnlineOrderItem,
} from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import type { OrdersStackParamList } from '~/navigation/types';
import { getDeliveryStatusLabelForList, getOrderStatusLabel } from '~/utils/orderStatusLabels';
import {
  normalizeDeliveryCode,
  deliveryStepIndex,
  isDelivered,
  isCancelled,
  type DeliveryCode,
} from '~/utils/deliveryStatus';
import { MiniDeliveryProgress } from '~/components/MiniDeliveryProgress';
import { formatMnt } from '~/components/cart/formatMoney';

const DELIVERY_FETCH_LIMIT = 20;
type DeliveryStatusByOrderId = Record<number, { current_status: { code: string } }>;

/** Map POS online order item to list shape used by OrdersScreen (same sale.order, different API). */
function posOrderToMxmItem(item: PosOnlineOrderItem, state: 'pending' | 'delivered' | 'cancelled'): MxmOrderItem {
  const code = ((item.mxm_delivery_status ?? '').trim().toLowerCase()) || null;
  const delivered = code === 'delivered';
  const cancelled = code === 'cancelled';
  const active = code != null && ['received', 'preparing', 'prepared', 'out_for_delivery'].includes(code);
  return {
    id: item.order_id,
    order_id: item.order_id,
    order_number: item.order_number,
    name: item.order_number,
    amount_total: item.total_amount,
    date_order: item.last_change,
    delivery_status_code: item.mxm_delivery_status ?? undefined,
    mxm_delivery_status: item.mxm_delivery_status ?? undefined,
    delivery_is_delivered: delivered,
    delivery_is_cancelled: cancelled,
    delivery_is_active: active,
  };
}

/** Delivery code: list API fields first, then cache from GET delivery, then order.state. */
function getDeliveryCodeFromOrder(order: MxmOrderItem, cache: DeliveryStatusByOrderId): DeliveryCode | null {
  const orderId = Number((order.id ?? order.order_id ?? 0) || 0);
  const fromCache = orderId ? cache[orderId]?.current_status?.code : undefined;
  if (fromCache != null) return normalizeDeliveryCode(fromCache);
  const code =
    order.delivery_status_code ??
    (order as { mxm_delivery_status?: string }).mxm_delivery_status ??
    null;
  const normalized = normalizeDeliveryCode(code);
  if (normalized !== null) return normalized;
  if (order.delivery_is_delivered === true) return 'delivered';
  if (order.delivery_is_cancelled === true) return 'cancelled';
  const state = String((order.state ?? order.status) ?? '').trim().toLowerCase();
  if (state === 'delivered' || state === 'done' || state === 'completed' || state === 'complete') return 'delivered';
  if (state === 'cancelled' || state === 'cancel' || state === 'canceled') return 'cancelled';
  return null;
}

/** List date: YYYY.MM.DD HH:mm */
function formatListDate(value: string | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${h}:${min}`;
  } catch {
    return value;
  }
}

type TabKey = 'all' | 'active' | 'delivered' | 'cancelled';

function OrderCard({
  item,
  deliveryCode,
  onPress,
}: {
  item: MxmOrderItem;
  deliveryCode: DeliveryCode | null;
  onPress: () => void;
}) {
  const orderNumber =
    item.order_number ?? item.name ?? `#${(item.id ?? item.order_id ?? '?')}`;
  const delivered = isDelivered(deliveryCode);
  const cancelled = isCancelled(deliveryCode);
  const isOutForDelivery = deliveryCode === 'out_for_delivery';
  const statusCode =
    item.delivery_status_code ??
    (item as { mxm_delivery_status?: string }).mxm_delivery_status;
  const deliveryLabel = getDeliveryStatusLabelForList(
    item.delivery_status_label_mn ?? undefined,
    statusCode ?? undefined
  );
  const statusLabel = delivered
    ? 'Хүргэгдсэн'
    : cancelled
      ? 'Цуцлагдсан'
      : (deliveryLabel != null && deliveryLabel !== 'Тодорхойгүй')
        ? deliveryLabel
        : getOrderStatusLabel(item.state, item.status);
  const stepIndex = deliveryStepIndex(deliveryCode);

  const badgeStyle =
    delivered
      ? styles.badgeDelivered
      : cancelled
        ? styles.badgeCancelled
        : isOutForDelivery
          ? styles.badgeOutForDelivery
          : styles.badge;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNumber} numberOfLines={1}>{orderNumber}</Text>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, delivered && styles.badgeTextDelivered, isOutForDelivery && styles.badgeTextOutForDelivery]} numberOfLines={1}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.cardMiddle}>
        <Text style={styles.date}>{formatListDate(item.date_order)}</Text>
        <Text style={styles.amount}>{formatMnt(item.amount_total)}</Text>
      </View>
      <MiniDeliveryProgress
        currentStepIndex={stepIndex >= 0 ? stepIndex : 0}
        isCancelled={cancelled}
      />
    </TouchableOpacity>
  );
}

const UNAUTHORIZED_CODES = ['UNAUTHORIZED'];
function isUnauthorized(err: unknown): boolean {
  const e = err as { code?: string; status?: number };
  const code = e?.code ?? '';
  return e?.code === 'UNAUTHORIZED' || e?.status === 401 || UNAUTHORIZED_CODES.includes(code);
}

function useEffectiveWarehouseId(): {
  warehouseId: number | null;
  warehouseName: string | null;
  isOwner: boolean;
} {
  const locationWarehouseId = locationStore((s) => s.warehouse_id);
  const warehouse_ids = authStore((s) => s.warehouse_ids);
  const owner_warehouses = authStore((s) => s.owner_warehouses);
  const locationWarehouseName = locationStore((s) => s.warehouse_name);
  const isOwner = Array.isArray(warehouse_ids) && warehouse_ids.length > 0;
  if (!isOwner) {
    return {
      warehouseId: locationWarehouseId,
      warehouseName: locationWarehouseName,
      isOwner: false,
    };
  }
  const allowed = warehouse_ids as number[];
  const effectiveId =
    locationWarehouseId != null && allowed.includes(locationWarehouseId)
      ? locationWarehouseId
      : (allowed[0] ?? null);
  const nameFromOwner = effectiveId != null
    ? (owner_warehouses.find((w) => w.id === effectiveId)?.name ?? null)
    : null;
  const warehouseName = nameFromOwner ?? locationWarehouseName;
  return {
    warehouseId: effectiveId,
    warehouseName: warehouseName ?? (effectiveId != null ? `Агуулах #${effectiveId}` : null),
    isOwner: true,
  };
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Бүгд' },
  { key: 'active', label: 'Идэвхтэй' },
  { key: 'delivered', label: 'Хүргэгдсэн' },
  { key: 'cancelled', label: 'Цуцлагдсан' },
];

export function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OrdersStackParamList, 'OrderList'>>();
  const { token } = useApp();
  const { warehouseId, warehouseName, isOwner } = useEffectiveWarehouseId();
  const authStatus = authStore((s) => s.status);
  const [orders, setOrders] = useState<MxmOrderItem[]>([]);
  const [deliveryStatusByOrderId, setDeliveryStatusByOrderId] = useState<DeliveryStatusByOrderId>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    if (warehouseId == null) {
      setOrders([]);
      setDeliveryStatusByOrderId({});
      setLoading(false);
      setError(null);
      return;
    }
    if (authStatus === 'LOGGING_OUT') return;
    if (!token) {
      setOrders([]);
      setDeliveryStatusByOrderId({});
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let list: MxmOrderItem[];
      if (isOwner) {
        try {
          const [pending, delivered, cancelled] = await Promise.all([
            getPosOnlineOrders(warehouseId, { state: 'pending' }),
            getPosOnlineOrders(warehouseId, { state: 'delivered' }),
            getPosOnlineOrders(warehouseId, { state: 'cancelled' }),
          ]);
          list = [
            ...pending.map((o) => posOrderToMxmItem(o, 'pending')),
            ...delivered.map((o) => posOrderToMxmItem(o, 'delivered')),
            ...cancelled.map((o) => posOrderToMxmItem(o, 'cancelled')),
          ];
        } catch {
          list = await getMxmOrders(warehouseId, { delivery_tab: 'all' });
        }
      } else {
        list = await getMxmOrders(warehouseId, { delivery_tab: 'all' });
      }
      setOrders(list);
      if (typeof __DEV__ !== 'undefined' && __DEV__ && list.length > 0) {
        const first = list[0];
        const rawStatusPayload = {
          delivery_status_code: first?.delivery_status_code,
          delivery_status_label_mn: first?.delivery_status_label_mn,
          delivery_status_label: (first as { delivery_status_label?: string })?.delivery_status_label,
          mxm_delivery_status: (first as { mxm_delivery_status?: string })?.mxm_delivery_status,
          state: first?.state,
          status: first?.status,
        };
        // eslint-disable-next-line no-console
        console.log('[OrdersScreen] raw status payload (first order):', JSON.stringify(rawStatusPayload));
      }
      const ids = list.slice(0, DELIVERY_FETCH_LIMIT).map((o) => Number((o.id ?? o.order_id ?? 0) || 0)).filter((id) => id > 0);
      const uniq = [...new Set(ids)];
      const results = await Promise.allSettled(uniq.map((id) => getOrderDelivery(id)));
      setDeliveryStatusByOrderId((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && uniq[i]) next[uniq[i]] = { current_status: r.value.current_status };
        });
        return next;
      });
    } catch (e) {
      if (isCancelError(e)) return;
      if (isUnauthorized(e)) {
        setError(null);
        setOrders([]);
        return;
      }
      const message = e instanceof Error ? e.message : 'Сүлжээний алдаа. Дахин оролдоно уу.';
      setError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, token, authStatus, isOwner]);

  useFocusEffect(
    useCallback(() => {
      if (authStatus === 'LOGGING_OUT' || !token) return;
      fetchOrders();
    }, [fetchOrders, authStatus, token])
  );

  useEffect(() => {
    if (warehouseId != null && token && authStatus !== 'LOGGING_OUT') {
      fetchOrders();
    }
  }, [tab]);

  const filteredOrders = useMemo(() => {
    const byTab =
      tab === 'all'
        ? orders
        : orders.filter((o) => {
            const code = getDeliveryCodeFromOrder(o, deliveryStatusByOrderId);
            if (tab === 'active') return !isDelivered(code) && !isCancelled(code);
            if (tab === 'delivered') return isDelivered(code);
            if (tab === 'cancelled') return isCancelled(code);
            return true;
          });
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((o) => {
      const num = (o.order_number ?? o.name ?? String(o.id ?? o.order_id ?? '')).toLowerCase();
      return num.includes(q);
    });
  }, [orders, tab, searchQuery, deliveryStatusByOrderId]);

  if (warehouseId == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Захиалга</Text>
        <Text style={styles.subtitle}>
          {isOwner ? 'Агуулах олдсонгүй.' : 'Агуулах сонгогдоогүй байна'}
        </Text>
      </View>
    );
  }

  if (!token || authStatus === 'LOGGING_OUT') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Захиалга</Text>
        <Text style={styles.subtitle}>Захиалга харахын тулд нэвтэрнэ үү</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => {}} activeOpacity={0.8}>
          <Text style={styles.ctaButtonText}>Нэвтрэх</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Уншиж байна...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Захиалга</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrders} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Дахин оролдох</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showEmpty = orders.length === 0 || filteredOrders.length === 0;
  const emptyMessage = tab === 'active'
    ? 'Идэвхтэй захиалга алга байна'
    : tab === 'delivered'
      ? 'Хүргэгдсэн захиалга алга байна'
      : tab === 'cancelled'
        ? 'Цуцлагдсан захиалга алга байна'
        : 'Захиалга байхгүй байна.';

  return (
    <View style={styles.container}>
      {warehouseName != null && (
        <View style={styles.warehouseHeader}>
          <Text style={styles.warehouseHeaderText} numberOfLines={1}>
            {isOwner ? `Миний агууллын захиалга · ${warehouseName}` : warehouseName}
          </Text>
        </View>
      )}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Захиалгын дугаар (жишээ: S00013)"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
      {showEmpty ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="document-text-outline" size={64} color="#cbd5e1" />
          </View>
          <Text style={styles.emptyTitle}>{emptyMessage}</Text>
          {isOwner && warehouseId != null && (
            <Text style={styles.emptyDiagnostics}>
              Агуулах ID: {warehouseId} · Таб: {tab}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id ?? item.order_number ?? Math.random())}
          renderItem={({ item }) => {
            const orderId = Number((item.id ?? item.order_id ?? 0) || 0);
            const code = getDeliveryCodeFromOrder(item, deliveryStatusByOrderId);
            return (
              <OrderCard
                item={item}
                deliveryCode={code}
                onPress={() => navigation.navigate('OrderDetail', { orderId })}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchOrders} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  warehouseHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  warehouseHeaderText: { fontSize: 13, color: '#64748b' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    paddingVertical: 0,
  },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
  },
  badgeDelivered: { backgroundColor: '#16a34a' },
  badgeCancelled: { backgroundColor: '#94a3b8' },
  badgeOutForDelivery: { backgroundColor: '#2563eb' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  badgeTextDelivered: { color: '#fff' },
  badgeTextOutForDelivery: { color: '#fff' },
  cardMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  date: { fontSize: 13, color: '#64748b' },
  amount: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8, color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  errorText: { fontSize: 16, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  ctaButton: { marginTop: 16, backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  retryButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: { marginBottom: 16 },
  emptyTitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  emptyDiagnostics: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
