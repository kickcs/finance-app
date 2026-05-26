import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

type Bucket = { date: string; expense: number };

type Props = {
  data: Bucket[];
  height?: number;
};

export function DailyExpenseChart({ data, height = 80 }: Props) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.expense), 1);
  const barWidth = 100 / data.length;
  return (
    <View style={{ height }} className="px-4">
      <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.expense / max) * (height - 4);
          return (
            <Rect
              key={d.date}
              x={i * barWidth + barWidth * 0.1}
              y={height - h}
              width={barWidth * 0.8}
              height={h}
              fill="#4f46e5"
              rx={1}
            />
          );
        })}
      </Svg>
    </View>
  );
}
