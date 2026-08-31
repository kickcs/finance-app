import { AbsoluteFill, Easing, Interactive, Sequence, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

/**
 * Единственная сцена с двумя экранами: инбокс и подтверждение.
 *
 * Иначе обещание кикера повисает — «сумма и магазин» видны в списке, а то, что
 * человеку остаётся один тап, видно только на экране подтверждения.
 *
 * Смена экрана — жёсткий рез на долю, с `entrance={false}` у второго `Stage`:
 * телефон и лупа остаются на месте, меняется только содержимое. Въезжать
 * заново должна новая сцена, а не новый экран внутри старой.
 *
 * Рамки берутся из замеров съёмки: три карточки инбокса сверху вниз и блок
 * разобранной суммы на подтверждении.
 */
export const Import: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill name="Import" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          zIndex: 2,
          translate: interpolate(frame, [0, 342], ["0px 0px", "0px -7px"], {
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
          {c.bankImport.headline}
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
          {c.bankImport.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <AbsoluteFill
        name="Inbox screen"
        style={{
          // Жёсткий рез, а не наплыв. Наплыв здесь был и оказался ровно той
          // кашей, ради которой между сценами стоит сдвиг: два плотных
          // текстовых экрана на середине накладываются друг на друга. Рез
          // приходится на долю и совпадает со звуком тапа — читается как
          // «нажал, и экран сменился».
          opacity: interpolate(frame, [201, 202], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.linear,
          }),
        }}
      >
        <Stage src={s.file("inbox.png")} loupeTop={300}>
          <Interactive.Div
            name="Card 1"
            style={{
              position: "absolute",
              ...s.box("inbox", "card1"),
              borderRadius: 22,
              border: "5px solid #E8C865",
              boxShadow: "0 0 44px rgba(232,200,101,0.26)",
              backgroundColor: "rgba(232,200,101,0.10)",
              opacity: interpolate(frame, [26, 44], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              }),
              scale: interpolate(frame, [26, 50], [0.96, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                output: "perceptual-scale",
              }),
            }}
          />
          <Interactive.Div
            name="Card 2"
            style={{
              position: "absolute",
              ...s.box("inbox", "card2"),
              borderRadius: 22,
              border: "5px solid #E8C865",
              boxShadow: "0 0 44px rgba(232,200,101,0.26)",
              backgroundColor: "rgba(232,200,101,0.10)",
              opacity: interpolate(frame, [50, 68], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              }),
              scale: interpolate(frame, [50, 74], [0.96, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                output: "perceptual-scale",
              }),
            }}
          />
          <Interactive.Div
            name="Card 3"
            style={{
              position: "absolute",
              ...s.box("inbox", "card3"),
              borderRadius: 22,
              border: "5px solid #E8C865",
              boxShadow: "0 0 44px rgba(232,200,101,0.26)",
              backgroundColor: "rgba(232,200,101,0.10)",
              opacity: interpolate(frame, [74, 92], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              }),
              scale: interpolate(frame, [74, 98], [0.96, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                output: "perceptual-scale",
              }),
            }}
          />
        </Stage>
      </AbsoluteFill>

      <Sequence from={202} name="Confirm screen">
        <Stage src={s.file("confirm.png")} loupeTop={150} entrance={false}>
          {/* Подсвечивается разобранный блок — сумма, магазин, дата, тип, —
              а не строки «Счёт» и «Категория»: они в этой версии приложения
              пустые, и обводка на них читалась бы обещанием, которого нет. */}
          <Interactive.Div
            name="Parsed block"
            style={{
              position: "absolute",
              ...s.box("confirm", "confirmAmount"),
              borderRadius: 26,
              border: "5px solid #E8C865",
              boxShadow: "0 0 44px rgba(232,200,101,0.26)",
              backgroundColor: "rgba(232,200,101,0.12)",
              opacity: interpolate(frame, [250, 270], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
              }),
              scale: interpolate(frame, [250, 276], [0.95, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                output: "perceptual-scale",
              }),
            }}
          />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
