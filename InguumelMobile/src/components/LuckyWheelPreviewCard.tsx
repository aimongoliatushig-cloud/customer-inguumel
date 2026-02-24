import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getLuckyEligibility } from '~/api/endpoints';
import type { LuckyEligibilityData } from '~/types';

function formatNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export interface LuckyWheelPreviewCardProps {
  warehouseId: number | null;
  onCardPress: () => void;
  onSpinPress: () => void;
  onShopPress: () => void;
}

export function LuckyWheelPreviewCard({
  warehouseId,
  onCardPress,
  onSpinPress,
  onShopPress,
}: LuckyWheelPreviewCardProps) {
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

  const threshold = data?.threshold_amount ?? 200_000;
  const cycleSpent = data ? data.accumulated_paid_amount % threshold : 0;
  const remainingAmount = threshold - cycleSpent;
  const progressRatio =
    threshold > 0 ? Math.min(1, cycleSpent / threshold) : 0;
  const spinCredits = data?.spin_credits ?? 0;


  if (warehouseId == null) return null;

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.skeletonTitle} />
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={styles.skeletonProgress} />
      </View>
    );
  }

  const handleButtonPress = () => {
    if (spinCredits > 0) {
      onSpinPress();
    } else {
      onShopPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onCardPress}
      activeOpacity={1}
    >
      <Text style={styles.title}>🎁 Азны эргэлт</Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressRatio * 100}%` },
          ]}
        />
      </View>

      {spinCredits > 0 ? (
        <>
          <Text style={styles.contentText}>
            Та {spinCredits} удаа эргүүлэх эрхтэй 🎉
          </Text>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={handleButtonPress}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaPrimaryText}>Эргүүлэх</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.contentText}>
            {formatNum(remainingAmount)}₮ зарцуулбал дараагийн эргэлт авна
          </Text>
          <TouchableOpacity
            style={styles.ctaOutline}
            onPress={handleButtonPress}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaOutlineText}>Одоо дэлгүүр хэсэх</Text>
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 12,
    width: 160,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  skeletonProgress: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 5,
  },
  contentText: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 16,
  },
  ctaPrimary: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  ctaOutline: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  ctaOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
