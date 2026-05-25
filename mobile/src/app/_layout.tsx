import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Providers } from '@/providers/Providers';
import { bootstrapAuth, useAuth } from '@/shared/api/composables/useAuth';

function AppShell() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === 'auth';
    if (!user && !inAuth) router.replace('/auth/sign-in');
    if (user && inAuth) router.replace('/');
  }, [ready, user, segments, router]);

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
