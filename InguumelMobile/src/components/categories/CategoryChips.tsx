import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { Category } from '~/types';

const CHIP_HEIGHT = 36;
const CHIP_PADDING_H = 14;

export interface CategoryChipsProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

const ALL_LABEL = 'Бүгд';

export function CategoryChips({ categories, selectedId, onSelect }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      <TouchableOpacity
        style={[styles.chip, selectedId === null && styles.chipSelected]}
        onPress={() => onSelect(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, selectedId === null && styles.chipTextSelected]}>
          {ALL_LABEL}
        </Text>
      </TouchableOpacity>
      {categories.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {cat.name ?? ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: CHIP_HEIGHT + 12 },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: CHIP_PADDING_H,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CHIP_HEIGHT / 2,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
