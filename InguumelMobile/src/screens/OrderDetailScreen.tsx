import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
  AppState,
  Animated,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '~/navigation/types';
import { useApp } from '~/state/AppContext';
import { getMxmOrderDetail, getOrderDelivery, updateOrderDeliveryStatus, cancelOrder, type OrderDetail, type DeliveryResponse } from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { authStore } from '~/store/authStore';
import { orderDetailCopy } from '~/utils/orderI18n';
import { OrderTimeline } from '~/components/OrderTimeline';
import { formatMnt } from '~/components/cart/formatMoney';
import { buildOrderDetailVM, type OrderDetailVMItem, type OrderStatusPillTone } from '~/viewmodels/orderDetailVM';
import { buildDeliveryTimelineSteps, getDeliveryCurrentStatusLabel, formatDeliveryLastUpdated, formatCodConfirmedAt } from '~/utils/deliveryTimeline';

const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const SUCCESS_BANNER_DURATION_MS = 1250;
const POLL_INTERVAL_MS = 20_000;
const DELIVERY_POLL_INTERVAL_MS = 10_000;
const DELIVERY_POLL_BACKOFF_MS = 25_000;
const DELIVERY_POLL_BACKOFF_AFTER_MS = 60_000;
const STATUS_UPDATED_MESSAGE_DURATION_MS = 3000;
const STATUS_UPDATED_MESSAGE = 'Төлөв шинэчлэгдлээ';
const DELIVERY_RETRY_DELAY_MS = 3000;
const OFFLINE_HINT = 'Сүлжээ тасарсан';
const FORBIDDEN_ORDER_MESSAGE = 'Танд энэ салбарын захиалгад эрх алга байна.';

/** Next possible delivery status codes (canonical lowercase). */
const NEXT_STATUS: Record<string, string> = {
  received: 'preparing',
  preparing: 'prepared',
  prepared: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
const STATUS_BUTTON_LABELS: Record<string, string> = {
  preparing: 'Бэлтгэж байна',
  prepared: 'Бэлтгэж дууссан',
  out_for_delivery: 'Хүргэлтэд гарсан',
  delivered: 'Хүргэгдсэн',
};

const CANCEL_CONFIRM_TITLE = 'Захиалга цуцлах уу?';
const CANCEL_CONFIRM_MESSAGE = 'Энэ үйлдлийг буцааж болохгүй.';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

function OrderLineRow({ item, token }: { item: OrderDetailVMItem; token: string | null }) {
  const imageSource = item.imageUrl
    ? { uri: item.imageUrl, ...(token ? { headers: { Authorization: `Bearer ${token}` } as Record<string, string> } : {}) }
    : null;
  return (
    <View style={styles.lineRow}>
      {imageSource ? (
        <Image source={imageSource} style={styles.lineImage} resizeMode="cover" />
      ) : (
        <View style={[styles.lineImage, styles.lineImagePlaceholder]}>
          <Ionicons name="image-outline" size={24} color="#94a3b8" />
        </View>
      )}
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.lineMeta}>
          <Text style={styles.lineQty}>{item.qtyText}</Text>
          <Text style={styles.linePriceUnit}>{item.unitPriceText}</Text>
        </View>
        <Text style={styles.lineSubtotal}>{item.lineTotalText}</Text>
      </View>
    </View>
  );
}

function getPillStyle(tone: OrderStatusPillTone) {
  switch (tone) {
    case 'success':
      return styles.badgeSuccess;
    case 'warning':
      return styles.badgeWarning;
    case 'danger':
      return styles.badgeDanger;
    default:
      return styles.badgeInfo;
  }
}

function LoadingSkeleton() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>{orderDetailCopy.loading}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="alert-circle-outline" size={48} color="#dc2626" style={{ marginBottom: 16 }} />
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>{orderDetailCopy.retry}</Text>
      </TouchableOpacity>
    </View>
  );
}

const ORDER_DETAIL_SCREEN_FILE = 'src/screens/OrderDetailScreen.tsx';

export function OrderDetailScreen({ route, navigation }: Props) {
  const { token } = useApp();
  const warehouse_ids = authStore((s) => s.warehouse_ids);
  const isWarehouseOwner = Array.isArray(warehouse_ids) && warehouse_ids.length > 0;
  const { orderId, fromCreate } = route.params;
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryResponse | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(!!fromCreate);
  const [showStatusUpdatedMessage, setShowStatusUpdatedMessage] = useState(false);
  const [lastOrderMeta, setLastOrderMeta] = useState<{
    last_order_payment_method: 'cod' | 'qpay';
    last_order_warehouse_id: number;
  } | null>(null);
  const retryCountRef = useRef(0);
  const deliveryRetryDoneRef = useRef(false);
  const previousStatusRef = useRef<string | null>(null);
  const pillScaleRef = useRef(new Animated.Value(1));
  const lastVersionRef = useRef<string | null>(null);
  const deliveryPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deliveryBackoffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const owner_warehouses = authStore((s) => s.owner_warehouses);
  const currentDeliveryCode = String(delivery?.current_status?.code ?? '').trim().toLowerCase();
  const nextCode = currentDeliveryCode ? NEXT_STATUS[currentDeliveryCode] : null;
  const nextLabel = nextCode ? STATUS_BUTTON_LABELS[nextCode] : null;
  const canUpdateStatus = isWarehouseOwner && !!nextCode && currentDeliveryCode !== 'delivered' && currentDeliveryCode !== 'cancelled';
  const orderWarehouseId = detail?.warehouse_id ?? detail?.warehouse?.id;
  const warehouseName =
    (detail?.warehouse?.name as string | undefined) ??
    (orderWarehouseId != null ? owner_warehouses.find((w) => w.id === orderWarehouseId)?.name : undefined) ??
    (orderWarehouseId != null ? `Агуулах #${orderWarehouseId}` : null);

  const validOrderId = orderId != null && !Number.isNaN(Number(orderId)) ? Number(orderId) : null;

  useEffect(() => {
    if (validOrderId == null) {
      navigation.replace('OrderList');
    }
  }, [validOrderId, navigation]);

  useEffect(() => {
    if (fromCreate && showSuccessBanner) {
      const t = setTimeout(() => setShowSuccessBanner(false), SUCCESS_BANNER_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [fromCreate, showSuccessBanner]);

  /** Load lastOrderMeta when fromCreate=true for fallback payment method display. */
  useEffect(() => {
    if (!fromCreate || validOrderId == null) return;
    let cancelled = false;
    (async () => {
      const meta = await authStore.getState().getLastOrderMeta();
      if (cancelled) return;
      if (meta && meta.last_order_id === validOrderId) {
        setLastOrderMeta({
          last_order_payment_method: meta.last_order_payment_method,
          last_order_warehouse_id: meta.last_order_warehouse_id,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromCreate, validOrderId]);

  /** Hide "Төлөв шинэчлэгдлээ" after a short duration. */
  useEffect(() => {
    if (!showStatusUpdatedMessage) return;
    const t = setTimeout(() => setShowStatusUpdatedMessage(false), STATUS_UPDATED_MESSAGE_DURATION_MS);
    return () => clearTimeout(t);
  }, [showStatusUpdatedMessage]);

  /** Animate status pill when status just changed. */
  useEffect(() => {
    if (!showStatusUpdatedMessage) return;
    const scale = pillScaleRef.current;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [showStatusUpdatedMessage]);

  const fetchDetail = useCallback(
    async (isRefresh = false, silent = false) => {
      if (validOrderId == null) return;
      if (!silent) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      }
      setError(null);
      try {
        const data = await getMxmOrderDetail(validOrderId);
        retryCountRef.current = 0;
        const newVm = buildOrderDetailVM(data, { fromCreate });
        const newStatus = newVm.orderStatusPillText;
        const hadPrevious = previousStatusRef.current !== null;
        const statusChanged = hadPrevious && previousStatusRef.current !== newStatus;
        previousStatusRef.current = newStatus;
        setDetail(data);
        if (statusChanged) setShowStatusUpdatedMessage(true);
      } catch (e) {
        if (!silent) {
          const attempts = retryCountRef.current;
          if (attempts < MAX_AUTO_RETRIES && !isRefresh) {
            retryCountRef.current = attempts + 1;
            setTimeout(() => fetchDetail(false, false), RETRY_DELAY_MS);
            return;
          }
          const msg = e instanceof Error ? e.message : 'Алдаа гарлаа';
          setError(msg);
          setDetail(null);
        }
      } finally {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [validOrderId, fromCreate]
  );

  /** Initial fetch on mount. */
  useEffect(() => {
    if (validOrderId == null) return;
    retryCountRef.current = 0;
    fetchDetail(false, false);
  }, [validOrderId, fetchDetail]);

  /** Fetch delivery timeline; update only when version or last_update_at changes. On terminal status (delivered/cancelled) stop polling. On error keep cached delivery, set deliveryError. Returns data on success for retry logic. */
  const fetchDelivery = useCallback(async (): Promise<DeliveryResponse | null> => {
    if (validOrderId == null) return null;
    try {
      const data = await getOrderDelivery(validOrderId);
      const versionKey = data.version ?? data.last_update_at;
      if (versionKey !== lastVersionRef.current) {
        lastVersionRef.current = versionKey;
        setDelivery(data);
      }
      setDeliveryError(null);
      const code = String(data.current_status?.code ?? '').trim().toLowerCase();
      if (code === 'delivered' || code === 'cancelled') {
        if (deliveryPollIntervalRef.current != null) {
          clearInterval(deliveryPollIntervalRef.current);
          deliveryPollIntervalRef.current = null;
        }
        if (deliveryBackoffTimeoutRef.current != null) {
          clearTimeout(deliveryBackoffTimeoutRef.current);
          deliveryBackoffTimeoutRef.current = null;
        }
      }
      return data;
    } catch (e) {
      if (!isCancelError(e)) {
        setDeliveryError(e instanceof Error ? e.message : 'Сүлжээ тасарсан');
      }
      return null;
    }
  }, [validOrderId]);

  /** Poll detail every 20s when focused; stop on blur. */
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => {
        if (AppState.currentState !== 'active') return;
        fetchDetail(false, true);
      }, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [fetchDetail])
  );

  /** Poll delivery: fetch once on focus; 10s for first 1 min, then 25s; stop on blur or when status is delivered/cancelled. Robust refresh: when fromCreate, retry once after 3s if current_status is empty. */
  useFocusEffect(
    useCallback(() => {
      let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
      (async () => {
        const data = await fetchDelivery();
        if (
          fromCreate &&
          validOrderId != null &&
          !deliveryRetryDoneRef.current
        ) {
          const code = String(data?.current_status?.code ?? '').trim();
          if (!code) {
            deliveryRetryDoneRef.current = true;
            retryTimeoutId = setTimeout(() => {
              fetchDelivery();
            }, DELIVERY_RETRY_DELAY_MS);
          }
        }
      })();
      deliveryPollIntervalRef.current = setInterval(() => {
        if (AppState.currentState !== 'active') return;
        fetchDelivery();
      }, DELIVERY_POLL_INTERVAL_MS);
      deliveryBackoffTimeoutRef.current = setTimeout(() => {
        if (deliveryPollIntervalRef.current != null) {
          clearInterval(deliveryPollIntervalRef.current);
          deliveryPollIntervalRef.current = null;
        }
        deliveryPollIntervalRef.current = setInterval(() => {
          if (AppState.currentState !== 'active') return;
          fetchDelivery();
        }, DELIVERY_POLL_BACKOFF_MS);
      }, DELIVERY_POLL_BACKOFF_AFTER_MS);
      return () => {
        if (retryTimeoutId != null) clearTimeout(retryTimeoutId);
        if (deliveryPollIntervalRef.current != null) {
          clearInterval(deliveryPollIntervalRef.current);
          deliveryPollIntervalRef.current = null;
        }
        if (deliveryBackoffTimeoutRef.current != null) {
          clearTimeout(deliveryBackoffTimeoutRef.current);
          deliveryBackoffTimeoutRef.current = null;
        }
      };
    }, [fetchDelivery, fromCreate, validOrderId])
  );

  const handleUpdateDeliveryStatus = useCallback(async () => {
    if (validOrderId == null || !nextCode || statusUpdating) return;
    setStatusUpdating(true);
    try {
      await updateOrderDeliveryStatus(validOrderId, { code: nextCode });
      setShowStatusUpdatedMessage(true);
      await Promise.all([fetchDetail(true, true), fetchDelivery()]);
    } catch (err: unknown) {
      const e = err as { status?: number; code?: string; response?: { status?: number } };
      const is403 = e.status === 403 || e.code === 'FORBIDDEN' || e.response?.status === 403;
      if (is403) {
        Alert.alert('Эрх байхгүй', FORBIDDEN_ORDER_MESSAGE);
      } else {
        const msg = err instanceof Error ? err.message : 'Төлөв шинэчлэхэд алдаа гарлаа.';
        Alert.alert('Алдаа', msg);
      }
    } finally {
      setStatusUpdating(false);
    }
  }, [validOrderId, nextCode, statusUpdating, fetchDetail, fetchDelivery]);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[OrderDetailScreen] RENDER', new Date().toISOString(), 'FILE', ORDER_DETAIL_SCREEN_FILE, 'route', route.name, route.params);
  }

  if (validOrderId == null) {
    return (
      <View style={styles.centered}>
        {__DEV__ && <Text style={styles.debugPatch}>DEBUG: UI PATCH ACTIVE</Text>}
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (loading && !detail) {
    return (
      <View style={styles.centered}>
        {__DEV__ && <Text style={styles.debugPatch}>DEBUG: UI PATCH ACTIVE</Text>}
        <LoadingSkeleton />
      </View>
    );
  }

  if (error && !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {__DEV__ && <Text style={styles.debugPatch}>DEBUG: UI PATCH ACTIVE</Text>}
        <ErrorState message={error} onRetry={() => fetchDetail()} />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        {__DEV__ && <Text style={styles.debugPatch}>DEBUG: UI PATCH ACTIVE</Text>}
        <LoadingSkeleton />
      </View>
    );
  }

  const vm = buildOrderDetailVM(detail, {
    fromCreate,
    fallbackPaymentMethod: fromCreate ? lastOrderMeta?.last_order_payment_method ?? null : null,
  });
  const c = vm.copy;
  const timelineSteps = delivery ? buildDeliveryTimelineSteps(delivery) : vm.timelineSteps;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[OrderDetail] status_history', detail?.status_history);
    // eslint-disable-next-line no-console
    console.log('[OrderDetail] timelineSteps', timelineSteps);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {__DEV__ && <Text style={styles.debugPatch}>DEBUG: UI PATCH ACTIVE</Text>}
      {showSuccessBanner && vm.successBannerText != null && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
          <Text style={styles.successBannerText}>{vm.successBannerText}</Text>
        </View>
      )}
      {vm.processingBannerText != null && (
        <View style={styles.processingBanner}>
          <Text style={styles.processingBannerText}>{vm.processingBannerText}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              fetchDetail(true, false);
              fetchDelivery();
            }}
          />
        }
      >
        {/* Hero: Delivery status – current_status.label, timeline, payment_method, COD (read-only) */}
        <View style={styles.heroCard}>
          <Text style={styles.heroOrderNumber}>{vm.orderNumber}</Text>
          <Text style={styles.heroDate}>{vm.createdAtText}</Text>
          <Text style={styles.heroTitle}>
            Одоогийн төлөв: {delivery ? getDeliveryCurrentStatusLabel(delivery) : vm.orderStatusPillText}
          </Text>
          <OrderTimeline steps={timelineSteps} />
          {delivery?.payment_method != null && String(delivery.payment_method).trim() !== '' && (
            <Text style={styles.heroPaymentMethod}>
              Төлбөрийн арга: {String(delivery.payment_method).trim().toUpperCase() === 'COD' ? 'Бэлэн мөнгө (COD)' : delivery.payment_method}
            </Text>
          )}
          {delivery?.payment_method != null && String(delivery.payment_method).trim().toLowerCase() === 'cod' && (
            <Text style={styles.codStatus}>
              {delivery.cod_confirmed === true
                ? `COD төлбөр: Баталгаажсан${delivery.cod_confirmed_at ? ` (${formatCodConfirmedAt(delivery.cod_confirmed_at)})` : ''}`
                : 'COD төлбөр: Хүлээгдэж байна'}
            </Text>
          )}
          <Text style={styles.heroUpdated}>
            Сүүлд шинэчлэгдсэн: {delivery ? formatDeliveryLastUpdated(delivery.last_update_at) : '—'}
          </Text>
          {showStatusUpdatedMessage && (
            <Text style={styles.statusUpdatedMessage}>{STATUS_UPDATED_MESSAGE}</Text>
          )}
          {deliveryError != null && delivery != null && (
            <Text style={styles.offlineHint}>{OFFLINE_HINT}</Text>
          )}
        </View>

        {/* Customer / contact card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Холбоо барих</Text>
          {vm.deliveryPhonePrimaryText !== '' && (
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => Linking.openURL(`tel:${vm.deliveryPhonePrimaryText}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={20} color="#2563eb" />
              <Text style={styles.phoneLink}>{vm.deliveryPhonePrimaryText}</Text>
            </TouchableOpacity>
          )}
          {vm.deliveryPhoneSecondaryText != null && vm.deliveryPhoneSecondaryText !== '' && (
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => Linking.openURL(`tel:${vm.deliveryPhoneSecondaryText}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={20} color="#2563eb" />
              <Text style={styles.phoneLink}>{vm.deliveryPhoneSecondaryText}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.addressText}>{vm.deliveryAddressText}</Text>
        </View>

        {/* Items + totals */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{c.sectionProducts}</Text>
          {vm.items.length === 0 ? (
            <Text style={styles.emptyLines}>{c.noProducts}</Text>
          ) : (
            vm.items.map((item, idx) => (
              <OrderLineRow key={idx} item={item} token={token} />
            ))
          )}
          {vm.amountUntaxed != null && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{c.totalUntaxed}</Text>
              <Text style={styles.totalValue}>{formatMnt(vm.amountUntaxed)}</Text>
            </View>
          )}
          {vm.amountTax != null && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{c.totalTax}</Text>
              <Text style={styles.totalValue}>{formatMnt(vm.amountTax)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowPrimary]}>
            <Text style={styles.totalLabelPrimary}>{c.totalAmount}</Text>
            <Text style={styles.totalValuePrimary}>{vm.totalText}</Text>
          </View>
          {vm.totalMissing && (
            <Text style={styles.totalWarning}>{c.totalMissing}</Text>
          )}
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{c.sectionPayment}</Text>
          <Text style={styles.paymentLine1}>{vm.paymentLine1}</Text>
          <Text style={styles.paymentLine2}>{vm.paymentLine2}</Text>
          <View style={[styles.badge, vm.paymentBadgeText === c.paid ? styles.badgePaid : styles.badgeUnpaid]}>
            <Text style={styles.badgeText}>{vm.paymentBadgeText}</Text>
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.debugCard}>
            <Text style={styles.debugCardTitle}>[DEV] Order Debug</Text>
            <Text style={styles.debugLine}>orderId: {validOrderId}</Text>
            <Text style={styles.debugLine}>warehouseId: {orderWarehouseId ?? lastOrderMeta?.last_order_warehouse_id ?? '—'}</Text>
            <Text style={styles.debugLine}>paymentMethod: {detail?.payment_method ?? detail?.payment?.payment_method ?? lastOrderMeta?.last_order_payment_method ?? '—'}</Text>
            <Text style={styles.debugLine}>lastUpdateAt: {delivery?.last_update_at ?? '—'}</Text>
            <Text style={styles.debugLine}>version: {delivery?.version ?? '—'}</Text>
          </View>
        )}

        {/* Update status (warehouse owner) */}
        {(canUpdateStatus || (isWarehouseOwner && currentDeliveryCode !== 'delivered' && currentDeliveryCode !== 'cancelled')) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Төлөв шинэчлэх</Text>
            {canUpdateStatus && nextLabel != null && (
              <TouchableOpacity
                style={[styles.statusUpdateButton, statusUpdating && styles.statusUpdateButtonDisabled]}
                onPress={handleUpdateDeliveryStatus}
                disabled={statusUpdating}
                activeOpacity={0.8}
              >
                <Text style={styles.statusUpdateButtonText}>
                  {statusUpdating ? 'Шинэчлэж байна…' : nextLabel}
                </Text>
              </TouchableOpacity>
            )}
            {isWarehouseOwner && currentDeliveryCode !== 'delivered' && currentDeliveryCode !== 'cancelled' && (
              <TouchableOpacity
                style={styles.cancelOrderButton}
                onPress={() => {
                  Alert.alert(
                    CANCEL_CONFIRM_TITLE,
                    CANCEL_CONFIRM_MESSAGE,
                    [
                      { text: 'Үгүй', style: 'cancel' },
                      {
                        text: 'Цуцлах',
                        style: 'destructive',
                        onPress: () => {
                          if (validOrderId == null) return;
                          cancelOrder(validOrderId).then(() => {
                            fetchDetail(true, false);
                            fetchDelivery();
                          }).catch((err) => {
                            Alert.alert('Алдаа', err instanceof Error ? err.message : 'Цуцлаж чадсангүй.');
                          });
                        },
                      },
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelOrderButtonText}>Захиалга цуцлах</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  debugPatch: {
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#dcfce7',
  },
  successBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  processingBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
  },
  processingBannerText: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  errorText: { fontSize: 16, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroOrderNumber: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  heroDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  heroPaymentMethod: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  codStatus: {
    fontSize: 13,
    color: '#0f172a',
    marginTop: 4,
    fontWeight: '500',
  },
  heroUpdated: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  phoneLink: { fontSize: 16, color: '#2563eb', fontWeight: '500' },
  statusUpdatedMessage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  offlineHint: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dateOrder: { fontSize: 14, color: '#64748b', marginTop: 4 },
  statusUpdateButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusUpdateButtonDisabled: { opacity: 0.6 },
  statusUpdateButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelOrderButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignSelf: 'flex-start',
  },
  cancelOrderButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeInfo: { backgroundColor: '#eff6ff' },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeDanger: { backgroundColor: '#fee2e2' },
  badgePaid: { backgroundColor: '#dcfce7', alignSelf: 'flex-start', marginTop: 8 },
  badgeUnpaid: { backgroundColor: '#fef3c7', alignSelf: 'flex-start', marginTop: 8 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  emptyLines: { fontSize: 14, color: '#64748b' },
  lineRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f1f5f9' },
  lineImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  lineBody: { flex: 1, marginLeft: 12 },
  lineName: { fontSize: 15, fontWeight: '500', color: '#0f172a', marginBottom: 4 },
  lineMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  lineQty: { fontSize: 13, color: '#64748b' },
  linePriceUnit: { fontSize: 13, color: '#64748b' },
  lineSubtotal: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalRowPrimary: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalLabel: { fontSize: 14, color: '#64748b' },
  totalValue: { fontSize: 14, color: '#0f172a' },
  totalLabelPrimary: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  totalValuePrimary: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  totalWarning: { fontSize: 11, color: '#b45309', marginTop: 6 },
  addressText: { fontSize: 14, color: '#0f172a', marginBottom: 6 },
  phoneText: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  paymentLine1: { fontSize: 14, color: '#0f172a' },
  paymentLine2: { fontSize: 13, color: '#64748b', marginTop: 2 },
  debugCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  debugCardTitle: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 8 },
  debugLine: { fontSize: 11, color: '#78350f', marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
