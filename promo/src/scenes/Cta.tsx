import { AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useCopy } from "../copy";

// Финал ничем не гаснет: ролик заканчивается на статичном кадре, чтобы
// стоп-кадр превью на лендинге и в YouTube был кадром с адресом, а не пустотой.
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCopy();

  return (
    <AbsoluteFill name="Cta" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
      <Img
        name="Enso"
        src={staticFile("enso.svg")}
        style={{
          position: "absolute",
          left: 848,
          top: 236,
          width: 224,
          height: 224,
          opacity: interpolate(frame, [0, 30], [0, 0.92], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          scale: interpolate(frame, [0, 40], [0.76, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            output: "perceptual-scale",
          }),
        }}
      />
      <Interactive.Div
        name="Wordmark"
        style={{
          position: "absolute",
          left: 360,
          top: 528,
          width: 1200,
          textAlign: "center",
          color: "#FAFAFA",
          fontSize: 88,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -2,
          opacity: interpolate(frame, [18, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [18, 44], ["0px 24px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        Ouro Finance
      </Interactive.Div>
      <Interactive.Div
        name="Domain"
        style={{
          position: "absolute",
          left: 360,
          top: 660,
          width: 1200,
          textAlign: "center",
          color: "#E8C865",
          fontSize: 48,
          fontWeight: 600,
          lineHeight: 1.2,
          opacity: interpolate(frame, [34, 60], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [34, 60], ["0px 20px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        app.ouro-finance.top
      </Interactive.Div>
      <Interactive.Div
        name="Note"
        style={{
          position: "absolute",
          left: 360,
          top: 752,
          width: 1200,
          textAlign: "center",
          color: "#A1A1AA",
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.25,
          opacity: interpolate(frame, [50, 76], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          translate: interpolate(frame, [50, 76], ["0px 16px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {c.cta.note}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
