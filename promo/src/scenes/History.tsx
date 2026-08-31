import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Рамки берутся из замеров съёмки: ряд фильтров и две первые линейки дней.
// Третья линейка (2231) в кадр лупы попадает только в самом низу скриншота —
// такт на ней не строим: панорама успела бы доехать, но не остановиться.
export const History: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="History" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          {c.history.headline}
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
          {c.history.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <Stage
        src={s.file("history.png")}
        loupeTop={interpolate(frame, [0, 98, 144, 234], [400, 400, 1000, 1000], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear],
        })}
      >
        <Interactive.Div
          name="Filters"
          style={{
            position: "absolute",
            ...s.box("history", "filters"),
            borderRadius: 999,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [12, 30, 62, 76], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
          }}
        />
        <Interactive.Div
          name="Day ruler 1"
          style={{
            position: "absolute",
            ...s.list("history", "dayRulers")[0],
            borderRadius: 16,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.12)",
            opacity: interpolate(frame, [46, 64, 80, 94], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
            scale: interpolate(frame, [46, 70], [0.96, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Day ruler 2"
          style={{
            position: "absolute",
            ...s.list("history", "dayRulers")[1],
            borderRadius: 16,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.12)",
            opacity: interpolate(frame, [160, 178], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [160, 184], [0.96, 1], {
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
