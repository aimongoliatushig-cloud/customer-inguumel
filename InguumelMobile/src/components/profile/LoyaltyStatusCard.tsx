import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface LoyaltyStatusCardProps {
  /** Display level/tier name (e.g. "Алтан", "Мөнгөн") */
  level?: string;
  /** Progress 0–1 for bar fill */
  progress?: number;
  /** Optional label below progress (e.g. "Дараагийн түвшин хүртэл") */
  progressLabel?: string;
}

/** Identity-focused loyalty card. No Lucky Wheel / spin logic. */
export function LoyaltyStatusCard({
  level = 'Таны түвшин',
  progress = 0,
  progressLabel,
}: LoyaltyStatusCardProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.level}>{level}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${clampedProgress * 100}%` }]}
        />
      </View>
      {progressLabel ? (
        <Text style={styles.progressLabel}>{progressLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    marginBottom: 12,
  },
  level: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    color: '#64748b',
  },
});
