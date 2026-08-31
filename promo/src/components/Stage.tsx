import { Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Кадр 16:9: телефон-контекст слева, лупа справа.
 *
 * Портретный экран целиком в широком кадре нечитаем — по высоте помещается
 * телефон ~910 px, и текст интерфейса 15 px превращается в 16 px. Поэтому
 * телефон отвечает только за «где мы», а читает зритель лупу: тот же скриншот
 * в родных пикселях DPR-3, то есть 45 px на тот же текст. Увеличения
 * интерполяцией нет вовсе — отсюда и отсутствие мыла.
 *
 * Ширина лупы равна ширине источника (1179), поэтому горизонтального
 * панорамирования не существует: лупа всегда показывает экран во всю ширину и
 * ездит только по вертикали. Одна анимируемая величина вместо двух.
 *
 * Рамка-указатель на телефоне показывает, какую полосу сейчас показывает лупа,
 * и связывает два фокуса внимания. Её координаты производные: 0.32231 — это
 * 380/1179, отношение телефона к источнику.
 *
 * Оверлеи передаются детьми и лежат ВНУТРИ слоя лупы, отрисованного один к
 * одному с источником. Поэтому их координаты — прямо те, что печатает
 * `npm run capture`, без пересчёта.
 *
 * `entrance={false}` убирает въезд и оставляет телефон и лупу сразу на месте.
 * Нужен там, где внутри одной сцены меняется экран приложения: въезжать заново
 * должна новая сцена, а не новый экран внутри старой — иначе смена читается
 * как склейка, а не как переход внутри приложения.
 *
 * Отступление от правила «в style только литералы»: `loupeTop` и ветка
 * `entrance` считаются до JSX, поэтому эти величины не правятся в Studio
 * мышкой. Альтернатива — повторить разметку лупы в девяти сценах, и тогда
 * геометрия неизбежно разъедется. Геометрия важнее.
 */
export const Stage: React.FC<{ src: string; loupeTop: number; entrance?: boolean; children?: React.ReactNode }> = ({
  src,
  loupeTop,
  entrance = true,
  children,
}) => {
  const frame = useCurrentFrame();

  // Без въезда телефон и лупа продолжают тот же медленный дрейф с той точки,
  // где его оставил предыдущий экран, — иначе на смене был бы скачок.
  const glowOpacity = entrance
    ? interpolate(frame, [0, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) })
    : 1;
  const glowScale = entrance
    ? interpolate(frame, [0, 110, 210], [0.94, 1.04, 0.99], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.bezier(0.65, 0, 0.35, 1)],
        output: "perceptual-scale",
      })
    : 1;
  const phoneOpacity = entrance
    ? interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) })
    : 1;
  const phoneTranslate = entrance
    ? interpolate(frame, [0, 34, 210], ["0px 46px -240px", "0px 0px 0px", "0px -5px 26px"], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear],
      })
    : interpolate(frame, [0, 140], ["0px -5px 26px", "0px -9px 46px"], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.linear,
      });
  const loupeOpacity = entrance
    ? interpolate(frame, [4, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) })
    : 1;
  const loupeTranslate = entrance
    ? interpolate(frame, [0, 34, 210], ["0px 30px -170px", "0px 0px 0px", "0px -9px 48px"], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: [Easing.bezier(0.22, 1, 0.36, 1), Easing.linear],
      })
    : interpolate(frame, [0, 140], ["0px -9px 48px", "0px -14px 70px"], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.linear,
      });
  const bandOpacity = entrance
    ? interpolate(frame, [14, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) })
    : 1;

  return (
    <Interactive.Div name="Stage" style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, perspective: 2600, perspectiveOrigin: "42% 52%" }}>
      <Interactive.Div
        name="Ambient glow"
        style={{
          position: "absolute",
          left: 40,
          top: 120,
          width: 1840,
          height: 940,
          borderRadius: 999,
          background: "radial-gradient(46% 52% at 34% 52%, rgba(232,200,101,0.13) 0%, rgba(232,200,101,0.04) 48%, rgba(232,200,101,0) 74%)",
          opacity: glowOpacity,
          scale: glowScale,
        }}
      />
      <Interactive.Div
        name="Phone"
        style={{
          position: "absolute",
          left: 135,
          top: 176,
          width: 380,
          height: 824,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: "#09090B",
          border: "2px solid rgba(232,200,101,0.26)",
          boxShadow: "0 40px 110px rgba(0,0,0,0.55), 0 0 0 1px rgba(232,200,101,0.06)",
          opacity: phoneOpacity,
          translate: phoneTranslate,
        }}
      >
        <Img name="Phone screenshot" src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: 380 }} />
        <Interactive.Div
          name="Loupe band"
          style={{
            position: "absolute",
            left: 0,
            width: 380,
            height: 232,
            top: loupeTop * 0.32231,
            borderTop: "2px solid rgba(232,200,101,0.85)",
            borderBottom: "2px solid rgba(232,200,101,0.85)",
            backgroundColor: "rgba(232,200,101,0.10)",
            opacity: bandOpacity,
          }}
        />
      </Interactive.Div>
      <Interactive.Div
        name="Loupe"
        style={{
          position: "absolute",
          left: 605,
          top: 280,
          width: 1179,
          height: 720,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "#09090B",
          border: "2px solid rgba(232,200,101,0.30)",
          boxShadow: "0 50px 130px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,200,101,0.07)",
          opacity: loupeOpacity,
          translate: loupeTranslate,
        }}
      >
        <Interactive.Div name="Loupe layer" style={{ position: "absolute", left: 0, top: -loupeTop, width: 1179, height: 2556 }}>
          <Img name="Loupe screenshot" src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: 1179 }} />
          {children}
        </Interactive.Div>
        {/* Лупа — окно в прокручиваемый экран, поэтому строки у её краёв всегда
            разрезаны. Без растушёвки срез читается дефектом; с ней — краем
            кадра, за которым что-то есть. Слой лежит поверх оверлеев
            намеренно: подсветка у самой границы окна тоже должна гаснуть. */}
        <Interactive.Div
          name="Loupe edge fade"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1179,
            height: 720,
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(9,9,11,0.92) 0%, rgba(9,9,11,0) 9%, rgba(9,9,11,0) 91%, rgba(9,9,11,0.92) 100%)",
          }}
        />
      </Interactive.Div>
    </Interactive.Div>
  );
};
