import { ScrollView, Text, View } from 'react-native';

import { AccountStack } from '@/widgets/account-stack';
import { BalanceCard } from '@/widgets/balance-card';

export default function DashboardScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <View className="px-4 py-6 gap-4">
        <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Главная
        </Text>
        <BalanceCard />
        <View className="gap-2">
          <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Счета
          </Text>
          <AccountStack />
        </View>
      </View>
    </ScrollView>
  );
}
