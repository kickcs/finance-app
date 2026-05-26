import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/shared/lib/utils';

export interface InputProps extends TextInputProps {
  className?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { className, style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor="#9CA3AF"
      className={cn(
        'bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3',
        'text-text-primary-light dark:text-text-primary-dark',
        className,
      )}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    />
  );
});
