/**
 * Раскладка долей по кольцу.
 *
 * Зазор между сегментами задаётся в пикселях, а не в градусах: один и тот же
 * угол на кольце разного радиуса даёт разный просвет, и подобранное «на глаз»
 * число градусов рассыпается, стоит поменять размер.
 *
 * Круглый торец выступает за конец дуги на половину толщины обода — при ободе
 * в 17px это 8.5px против 3px просвета, поэтому вылет вычитается из дуги, а не
 * игнорируется. Доли, которые сами уже́ двух торцов, рисуются плоскими: круглый
 * торец на них превращался в кляксу поверх соседей.
 */

/** Просвет между соседними сегментами, px по дуге. */
export const ARC_GAP_PX = 3;

/** Минимальная видимая дуга, px: доля меньше просвета всё равно должна читаться. */
const MIN_ARC_PX = 2;

/** Ниже этого остатка круглый торец рисовать не из чего. */
const MIN_ROUND_ARC_PX = 1;

export interface RingMetrics {
  radius: number;
  strokeWidth: number;
}

export interface Arc {
  /** Угол начала дуги в SVG-координатах: −90° — 12 часов. */
  startAngle: number;
  arcAngle: number;
  largeArc: 0 | 1;
  linecap: 'round' | 'butt';
}

/**
 * Доли (в процентах, в порядке отрисовки) → дуги кольца.
 * Каждый сегмент занимает свою долю круга целиком, включая просвет, поэтому
 * сумма долей всегда раскладывается ровно в 360°.
 */
export function buildArcs(percents: number[], ring: RingMetrics): Arc[] {
  if (percents.length === 0) return [];

  const circumference = 2 * Math.PI * ring.radius;
  const toDeg = (px: number) => (px / circumference) * 360;

  const gapDeg = toDeg(ARC_GAP_PX);
  const minArcDeg = toDeg(MIN_ARC_PX);
  const capDeg = toDeg(ring.strokeWidth / 2);

  let cursor = -90;

  return percents.map((percent) => {
    const share = (percent / 100) * 360;
    // Видимая длина сегмента: своя доля минус просвет, но не меньше риски,
    // которую вообще можно заметить.
    const visible = Math.max(share - gapDeg, Math.min(share, minArcDeg));

    const roundArc = visible - 2 * capDeg;
    const isRound = roundArc >= toDeg(MIN_ROUND_ARC_PX);

    const arcAngle = isRound ? roundArc : visible;
    // Сегмент центрируется в своей доле, чтобы просвет делился поровну между
    // соседями, а не копился с одной стороны.
    const startAngle = cursor + (share - visible) / 2 + (isRound ? capDeg : 0);

    cursor += share;

    return {
      startAngle,
      arcAngle,
      largeArc: arcAngle > 180 ? 1 : 0,
      linecap: isRound ? 'round' : 'butt',
    };
  });
}

/** Дуга в виде SVG-пути. */
export function arcPath(
  arc: Pick<Arc, 'startAngle' | 'arcAngle' | 'largeArc'>,
  ring: { radius: number; center: number },
): string {
  const { radius, center } = ring;

  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${round(center + radius * Math.cos(rad))} ${round(center + radius * Math.sin(rad))}`;
  };

  const from = point(arc.startAngle);
  const to = point(arc.startAngle + arc.arcAngle);

  return `M ${from} A ${radius} ${radius} 0 ${arc.largeArc} 1 ${to}`;
}

/** Хвост из плавающей арифметики в координатах пути только раздувает разметку. */
function round(value: number): number {
  return Number(value.toFixed(3));
}
