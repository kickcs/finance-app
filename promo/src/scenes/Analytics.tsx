import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Stage } from "../components/Stage";
import { Watermark } from "../components/Watermark";

// Рамка строки-лидера берётся из замеров съёмки: список категорий сортируется
// по сумме, а суммы в демо-данных случайны — какая строка окажется первой,
// заранее не известно.
//
// Такты: темп → кольцо → список. Кольцо отвечает на «сколько», список — на
// «из чего», и проезд лупы между ними и есть жест чтения.
//
// Здесь была заслонка, «дорисовывавшая» кольцо поворотом на 360°. Убрана:
// диаграмма уже нарисована в скриншоте, закрывать её и открывать — украшение,
// притворяющееся данными. Освободившееся время отдано второму проезду, который
// показывает настоящее содержимое экрана.
export const Analytics: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();
  // Строка-лидер списка стоит в кадре не по центру, а чуть выше: под ней
  // должны остаться следующие категории, иначе список читается как одна
  // подсвеченная строка.
  const topRow = s.box("analytics", "topCategory").top - 40;

  return (
    <AbsoluteFill name="Analytics" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
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
          {c.analytics.headline}
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
          {c.analytics.kicker}
        </Interactive.Div>
      </Interactive.Div>

      <Stage
        src={s.file("analytics.png")}
        loupeTop={interpolate(frame, [0, 88, 134, 176, 218, 270], [240, 240, 1205, 1205, topRow, topRow], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: [Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear, Easing.bezier(0.65, 0, 0.35, 1), Easing.linear],
        })}
      >
        <Interactive.Div
          name="Top category"
          style={{
            position: "absolute",
            ...s.box("analytics", "topCategory"),
            borderRadius: 18,
            border: "5px solid #E8C865",
            boxShadow: "0 0 44px rgba(232,200,101,0.26)",
            backgroundColor: "rgba(232,200,101,0.12)",
            opacity: interpolate(frame, [214, 232], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            }),
            scale: interpolate(frame, [214, 238], [0.94, 1], {
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
