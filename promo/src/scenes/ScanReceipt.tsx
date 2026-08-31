import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Координаты оверлеев — в пикселях источника, их печатает `npm run capture`.
// Позиции строк: 442, 647, 851 (первые три из шести), итог — 2226.
export const ScanReceipt: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="ScanReceipt" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          translate: interpolate(frame, [0, 270], ["0px 0px", "0px -6px"], {
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
          {c.scanReceipt.headline}
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
          {c.scanReceipt.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <Stage
        src={s.file("scan.png")}
        loupeTop={interpolate(frame, [0, 148, 192, 270], [330, 330, 1836, 1836], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear],
        })}
      >
        {/* Полоса-сканер проходит по списку позиций и гаснет: она объясняет,
            откуда взялись строки, и уходит раньше, чем начнёт мешать читать. */}
        <Interactive.Div
          name="Scanner"
          style={{
            position: "absolute",
            left: 40,
            width: 1099,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(90deg, rgba(232,200,101,0) 0%, #E8C865 22%, #E8C865 78%, rgba(232,200,101,0) 100%)",
            boxShadow: "0 0 40px 12px rgba(232,200,101,0.35)",
            top: interpolate(frame, [14, 46], [400, 1700], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.65, 0, 0.35, 1),
            }),
            opacity: interpolate(frame, [10, 18, 40, 50], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
          }}
        />
        <Interactive.Div
          name="Item 1"
          style={{
            position: "absolute",
            ...s.box("scan", "itemRow1"),
            borderRadius: 20,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [50, 66], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [50, 72], [0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Item 2"
          style={{
            position: "absolute",
            ...s.box("scan", "itemRow2"),
            borderRadius: 20,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [68, 84], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [68, 90], [0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Item 3"
          style={{
            position: "absolute",
            ...s.box("scan", "itemRow3"),
            borderRadius: 20,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [86, 102], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [86, 108], [0.95, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Total"
          style={{
            position: "absolute",
            ...s.box("scan", "total"),
            borderRadius: 18,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.12)",
            opacity: interpolate(frame, [200, 218], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [200, 224], [0.94, 1], {
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
