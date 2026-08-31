import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Порядок тактов — от причины к следствию: сначала два встречных долга по
// людям, потом настоящая нетто-цифра приложения. Обратный порядок читался бы
// как «вот итог, а вот из чего он», то есть как отчёт, а не как удобство.
// Рамки берутся из замеров съёмки: карточка итога и две строки людей.
export const Debts: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="Debts" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          {c.debts.headline}
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
          {c.debts.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <Stage
        src={s.file("debts.png")}
        loupeTop={interpolate(frame, [0, 116, 162, 270], [1200, 1200, 438, 438], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear],
        })}
      >
        <Interactive.Div
          name="Row owed to you"
          style={{
            position: "absolute",
            ...s.box("debts", "rowAhmed"),
            borderRadius: 22,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [16, 34, 96, 110], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
            scale: interpolate(frame, [16, 40], [0.96, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Row you owe"
          style={{
            position: "absolute",
            ...s.box("debts", "rowDima"),
            borderRadius: 22,
            border: "5px solid #A855F7",
            boxShadow: "0 0 44px rgba(168,85,247,0.26)",
            backgroundColor: "rgba(168,85,247,0.12)",
            opacity: interpolate(frame, [44, 62, 96, 110], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
            scale: interpolate(frame, [44, 68], [0.96, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        {/* Нетто — кульминация сцены: подсветка приходит с задержкой после
            того, как лупа встала, чтобы цифру успели прочитать до обводки. */}
        <Interactive.Div
          name="Net"
          style={{
            position: "absolute",
            ...s.box("debts", "net"),
            borderRadius: 26,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: interpolate(frame, [180, 198], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [180, 208], [0.96, 1], {
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
