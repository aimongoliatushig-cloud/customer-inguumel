import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { formatMnt } from '~/components/cart/formatMoney';

/** Exported for FlatList paddingBottom calculation on Home screen. */
export const CART_PILL_HEIGHT = 44;
const PILL_HEIGHT = CART_PILL_HEIGHT;
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
        <Text style={styles.amountLabel}>Нийт үнэ </Text>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  logoWrap: {
    width: LOGO_SIZE + 4,
    height: LOGO_SIZE + 4,
    borderRadius: (LOGO_SIZE + 4) / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
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
    backgroundColor: '#2563EB',
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
