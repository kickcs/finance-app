import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { useSubscription } from '@/entities/subscription/api';
import { signOut, useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  premium_monthly: 'Premium · ежемесячно',
  premium_yearly: 'Premium · ежегодно',
};

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU');
}

export default function ProfileScreen() {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { subscription } = useSubscription(user?.id ?? null);
  const [signingOut, setSigningOut] = useState(false);

  const planLabel = PLAN_LABELS[subscription.plan] ?? subscription.plan;
  const email = profile?.email ?? user?.email ?? 'Анонимный пользователь';
  const currency = profile?.currency ?? 'USD';
  const periodEndLabel = formatPeriodEnd(subscription.current_period_end);

  const handleSignOut = () => {
    if (signingOut) return;
    Alert.alert('Выйти из аккаунта?', 'Локальные данные будут очищены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <View className="px-4 py-6 gap-4">
        <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Профиль
        </Text>

        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Email
          </Text>
          <Text
            numberOfLines={1}
            className="mt-1 text-base text-text-primary-light dark:text-text-primary-dark"
          >
            {email}
          </Text>
        </Card>

        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Валюта
          </Text>
          <Text className="mt-1 text-base text-text-primary-light dark:text-text-primary-dark">
            {currency}
          </Text>
        </Card>

        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Подписка
          </Text>
          <Text className="mt-1 text-base font-medium text-text-primary-light dark:text-text-primary-dark">
            {planLabel}
          </Text>
          {periodEndLabel ? (
            <Text className="mt-0.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              {subscription.cancel_at_period_end ? 'Заканчивается ' : 'Продление '}
              {periodEndLabel}
            </Text>
          ) : null}
        </Card>

        <Button
          title={signingOut ? 'Выход…' : 'Выйти'}
          variant="danger"
          loading={signingOut}
          disabled={signingOut}
          onPress={handleSignOut}
        />
      </View>
    </ScrollView>
  );
}
