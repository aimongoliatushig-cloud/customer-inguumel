import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getLuckyEligibility } from '~/api/endpoints';
import type { LuckyEligibilityData } from '~/types';

function formatNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export interface LuckyWheelProgressCardProps {
  warehouseId: number | null;
  onPress: () => void;
}

export function LuckyWheelProgressCard({
  warehouseId,
  onPress,
}: LuckyWheelProgressCardProps) {
  const [data, setData] = useState<LuckyEligibilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (warehouseId == null) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const result = await getLuckyEligibility(warehouseId);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  if (warehouseId == null || loading) {
    if (loading) {
      return (
        <View style={styles.card}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '60%' }]} />
        </View>
      );
    }
    return null;
  }

  const threshold = data?.threshold_amount ?? 200_000;
  const cycleSpent = data ? data.accumulated_paid_amount % threshold : 0;
  const remainingAmount = threshold - cycleSpent;
  const progressRatio =
    threshold > 0 ? Math.min(1, cycleSpent / threshold) : 0;
  const spinCredits = data?.spin_credits ?? 0;

  const caption =
    spinCredits > 0
      ? `${spinCredits} эргэлт бэлэн`
      : `Дараагийн эргэлт хүртэл ${formatNum(remainingAmount)}₮`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift" size={24} color="#f59e0b" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Азны эргэлт</Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressRatio * 100}%` },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 10,
    width: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  caption: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
});
