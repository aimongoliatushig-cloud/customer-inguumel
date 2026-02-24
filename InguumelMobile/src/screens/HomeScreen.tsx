import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getMxmOrders,
  getMxmOrderDetail,
  addCartLine,
  getCart,
} from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { getAlertMessage } from '~/utils/errors';
import type { ProductItem } from '~/types';
import type { AppError } from '~/types';
import type { MxmOrderItem } from '~/api/endpoints';
import type { OrderLine } from '~/api/endpoints';
import { authStore } from '~/store/authStore';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { BottomTabParamList } from '~/navigation/types';
import { TAB_BAR_BASE_HEIGHT } from '~/navigation/types';
import { LuckyWheelPreviewCard } from '~/components/LuckyWheelPreviewCard';
import { CartPill, CART_PILL_HEIGHT } from '~/components/CartPill';
import { config } from '~/constants/config';

type Props = BottomTabScreenProps<BottomTabParamList, 'Home'>;

const CARD_WIDTH = 140;
const CARD_MARGIN = 10;
const QUICK_ACTION_SIZE = 56;

/** Build product-like item from order line for suggestion display. */
function lineToSuggestionItem(line: OrderLine): ProductItem | null {
  const productId = line.product_id;
  if (productId == null) return null;
  const name = line.product_name ?? line.name ?? '—';
  return {
    id: productId,
    name,
    price: line.price_unit ?? 0,
    stock_qty: 99,
    image_url: line.image_url ?? undefined,
  };
}

function buildImageUrl(url: string | undefined | null): string | null {
  if (url == null || typeof url !== 'string' || url.trim() === '') return null;
  const trimmed = url.trim();
  const base = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl.slice(0, -1) : config.apiBaseUrl;
  return trimmed.startsWith('/') ? base + trimmed : base + '/' + trimmed;
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductItem[]>([]);
  const [lastOrder, setLastOrder] = useState<MxmOrderItem | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const warehouseId = locationStore((s) => s.warehouse_id);
  const authStatus = authStore((s) => s.status);
  const authToken = authStore((s) => s.token);
  const cartLines = cartStore((s) => s.lines);
  const qtyByProductId = React.useMemo(
    () => cartLines.reduce<Record<number, number>>((acc, l) => ({ ...acc, [l.product_id]: l.qty }), {}),
    [cartLines]
  );
  const totalQty = cartStore((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
  const totalAmount = cartStore((s) => s.amount_total);

  const effectiveTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const listPaddingBottom =
    totalQty > 0
      ? CART_PILL_HEIGHT + effectiveTabBarHeight + 24
      : effectiveTabBarHeight + 24;

  const goToCart = useCallback(() => navigation.navigate('Cart'), [navigation]);
  const goToLuckyWheel = useCallback(
    () => navigation.navigate('Profile', { screen: 'LuckyWheel' }),
    [navigation]
  );
  const goToCategories = useCallback(() => navigation.navigate('Categories'), [navigation]);
  const goToOrders = useCallback(() => navigation.navigate('Orders'), [navigation]);

  const loadSuggestionsAndLastOrder = useCallback(async () => {
    if (warehouseId == null) return;
    if (authStore.getState().status !== 'LOGGED_IN' || !authStore.getState().token) return;
    try {
      const orders = await getMxmOrders(warehouseId, {
        delivery_tab: 'all',
        limit: 1,
        offset: 0,
      });
      const first = orders[0];
      setLastOrder(first ?? null);
      if (first) {
        const orderId = first.order_id ?? first.id;
        if (orderId != null && !Number.isNaN(orderId)) {
          const detail = await getMxmOrderDetail(orderId);
          const lines = detail.order_line ?? detail.lines ?? [];
          const items: ProductItem[] = [];
          for (const line of lines) {
            const item = lineToSuggestionItem(line);
            if (item && items.length < 4) items.push(item);
          }
          setSuggestions(items);
        } else {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
      setLastOrder(null);
    }
  }, [warehouseId]);

  const handleReorder = useCallback(async () => {
    if (warehouseId == null || !lastOrder) return;
    const orderId = lastOrder.order_id ?? lastOrder.id;
    if (orderId == null || Number.isNaN(orderId)) return;
    setReorderLoading(true);
    try {
      const detail = await getMxmOrderDetail(orderId);
      const lines = detail.order_line ?? detail.lines ?? [];
      let cart = await getCart(warehouseId);
      for (const line of lines) {
        const pid = line.product_id;
        const qty = line.qty ?? 1;
        if (pid != null && qty > 0) {
          try {
            cart = await addCartLine({
              warehouse_id: warehouseId,
              product_id: pid,
              qty,
            });
          } catch {
            // skip failed lines
          }
        }
      }
      cartStore.getState().setCart(cart);
      navigation.navigate('Cart');
    } catch (err) {
      if (isCancelError(err)) return;
      Alert.alert('Алдаа', getAlertMessage(err as AppError));
    } finally {
      setReorderLoading(false);
    }
  }, [warehouseId, lastOrder, navigation]);

  const handleAddSuggestion = useCallback(
    async (product: ProductItem) => {
      if (warehouseId == null) return;
      setAddingId(product.id);
      try {
        const cart = await addCartLine({
          warehouse_id: warehouseId,
          product_id: product.id,
          qty: 1,
        });
        cartStore.getState().setCart(cart);
      } catch (err) {
        if (isCancelError(err)) return;
        Alert.alert('Алдаа', getAlertMessage(err as AppError));
      } finally {
        setAddingId(null);
      }
    },
    [warehouseId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadSuggestionsAndLastOrder();
    if (warehouseId != null) {
      getCart(warehouseId)
        .then((cart) => cartStore.getState().setCart(cart))
        .catch(() => {});
    }
    setRefreshing(false);
  }, [loadSuggestionsAndLastOrder, warehouseId]);

  useEffect(() => {
    if (warehouseId == null || authStatus !== 'LOGGED_IN' || !authToken) return;
    loadSuggestionsAndLastOrder();
  }, [warehouseId, authStatus, authToken, loadSuggestionsAndLastOrder]);

  if (warehouseId == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Салбараа (агуулхаа) сонгоно уу</Text>
      </View>
    );
  }

  const orderLabel = lastOrder?.order_number ?? lastOrder?.name ?? `#${lastOrder?.order_id ?? ''}`;
  const statusLabel = lastOrder?.delivery_status_label_mn ?? '—';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: listPaddingBottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <LuckyWheelPreviewCard
          warehouseId={warehouseId}
          onCardPress={goToLuckyWheel}
          onSpinPress={goToLuckyWheel}
          onShopPress={goToCategories}
        />

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={handleReorder}
            disabled={reorderLoading || !lastOrder}
            activeOpacity={0.7}
          >
            {reorderLoading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="cart" size={24} color="#2563eb" />
            )}
            <Text style={styles.quickActionLabel}>Дахин захиалах</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={goToOrders}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={24} color="#2563eb" />
            <Text style={styles.quickActionLabel}>Миний захиалгууд</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={goToLuckyWheel}
            activeOpacity={0.7}
          >
            <Ionicons name="gift" size={24} color="#2563eb" />
            <Text style={styles.quickActionLabel}>Азны эргэлт</Text>
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧠 Танд санал болгох</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {suggestions.map((product) => {
                const qty = qtyByProductId[product.id] ?? 0;
                const imgUrl = buildImageUrl(product.image_url);
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.suggestionCard}
                    onPress={() => handleAddSuggestion(product)}
                    disabled={addingId === product.id}
                    activeOpacity={0.8}
                  >
                    <View style={styles.suggestionImageWrap}>
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={styles.suggestionImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.suggestionImage, styles.suggestionImagePlaceholder]}>
                          <Ionicons name="bag" size={28} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.suggestionName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    {addingId === product.id ? (
                      <ActivityIndicator size="small" color="#2563eb" style={styles.suggestionAdd} />
                    ) : (
                      <View style={[styles.suggestionAddBtn, qty > 0 && styles.suggestionAddBtnActive]}>
                        <Text style={[styles.suggestionAddText, qty > 0 && styles.suggestionAddTextActive]}>
                          {qty > 0 ? `${qty}` : '+'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {lastOrder != null && (
          <TouchableOpacity
            style={styles.statusCard}
            onPress={goToOrders}
            activeOpacity={0.85}
          >
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>📦 Сүүлийн захиалга</Text>
              <Text style={styles.statusText}>
                {orderLabel} — {statusLabel}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </ScrollView>

      <View
        style={[styles.cartPillWrap, { bottom: effectiveTabBarHeight + 6 }]}
        pointerEvents="box-none"
      >
        <CartPill
          visible={totalQty > 0}
          totalQty={totalQty}
          totalAmount={totalAmount ?? 0}
          onPress={goToCart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', padding: 32, color: '#64748b', fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
  },
  quickAction: {
    alignItems: 'center',
    width: QUICK_ACTION_SIZE + 24,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
  },
  suggestionCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: CARD_MARGIN,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionImageWrap: {
    width: '100%',
    height: 100,
    backgroundColor: '#f1f5f9',
  },
  suggestionImage: {
    width: '100%',
    height: 100,
  },
  suggestionImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    padding: 8,
    minHeight: 36,
  },
  suggestionAdd: {
    marginHorizontal: 8,
    marginBottom: 8,
  },
  suggestionAddBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 8,
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionAddBtnActive: {
    backgroundColor: '#2563eb',
  },
  suggestionAddText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  suggestionAddTextActive: {
    color: '#fff',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  cartPillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
