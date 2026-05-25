import '../global.css';

import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { Providers } from '@/providers/Providers';
import { bootstrapAuth, useAuthReady, useUser } from '@/shared/api/composables/useAuth';

// Keep the native splash visible until auth bootstrap finishes — avoids a
// no-route flash and lets useSegments resolve against a real router tree.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden */
});

function AppShell() {
  const user = useUser();
  const ready = useAuthReady();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    const inAuth = segments[0] === 'auth';
    if (!user && !inAuth) router.replace('/auth/sign-in');
    if (user && inAuth) router.replace('/');
  }, [ready, user, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
