import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CartLine } from '~/types';
import { formatMoney } from './formatMoney';
import { updateCartLine, removeCartLine } from '~/api/endpoints';
import { cartStore } from '~/store/cartStore';

interface CartLineCardProps {
  item: CartLine;
  warehouseId: number | null;
}

/** Default unit when uom_name is missing; hide unit row if not needed. */
function getVariantText(item: CartLine): string {
  const uom = (item as CartLine & { uom_name?: string }).uom_name;
  if (uom && String(uom).trim()) return String(uom).trim();
  return '1 ш';
}

/** Product title from item.name (normalized cart always has name as string). */
function getProductName(item: CartLine): string {
  const name = item.name;
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  const alt = (item as CartLine & { product_name?: string }).product_name;
  if (typeof alt === 'string' && alt.trim() !== '') return alt.trim();
  return '';
}

/** Image URL: store holds full URL after normalization; use as-is when present. */
function getImageUrl(item: CartLine): string | null {
  const url = item.image_url;
  if (url == null || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed === '') return null;
  return trimmed;
}

/** Subtotal: use normalized subtotal or compute from unit_price * qty (Hermes-safe, no ??/|| mix). */
function getSubtotal(item: CartLine): number {
  const st = item.subtotal;
  if (typeof st === 'number' && !Number.isNaN(st)) return st;
  const unit = item.unit_price;
  const qty = typeof item.qty === 'number' ? item.qty : 0;
  if (typeof unit === 'number' && !Number.isNaN(unit)) return unit * qty;
  return 0;
}

export function CartLineCard({ item, warehouseId }: CartLineCardProps) {
  const [updating, setUpdating] = useState(false);
  const name = getProductName(item);
  const variant = getVariantText(item);
  const imageUrl = getImageUrl(item);
  const subtotal = getSubtotal(item);

  const handleMinus = async () => {
    if (warehouseId == null) return;
    if (item.qty <= 1) return;
    setUpdating(true);
    try {
      const cart = await updateCartLine(item.id, { qty: item.qty - 1 }, warehouseId);
      cartStore.getState().setCart(cart);
    } catch {
      Alert.alert('Алдаа', 'Тоо хэмжээ шинэчлэхэд алдаа гарлаа.');
    } finally {
      setUpdating(false);
    }
  };

  const handlePlus = async () => {
    if (warehouseId == null) return;
    setUpdating(true);
    try {
      const cart = await updateCartLine(item.id, { qty: item.qty + 1 }, warehouseId);
      cartStore.getState().setCart(cart);
    } catch {
      Alert.alert('Алдаа', 'Тоо хэмжээ шинэчлэхэд алдаа гарлаа.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemove = () => {
    if (warehouseId == null) return;
    Alert.alert('Устгах', 'Энэ барааг сагснаас устгах уу?', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          try {
            const cart = await removeCartLine(item.id, warehouseId);
            cartStore.getState().setCart(cart);
          } catch {
            Alert.alert('Алдаа', 'Устгахад алдаа гарлаа.');
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#94a3b8" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.variant}>{variant}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            onPress={handleRemove}
            style={styles.trashBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperBtn, styles.stepperBtnMinus]}
              onPress={handleMinus}
              disabled={updating || item.qty <= 1}
            >
              <Ionicons name="remove" size={20} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.qty}>{item.qty}</Text>
            <TouchableOpacity
              style={[styles.stepperBtn, styles.stepperBtnPlus]}
              onPress={handlePlus}
              disabled={updating}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <TouchableOpacity onPress={handleRemove} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={20} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.price}>{formatMoney(subtotal)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  imageWrap: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    minHeight: 80,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  variant: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trashBtn: {
    padding: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnMinus: {
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  stepperBtnPlus: {
    backgroundColor: '#2563eb',
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  qty: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 80,
  },
  deleteBtn: {
    padding: 4,
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
});
