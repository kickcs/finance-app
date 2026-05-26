import '../global.css';

import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useSubscription } from '@/entities/subscription';
import {
  PremiumUpgradeModal,
  setPremiumStatus,
} from '@/features/upgrade-to-premium';
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
  // Premium gate consumes a single global isPremium flag — keep the Zustand
  // mirror in sync with the server-truth subscription query so requirePremium()
  // call sites don't need their own React Query subscription.
  const { isPremium } = useSubscription(user?.id ?? null);

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  useEffect(() => {
    setPremiumStatus(isPremium);
  }, [isPremium]);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    const inAuth = segments[0] === 'auth';
    if (!user && !inAuth) router.replace('/auth/sign-in');
    if (user && inAuth) router.replace('/');
  }, [ready, user, segments, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="transactions/new"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.75, 1.0],
          title: 'Новая операция',
        }}
      />
      <Stack.Screen
        name="transactions/[id]/edit"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.75, 1.0],
          title: 'Редактировать',
        }}
      />
      <Stack.Screen
        name="accounts/new"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          title: 'Новый счёт',
        }}
      />
      <Stack.Screen
        name="goals/new"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          title: 'Новая цель',
        }}
      />
      <Stack.Screen
        name="debts/new"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          title: 'Новый долг',
        }}
      />
      <Stack.Screen
        name="debts/[id]/edit"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          title: 'Редактировать долг',
        }}
      />
      <Stack.Screen
        name="debts/[id]/partial-pay"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6],
          title: 'Частичная оплата',
        }}
      />
      <Stack.Screen
        name="debts/[id]/close"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6],
          title: 'Закрыть долг',
        }}
      />
      <Stack.Screen
        name="accounts/[id]/adjust"
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6],
          title: 'Корректировка',
        }}
      />
      <Stack.Screen
        name="scan-receipt"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          title: 'Чек',
        }}
      />
      </Stack>
      <PremiumUpgradeModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
