import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Рамки берутся из замеров съёмки: сумма-герой, чип категории и ряд
// «Делёж · Скан чека». Ширина чипа зависит от языка — отсюда и замер.
export const QuickAdd: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="QuickAdd" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
      <Watermark />
      <Interactive.Div
        name="Caption"
        style={{
          position: "absolute",
          left: 605,
          top: 88,
          width: 1180,
          height: 162,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          translate: interpolate(frame, [0, 234], ["0px 0px", "0px -5px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.linear,
          }),
        }}
      >
        <Interactive.Div
          name="Headline"
          style={{
            color: "#FAFAFA",
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: -1.5,
            opacity: interpolate(frame, [2, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            translate: interpolate(frame, [2, 24], ["0px 30px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
          }}
        >
          {c.quickAdd.headline}
        </Interactive.Div>
        <Interactive.Div
          name="Kicker"
          style={{
            marginTop: 16,
            color: "#A1A1AA",
            fontSize: 34,
            fontWeight: 500,
            lineHeight: 1.25,
            opacity: interpolate(frame, [16, 38], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            translate: interpolate(frame, [16, 38], ["0px 18px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
          }}
        >
          {c.quickAdd.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <Stage
        src={s.file("add.png")}
        loupeTop={interpolate(frame, [0, 80, 124, 234], [0, 0, 1100, 1100], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear],
        })}
      >
        <Interactive.Div
          name="Amount"
          style={{
            position: "absolute",
            ...s.box("add", "amount"),
            borderRadius: 24,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [14, 32, 74, 88], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
            scale: interpolate(frame, [14, 38], [0.96, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Category chip"
          style={{
            position: "absolute",
            ...s.box("add", "categoryChip"),
            borderRadius: 999,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.14)",
            opacity: interpolate(frame, [136, 154], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [136, 160], [0.9, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        {/* Ряд «Делёж · Скан чека» — мостик к следующим сценам: отсюда
            начинается вечерний сюжет с чеком. */}
        <Interactive.Div
          name="Split and scan"
          style={{
            position: "absolute",
            ...s.box("add", "splitAndScan"),
            borderRadius: 20,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [170, 188], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [170, 194], [0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </Stage>
    </AbsoluteFill>
  );
};
