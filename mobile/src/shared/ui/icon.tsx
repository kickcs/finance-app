import { Platform, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/**
 * Map of common material-style identifiers used across the Vue codebase to
 * Apple SF Symbol names. Add new entries here as widgets are ported.
 */
const SF_SYMBOL_MAP: Record<string, string> = {
  account_balance_wallet: 'creditcard.fill',
  credit_card: 'creditcard',
  savings: 'banknote.fill',
  payments: 'banknote',
  account_balance: 'building.columns.fill',
  diamond: 'diamond.fill',
  arrow_forward: 'arrow.right',
  chevron_right: 'chevron.right',
  chevron_left: 'chevron.left',
  visibility: 'eye.fill',
  visibility_off: 'eye.slash.fill',
  add: 'plus',
  close: 'xmark',
  check: 'checkmark',
  search: 'magnifyingglass',
  delete: 'trash',
  edit: 'pencil',
  settings: 'gearshape.fill',
  home: 'house.fill',
  list: 'list.bullet',
  pie_chart: 'chart.pie.fill',
  account_circle: 'person.crop.circle',
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  /**
   * On iOS this is forwarded to the SF Symbol container (treated as a ViewStyle).
   * On Android (fallback) it is applied to the Text glyph (TextStyle).
   */
  style?: StyleProp<ViewStyle> | StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color, style }: IconProps) {
  if (Platform.OS === 'ios') {
    const sfName = SF_SYMBOL_MAP[name] ?? name;
    const tint: SymbolViewProps['tintColor'] = color;
    return (
      <SymbolView
        name={sfName as SymbolViewProps['name']}
        size={size}
        tintColor={tint}
        style={[{ width: size, height: size }, style as StyleProp<ViewStyle>]}
      />
    );
  }
  // Android fallback — text glyph until @react-native-vector-icons is wired up.
  return (
    <Text
      style={[
        {
          fontSize: size * 0.75,
          lineHeight: size,
          color: color ?? '#71717a',
          width: size,
          textAlign: 'center',
        },
        style as StyleProp<TextStyle>,
      ]}
    >
      {name.charAt(0).toUpperCase()}
    </Text>
  );
}
