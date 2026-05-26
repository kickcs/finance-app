import { Link, Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { GoalCard, useGoals } from '@/entities/goal';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

export default function GoalsScreen() {
  const user = useUser();
  const router = useRouter();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: goals, isLoading } = useGoals(user?.id ?? null);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Цели' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Цели',
          headerLargeTitle: true,
          headerRight: () => (
            <Link href="/goals/new" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Новая цель">
                <Icon name="add" size={22} color="#4f46e5" />
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background-light dark:bg-background-dark"
        data={goals ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            currency={profile?.currency}
            onPress={() =>
              router.push({ pathname: '/goals/[id]', params: { id: item.id } })
            }
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-12 px-6">
            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
              Целей пока нет
            </Text>
          </View>
        }
      />
    </>
  );
}
