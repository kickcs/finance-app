import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLAN_PRICES, PREMIUM_FEATURES } from '@/entities/subscription';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';

import { usePremiumModalState } from './usePremiumFeature';

type Plan = 'premium_monthly' | 'premium_yearly';

export function PremiumUpgradeModal() {
  const { showUpgradeModal, upgradeFeatureName, closeModal } = usePremiumModalState();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  async function handlePurchase(plan: Plan) {
    setLoadingPlan(plan);
    try {
      // IAP wiring lands in Task 57 (expo-iap). Until then keep the UX
      // discoverable so designers can review the gate flow end-to-end.
      Alert.alert(
        'Скоро',
        'Покупка через App Store / Google Play появится в ближайшем обновлении.',
      );
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <Modal
      visible={showUpgradeModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeModal}
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-background-light dark:bg-background-dark"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-bold text-text-light dark:text-text-dark">
            Ouro Premium
          </Text>
          <Pressable
            onPress={closeModal}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            hitSlop={12}
          >
            <Icon name="close" size={24} />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerClassName="pb-6 gap-5">
          {upgradeFeatureName ? (
            <Text className="text-sm text-text-muted-light dark:text-text-muted-dark">
              Функция «{upgradeFeatureName}» доступна с Premium-подпиской.
            </Text>
          ) : null}

          <View className="gap-3">
            {(PREMIUM_FEATURES as ReadonlyArray<{ icon: string; label: string; description: string }>).map((feature) => (
              <View key={feature.label} className="flex-row items-start gap-3">
                <Icon name={feature.icon} size={20} color="#FF9500" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                    {feature.label}
                  </Text>
                  <Text className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text className="text-xs text-center text-text-muted-light dark:text-text-muted-dark">
            7 дней бесплатно, затем от {PLAN_PRICES.premium_monthly}
          </Text>
        </ScrollView>

        <View className="px-5 pb-2 gap-2">
          <Button
            title={`${PLAN_PRICES.premium_yearly} — выгоднее`}
            variant="primary"
            loading={loadingPlan === 'premium_yearly'}
            disabled={loadingPlan !== null}
            onPress={() => handlePurchase('premium_yearly')}
          />
          <Button
            title={PLAN_PRICES.premium_monthly}
            variant="secondary"
            loading={loadingPlan === 'premium_monthly'}
            disabled={loadingPlan !== null}
            onPress={() => handlePurchase('premium_monthly')}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
