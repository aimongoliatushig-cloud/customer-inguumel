import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '~/state/AppContext';
import { locationStore } from '~/store/locationStore';
import { getPrizeWallet, getPrizeState } from '~/storage/luckyWheelStorage';
import type { StoredPrizeItem } from '~/types';
import type { ProfileStackParamList } from '~/navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'PrizeWallet'>;

const INSTRUCTION_TEXT =
  'Дэлгүүр дээр очоод энэхүү шагналыг үзүүлнэ үү';

function stateLabel(state: 'pending' | 'claimed' | 'expired'): string {
  switch (state) {
    case 'pending':
      return 'Хүлээгдэж буй';
    case 'claimed':
      return 'Авсан';
    case 'expired':
      return 'Хугацаа дууссан';
    default:
      return 'Хүлээгдэж буй';
  }
}

function formatExpiresAt(expiresAt: string): string {
  try {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return expiresAt;
    return d.toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return expiresAt;
  }
}

function prizeLabel(item: StoredPrizeItem): string {
  if (item.prize_type === 'product' && item.product?.name) {
    return item.product.name;
  }
  if (item.prize_type === 'coupon' && item.coupon_payload?.title) {
    return String(item.coupon_payload.title);
  }
  if (item.prize_type === 'empty') return 'Алга';
  return 'Бэлэг';
}

function PrizeRow({ item }: { item: StoredPrizeItem }) {
  const state = item.state ?? getPrizeState(item.expires_at);
  const label = prizeLabel(item);
  const icon =
    item.prize_type === 'product'
      ? 'cube-outline'
      : item.prize_type === 'coupon'
        ? 'pricetag'
        : 'gift-outline';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={24} color="#2563eb" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowState}>{stateLabel(state)}</Text>
        <Text style={styles.rowExpiry}>Хүчинтэй: {formatExpiresAt(item.expires_at)}</Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.message}>{text}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Уншиж байна...</Text>
    </View>
  );
}

export function PrizeWalletScreen(_props: Props) {
  const { warehouseId: contextWarehouseId } = useApp();
  const storeWarehouseId = locationStore((s) => s.warehouse_id);
  const warehouseId = contextWarehouseId ?? storeWarehouseId;

  const [items, setItems] = useState<StoredPrizeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (warehouseId == null) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getPrizeWallet(warehouseId);
      setItems(
        list.map((p) => ({
          ...p,
          state: p.state ?? getPrizeState(p.expires_at),
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const renderItem: ListRenderItem<StoredPrizeItem> = ({ item }) => (
    <PrizeRow item={item} />
  );

  if (warehouseId == null) {
    return <EmptyState text="Байршил сонгоно уу" />;
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.instructionBlock}>
        <Ionicons name="information-circle-outline" size={22} color="#64748b" />
        <Text style={styles.instructionText}>{INSTRUCTION_TEXT}</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="wallet-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyText}>Одоогоор шагнал байхгүй</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.prize_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    color: '#64748b',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  instructionBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 14,
    margin: 20,
    marginBottom: 12,
    borderRadius: 10,
    gap: 10,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowIcon: {
    marginRight: 14,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  rowState: {
    fontSize: 14,
    color: '#2563eb',
    marginBottom: 2,
  },
  rowExpiry: {
    fontSize: 13,
    color: '#64748b',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
});
