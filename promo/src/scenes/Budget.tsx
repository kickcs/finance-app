import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Рамки берутся из замеров съёмки: карточка баланса и строка «расход/дн ·
// безопасно · осталось N дн» под ней.
export const Budget: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="Budget" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          {c.budget.headline}
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
          {c.budget.kicker}
        </Interactive.Div>
      </Interactive.Div>

      {/* Панорамы как такта здесь нет — карточка баланса и строка «расход/дн ·
          безопасно · осталось N дн» попадают в одну полосу лупы. Но после
          последней подсветки сцена держится ещё три с половиной секунды, и
          неподвижный кадр за это время умирает: лупа очень медленно ползёт
          вверх, ровно настолько, чтобы кадр оставался живым. */}
      <Stage
        src={s.file("home.png")}
        loupeTop={interpolate(frame, [0, 234], [250, 296], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.linear,
        })}
      >
        <Interactive.Div
          name="Balance card"
          style={{
            position: "absolute",
            ...s.box("home", "balanceCard"),
            borderRadius: 26,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.08)",
            opacity: interpolate(frame, [14, 32, 100, 116], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
            }),
            scale: interpolate(frame, [14, 38], [0.97, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Daily budget"
          style={{
            position: "absolute",
            ...s.box("home", "dailyBudget"),
            borderRadius: 20,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.14)",
            opacity: interpolate(frame, [124, 144], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [124, 150], [0.94, 1], {
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
