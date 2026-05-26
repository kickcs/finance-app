import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AccountStack } from '@/widgets/account-stack';
import { BalanceCard } from '@/widgets/balance-card';
import { RecentTransactions } from '@/widgets/recent-transactions';
import { SaveSpendSection } from '@/widgets/save-spend-section';
import { Icon } from '@/shared/ui/icon';

export default function DashboardScreen() {
  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }}
      >
        <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Главная
        </Text>
        <BalanceCard />
        <SaveSpendSection />
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              Счета
            </Text>
            <Link href="/accounts/new" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Добавить счёт">
                <Icon name="add" size={20} color="#4f46e5" />
              </Pressable>
            </Link>
          </View>
          <AccountStack />
        </View>
        <View className="gap-2">
          <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Последние операции
          </Text>
          <RecentTransactions />
        </View>
      </ScrollView>

      <Link href="/transactions/new" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Добавить операцию"
          className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Icon name="add" size={28} color="#ffffff" />
        </Pressable>
      </Link>
    </View>
  );
}
