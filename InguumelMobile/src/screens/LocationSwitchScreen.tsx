import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getAimags, getSoums, getWarehouses } from '~/api/endpoints';
import type { Aimag, Soum, Warehouse } from '~/types';
import type { AppError } from '~/types';
import { locationStore } from '~/store/locationStore';
import { cartStore } from '~/store/cartStore';
import { useApp } from '~/state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '~/navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LocationSwitch'>;

type Step = 'location' | 'warehouse';

const CART_WARNING =
  'Байршил солиход таны сагс цэвэрлэгдэнэ. Үргэлжлүүлэх үү?';

export function LocationSwitchScreen({ navigation }: Props) {
  const { selectWarehouse } = useApp();
  const warehouseId = locationStore((s) => s.warehouse_id);
  const warehouseName = locationStore((s) => s.warehouse_name);
  const cartLines = cartStore((s) => s.lines);
  const hasCartItems = cartLines.length > 0;

  const [aimags, setAimags] = useState<Aimag[]>([]);
  const [soums, setSoums] = useState<Soum[]>([]);
  const [selectedAimag, setSelectedAimag] = useState<Aimag | null>(null);
  const [selectedSoum, setSelectedSoum] = useState<Soum | null>(null);
  const [loadingAimags, setLoadingAimags] = useState(true);
  const [loadingSoums, setLoadingSoums] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [step, setStep] = useState<Step>('location');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAimags();
        if (!cancelled) setAimags(list);
      } catch (err) {
        if (!cancelled) Alert.alert('Алдаа', (err as AppError).message);
      } finally {
        if (!cancelled) setLoadingAimags(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedAimag) {
      setSoums([]);
      setSelectedSoum(null);
      return;
    }
    let cancelled = false;
    setLoadingSoums(true);
    (async () => {
      try {
        const list = await getSoums(selectedAimag.id);
        if (!cancelled) {
          setSoums(list);
          setSelectedSoum(null);
        }
      } catch (err) {
        if (!cancelled) Alert.alert('Алдаа', (err as AppError).message);
      } finally {
        if (!cancelled) setLoadingSoums(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedAimag]);

  const applyWarehouse = async (warehouse: Warehouse) => {
    const doSelect = async () => {
      setSaving(true);
      try {
        await selectWarehouse(warehouse.id, {
          aimag_name: selectedAimag?.name,
          soum_name: selectedSoum?.name,
          warehouse_name: warehouse.name,
        });
        navigation.goBack();
      } catch (err) {
        Alert.alert('Алдаа', (err as AppError).message);
      } finally {
        setSaving(false);
      }
    };

    if (hasCartItems) {
      Alert.alert('Байршил солих', CART_WARNING, [
        { text: 'Цуцлах', style: 'cancel' },
        { text: 'Үргэлжлүүлэх', onPress: doSelect },
      ]);
    } else {
      await doSelect();
    }
  };

  const handleConfirmLocation = async () => {
    if (!selectedAimag || !selectedSoum) {
      Alert.alert('Сонгоно уу', 'Аймаг болон сум сонгоно уу.');
      return;
    }
    setSaving(true);
    try {
      await locationStore.getState().setLocation(selectedAimag.id, selectedSoum.id);
      setLoadingWarehouses(true);
      const list = await getWarehouses(selectedSoum.id);
      setLoadingWarehouses(false);
      if (list.length === 1) {
        await applyWarehouse(list[0]);
        return;
      }
      if (list.length > 1) {
        setWarehouses(list);
        setStep('warehouse');
      } else {
        Alert.alert('Алдаа', 'Энэ суманд агуулах олдсонгүй.');
      }
    } catch (err) {
      setLoadingWarehouses(false);
      Alert.alert('Алдаа', (err as AppError).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    applyWarehouse(warehouse);
  };

  const currentLine =
    warehouseId != null
      ? `Одоо: ${warehouseName?.trim() || `Агуулах #${warehouseId}`}`
      : 'Одоо: сонгогдоогүй';

  if (loadingWarehouses && warehouses.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Агуулах ачаалж байна…</Text>
      </View>
    );
  }

  if (step === 'warehouse') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.currentLine}>{currentLine}</Text>
        <Text style={styles.section}>Нэг агуулах сонгоно уу</Text>
        <View style={styles.list}>
          {warehouses.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.warehouseRow}
              onPress={() => handleSelectWarehouse(w)}
              disabled={saving}
            >
              <Text style={styles.warehouseName}>
                {w.name?.trim() || `Агуулах #${w.id}`}
              </Text>
              {(selectedAimag != null || selectedSoum != null) && (
                <Text style={styles.warehouseSub}>
                  {[selectedAimag?.name, selectedSoum?.name].filter(Boolean).join(' / ')}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (loadingAimags) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.currentLine}>{currentLine}</Text>
      <Text style={styles.section}>Аймаг</Text>
      <View style={styles.chips}>
        {aimags.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={[styles.chip, selectedAimag?.id === a.id && styles.chipSelected]}
            onPress={() => setSelectedAimag(a)}
          >
            <Text style={[styles.chipText, selectedAimag?.id === a.id && styles.chipTextSelected]}>
              {a.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedAimag && (
        <>
          <Text style={styles.section}>Сум</Text>
          {loadingSoums ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <View style={styles.chips}>
              {soums.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, selectedSoum?.id === s.id && styles.chipSelected]}
                  onPress={() => setSelectedSoum(s)}
                >
                  <Text style={[styles.chipText, selectedSoum?.id === s.id && styles.chipTextSelected]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.button, (saving || !selectedSoum) && styles.buttonDisabled]}
            onPress={handleConfirmLocation}
            disabled={saving || !selectedSoum}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Байршил тохируулж байна…' : 'Баталгаажуулах'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
  currentLine: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  section: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  chipSelected: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  loader: { marginVertical: 16 },
  list: { gap: 8 },
  warehouseRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  warehouseName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  warehouseSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
