import { describe, it, expect } from 'vitest';
import { buildArcs, arcPath, ARC_GAP_PX } from './arcGeometry';

/** Размеры кольца из CategoryBreakdown: size 144 → strokeWidth 17, radius 63.5. */
const RING = { radius: 63.5, strokeWidth: 17 };

const CIRCUMFERENCE = 2 * Math.PI * RING.radius;

/** Длина дуги в пикселях по её углу. */
function arcPx(deg: number): number {
  return (deg / 360) * CIRCUMFERENCE;
}

/** Границы того, что видно на кольце: round-торцы выступают за концы дуги. */
function visualBounds(arc: ReturnType<typeof buildArcs>[number]) {
  const capDeg = arc.linecap === 'round' ? (RING.strokeWidth / 2 / CIRCUMFERENCE) * 360 : 0;
  return { from: arc.startAngle - capDeg, to: arc.startAngle + arc.arcAngle + capDeg };
}

describe('buildArcs', () => {
  it('ставит первый сегмент в 12 часов и раскладывает остальные по часовой стрелке', () => {
    const arcs = buildArcs([25, 25, 25, 25], RING);

    expect(visualBounds(arcs[0]).from).toBeCloseTo(-90 + arcPxToDeg(ARC_GAP_PX) / 2, 1);
    expect(arcs[1].startAngle).toBeGreaterThan(arcs[0].startAngle);
    expect(arcs[3].startAngle).toBeGreaterThan(arcs[2].startAngle);
  });

  it('оставляет между соседними сегментами просвет в ARC_GAP_PX', () => {
    const arcs = buildArcs([40, 30, 30], RING);

    for (let i = 0; i < arcs.length - 1; i++) {
      const gapDeg = visualBounds(arcs[i + 1]).from - visualBounds(arcs[i]).to;
      expect(arcPx(gapDeg)).toBeCloseTo(ARC_GAP_PX, 1);
    }
  });

  it('сохраняет видимую длину сегмента при round-торцах', () => {
    // Дуга рисуется короче доли ровно на вылет торцов — иначе сегмент занимал
    // бы на кольце больше места, чем ему причитается.
    const [arc] = buildArcs([50], RING);
    const bounds = visualBounds(arc);

    expect(arcPx(bounds.to - bounds.from)).toBeCloseTo(arcPx(180) - ARC_GAP_PX, 1);
  });

  it('не даёт мелким долям отрицательный угол дуги', () => {
    // 1% при зазоре, заданном в градусах, уходил в минус, и SVG рисовал дугу
    // по другой окружности — на кольце появлялась клякса поверх соседей.
    const arcs = buildArcs([97, 1, 1, 0.5, 0.5], RING);

    for (const arc of arcs) {
      expect(arc.arcAngle).toBeGreaterThan(0);
    }
  });

  it('рисует мелкие доли плоскими торцами: круглый торец шире самой доли', () => {
    const arcs = buildArcs([97, 1, 1, 0.5, 0.5], RING);

    expect(arcs[0].linecap).toBe('round');
    expect(arcs.slice(1).map((a) => a.linecap)).toEqual(['butt', 'butt', 'butt', 'butt']);
  });

  it('не даёт сегментам наползать друг на друга при любых долях', () => {
    const arcs = buildArcs([60, 20, 8, 5, 3, 2, 1, 0.7, 0.3], RING);

    for (let i = 0; i < arcs.length - 1; i++) {
      expect(visualBounds(arcs[i]).to).toBeLessThanOrEqual(visualBounds(arcs[i + 1]).from);
    }
  });

  it('замыкает единственный сегмент в кольцо с одним просветом', () => {
    const [arc] = buildArcs([100], RING);
    const bounds = visualBounds(arc);

    expect(arcPx(360 - (bounds.to - bounds.from))).toBeCloseTo(ARC_GAP_PX, 1);
    expect(arc.largeArc).toBe(1);
  });

  it('возвращает пустой список без долей', () => {
    expect(buildArcs([], RING)).toEqual([]);
  });
});

describe('arcPath', () => {
  it('строит дугу от начального угла к конечному', () => {
    const d = arcPath({ startAngle: -90, arcAngle: 90, largeArc: 0 }, { radius: 50, center: 60 });

    // 12 часов → 3 часа: из (60, 10) в (110, 60)
    expect(d).toBe('M 60 10 A 50 50 0 0 1 110 60');
  });

  it('помечает дуги длиннее полукруга флагом large-arc', () => {
    const arcs = buildArcs([80, 20], RING);

    expect(arcs[0].largeArc).toBe(1);
    expect(arcs[1].largeArc).toBe(0);
  });
});

function arcPxToDeg(px: number): number {
  return (px / CIRCUMFERENCE) * 360;
}
