import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { formatMnt } from '~/components/cart/formatMoney';
import { config } from '~/constants/config';
import type { ProductItem } from '~/types';

const IMAGE_HEIGHT = 120;
const ADD_BTN_SIZE = 44;

export interface ProductGridCardProps {
  product: ProductItem;
  qty: number;
  adding: boolean;
  onAdd: () => void;
  onMinus: () => void;
  onPlus: () => void;
}

function buildImageUrl(item: ProductItem): string | null {
  const url = item.image_url;
  if (url == null || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;
  const base = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl.slice(0, -1) : config.apiBaseUrl;
  return trimmed.startsWith('/') ? base + trimmed : base + '/' + trimmed;
}

export function ProductGridCard({ product, qty, adding, onAdd, onMinus, onPlus }: ProductGridCardProps) {
  const fullUrl = buildImageUrl(product);
  const stockQty = product.stock_qty;
  const stockDefined = typeof stockQty === 'number';
  const outOfStock = stockDefined && stockQty <= 0;
  const canAdd = !outOfStock && (stockDefined ? qty < stockQty : true);

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {fullUrl ? (
          <Image
            source={{ uri: fullUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>—</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatMnt(product.price)}</Text>
        {stockDefined && (
          <Text style={outOfStock ? styles.stockOut : styles.stock}>
            {outOfStock ? 'Боломжгүй' : 'Боломжтой'}
          </Text>
        )}
        {qty === 0 ? (
          <TouchableOpacity
            style={[styles.addBtn, (adding || !canAdd) && styles.addBtnDisabled]}
            onPress={onAdd}
            disabled={adding || !canAdd}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.addBtnText}>{adding ? '…' : '+'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperBtn, adding && styles.stepperBtnDisabled]}
              onPress={onMinus}
              disabled={adding}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperQty}>{qty}</Text>
            <TouchableOpacity
              style={[styles.stepperBtn, (adding || !canAdd) && styles.stepperBtnDisabled]}
              onPress={onPlus}
              disabled={adding || !canAdd}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#f1f5f9',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: '#94a3b8', fontSize: 11 },
  body: { padding: 6 },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
    minHeight: 28,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 2,
  },
  stock: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  stockOut: { fontSize: 10, color: '#dc2626', marginBottom: 4 },
  addBtn: {
    alignSelf: 'flex-start',
    width: ADD_BTN_SIZE,
    minWidth: ADD_BTN_SIZE,
    height: ADD_BTN_SIZE,
    minHeight: ADD_BTN_SIZE,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: { opacity: 0.5 },
  stepperBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stepperQty: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 4,
  },
});
