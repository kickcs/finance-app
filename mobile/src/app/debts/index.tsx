import { Link, Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';

import { DebtCard, useInfiniteDebts } from '@/entities/debt';
import { CURRENCIES } from '@/entities/currency/model/constants';
import { useUser } from '@/shared/api/composables/useAuth';
import { Icon } from '@/shared/ui/icon';
import { SelectChips } from '@/shared/ui/select-chips';
import { Spinner } from '@/shared/ui/spinner';
import { Tabs } from '@/shared/ui/tabs';
import { Toggle } from '@/shared/ui/toggle';
import { useDebtsPageState } from '@/features/debts-filters/composables/useDebtsPageState';

interface Section {
  title: string;
  data: ReturnType<typeof useInfiniteDebts>['data'] extends
    | { pages: Array<{ groups: Array<{ debts: infer D }> }> }
    | undefined
    ? D
    : never;
}

const DIRECTION_TABS = [
  { id: 'all' as const, label: 'Все' },
  { id: 'owed_to_me' as const, label: 'Мне должны' },
  { id: 'i_owe' as const, label: 'Я должен' },
];

const CURRENCY_CHIPS = CURRENCIES.map((c) => ({ id: c.code, label: c.code }));

export default function DebtsScreen() {
  const user = useUser();
  const router = useRouter();
  const { direction, setDirection, currency, setCurrency, showClosed, setShowClosed } =
    useDebtsPageState();

  // Backend supports status and currency server-side; direction is client-side
  const serverFilters = useMemo(
    () => ({
      status: showClosed ? undefined : ('active' as const),
      currency: currency ?? undefined,
    }),
    [showClosed, currency],
  );

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteDebts(user?.id ?? null, serverFilters);

  const sections = useMemo(() => {
    if (!data) return [];
    const result: Section[] = [];
    for (const page of data.pages) {
      for (const group of page.groups) {
        // Client-side direction filter (backend doesn't support debtType filter on paginated)
        if (direction === 'owed_to_me' && group.debt_type !== 'given') continue;
        if (direction === 'i_owe' && group.debt_type !== 'taken') continue;

        const directionLabel = group.debt_type === 'given' ? 'Вам должны' : 'Вы должны';
        result.push({
          title: `${group.person_name} · ${directionLabel}`,
          data: group.debts as Section['data'],
        });
      }
    }
    return result;
  }, [data, direction]);

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
            <View className="flex-row items-center gap-3">
              <Link href="/debts/close-all" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="Закрыть долги">
                  <Text className="text-sm font-medium text-primary">Закрыть все</Text>
                </Pressable>
              </Link>
              <Link href="/debts/new" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="Добавить долг">
                  <Icon name="add" size={22} color="#4f46e5" />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ paddingBottom: 32 }}
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View className="gap-3 pb-2 pt-2">
            <View className="px-4">
              <Tabs items={DIRECTION_TABS} value={direction} onChange={setDirection} />
            </View>
            <SelectChips
              items={CURRENCY_CHIPS}
              value={currency as string | null}
              onChange={(v) => setCurrency(v)}
            />
            <View className="flex-row items-center justify-between px-4">
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Показывать закрытые
              </Text>
              <Toggle
                value={showClosed}
                onChange={setShowClosed}
                accessibilityLabel="Показывать закрытые долги"
              />
            </View>
          </View>
        }
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
