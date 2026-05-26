import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

export type DonutSlice = { id: string; value: number; color: string; label: string };

type Props = {
  slices: DonutSlice[];
  total: number;
  size?: number;
  strokeWidth?: number;
};

export function DonutChart({ slices, total, size = 160, strokeWidth = 20 }: Props) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View className="items-center">
      <Svg width={size} height={size} viewBox={`-${size / 2} -${size / 2} ${size} ${size}`}>
        <G rotation={-90}>
          {slices.map((s) => {
            const len = total > 0 ? (s.value / total) * c : 0;
            const el = (
              <Circle
                key={s.id}
                cx={0}
                cy={0}
                r={r}
                stroke={s.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View className="mt-3 gap-1">
        {slices.map((s) => (
          <View key={s.id} className="flex-row items-center gap-2">
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className="text-sm text-text-primary-light dark:text-text-primary-dark">
              {s.label} · {s.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
