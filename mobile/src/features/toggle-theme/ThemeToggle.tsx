import { Pressable, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/utils';

import { useSetThemeMode, useThemeMode, type ThemeMode } from './useTheme';

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const mode = useThemeMode();
  const setMode = useSetThemeMode();

  return (
    <View
      className={cn(
        'flex-row rounded-full bg-surface-light p-1 dark:bg-surface-dark',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            onPress={async () => {
              if (opt.value === mode) return;
              trigger('selection');
              await setMode(opt.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Тема: ${opt.label}`}
            className={cn(
              'flex-1 items-center rounded-full px-3 py-1.5',
              active && 'bg-primary',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active
                  ? 'text-white'
                  : 'text-text-muted-light dark:text-text-muted-dark',
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
