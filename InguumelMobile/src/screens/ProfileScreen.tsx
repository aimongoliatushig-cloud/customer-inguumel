import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authStore } from '~/store/authStore';
import { locationStore } from '~/store/locationStore';
import { useApp } from '~/state/AppContext';
import type { ProfileStackParamList } from '~/navigation/types';
import { getMe } from '~/api/endpoints';
import { getMxmOrders, type MxmOrderItem } from '~/api/endpoints';
import { normalizeDeliveryCode, isDelivered, isCancelled } from '~/utils/deliveryStatus';
import {
  AvatarHeader,
  LoyaltyStatusCard,
  OrderStatsCard,
  SettingsList,
} from '~/components/profile';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

const LOCATION_CHANGE_MESSAGE =
  'Байршил солих үед таны сагс автоматаар цэвэрлэгдэнэ.';

/** Mask phone for display: first 4 digits + **** */
function maskPhone(phone: string | undefined): string {
  if (!phone || typeof phone !== 'string') return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return digits.slice(0, 4) + '****';
}

/** Count orders by delivery status */
function countOrdersByStatus(list: MxmOrderItem[]): {
  active: number;
  delivered: number;
  cancelled: number;
} {
  let active = 0;
  let delivered = 0;
  let cancelled = 0;
  for (const o of list) {
    const code = normalizeDeliveryCode(
      o.delivery_status_code ??
        (o as { mxm_delivery_status?: string }).mxm_delivery_status
    );
    if (o.delivery_is_delivered === true || isDelivered(code)) delivered++;
    else if (o.delivery_is_cancelled === true || isCancelled(code)) cancelled++;
    else active++;
  }
  return { active, delivered, cancelled };
}

export function ProfileScreen({ navigation }: Props) {
  const { token, setAuthToken } = useApp();
  const warehouseId = locationStore((s) => s.warehouse_id);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [orderCounts, setOrderCounts] = useState({
    active: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const hasLocation = warehouseId != null;

  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await getMe();
      if (res.success && res.data) {
        const me = res.data;
        setPhone(me.phone_primary ?? '');
        setName(me.name?.trim() || 'Хэрэглэгч');
      }
    } catch {
      // keep previous
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  const loadOrderCounts = useCallback(async () => {
    const wh = warehouseId ?? (await locationStore.getState().getWarehouseIdAsync());
    if (wh == null) {
      setOrderCounts({ active: 0, delivered: 0, cancelled: 0 });
      return;
    }
    setOrdersLoading(true);
    try {
      const list = await getMxmOrders(wh, { delivery_tab: 'all', limit: 500 });
      setOrderCounts(countOrdersByStatus(list));
    } catch {
      setOrderCounts({ active: 0, delivered: 0, cancelled: 0 });
    } finally {
      setOrdersLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadOrderCounts();
    }, [loadProfile, loadOrderCounts])
  );

  const handleConfirmLocationChange = () => {
    setLocationModalVisible(false);
    navigation.navigate('LocationSwitch');
  };

  const handleViewOrders = () => {
    const tabNav = navigation.getParent()?.getParent() as
      | { navigate: (name: string) => void }
      | undefined;
    tabNav?.navigate('Orders');
  };

  const handleLogout = () => {
    Alert.alert('Гарах', 'Та системээс гарах уу?', [
      { text: 'Үгүй', style: 'cancel' },
      {
        text: 'Тийм',
        style: 'destructive',
        onPress: async () => {
          await authStore.getState().logout();
          setAuthToken(null);
        },
      },
    ]);
  };

  const settingsItems = [
    {
      key: 'location',
      icon: 'location-outline' as const,
      label: 'Байршил',
      onPress: () => setLocationModalVisible(true),
    },
    {
      key: 'delivery',
      icon: 'navigate-outline' as const,
      label: 'Хүргэлтийн хаяг',
      onPress: () => navigation.navigate('DeliveryAddress'),
    },
    {
      key: 'luckywheel',
      icon: 'gift-outline' as const,
      label: 'Азны эргэлт',
      onPress: () => navigation.navigate('LuckyWheel'),
    },
    {
      key: 'wallet',
      icon: 'wallet-outline' as const,
      label: 'Шагналын түрийвч',
      onPress: () => navigation.navigate('PrizeWallet'),
    },
    {
      key: 'privacy',
      icon: 'shield-checkmark-outline' as const,
      label: 'Нууцлал ба бүртгэл',
      onPress: () => navigation.navigate('AccountPrivacy'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <AvatarHeader
          name={name}
          maskedPhone={maskPhone(phone)}
          loading={profileLoading}
        />
      </View>

      <LoyaltyStatusCard
        level="Таны түвшин"
        progress={0}
        progressLabel="Дараагийн түвшин хүртэл"
      />

      <OrderStatsCard
        active={orderCounts.active}
        delivered={orderCounts.delivered}
        cancelled={orderCounts.cancelled}
        loading={ordersLoading}
        onViewOrders={handleViewOrders}
        disabled={!hasLocation}
      />

      <SettingsList items={settingsItems} />

      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Гарах</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={locationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLocationModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>{LOCATION_CHANGE_MESSAGE}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Цуцлах</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleConfirmLocationChange}
              >
                <Text style={styles.modalButtonPrimaryText}>Үргэлжлүүлэх</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 40 },
  avatarSection: {
    backgroundColor: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoutSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalMessage: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButtonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  modalButtonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
