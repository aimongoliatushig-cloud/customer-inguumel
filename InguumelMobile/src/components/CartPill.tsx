import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { formatMnt } from '~/components/cart/formatMoney';

/** Exported for FlatList paddingBottom calculation on Home screen. */
export const CART_PILL_HEIGHT = 44;
const PILL_HEIGHT = 54;
const LOGO_SIZE = 22;
const BADGE_SIZE = 28;

/** Manual tuning: shift amount text horizontally (e.g. -2, 0, 2). */
const amountTranslateX = 0;

let inguumelLogo: number | null = null;
try {
  inguumelLogo = require('../../assets/images/inguumel_logo.png');
} catch {
  // Fallback: use "e" letter in circle
}

export interface CartPillProps {
  visible: boolean;
  totalQty: number;
  totalAmount: number;
  onPress: () => void;
}

function CartPillInner({ visible, totalQty, totalAmount, onPress }: CartPillProps) {
  if (!visible || totalQty <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.logoWrap}>
        {inguumelLogo != null ? (
          <Image source={inguumelLogo} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>e</Text>
          </View>
        )}
      </View>
      <View style={styles.amountWrap}>
        <Text style={styles.amountLabel}>Сагс</Text>
        <Text
          style={[
            styles.amount,
            amountTranslateX !== 0 && { transform: [{ translateX: amountTranslateX }] },
          ]}
        >
          {formatMnt(totalAmount)}
        </Text>
      </View>
      <View style={styles.badgeWrap}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalQty > 99 ? '99+' : totalQty}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  logoWrap: {
    width: LOGO_SIZE + 10,
    height: LOGO_SIZE + 10,
    borderRadius: (LOGO_SIZE + 10) / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoFallback: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  amountWrap: {
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  badgeWrap: {
    marginLeft: 10,
  },
  badge: {
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#0f766e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export const CartPill = React.memo(CartPillInner);
