import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface OrderStatsCardProps {
  active: number;
  delivered: number;
  cancelled: number;
  loading?: boolean;
  onViewOrders: () => void;
  disabled?: boolean;
}

export function OrderStatsCard({
  active,
  delivered,
  cancelled,
  loading = false,
  onViewOrders,
  disabled = false,
}: OrderStatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        <Ionicons name="cube-outline" size={18} color="#0f172a" /> Миний захиалгууд
      </Text>
      {loading ? (
        <Text style={styles.loadingText}>Уншиж байна…</Text>
      ) : (
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{active}</Text>
            <Text style={styles.statLabel}>Идэвхтэй</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{delivered}</Text>
            <Text style={styles.statLabel}>Хүргэгдсэн</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{cancelled}</Text>
            <Text style={styles.statLabel}>Цуцлагдсан</Text>
          </View>
        </View>
      )}
      <TouchableOpacity
        style={styles.linkButton}
        onPress={onViewOrders}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={[styles.linkText, disabled && styles.linkTextDisabled]}>
          Захиалгууд харах
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={disabled ? '#94a3b8' : '#2563eb'}
        />
      </TouchableOpacity>
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
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2563eb',
    marginRight: 4,
  },
  linkTextDisabled: {
    color: '#94a3b8',
  },
});
