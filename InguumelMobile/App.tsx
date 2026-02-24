import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '~/state/AppContext';
import { RootNavigator } from '~/navigation/RootNavigator';

export default function App() {
  const [ready] = useState(true);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
