import '../global.css';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Providers } from '@/providers/Providers';
import { bootstrapAuth, useAuth } from '@/shared/api/composables/useAuth';

function AppShell() {
  const { ready } = useAuth();

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
