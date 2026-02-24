import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '~/state/AppContext';
import { LoginScreen } from '~/screens/LoginScreen';
import { RegisterScreen } from '~/screens/RegisterScreen';
import { LocationSelectScreen } from '~/screens/LocationSelectScreen';
import { TabsNavigator } from './TabsNavigator';
import type { AuthStackParamList, LocationStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const LocationStack = createNativeStackNavigator<LocationStackParamList>();

export function RootNavigator() {
  const { token, warehouseId, hydrated } = useApp();
  // eslint-disable-next-line no-console
  console.log('[RootNavigator]', { hydrated, token: token ? `${token.slice(0, 20)}…` : null, warehouseId });

  if (!hydrated) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const content = !token ? (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Нэвтрэх' }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Бүртгүүлэх' }} />
    </AuthStack.Navigator>
  ) : warehouseId == null ? (
    <LocationStack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <LocationStack.Screen
        name="LocationSelect"
        component={LocationSelectScreen}
        options={{ title: 'Location' }}
      />
    </LocationStack.Navigator>
  ) : (
    <TabsNavigator />
  );

  return <NavigationContainer>{content}</NavigationContainer>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
