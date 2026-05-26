import { Link, Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';

import { DebtCard, useInfiniteDebts } from '@/entities/debt';
import { useUser } from '@/shared/api/composables/useAuth';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

interface Section {
  title: string;
  data: ReturnType<typeof useInfiniteDebts>['data'] extends
    | { pages: Array<{ groups: Array<{ debts: infer D }> }> }
    | undefined
    ? D
    : never;
}

export default function DebtsScreen() {
  const user = useUser();
  const router = useRouter();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteDebts(user?.id ?? null);

  const sections = useMemo(() => {
    if (!data) return [];
    const result: Section[] = [];
    for (const page of data.pages) {
      for (const group of page.groups) {
        const directionLabel = group.debt_type === 'given' ? 'Вам должны' : 'Вы должны';
        result.push({
          title: `${group.person_name} · ${directionLabel}`,
          data: group.debts as Section['data'],
        });
      }
    }
    return result;
  }, [data]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Долги' }} />
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
          title: 'Долги',
          headerLargeTitle: true,
          headerRight: () => (
            <Link href="/debts/new" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Добавить долг">
                <Icon name="add" size={22} color="#4f46e5" />
              </Pressable>
            </Link>
          ),
        }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ paddingBottom: 32 }}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 py-1">
            <DebtCard
              debt={item}
              onPress={() =>
                router.push({ pathname: '/debts/[id]', params: { id: item.id } })
              }
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View className="bg-background-light dark:bg-background-dark px-4 py-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
              {section.title}
            </Text>
          </View>
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-12 px-6">
            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
              Долгов пока нет
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <Spinner />
            </View>
          ) : null
        }
        stickySectionHeadersEnabled
      />
    </>
  );
}
