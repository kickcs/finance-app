import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
// Audio берётся из @remotion/media: одноимённый компонент в ядре remotion
// помечен устаревшим.
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { LangContext, type Lang } from "./copy";
import "./fonts";
import { Analytics } from "./scenes/Analytics";
import { Budget } from "./scenes/Budget";
import { Cta } from "./scenes/Cta";
import { Debts } from "./scenes/Debts";
import { Everywhere } from "./scenes/Everywhere";
import { History } from "./scenes/History";
import { Import } from "./scenes/Import";
import { Morning } from "./scenes/Morning";
import { QuickAdd } from "./scenes/QuickAdd";
import { ScanReceipt } from "./scenes/ScanReceipt";
import { Split } from "./scenes/Split";

// 198+342+234+270+270+270+234+270+234+234+144 = 2700, минус 10 переходов по 18
// = 2520 кадров = 84.0 с при 30 fps. Менять длину сцены — значит пересчитать
// эту сумму, иначе ролик перестанет попадать в целое число тактов. Проверка:
// `npx remotion compositions` показывает у Promo ровно 2520.
//
// 18 кадров — доля при 100 BPM, 72 кадра — такт. 2520 = 35 тактов ровно,
// поэтому каждый рез приходится на долю, а подложка кончается на сильной доле.
//
// Абсолютные старты сцен (нужны для позиций SFX ниже):
//   0, 180, 504, 720, 972, 1224, 1476, 1692, 1944, 2160, 2376
//
// Между экранами приложения стоит сдвиг, а не наплыв: на середине наплыва две
// плотные текстовые лупы накладываются и читаются кашей. Наплыв остаётся там,
// где кадр почти пуст (вход из Morning, выход в Cta), и там, где раскладка
// меняется целиком (переход к десктопной сцене).
//
// Порядок — один день: пришло уведомление → импорт → наличные → ужин →
// делёж → долги → история → аналитика → бюджет → «и на компьютере».
//
// Язык меняет только подписи: монтаж, тайминг и звук у версий общие, и это
// намеренно — иначе английская копия начала бы жить своей жизнью и разошлась
// бы с русской. Английские строки подобраны так, чтобы влезать в те же боксы
// (`npm run measure`). Интерфейс на скриншотах остаётся русским: английской
// локали в приложении пока нет.
export const Promo: React.FC<{ lang: Lang }> = ({ lang }) => {
  return (
    <LangContext value={lang}>
      <AbsoluteFill name="Promo" style={{ backgroundColor: "#09090B", fontFamily: "Inter" }}>
        {/* Звук живёт на уровне ролика, в абсолютных кадрах. Сцены внутри
          TransitionSeries имеют собственные таймлайны, и класть SFX внутрь них
          значило бы пересчитывать позиции при каждой правке длительности.

          Файлы собирает `npm run audio`. <Audio> с несуществующим файлом валит
          рендер — если Studio упал на старте, звук просто не сгенерирован.

          Ролик обязан читаться без звука: SFX ничего не сообщают, они лишь
          подчёркивают то, что уже видно. Лендинг проигрывает без звука. */}
        <Audio name="Bed" src={staticFile("audio/bed.wav")} volume={0.55} />
        {/* Свуши стоят на стартах сцен 2…11 — это и есть моменты резов. */}
        {[180, 504, 720, 972, 1224, 1476, 1692, 1944, 2160, 2376].map((at) => (
          <Sequence key={at} from={at} durationInFrames={14} name={`Whoosh ${at}`}>
            <Audio src={staticFile("audio/sfx-whoosh.wav")} volume={0.25} />
          </Sequence>
        ))}
        {/* Тики — на моменты, когда подсветка встаёт на элемент. */}
        {[770, 788, 806, 1144, 1166, 1522, 1636, 1916, 2068, 2220, 2248, 2276, 2304].map((at) => (
          <Sequence key={at} from={at} durationInFrames={4} name={`Tick ${at}`}>
            <Audio src={staticFile("audio/sfx-tick.wav")} volume={0.3} />
          </Sequence>
        ))}
        <Sequence from={382} durationInFrames={6} name="Thock: подтверждение импорта">
          <Audio src={staticFile("audio/sfx-thock.wav")} volume={0.33} />
        </Sequence>
        <Sequence from={640} durationInFrames={6} name="Thock: выбор категории">
          <Audio src={staticFile("audio/sfx-thock.wav")} volume={0.33} />
        </Sequence>
        <Sequence from={1404} durationInFrames={36} name="Chime: нетто-цифра">
          <Audio src={staticFile("audio/sfx-chime.wav")} volume={0.45} />
        </Sequence>
        <Sequence from={2394} durationInFrames={36} name="Chime: финал">
          <Audio src={staticFile("audio/sfx-chime.wav")} volume={0.45} />
        </Sequence>
        <TransitionSeries>
          <TransitionSeries.Sequence durationInFrames={198} name="Morning">
            <Morning />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />
          <TransitionSeries.Sequence durationInFrames={342} name="Import">
            <Import />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={234} name="QuickAdd">
            <QuickAdd />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={270} name="ScanReceipt">
            <ScanReceipt />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={270} name="Split">
            <Split />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={270} name="Debts">
            <Debts />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={234} name="History">
            <History />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={270} name="Analytics">
            <Analytics />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({
              config: { damping: 200 },
              durationInFrames: 18,
            })}
          />
          <TransitionSeries.Sequence durationInFrames={234} name="Budget">
            <Budget />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />
          <TransitionSeries.Sequence durationInFrames={234} name="Everywhere">
            <Everywhere />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 18 })} />
          <TransitionSeries.Sequence durationInFrames={144} name="Cta">
            <Cta />
          </TransitionSeries.Sequence>
        </TransitionSeries>
        {/* Виньетка поверх всего: собирает кадр к центру и добавляет глубины.
          Центр смещён влево, к телефону, потому что смысловой вес кадра
          лежит между телефоном и лупой, а не в геометрической середине. */}
        <AbsoluteFill
          name="Vignette"
          style={{
            background: "radial-gradient(66% 62% at 46% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      </AbsoluteFill>
    </LangContext>
  );
};
