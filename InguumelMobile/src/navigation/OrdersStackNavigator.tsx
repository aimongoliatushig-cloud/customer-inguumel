import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrdersScreen } from '~/screens/OrdersScreen';
import { OrderDetailScreen } from '~/screens/OrderDetailScreen';
import type { OrdersStackParamList } from './types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Буцах',
      }}
    >
      <Stack.Screen
        name="OrderList"
        component={OrdersScreen}
        options={{
          title: 'Захиалга',
        }}
      />
      {/* OrderDetail route → src/screens/OrderDetailScreen.tsx (import: ~/screens/OrderDetailScreen) */}
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          title: 'Захиалгын дэлгэрэнгүй',
        }}
      />
    </Stack.Navigator>
  );
}
