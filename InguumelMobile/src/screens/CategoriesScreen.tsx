import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProducts, getCart, addCartLine, updateCartLine, removeCartLine } from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { getAlertMessage } from '~/utils/errors';
import type { ProductItem } from '~/types';
import type { Category } from '~/types';
import type { AppError } from '~/types';
import { authStore } from '~/store/authStore';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import { categoryStore } from '~/store/categoryStore';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { BottomTabParamList } from '~/navigation/types';
import { TAB_BAR_BASE_HEIGHT } from '~/navigation/types';
import { ProductGridCard } from '~/components/products';
import { CategoryIcon } from '~/components/categories';
import { CartPill, CART_PILL_HEIGHT } from '~/components/CartPill';

const LEFT_PANEL_WIDTH = 100;
const ROOT_ICON_SIZE = 42;
const CHIP_HEIGHT = 36;
const CHIP_PADDING_H = 14;

type Props = BottomTabScreenProps<BottomTabParamList, 'Categories'>;

export function CategoriesScreen({ navigation }: Props) {
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
  const rootCategories = categoryStore((s) => s.categories);
  const childCategories = categoryStore((s) => s.childCategories);
  const selectedRootId = categoryStore((s) => s.selectedRootId);
  const selectedChildId = categoryStore((s) => s.selectedChildId);
  const loadCategories = categoryStore((s) => s.loadCategories);
  const selectRoot = categoryStore((s) => s.selectRoot);
  const selectChild = categoryStore((s) => s.selectChild);

  const cartLines = cartStore((s) => s.lines);
  const qtyByProductId = React.useMemo(
    () => cartLines.reduce<Record<number, number>>((acc, l) => ({ ...acc, [l.product_id]: l.qty }), []),
    [cartLines]
  );
  const totalQty = cartStore((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
  const totalAmount = cartStore((s) => s.amount_total);

  const effectiveCategoryId = selectedChildId ?? selectedRootId ?? undefined;

  const goToCart = useCallback(() => {
    navigation.navigate('Cart');
  }, [navigation]);

  const effectiveTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const listPaddingBottom =
    totalQty > 0 ? CART_PILL_HEIGHT + effectiveTabBarHeight + 12 : effectiveTabBarHeight + 12;

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (warehouseId == null) return;
      if (authStore.getState().status !== 'LOGGED_IN' || !authStore.getState().token) return;
      try {
        const data = await fetchProducts({
          warehouseId,
          categoryId: effectiveCategoryId,
          page: pageNum,
          limit: 50,
        });
        const list = data.items ?? [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setTotal(data.pagination?.total ?? list.length);
        setPage(data.pagination?.page ?? pageNum);
      } catch (err) {
        if (isCancelError(err)) return;
        Alert.alert('Алдаа', getAlertMessage(err as AppError));
      }
    },
    [warehouseId, effectiveCategoryId]
  );

  const refreshCart = useCallback(async () => {
    if (warehouseId == null) return;
    if (authStore.getState().status !== 'LOGGED_IN' || !authStore.getState().token) return;
    try {
      const cart = await getCart(warehouseId);
      cartStore.getState().setCart(cart);
    } catch (err) {
      if (isCancelError(err)) return;
      // ignore
    }
  }, [warehouseId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    if (warehouseId != null) loadCategories(warehouseId).catch(() => {});
    await load(1, false);
    await refreshCart();
    setRefreshing(false);
  }, [warehouseId, loadCategories, load, refreshCart]);

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
  }, [warehouseId, effectiveCategoryId, authStatus, authToken, load]);

  const handleRootSelect = useCallback(
    (id: number | null) => {
      selectRoot(id);
      setPage(1);
      setItems([]);
      setTotal(0);
    },
    [selectRoot]
  );

  const handleChildSelect = useCallback(
    (id: number | null) => {
      selectChild(id);
      setPage(1);
      setItems([]);
      setTotal(0);
    },
    [selectChild]
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
      Alert.alert(
        'Алдаа',
        e.code === 'WAREHOUSE_REQUIRED' ? 'Салбараа (агуулхаа) сонгоно уу' : getAlertMessage(e as AppError)
      );
    } finally {
      setAddingId(null);
    }
  };

  const handleStepperMinus = async (product: ProductItem) => {
    if (warehouseId == null) return;
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
    if (warehouseId == null) return;
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

  const renderRootItem = ({ item }: { item: Category }) => {
    const isSelected = selectedRootId === item.id;

    return (
      <TouchableOpacity
        style={[styles.rootItem, isSelected && styles.rootItemSelected]}
        onPress={() => handleRootSelect(isSelected ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.rootIconWrap}>
          <CategoryIcon category={item} size={ROOT_ICON_SIZE} />
        </View>
        <Text style={[styles.rootLabel, isSelected && styles.rootLabelSelected]} numberOfLines={2}>
          {item.name ?? ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProductItem = ({ item }: { item: ProductItem }) => {
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

  const emptyMessage = 'Энэ ангилалд бараа алга.';

  return (
    <View style={styles.container}>
      <View style={styles.leftPanel}>
        <FlatList
          data={rootCategories}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderRootItem}
          contentContainerStyle={styles.rootListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <View style={styles.rightPanel}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ангилал</Text>
          <Text style={styles.headerSubtitle}>{total} бүтээгдэхүүн байна</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          style={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.chip, selectedChildId === null && styles.chipSelected]}
            onPress={() => handleChildSelect(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedChildId === null && styles.chipTextSelected]}>
              Бүгд
            </Text>
          </TouchableOpacity>
          {childCategories.map((cat) => {
            const isSelected = selectedChildId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => handleChildSelect(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {cat.name ?? ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderProductItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
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
      </View>
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
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  leftPanel: {
    width: LEFT_PANEL_WIDTH,
    backgroundColor: '#f1f5f9',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  rootListContent: { paddingVertical: 8, paddingHorizontal: 6 },
  rootItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
    borderRadius: 8,
  },
  rootItemSelected: {
    backgroundColor: '#2563eb',
  },
  rootIconWrap: {
    width: ROOT_ICON_SIZE,
    height: ROOT_ICON_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  rootLabel: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  rootLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  rightPanel: { flex: 1 },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  chipsScroll: { maxHeight: CHIP_HEIGHT + 12 },
  chipsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: CHIP_PADDING_H,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CHIP_HEIGHT / 2,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  chipSelected: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  listContent: { paddingHorizontal: 12, paddingTop: 4 },
  columnWrapper: { marginBottom: 0 },
  gridItem: { flex: 1, marginHorizontal: 5, marginBottom: 10 },
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  empty: { textAlign: 'center', padding: 32, color: '#64748b' },
  cartPillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
