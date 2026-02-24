import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '~/screens/HomeScreen';
import { CategoriesScreen } from '~/screens/CategoriesScreen';
import { OrdersStackNavigator } from '~/navigation/OrdersStackNavigator';
import { ProfileStackNavigator } from '~/navigation/ProfileStackNavigator';
import { CartStackNavigator } from '~/navigation/CartStackNavigator';
import { cartStore } from '~/store/cartStore';
import type { BottomTabParamList } from './types';
import { TAB_BAR_BASE_HEIGHT } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function TabsNavigator() {
  const insets = useSafeAreaInsets();
  const cartCount = cartStore((s) => {
    const list = Array.isArray(s.lines) ? s.lines : [];
    return list.reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
  });
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Нүүр',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          title: 'Ангилал',
          tabBarLabel: 'Ангилал',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartStackNavigator}
        options={{
          title: 'Cart',
          headerShown: false,
          tabBarLabel: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStackNavigator}
        options={{
          title: 'Orders',
          headerShown: false,
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
