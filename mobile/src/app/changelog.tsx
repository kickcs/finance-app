import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import type { ChangelogItemType } from '@/features/changelog/model/changelogData';
import { useChangelog } from '@/features/changelog/composables/useChangelog';
import type { BadgeVariant } from '@/shared/ui/badge';
import { Badge } from '@/shared/ui/badge';

function typeLabel(t: ChangelogItemType): string {
  if (t === 'feature') return 'Новое';
  if (t === 'fix') return 'Исправление';
  if (t === 'improvement') return 'Улучшение';
  return t;
}

function typeVariant(t: ChangelogItemType): BadgeVariant {
  if (t === 'feature') return 'success';
  if (t === 'fix') return 'warning';
  return 'default';
}

export default function ChangelogScreen() {
  const { entries, markSeen } = useChangelog();

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Что нового' }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
        {entries.map((entry) => (
          <View
            key={entry.version}
            className="rounded-2xl bg-card-light p-4 dark:bg-card-dark"
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                v{entry.version}
              </Text>
              <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {entry.date}
              </Text>
            </View>

            {entry.title ? (
              <Text className="mb-2 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                {entry.title}
              </Text>
            ) : null}

            {entry.items.map((item, i) => (
              <View key={i} className="mb-1 flex-row items-start gap-2">
                <Badge label={typeLabel(item.type)} variant={typeVariant(item.type)} />
                <Text className="flex-1 text-sm text-text-primary-light dark:text-text-primary-dark">
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
