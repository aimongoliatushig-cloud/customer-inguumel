import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { config } from '~/constants/config';
import type { Category } from '~/types';

const FALLBACK_COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#ea580c'];

/**
 * Build full URL for category icon.
 * icon_url from API is relative (e.g. /api/v1/mxm/category-icon/<id>?size=128&v=...).
 * No double slash between baseUrl and path.
 *
 * AUTH: RN <Image> does NOT send session cookies. We use direct URI (Option A – backend
 * category-icon endpoint is assumed public). If icons fail with 401/onError, either make
 * the endpoint public or use token-based icon_url (backend change).
 */
function buildCategoryIconUri(category: Category): string | null {
  const url = category.icon_url ?? category.image_url ?? null;
  if (url == null || typeof url !== 'string' || url.trim() === '') return null;
  const base = config.apiBaseUrl.replace(/\/$/, '');
  const path = url.trim().startsWith('/') ? url.trim() : '/' + url.trim();
  return base + path;
}

export interface CategoryIconProps {
  category: Category;
  /** Icon/tile size (width and height). Default 42. */
  size?: number;
}

/**
 * Renders category icon from icon_url when available; otherwise letter tile (first letter).
 * On image load error, logs and falls back to letter tile (no blank space).
 */
export function CategoryIcon({ category, size = 42 }: CategoryIconProps) {
  const [failed, setFailed] = useState(false);

  const uri = useMemo(() => buildCategoryIconUri(category), [category.id, category.icon_url, category.image_url]);

  const firstLetter = (category.name ?? '').trim().charAt(0).toUpperCase() || '?';
  const colorIndex = category.id % FALLBACK_COLORS.length;
  const fallbackColor = FALLBACK_COLORS[colorIndex];

  const showFallback = !uri || failed;

  const handleError = () => {
    setFailed(true);
    // eslint-disable-next-line no-console
    console.log(`[CategoryIcon] load failed categoryId=${category.id} url=${uri ?? ''}`);
  };

  if (showFallback) {
    return (
      <View style={[styles.tile, { width: size, height: size, borderRadius: size / 8 }, { backgroundColor: fallbackColor }]}>
        <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{firstLetter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: uri! }}
      style={[styles.image, { width: size, height: size, borderRadius: size / 8 }]}
      resizeMode="cover"
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    color: '#fff',
    fontWeight: '700',
  },
  image: {
    backgroundColor: '#f1f5f9',
  },
});
