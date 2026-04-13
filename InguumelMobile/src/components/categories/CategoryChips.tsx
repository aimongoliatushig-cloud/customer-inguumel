import React from 'react';
import { Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
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
  scroll: { maxHeight: CHIP_HEIGHT + 20 },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: CHIP_PADDING_H + 2,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CHIP_HEIGHT / 2,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  chipSelected: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});
