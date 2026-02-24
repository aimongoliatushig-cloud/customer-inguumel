import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { authStore } from '~/store/authStore';
import { locationStore } from '~/store/locationStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type InitStackParamList = { Init: undefined; Login: undefined; LocationSelect: undefined; Home: undefined };
type Props = NativeStackScreenProps<InitStackParamList, 'Init'>;

export function InitScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([
        authStore.getState().hydrate(),
        locationStore.getState().hydrate(),
      ]);
      if (cancelled) return;
      const { uid, token } = authStore.getState();
      if (uid == null && !token) {
        navigation.replace('Login');
        return;
      }
      const { aimag_id, sum_id, warehouse_id } = locationStore.getState();
      if (aimag_id == null || sum_id == null || warehouse_id == null) {
        navigation.replace('LocationSelect');
        return;
      }
      navigation.replace('Home');
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
