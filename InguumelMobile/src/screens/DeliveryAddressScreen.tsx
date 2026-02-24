import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMe } from '~/api/endpoints';

/** Read-only screen: show saved delivery address and phone from profile. */
export function DeliveryAddressScreen() {
  const [phonePrimary, setPhonePrimary] = useState<string>('');
  const [phoneSecondary, setPhoneSecondary] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const res = await getMe();
          if (!cancelled && res.success && res.data) {
            const me = res.data;
            setPhonePrimary(me.phone_primary ?? '');
            setPhoneSecondary(me.phone_secondary ?? '');
            setDeliveryAddress(me.delivery_address ?? '');
          }
        } catch {
          if (!cancelled) {
            setPhonePrimary('');
            setPhoneSecondary('');
            setDeliveryAddress('');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Хаяг ачаалж байна…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.block}>
        <Text style={styles.label}>
          <Ionicons name="call-outline" size={18} color="#64748b" /> Утасны дугаар
        </Text>
        <Text style={styles.value}>{phonePrimary || '—'}</Text>
      </View>
      {phoneSecondary ? (
        <View style={styles.block}>
          <Text style={styles.label}>
            <Ionicons name="call-outline" size={18} color="#64748b" /> Нэмэлт утас
          </Text>
          <Text style={styles.value}>{phoneSecondary}</Text>
        </View>
      ) : null}
      <View style={styles.block}>
        <Text style={styles.label}>
          <Ionicons name="location-outline" size={18} color="#64748b" /> Хүргэлтийн хаяг
        </Text>
        <Text style={styles.value}>{deliveryAddress || '—'}</Text>
      </View>
      <Text style={styles.hint}>
        Захиалга баталгаажуулах үед энэ хаягыг ашиглана. Хаягаа өөрчлөхийг хүсвэл захиалга
        үүсгэх цэс дээр засна.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
  block: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
    lineHeight: 24,
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 20,
  },
});
