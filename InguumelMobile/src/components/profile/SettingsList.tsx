import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SettingsItem {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

export interface SettingsListProps {
  items: SettingsItem[];
}

export function SettingsList({ items }: SettingsListProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        <Ionicons name="settings-outline" size={18} color="#64748b" /> Тохиргоо
      </Text>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.key}
          style={[
            styles.row,
            index === items.length - 1 && styles.rowLast,
          ]}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon} size={22} color="#334155" />
          <Text style={styles.rowText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      ))}
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
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    fontSize: 16,
    color: '#0f172a',
    flex: 1,
  },
});
