import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountPrivacyScreen } from '~/screens/AccountPrivacyScreen';
import { DeliveryAddressScreen } from '~/screens/DeliveryAddressScreen';
import { LocationSwitchScreen } from '~/screens/LocationSwitchScreen';
import { LuckyWheelScreen } from '~/screens/LuckyWheelScreen';
import { PrizeWalletScreen } from '~/screens/PrizeWalletScreen';
import { ProfileScreen } from '~/screens/ProfileScreen';
import { SpinResultScreen } from '~/screens/SpinResultScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Миний профайл' }}
      />
      <Stack.Screen
        name="LocationSwitch"
        component={LocationSwitchScreen}
        options={{ title: 'Байршил сонгох' }}
      />
      <Stack.Screen
        name="DeliveryAddress"
        component={DeliveryAddressScreen}
        options={{ title: 'Хүргэлтийн хаяг' }}
      />
      <Stack.Screen
        name="AccountPrivacy"
        component={AccountPrivacyScreen}
        options={{ title: 'Нууцлал ба бүртгэл' }}
      />
      <Stack.Screen
        name="LuckyWheel"
        component={LuckyWheelScreen}
        options={{ title: 'Азны эргэлт' }}
      />
      <Stack.Screen
        name="SpinResult"
        component={SpinResultScreen}
        options={{ title: 'Үр дүн' }}
      />
      <Stack.Screen
        name="PrizeWallet"
        component={PrizeWalletScreen}
        options={{ title: 'Шагналын түрийвч' }}
      />
    </Stack.Navigator>
  );
}
