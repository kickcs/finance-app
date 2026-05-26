import { cva, type VariantProps } from 'class-variance-authority';
import { ActivityIndicator, Pressable, type PressableProps, Text } from 'react-native';

import { cn } from '@/shared/lib/utils';

const buttonVariants = cva('flex-row items-center justify-center rounded-xl', {
  variants: {
    variant: {
      primary: 'bg-primary active:bg-primary-pressed',
      secondary: 'bg-surface-light dark:bg-surface-dark',
      danger: 'bg-danger',
      ghost: 'bg-transparent',
    },
    size: {
      sm: 'px-3 py-2',
      md: 'px-4 py-3',
      lg: 'px-6 py-4',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

const buttonTextVariants = cva('font-semibold', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-text-primary-light dark:text-text-primary-dark',
      danger: 'text-white',
      ghost: 'text-primary',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export type ButtonProps = Omit<PressableProps, 'children'> &
  VariantProps<typeof buttonVariants> & {
    title: string;
    className?: string;
    textClassName?: string;
    loading?: boolean;
  };

export function Button({
  title,
  variant,
  size,
  className,
  textClassName,
  disabled,
  loading,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      className={cn(buttonVariants({ variant, size }), isDisabled && 'opacity-50', className)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? 'white' : undefined} />
      ) : (
        <Text className={cn(buttonTextVariants({ variant, size }), textClassName)}>{title}</Text>
      )}
    </Pressable>
  );
}
