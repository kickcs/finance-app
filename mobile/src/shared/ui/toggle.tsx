import { Switch } from 'react-native';

export type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Toggle({ value, onChange, disabled, accessibilityLabel }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
