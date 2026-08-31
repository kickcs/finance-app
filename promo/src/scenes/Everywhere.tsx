import { AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";
import { useShots } from "../shots";
import { Watermark } from "../components/Watermark";

/**
 * Единственная сцена без телефона и лупы.
 *
 * После девяти сцен с вертикальным экраном широкий десктопный кадр читается
 * как поворот — «оказывается, оно ещё и здесь». Показывать десктоп раньше
 * значило бы потратить этот контраст впустую.
 *
 * Скриншот лежит панелью в верхних двух третях, а подпись — в чистой полосе
 * под ней. Полный кадр во всю площадь пробовали: подпись неизбежно ложится
 * поверх плотного интерфейса и не читается ни с заслонкой, ни без неё, а
 * наезд вдобавок срезает сайдбар — то самое, что сцена и показывает.
 * Ценой стал мелкий текст интерфейса, и это принято: сцена про широту, а
 * смысл несёт подпись.
 *
 * Перечень — то, что не заслужило отдельной сцены, но должно прозвучать.
 * Строки набегают по одной каждые 18 кадров, то есть ровно по доле.
 */
export const Everywhere: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const s = useShots();

  return (
    <AbsoluteFill
      name="Everywhere"
      style={{
        backgroundColor: "#09090B",
        fontFamily: "Inter",
        overflow: "hidden",
      }}
    >
      <Interactive.Div
        name="Ambient glow"
        style={{
          position: "absolute",
          left: 140,
          top: 0,
          width: 1640,
          height: 900,
          borderRadius: 999,
          background: "radial-gradient(50% 50% at 50% 50%, rgba(232,200,101,0.12) 0%, rgba(232,200,101,0.035) 50%, rgba(232,200,101,0) 76%)",
          opacity: interpolate(frame, [0, 32], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      />
      <Interactive.Div
        name="Desktop panel"
        style={{
          position: "absolute",
          left: 240,
          top: 56,
          width: 1440,
          height: 810,
          borderRadius: 22,
          overflow: "hidden",
          border: "2px solid rgba(232,200,101,0.26)",
          boxShadow: "0 50px 130px rgba(0,0,0,0.62), 0 0 0 1px rgba(232,200,101,0.06)",
          opacity: interpolate(frame, [0, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [0, 34], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          scale: interpolate(frame, [0, 234], [1, 1.022], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.65, 0, 0.35, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <Img name="Desktop" src={staticFile(s.file("desktop.png"))} style={{ position: "absolute", left: 0, top: 0, width: 1440 }} />
      </Interactive.Div>
      <Watermark />
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 135,
          top: 872,
          width: 1400,
          color: "#FAFAFA",
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.06,
          letterSpacing: -1.5,
          opacity: interpolate(frame, [10, 34], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [10, 34], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.everywhere.headline}
      </Interactive.Div>
      <Interactive.Div
        name="Item 1"
        style={{
          position: "absolute",
          left: 135,
          top: 964,
          width: 356,
          color: "#A1A1AA",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.3,
          borderLeft: "4px solid #E8C865",
          paddingLeft: 22,
          opacity: interpolate(frame, [60, 82], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [60, 82], ["0px 18px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.everywhere.items[0]}
      </Interactive.Div>
      <Interactive.Div
        name="Item 2"
        style={{
          position: "absolute",
          left: 615,
          top: 964,
          width: 356,
          color: "#A1A1AA",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.3,
          borderLeft: "4px solid #E8C865",
          paddingLeft: 22,
          opacity: interpolate(frame, [88, 110], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [88, 110], ["0px 18px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.everywhere.items[1]}
      </Interactive.Div>
      <Interactive.Div
        name="Item 3"
        style={{
          position: "absolute",
          left: 995,
          top: 964,
          width: 356,
          color: "#A1A1AA",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.3,
          borderLeft: "4px solid #E8C865",
          paddingLeft: 22,
          opacity: interpolate(frame, [116, 138], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [116, 138], ["0px 18px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.everywhere.items[2]}
      </Interactive.Div>
      <Interactive.Div
        name="Item 4"
        style={{
          position: "absolute",
          left: 1375,
          top: 964,
          width: 356,
          color: "#A1A1AA",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.3,
          borderLeft: "4px solid #E8C865",
          paddingLeft: 22,
          opacity: interpolate(frame, [144, 166], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [144, 166], ["0px 18px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.everywhere.items[3]}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
