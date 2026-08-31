/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.overrideBundlerConfig(enableTailwind);

// Кадры отдаются энкодеру в PNG, а не в JPEG. Ролик тёмный, с золотом на
// почти чёрном и с крупными градиентами: JPEG-промежуток давал ореолы вокруг
// цветных цифр и блочность в тенях — это видно на увеличенном кропе, а не
// только «на глаз». PNG медленнее, но здесь платим один раз при рендере.
Config.setVideoImageFormat("png");

// CRF 15 вместо дефолтных 18 и пресет slow: тёмные градиенты — худший случай
// для h264, на 18 они рассыпаются в бандинг.
Config.setCrf(15);
Config.setX264Preset("slow");

// Без этих двух строк файл получался с pix_fmt yuvj420p и матрицей bt470bg
// (PAL) — часть плееров разбирала цвета не той матрицей, и золото уезжало.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
