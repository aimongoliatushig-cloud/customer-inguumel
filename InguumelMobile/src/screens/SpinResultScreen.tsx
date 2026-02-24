import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '~/state/AppContext';
import { locationStore } from '~/store/locationStore';
import { getLuckyEligibility, invalidateLuckyEligibilityCache } from '~/api/endpoints';
import type { LuckySpinResultData, LuckyPrizeType } from '~/types';
import type { ProfileStackParamList } from '~/navigation/types';
import { config } from '~/constants/config';

type Props = NativeStackScreenProps<ProfileStackParamList, 'SpinResult'>;

function formatExpiresAt(expiresAt: string): string {
  try {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return expiresAt;
    return d.toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return expiresAt;
  }
}

function buildImageUri(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith('http')) return trimmed;
  const base = config.apiBaseUrl.replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function SpinResultScreen({ navigation, route }: Props) {
  const { result } = route.params;
  const { warehouseId: contextWarehouseId } = useApp();
  const storeWarehouseId = locationStore((s) => s.warehouse_id);
  const warehouseId = contextWarehouseId ?? storeWarehouseId;

  useFocusEffect(
    useCallback(() => {
      if (warehouseId != null) {
        invalidateLuckyEligibilityCache(warehouseId);
        getLuckyEligibility(warehouseId).catch(() => {});
      }
    }, [warehouseId])
  );

  const goToWallet = () => navigation.navigate('PrizeWallet');
  const goBack = () => navigation.goBack();

  const prizeType: LuckyPrizeType = result.prize_type;
  const isProduct = prizeType === 'product';
  const isCoupon = prizeType === 'coupon';
  const isEmpty = prizeType === 'empty';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {isProduct && result.product && (
          <>
            {result.product.image_url ? (
              <Image
                source={{ uri: buildImageUri(result.product.image_url) ?? undefined }}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.productPlaceholder}>
                <Ionicons name="cube-outline" size={48} color="#94a3b8" />
              </View>
            )}
            <Text style={styles.productName}>{result.product.name}</Text>
            <Text style={styles.resultTitle}>Танд бэлэг хожлоо</Text>
          </>
        )}
        {isCoupon && (
          <>
            <View style={styles.couponIcon}>
              <Ionicons name="pricetag" size={48} color="#16a34a" />
            </View>
            <Text style={styles.couponTitle}>
              {result.coupon_payload?.title && typeof result.coupon_payload.title === 'string'
                ? result.coupon_payload.title
                : 'Купон'}
            </Text>
            {result.coupon_payload?.description != null && result.coupon_payload.description !== '' ? (
              <Text style={styles.couponDesc}>
                {String(result.coupon_payload.description)}
              </Text>
            ) : null}
            <Text style={styles.resultTitle}>Дараагийн худалдан авалтад ашиглана</Text>
          </>
        )}
        {isEmpty && (
          <>
            <View style={styles.emptyIcon}>
              <Ionicons name="sad-outline" size={48} color="#64748b" />
            </View>
            <Text style={styles.emptyText}>Аз энэ удаа таараагүй 😄 Дахин оролдоорой</Text>
          </>
        )}

        {!isEmpty && (
          <Text style={styles.expiresAt}>Хүчинтэй: {formatExpiresAt(result.expires_at)}</Text>
        )}
      </View>

      <View style={styles.actions}>
        {!isEmpty && (
          <TouchableOpacity style={styles.primaryButton} onPress={goToWallet} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Prize Wallet руу очих</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={goBack} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>Буцах</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  productPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: '500',
  },
  couponIcon: {
    marginBottom: 12,
  },
  couponTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  couponDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  expiresAt: {
    marginTop: 16,
    fontSize: 13,
    color: '#64748b',
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2563eb',
  },
});
