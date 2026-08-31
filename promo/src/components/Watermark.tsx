import { Img, staticFile } from "remotion";

// Знак стоит над телефоном, в левой колонке: правый верхний угол занят
// подписью, которая тянется до правого края лупы.
export const Watermark: React.FC = () => {
  return (
    <Img
      name="Watermark"
      src={staticFile("enso.svg")}
      style={{
        position: "absolute",
        left: 135,
        top: 84,
        width: 56,
        height: 56,
        opacity: 0.45,
      }}
    />
  );
};
