import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLAN_PRICES, PREMIUM_FEATURES } from '@/entities/subscription';
import { useSubscription } from '@/entities/subscription/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';

import type { ProductPlan } from './iap';
import { usePremiumModalState } from './usePremiumFeature';
import { useUpgrade, type UpgradeProductOption } from './useUpgrade';

export function PremiumUpgradeModal() {
  const { showUpgradeModal, upgradeFeatureName, closeModal } = usePremiumModalState();
  const user = useUser();
  const { refreshSubscription } = useSubscription(user?.id ?? null);
  const {
    options,
    isLoadingProducts,
    purchasingPlan,
    lastError,
    isAvailable,
    purchase,
  } = useUpgrade();

  // When the store returns prices use them; otherwise fall back to the static
  // PLAN_PRICES strings so the modal stays useful in the simulator / before
  // products are configured in App Store Connect.
  const yearlyOption = options.find((opt) => opt.plan === 'yearly');
  const monthlyOption = options.find((opt) => opt.plan === 'monthly');

  async function handlePurchase(plan: ProductPlan) {
    await purchase(plan);
    if (user?.id) {
      void refreshSubscription();
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
            {(PREMIUM_FEATURES as ReadonlyArray<{
              icon: string;
              label: string;
              description: string;
            }>).map((feature) => (
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
            7 дней бесплатно, затем от {monthlyOption?.displayPrice ?? PLAN_PRICES.premium_monthly}
          </Text>

          {lastError ? (
            <Text className="text-center text-sm text-danger-light">{lastError}</Text>
          ) : null}

          {!isAvailable ? (
            <Text className="text-center text-xs text-text-muted-light dark:text-text-muted-dark">
              Покупки доступны только в мобильном приложении.
            </Text>
          ) : null}
        </ScrollView>

        <View className="px-5 pb-2 gap-2">
          <PurchaseButton
            option={yearlyOption}
            fallbackPrice={PLAN_PRICES.premium_yearly}
            fallbackLabel={`${PLAN_PRICES.premium_yearly} — выгоднее`}
            buildLabel={(opt) => `${opt.displayPrice} — выгоднее`}
            plan="yearly"
            variant="primary"
            loading={purchasingPlan === 'yearly'}
            disabled={!isAvailable || purchasingPlan !== null}
            isLoadingProducts={isLoadingProducts}
            onPress={handlePurchase}
          />
          <PurchaseButton
            option={monthlyOption}
            fallbackPrice={PLAN_PRICES.premium_monthly}
            fallbackLabel={PLAN_PRICES.premium_monthly}
            buildLabel={(opt) => opt.displayPrice}
            plan="monthly"
            variant="secondary"
            loading={purchasingPlan === 'monthly'}
            disabled={!isAvailable || purchasingPlan !== null}
            isLoadingProducts={isLoadingProducts}
            onPress={handlePurchase}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface PurchaseButtonProps {
  option: UpgradeProductOption | undefined;
  fallbackPrice: string;
  fallbackLabel: string;
  buildLabel: (opt: UpgradeProductOption) => string;
  plan: ProductPlan;
  variant: 'primary' | 'secondary';
  loading: boolean;
  disabled: boolean;
  isLoadingProducts: boolean;
  onPress: (plan: ProductPlan) => void;
}

function PurchaseButton({
  option,
  fallbackLabel,
  buildLabel,
  plan,
  variant,
  loading,
  disabled,
  isLoadingProducts,
  onPress,
}: PurchaseButtonProps) {
  const title = option ? buildLabel(option) : isLoadingProducts ? 'Загрузка…' : fallbackLabel;
  return (
    <Button
      title={title}
      variant={variant}
      loading={loading}
      disabled={disabled || isLoadingProducts}
      onPress={() => onPress(plan)}
    />
  );
}
