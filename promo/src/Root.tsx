import "./index.css";
import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
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

// Каждая сцена зарегистрирована отдельно: двойной клик по сцене в таймлайне
// главной композиции открывает её на правку.
//
// Длительности здесь — те же, что в TransitionSeries, вместе с +18 кадрами на
// перекрытие перехода. Иначе предпросмотр сцены разошёлся бы с роликом.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Scenes">
        <Composition id="Morning" component={Morning} durationInFrames={198} fps={30} width={1920} height={1080} />
        <Composition id="Import" component={Import} durationInFrames={342} fps={30} width={1920} height={1080} />
        <Composition id="QuickAdd" component={QuickAdd} durationInFrames={234} fps={30} width={1920} height={1080} />
        <Composition id="ScanReceipt" component={ScanReceipt} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="Split" component={Split} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="Debts" component={Debts} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="History" component={History} durationInFrames={234} fps={30} width={1920} height={1080} />
        <Composition id="Analytics" component={Analytics} durationInFrames={270} fps={30} width={1920} height={1080} />
        <Composition id="Budget" component={Budget} durationInFrames={234} fps={30} width={1920} height={1080} />
        <Composition id="Everywhere" component={Everywhere} durationInFrames={234} fps={30} width={1920} height={1080} />
        <Composition id="Cta" component={Cta} durationInFrames={144} fps={30} width={1920} height={1080} />
      </Folder>
      {/* Две композиции на одном компоненте: монтаж общий, различаются только
          подписи. Рендерить нужно обе — `npm run render` и `render:en`. */}
      <Composition id="Promo" component={Promo} defaultProps={{ lang: "ru" as const }} durationInFrames={2520} fps={30} width={1920} height={1080} />
      <Composition id="PromoEn" component={Promo} defaultProps={{ lang: "en" as const }} durationInFrames={2520} fps={30} width={1920} height={1080} />
    </>
  );
};
