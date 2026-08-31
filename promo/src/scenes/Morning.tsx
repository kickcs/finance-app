import { AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";

/**
 * Открывающая сцена: уведомление банка, которое пользователь пересылает боту.
 *
 * Логотипа в начале нет намеренно — первые секунды тратятся на смысл, бренд
 * живёт водяным знаком в остальных сценах и приходит целиком в финале.
 *
 * Текст карточки — настоящее сообщение HUMO в том же виде, в каком его
 * разбирает боевой парсер: ровно оно уходит в инбокс следующей сцены. Ни одна
 * строка не придумана ради кадра.
 *
 * В конце карточка уезжает вправо — туда, где в следующей сцене окажется лупа.
 */
export const Morning: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();

  return (
    <AbsoluteFill name="Morning" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
      <Img
        name="Enso"
        src={staticFile("enso.svg")}
        style={{
          position: "absolute",
          left: 660,
          top: 130,
          width: 600,
          height: 600,
          opacity: interpolate(frame, [6, 46], [0, 0.22], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          scale: interpolate(frame, [6, 150], [0.82, 1.06], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            output: "perceptual-scale",
          }),
        }}
      />
      <Interactive.Div
        name="Notification"
        style={{
          position: "absolute",
          left: 550,
          top: 214,
          width: 820,
          padding: 44,
          borderRadius: 28,
          backgroundColor: "#18181B",
          border: "2px solid rgba(232,200,101,0.22)",
          boxShadow: "0 50px 120px rgba(0,0,0,0.6)",
          color: "#FAFAFA",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 30,
          lineHeight: 1.55,
          whiteSpace: "pre-line",
          opacity: interpolate(frame, [4, 30, 140, 178], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
          }),
          translate: interpolate(frame, [4, 30, 140, 178], ["0px 44px", "0px 0px", "0px 0px", "540px -34px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1)],
          }),
          scale: interpolate(frame, [140, 178], [1, 0.84], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.65, 0, 0.35, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        {"💸 Оплата\n➖ 42.000,00 UZS\n📍 KORZINKA CHILANZAR\n💳 HUMOCARD *1951\n🕓 09:14\n💰 3.148.220,00 UZS"}
      </Interactive.Div>
      <Interactive.Div
        name="Line"
        style={{
          position: "absolute",
          left: 360,
          top: 726,
          width: 1200,
          textAlign: "center",
          color: "#FAFAFA",
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: -1,
          opacity: interpolate(frame, [40, 66], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [40, 66], ["0px 26px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.morning.line}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
