import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartStore } from '~/store/cartStore';
import { locationStore } from '~/store/locationStore';
import { getCart } from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import type { CartLine } from '~/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CartStackParamList } from '~/navigation/types';
import {
  CartHeader,
  CartLineCard,
  CheckoutBar,
} from '~/components/cart';

type Props = NativeStackScreenProps<CartStackParamList, 'CartHome'>;

const CHECKOUT_BAR_APPROX_HEIGHT = 180;

/** Safe fallback so we never read .length on undefined. */
const EMPTY_LINES: CartLine[] = [];

export function CartScreen({ navigation }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const warehouseId = locationStore((s) => s.warehouse_id ?? null);
  const linesFromStore = cartStore((s) => s.lines);
  const amountTotalFromStore = cartStore((s) => s.amount_total);

  useEffect(() => {
    if (warehouseId != null) {
      getCart(warehouseId)
        .then((cart) => {
          cartStore.getState().setCart(cart);
          const items = Array.isArray(cart?.lines) ? cart.lines : [];
          const sample = items[0];
          const fullImageUrl = sample && typeof sample.image_url === 'string' ? sample.image_url : null;
          if (__DEV__) {
            console.log('[CART_DEBUG] warehouseId:', warehouseId, 'cart items length:', items.length, 'fullImageUrl sample:', fullImageUrl);
          }
        })
        .catch((err) => {
          if (isCancelError(err)) return;
          cartStore.getState().setCart(null);
        });
    }
  }, [warehouseId]);

  const handleCheckout = useCallback(() => {
    if (warehouseId == null) {
      Alert.alert('Анхааруулга', 'Агуулах сонгогдоогүй байна');
      return;
    }
    const safeLines = Array.isArray(linesFromStore) ? linesFromStore : EMPTY_LINES;
    if (safeLines.length === 0) {
      Alert.alert('Сагс хоосон', 'Захиалахын тулд бараа нэмнэ үү.');
      return;
    }
    navigation.navigate('OrderInfo');
  }, [warehouseId, linesFromStore, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: CartLine }) => (
      <CartLineCard item={item} warehouseId={warehouseId} />
    ),
    [warehouseId]
  );
  const keyExtractor = useCallback((item: CartLine) => String(item.id), []);

  const lines = Array.isArray(linesFromStore) ? linesFromStore : EMPTY_LINES;
  const amountTotal =
    typeof amountTotalFromStore === 'number' && !Number.isNaN(amountTotalFromStore)
      ? amountTotalFromStore
      : 0;
  const hasItems = lines.length > 0;
  const totalQty = lines.reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
  const listPaddingBottom = Math.max(CHECKOUT_BAR_APPROX_HEIGHT, height * 0.22) + insets.bottom;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CartHeader cartCount={totalQty} />
      <FlatList
        data={lines}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Таны сагс хоосон байна</Text>
          </View>
        }
      />
      <View style={[styles.checkoutBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <CheckoutBar
          totalAmount={amountTotal}
          buttonLabel="Захиалах"
          onCheckout={handleCheckout}
          disabled={!hasItems || warehouseId == null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
  },
  checkoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingBottom: 24,
  },
});
