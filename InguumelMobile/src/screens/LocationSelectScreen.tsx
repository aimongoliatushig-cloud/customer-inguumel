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
import { authStore } from '~/store/authStore';
import { useApp } from '~/state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LocationStackParamList } from '~/navigation/types';

type Props = NativeStackScreenProps<LocationStackParamList, 'LocationSelect'>;

type Step = 'location' | 'warehouse';

export function LocationSelectScreen(_props: Props) {
  const { selectWarehouse } = useApp();
  const warehouse_ids = authStore((s) => s.warehouse_ids);
  const owner_warehouses = authStore((s) => s.owner_warehouses);
  const isWarehouseOwner = Array.isArray(warehouse_ids) && warehouse_ids.length > 0;
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

  /** On mount: if we have aimag+sum but no warehouse (e.g. returning user), fetch warehouses */
  useEffect(() => {
    const { aimag_id, sum_id, warehouse_id } = locationStore.getState();
    if (aimag_id == null || sum_id == null || warehouse_id != null) return;
    let cancelled = false;
    setLoadingWarehouses(true);
    (async () => {
      try {
        const list = await getWarehouses(sum_id);
        if (cancelled) return;
        if (list.length === 1) {
          await selectWarehouse(list[0].id, { warehouse_name: list[0].name });
          return;
        }
        if (list.length > 1) {
          setWarehouses(list);
          setStep('warehouse');
        } else {
          Alert.alert('Алдаа', 'Энэ суманд агуулах олдсонгүй.');
        }
      } catch (err) {
        if (!cancelled) Alert.alert('Алдаа', (err as AppError).message);
      } finally {
        if (!cancelled) setLoadingWarehouses(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectWarehouse]);

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
        await selectWarehouse(list[0].id, {
          aimag_name: selectedAimag.name,
          soum_name: selectedSoum.name,
          warehouse_name: list[0].name,
        });
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

  const handleSelectWarehouse = async (warehouse: Warehouse) => {
    try {
      await selectWarehouse(warehouse.id, {
        aimag_name: selectedAimag?.name,
        soum_name: selectedSoum?.name,
        warehouse_name: warehouse.name,
      });
    } catch (err) {
      Alert.alert('Алдаа', (err as AppError).message);
    }
  };

  /** Warehouse owner: only allow picking from their warehouse_ids (no arbitrary aimag/soum/warehouse). */
  if (isWarehouseOwner) {
    const ownerList = owner_warehouses.length > 0
      ? owner_warehouses
      : warehouse_ids.map((id) => ({ id, name: `Агуулах #${id}` }));
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Миний агуулгууд</Text>
        <Text style={styles.section}>Захиалга харах агуулгаа сонгоно уу</Text>
        <View style={styles.chips}>
          {ownerList.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.chip}
              onPress={() => selectWarehouse(w.id, { warehouse_name: w.name ?? `Агуулах #${w.id}` })}
            >
              <Text style={styles.chipText}>{w.name ?? `Агуулах #${w.id}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

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
        <Text style={styles.title}>Агуулах сонгох</Text>
        <Text style={styles.section}>Нэг агуулах сонгоно уу</Text>
        <View style={styles.chips}>
          {warehouses.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.chip}
              onPress={() => handleSelectWarehouse(w)}
            >
              <Text style={styles.chipText}>{w.name ?? `Агуулах #${w.id}`}</Text>
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
      <Text style={styles.title}>Байршил сонгох</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 24 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
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
