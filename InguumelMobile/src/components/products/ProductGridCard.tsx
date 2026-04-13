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
  const stockLabel = outOfStock
    ? 'Дууссан'
    : stockDefined
      ? `${stockQty} ш үлдсэн`
      : 'Бэлэн';

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <View style={[styles.stockBadge, outOfStock ? styles.stockBadgeOut : styles.stockBadgeIn]}>
          <Text style={styles.stockBadgeText}>{stockLabel}</Text>
        </View>
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
        {product.category_name ? (
          <Text style={styles.category} numberOfLines={1}>
            {product.category_name}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>{formatMnt(product.price)}</Text>
        {stockDefined ? (
          <Text style={outOfStock ? styles.stockOut : styles.stock}>
            {outOfStock ? 'Одоогоор захиалах боломжгүй' : 'Сагсанд нэмэхэд бэлэн'}
          </Text>
        ) : null}
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
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  stockBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stockBadgeIn: {
    backgroundColor: 'rgba(15, 118, 110, 0.92)',
  },
  stockBadgeOut: {
    backgroundColor: 'rgba(185, 28, 28, 0.92)',
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: '#94a3b8', fontSize: 16 },
  body: { padding: 12 },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    minHeight: 40,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  stock: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  stockOut: { fontSize: 12, color: '#dc2626', marginBottom: 10 },
  addBtn: {
    width: '100%',
    minHeight: ADD_BTN_SIZE,
    backgroundColor: '#0f766e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#0f766e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: { opacity: 0.5 },
  stepperBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  stepperQty: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
});
