import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CartScreen } from '~/screens/CartScreen';
import { OrderInfoScreen } from '~/screens/OrderInfoScreen';
import type { CartStackParamList } from './types';

const Stack = createNativeStackNavigator<CartStackParamList>();

export function CartStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Буцах',
      }}
    >
      <Stack.Screen
        name="CartHome"
        component={CartScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="OrderInfo"
        component={OrderInfoScreen}
        options={{
          title: 'Захиалгын мэдээлэл',
          headerBackTitle: 'Сагс',
        }}
      />
    </Stack.Navigator>
  );
}
