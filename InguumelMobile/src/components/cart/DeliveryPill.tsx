import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DeliveryPillProps {
  count: number;
}

/** Single delivery type pill: "Энгийн хүргэлт" with count. No "Захиалгат хүргэлт". */
export function DeliveryPill({ count }: DeliveryPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>Энгийн хүргэлт</Text>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 24,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  bubble: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
