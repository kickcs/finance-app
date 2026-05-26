import { Pressable, Text, TextInput, View } from 'react-native';
import { usePeople } from '@/entities/person/api/usePeople';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { InitialAvatar } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import type { SplitParticipant } from '../composables/useSplitExpense';

type Props = {
  participants: SplitParticipant[];
  totalAmount: number;
  onAdd: (personId: string) => void;
  onRemove: (personId: string) => void;
  onShareChange: (personId: string, share: number) => void;
};

export function SplitParticipants({
  participants,
  totalAmount,
  onAdd,
  onRemove,
  onShareChange,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: people = [] } = usePeople(user?.id ?? null);

  const totalShared = participants.reduce((s, p) => s + p.share, 0);

  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
        Разделить с
      </Text>
      <View className="gap-2">
        {people.map((person) => {
          const part = participants.find((x) => x.personId === person.id);
          const selected = !!part;
          return (
            <View key={person.id} className="flex-row items-center gap-2">
              <Pressable
                onPress={() => (selected ? onRemove(person.id) : onAdd(person.id))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={person.name}
                className={cn(
                  'flex-1 flex-row items-center gap-3 rounded-2xl border p-3',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border-light dark:border-border-dark',
                )}
              >
                <InitialAvatar name={person.name} color={person.color} size="sm" />
                <Text className="flex-1 text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                  {person.name}
                </Text>
              </Pressable>
              {selected && part ? (
                <TextInput
                  value={part.share ? String(part.share) : ''}
                  onChangeText={(t) =>
                    onShareChange(
                      person.id,
                      Number(t.replace(/[^0-9.]/g, '')) || 0,
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  className="w-24 rounded-2xl bg-surface-light px-3 py-3 text-right text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
                  accessibilityLabel={`Доля ${person.name}`}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
        Разделено: {totalShared} из {totalAmount}
      </Text>
    </View>
  );
}
