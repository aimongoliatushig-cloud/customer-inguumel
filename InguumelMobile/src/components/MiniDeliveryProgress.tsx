/**
 * Thin horizontal delivery progress strip for order list cards.
 * currentStepIndex from delivery.current_status.code (detail) or order.state (list proxy).
 * Steps: received → preparing → prepared → out_for_delivery → delivered (0–4).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

const STEP_COUNT = 5;
const DOT_SIZE = 6;
const GAP = 4;

interface MiniDeliveryProgressProps {
  /** 0–4; from delivery.current_status.code or deliveryStepIndex(normalizeDeliveryCode(...)). */
  currentStepIndex: number;
  /** When true, show cancelled style (gray/red), no progression. */
  isCancelled?: boolean;
}

export function MiniDeliveryProgress({ currentStepIndex, isCancelled: cancelled }: MiniDeliveryProgressProps) {
  const safeIndex = Math.max(-1, Math.min(currentStepIndex, STEP_COUNT - 1));
  const isDelivered = safeIndex === STEP_COUNT - 1;
  if (cancelled) {
    return (
      <View style={styles.container}>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <View key={i} style={[styles.dot, styles.dotCancelled]} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const isDone = i < safeIndex || (isDelivered && i === safeIndex);
        const isActive = !isDelivered && i === safeIndex;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isDone && styles.dotDone,
              isActive && styles.dotActive,
              !isDone && !isActive && styles.dotTodo,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: GAP / 2,
  },
  dotDone: {
    backgroundColor: '#16a34a',
  },
  dotActive: {
    backgroundColor: '#2563eb',
    transform: [{ scale: 1.2 }],
  },
  dotTodo: {
    backgroundColor: '#e2e8f0',
  },
  dotCancelled: {
    backgroundColor: '#94a3b8',
  },
});
