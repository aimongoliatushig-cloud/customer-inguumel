import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '~/state/AppContext';
import { locationStore } from '~/store/locationStore';
import {
  getLuckyEligibility,
  spinLuckyWheel,
  invalidateLuckyEligibilityCache,
} from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { appendPrizeToWallet } from '~/storage/luckyWheelStorage';
import type { LuckyEligibilityData, LuckySpinResultData } from '~/types';
import type { ProfileStackParamList } from '~/navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LuckyWheel'>;

const SPIN_ANIMATION_MS = 2500;
const TOAST_SPIN_UNAVAILABLE = 'Оролдох боломжгүй байна';
const TOAST_SERVER_ERROR = 'Системийн алдаа. Дахин оролдоно уу';

function formatNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function LuckyWheelScreen({ navigation }: Props) {
  const { warehouseId: contextWarehouseId } = useApp();
  const storeWarehouseId = locationStore((s) => s.warehouse_id);
  const warehouseId = contextWarehouseId ?? storeWarehouseId;

  const [eligibility, setEligibility] = useState<LuckyEligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const animationDoneRef = useRef(false);

  const loadEligibility = useCallback(async () => {
    if (warehouseId == null) {
      setLoading(false);
      setEligibility(null);
      return;
    }
    setLoading(true);
    try {
      const data = await getLuckyEligibility(warehouseId);
      setEligibility(data);
    } catch {
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      if (warehouseId != null) {
        invalidateLuckyEligibilityCache(warehouseId);
      }
      loadEligibility();
    }, [loadEligibility, warehouseId])
  );

  const threshold = eligibility?.threshold_amount ?? 200_000;
  const cycleSpent = eligibility
    ? eligibility.accumulated_paid_amount % threshold
    : 0;
  const remainingAmount = threshold - cycleSpent;
  const progressRatio =
    threshold > 0 ? Math.min(1, cycleSpent / threshold) : 0;
  const spinCredits = eligibility?.spin_credits ?? 0;

  const canSpin = Boolean(eligibility && spinCredits > 0 && eligibility.eligible);

  const getCaption = (): string => {
    if (cycleSpent > 0) {
      const ratio = cycleSpent / threshold;
      if (ratio >= 0.85) return 'Бараг авчихлаа!';
      if (ratio >= 0.5) return 'Дараагийн бэлэг ойрхон байна 🎁';
      return `Дараагийн эргэлт хүртэл ${formatNum(remainingAmount)}₮`;
    }
    if (cycleSpent === 0 && spinCredits > 0) {
      return 'Шинэ эргэлтийн цикл эхэллээ 🎉';
    }
    return `Дараагийн эргэлт хүртэл ${formatNum(remainingAmount)}₮`;
  };

  const goToHome = useCallback(() => {
    const tabNav = navigation.getParent()?.getParent() as
      | { navigate: (name: string) => void }
      | undefined;
    tabNav?.navigate('Home');
  }, [navigation]);

  const handleSpin = useCallback(async () => {
    if (warehouseId == null || !canSpin || spinning) return;

    const idempotencyKey = generateIdempotencyKey();
    setSpinning(true);
    animationDoneRef.current = false;

    const animationPromise = new Promise<void>((resolve) => {
      spinAnim.setValue(0);
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: SPIN_ANIMATION_MS,
        useNativeDriver: true,
      }).start(() => {
        animationDoneRef.current = true;
        resolve();
      });
    });

    let result: LuckySpinResultData | null = null;
    let spinError: unknown = null;

    try {
      result = await spinLuckyWheel(warehouseId, idempotencyKey);
    } catch (err) {
      if (isCancelError(err)) {
        spinError = err;
      } else {
        const status = (err as { status?: number })?.status;
        const code = (err as { code?: string })?.code;
        const msg = (err as Error).message ?? '';
        const isTimeout =
          status === 408 ||
          code === 'ECONNABORTED' ||
          msg.includes('timeout') ||
          msg.includes('Timeout');
        if (isTimeout) {
          try {
            result = await spinLuckyWheel(warehouseId, idempotencyKey);
          } catch (retryErr) {
            spinError = retryErr;
          }
        } else {
          spinError = err;
        }
      }
    }

    if (spinError != null) {
      setSpinning(false);
      const status = (spinError as { status?: number })?.status;
      const code = (spinError as { code?: string })?.code;
      if (status === 401 || code === 'UNAUTHORIZED') {
        return;
      }
      if (status === 400 || status === 409) {
        Alert.alert('Алдаа', TOAST_SPIN_UNAVAILABLE);
      } else {
        Alert.alert('Алдаа', TOAST_SERVER_ERROR);
      }
      return;
    }

    if (result) {
      invalidateLuckyEligibilityCache(warehouseId);
      try {
        await appendPrizeToWallet(warehouseId, {
          prize_id: result.prize_id,
          prize_type: result.prize_type,
          product: result.product,
          coupon_payload: result.coupon_payload,
          expires_at: result.expires_at,
        });
      } catch {
        // non-blocking
      }
      await animationPromise;
      setSpinning(false);
      navigation.navigate('SpinResult', { result });
    } else {
      setSpinning(false);
    }
  }, [warehouseId, canSpin, spinning, spinAnim, navigation]);

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2160deg'],
  });

  if (warehouseId == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Агуулах сонгоно уу</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.skeleton}>
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonWheel} />
          <View style={styles.skeletonButton} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Азны эргэлт</Text>
            <Text style={styles.cardSubtitle}>
              {spinCredits > 0
                ? `Эргүүлэх эрх: ${spinCredits} удаа`
                : 'Дараагийн бэлэг ойрхон байна 🎁'}
            </Text>

            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>
                {formatNum(cycleSpent)}₮ / {formatNum(threshold)}₮
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressRatio * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressCaption}>{getCaption()}</Text>
            </View>
          </View>

          <View style={styles.wheelContainer}>
            <Animated.View
              style={[
                styles.wheel,
                {
                  transform: [{ rotate: spinRotation }],
                },
              ]}
            >
              <View style={styles.wheelInner}>
                <Ionicons name="gift" size={48} color="#f59e0b" />
              </View>
            </Animated.View>
          </View>

          {spinCredits > 0 ? (
            <TouchableOpacity
              style={[
                styles.ctaPrimary,
                spinning && styles.ctaDisabled,
              ]}
              onPress={handleSpin}
              disabled={spinning}
              activeOpacity={0.8}
            >
              {spinning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaPrimaryText}>Эргүүлэх</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.ctaOutline}
              onPress={goToHome}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaOutlineText}>Дараагийн эргэлт авах</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
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
  skeleton: {
    paddingVertical: 24,
  },
  skeletonCard: {
    height: 140,
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    marginBottom: 24,
  },
  skeletonWheel: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginVertical: 24,
  },
  skeletonButton: {
    height: 52,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
  },
  progressSection: {
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  progressCaption: {
    fontSize: 14,
    color: '#64748b',
  },
  wheelContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  wheel: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fef3c7',
    borderWidth: 6,
    borderColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaPrimary: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: '#94a3b8',
  },
  ctaPrimaryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  ctaOutline: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  ctaOutlineText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2563eb',
  },
});
