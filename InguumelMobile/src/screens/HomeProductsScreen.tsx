import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProducts, fetchCategories, getCart, addCartLine, updateCartLine, removeCartLine } from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { isDev } from '~/constants/config';
import { getAlertMessage } from '~/utils/errors';
import type { ProductItem } from '~/types';
import type { AppError } from '~/types';
import { authStore } from '~/store/authStore';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import { categoryStore } from '~/store/categoryStore';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { BottomTabParamList } from '~/navigation/types';
import { TAB_BAR_BASE_HEIGHT } from '~/navigation/types';
import { ProductGridCard } from '~/components/products';
import { CategoryChips } from '~/components/categories';
import { CartPill, CART_PILL_HEIGHT } from '~/components/CartPill';
import { LuckyWheelProgressCard } from '~/components/LuckyWheelProgressCard';

type Props = BottomTabScreenProps<BottomTabParamList, 'Home'>;

export function HomeProductsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ProductItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const warehouseId = locationStore((s) => s.warehouse_id);
  const authStatus = authStore((s) => s.status);
  const authToken = authStore((s) => s.token);
  const categories = categoryStore((s) => s.categories);
  const selectedCategoryId = categoryStore((s) => s.selectedCategoryId);
  const loadCategories = categoryStore((s) => s.loadCategories);
  const selectCategory = categoryStore((s) => s.selectCategory);
  const cartLines = cartStore((s) => s.lines);
  const qtyByProductId = React.useMemo(
    () => cartLines.reduce<Record<number, number>>((acc, l) => ({ ...acc, [l.product_id]: l.qty }), {}),
    [cartLines]
  );
  const totalQty = cartStore((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
  const totalAmount = cartStore((s) => s.amount_total);

  const goToCart = React.useCallback(() => {
    navigation.navigate('Cart');
  }, [navigation]);

  const goToLuckyWheel = React.useCallback(() => {
    navigation.navigate('Profile', { screen: 'LuckyWheel' });
  }, [navigation]);

  const effectiveTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const listPaddingBottom =
    totalQty > 0
      ? CART_PILL_HEIGHT + effectiveTabBarHeight + 12
      : effectiveTabBarHeight + 12;

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (warehouseId == null) return;
      if (authStore.getState().status !== 'LOGGED_IN' || !authStore.getState().token) return;
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log('[Products] warehouseId:', warehouseId, 'categoryId:', selectedCategoryId, '(FINAL URL logged by API client)');
      }
      try {
        const data = await fetchProducts({
          warehouseId,
          categoryId: selectedCategoryId,
          page: pageNum,
          limit: 50,
        });
        const list = data.items ?? [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setTotal(data.pagination?.total ?? list.length);
        setPage(data.pagination?.page ?? pageNum);
        if (isDev) {
          // eslint-disable-next-line no-console
          console.log('[Products] items.length:', list.length);
        }
      } catch (err) {
        if (isCancelError(err)) return;
        Alert.alert('Алдаа', getAlertMessage(err as AppError));
      }
    },
    [warehouseId, selectedCategoryId]
  );

  const refreshCart = useCallback(async () => {
    if (warehouseId == null) return;
    if (authStore.getState().status !== 'LOGGED_IN' || !authStore.getState().token) return;
    try {
      const cart = await getCart(warehouseId);
      cartStore.getState().setCart(cart);
    } catch (err) {
      if (isCancelError(err)) return;
      // ignore other errors
    }
  }, [warehouseId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(1, false);
    await refreshCart();
    setRefreshing(false);
  }, [load, refreshCart]);

  useEffect(() => {
    if (warehouseId == null) return;
    if (authStatus !== 'LOGGED_IN' || !authToken) return;
    loadCategories(warehouseId).catch(() => {});
  }, [warehouseId, authStatus, authToken, loadCategories]);

  useEffect(() => {
    if (warehouseId == null) return;
    if (authStatus !== 'LOGGED_IN' || !authToken) return;
    setLoading(true);
    load(1, false).finally(() => setLoading(false));
    getCart(warehouseId)
      .then((cart) => cartStore.getState().setCart(cart))
      .catch((err) => {
        if (isCancelError(err)) return;
        // ignore
      });
  }, [warehouseId, selectedCategoryId, authStatus, authToken, load]);

  const handleCategorySelect = useCallback(
    (categoryId: number | null) => {
      selectCategory(categoryId);
      setPage(1);
      setItems([]);
      setTotal(0);
    },
    [selectCategory]
  );

  const loadMore = () => {
    if (items.length >= total || loading) return;
    load(page + 1, true);
  };

  const handleAddToCart = async (product: ProductItem) => {
    if (warehouseId == null) {
      Alert.alert('Анхааруулга', 'Салбараа (агуулхаа) сонгоно уу');
      return;
    }
    setAddingId(product.id);
    try {
      const cart = await addCartLine({ warehouse_id: warehouseId, product_id: product.id, qty: 1 });
      cartStore.getState().setCart(cart);
    } catch (err) {
      const e = err as AppError & { code?: string };
      Alert.alert('Алдаа', e.code === 'WAREHOUSE_REQUIRED' ? 'Салбараа (агуулхаа) сонгоно уу' : getAlertMessage(e as AppError));
    } finally {
      setAddingId(null);
    }
  };

  const handleStepperMinus = async (product: ProductItem) => {
    if (warehouseId == null) {
      Alert.alert('Анхааруулга', 'Салбараа (агуулхаа) сонгоно уу');
      return;
    }
    const line = cartLines.find((l) => l.product_id === product.id);
    if (!line) return;
    setAddingId(product.id);
    try {
      const cart =
        line.qty <= 1
          ? await removeCartLine(line.id, warehouseId)
          : await updateCartLine(line.id, { qty: line.qty - 1 }, warehouseId);
      cartStore.getState().setCart(cart);
    } catch (err) {
      Alert.alert('Алдаа', getAlertMessage(err as AppError));
    } finally {
      setAddingId(null);
    }
  };

  const handleStepperPlus = async (product: ProductItem) => {
    if (warehouseId == null) {
      Alert.alert('Анхааруулга', 'Салбараа (агуулхаа) сонгоно уу');
      return;
    }
    const line = cartLines.find((l) => l.product_id === product.id);
    if (!line) return;
    setAddingId(product.id);
    try {
      const cart = await updateCartLine(line.id, { qty: line.qty + 1 }, warehouseId);
      cartStore.getState().setCart(cart);
    } catch (err) {
      Alert.alert('Алдаа', getAlertMessage(err as AppError));
    } finally {
      setAddingId(null);
    }
  };

  const renderItem = ({ item }: { item: ProductItem }) => {
    const qty = qtyByProductId[item.id] ?? 0;
    return (
      <View style={styles.gridItem}>
        <ProductGridCard
          product={item}
          qty={qty}
          adding={addingId === item.id}
          onAdd={() => handleAddToCart(item)}
          onMinus={() => handleStepperMinus(item)}
          onPlus={() => handleStepperPlus(item)}
        />
      </View>
    );
  };

  if (warehouseId == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Салбараа (агуулхаа) сонгоно уу</Text>
      </View>
    );
  }

  const emptyMessage =
    selectedCategoryId != null
      ? 'Энэ ангилалд бараа алга.'
      : 'Бараа олдсонгүй';

  return (
    <View style={styles.container}>
      <CategoryChips
        categories={categories}
        selectedId={selectedCategoryId}
        onSelect={handleCategorySelect}
      />
      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listPaddingBottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          warehouseId != null ? (
            <LuckyWheelProgressCard
              warehouseId={warehouseId}
              onPress={goToLuckyWheel}
            />
          ) : null
        }
        ListEmptyComponent={
          loading && items.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" />
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{emptyMessage}</Text>
          ) : null
        }
      />
      <View
        style={[styles.cartPillWrap, { bottom: effectiveTabBarHeight + 6 }]}
        pointerEvents="box-none"
      >
        <CartPill
          visible={totalQty > 0}
          totalQty={totalQty}
          totalAmount={totalAmount}
          onPress={goToCart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  listContent: { paddingHorizontal: 12, paddingTop: 12 },
  columnWrapper: { marginBottom: 0 },
  gridItem: { flex: 1, marginHorizontal: 5, marginBottom: 10 },
  cartPillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  empty: { textAlign: 'center', padding: 32, color: '#64748b' },
});
