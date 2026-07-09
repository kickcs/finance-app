<script setup lang="ts">
import { ref, computed, watch, useTemplateRef } from 'vue';
import { useIntervalFn, useEventListener } from '@vueuse/core';
import { UButton, UIcon, USpinner } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { pluralize } from '@/shared/lib/format/pluralize';
import { formatCurrency } from '@/shared/lib/format/currency';
import { isAcceptableImage, ensureJpegDecodable } from '../../model/imageFile';
import { MAX_RECEIPT_PHOTOS } from '../../model/usePhotoStep';

const props = defineProps<{
  previewUrls: string[];
  isOcrLoading: boolean;
  isOcrSuccess: boolean;
  ocrError: { message: string; details: string } | null;
  /** Свежий черновик прошлого чека — предложение продолжить */
  draft?: { itemCount: number; totalAmount: number; currency: string } | null;
}>();

const emit = defineEmits<{
  addFile: [file: File];
  removeFile: [index: number];
  resetPhoto: [];
  scan: [];
  manual: [];
  continueDraft: [];
  discardDraft: [];
}>();

const cameraInputRef = useTemplateRef<HTMLInputElement>('cameraInputRef');
const galleryInputRef = useTemplateRef<HTMLInputElement>('galleryInputRef');
const fileError = ref<string | null>(null);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1536; // Good enough for OCR, keeps JPEG under ~2MB

const OCR_MESSAGES = ['Читаем текст...', 'Ищем суммы...', 'Почти готово...'];
const currentOcrMessage = ref(OCR_MESSAGES[0]);
let messageIndex = 0;

const { pause: pauseMessages, resume: resumeMessages } = useIntervalFn(
  () => {
    messageIndex = (messageIndex + 1) % OCR_MESSAGES.length;
    currentOcrMessage.value = OCR_MESSAGES[messageIndex];
  },
  1500,
  { immediate: false },
);

watch(
  () => props.isOcrLoading,
  (isLoading) => {
    if (isLoading) {
      messageIndex = 0;
      currentOcrMessage.value = OCR_MESSAGES[0];
      resumeMessages();
    } else {
      pauseMessages();
    }
  },
);

// Активный кадр в превью — по умолчанию последний добавленный
const activeIdx = ref(0);
watch(
  () => props.previewUrls.length,
  (len, prevLen) => {
    if (len === 0) return;
    if (len > (prevLen ?? 0)) activeIdx.value = len - 1;
    else activeIdx.value = Math.min(activeIdx.value, len - 1);
  },
);

const activePreviewUrl = computed(() => props.previewUrls[activeIdx.value] ?? null);
const photosCount = computed(() => props.previewUrls.length);
const canAddMore = computed(
  () => photosCount.value < MAX_RECEIPT_PHOTOS && !props.isOcrLoading && !props.isOcrSuccess,
);

const scanLabel = computed(() =>
  photosCount.value > 1
    ? `Распознать ${photosCount.value} ${pluralize(photosCount.value, 'кадр', 'кадра', 'кадров')}`
    : 'Распознать',
);

function openCamera() {
  cameraInputRef.value?.click();
}

function openGallery() {
  galleryInputRef.value?.click();
}

/** Convert image to JPEG via <img> + Canvas (universal iOS/Android support) */
function toJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob returned null'));
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Image load failed for ${file.type}`));
    };
    img.src = url;
  });
}

/** Конвертирует один кадр (HEIC→JPEG декод + ресайз/перекодирование). */
async function convertFrame(rawFile: File): Promise<File> {
  const decodable = await ensureJpegDecodable(rawFile);
  return toJpeg(decodable);
}

/** Обработка одиночного кадра (paste из буфера). */
async function processFile(rawFile: File) {
  if (photosCount.value >= MAX_RECEIPT_PHOTOS) {
    fileError.value = `Максимум ${MAX_RECEIPT_PHOTOS} кадра одного чека`;
    return;
  }
  if (!isAcceptableImage(rawFile)) {
    fileError.value = 'Неверный формат файла. Поддерживаются JPG, PNG, HEIC.';
    return;
  }
  if (rawFile.size > MAX_SIZE) {
    fileError.value = 'Файл слишком большой. Максимальный размер — 10 МБ.';
    return;
  }
  fileError.value = null;
  try {
    emit('addFile', await convertFrame(rawFile));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileError.value = `Ошибка обработки (${rawFile.type}, ${Math.round(rawFile.size / 1024)}KB): ${msg}`;
  }
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const rawFiles = Array.from(input.files ?? []);
  input.value = '';
  if (rawFiles.length === 0) return;

  fileError.value = null;

  // Cap-guard считаем один раз по числу свободных слотов: photosCount
  // обновляется родителем асинхронно, поэтому проверять его в цикле per-file
  // ненадёжно. Лишние кадры сверх лимита отсекаем сразу.
  const freeSlots = MAX_RECEIPT_PHOTOS - photosCount.value;
  if (freeSlots <= 0) {
    fileError.value = `Максимум ${MAX_RECEIPT_PHOTOS} кадра одного чека`;
    return;
  }
  if (rawFiles.length > freeSlots) {
    fileError.value = `Максимум ${MAX_RECEIPT_PHOTOS} кадра одного чека`;
  }

  // Синхронная валидация формата/размера — отбрасываем негодные до тяжёлой работы.
  const valid = rawFiles.slice(0, freeSlots).filter((f) => {
    if (!isAcceptableImage(f)) {
      fileError.value = 'Неверный формат файла. Поддерживаются JPG, PNG, HEIC.';
      return false;
    }
    if (f.size > MAX_SIZE) {
      fileError.value = 'Файл слишком большой. Максимальный размер — 10 МБ.';
      return false;
    }
    return true;
  });
  if (valid.length === 0) return;

  // Конвертация независимых кадров — параллельно (до 3 кадров), а не по очереди.
  // Порядок кадров сохраняем: emit по индексу после settled.
  const results = await Promise.allSettled(valid.map(convertFrame));
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      emit('addFile', res.value);
    } else {
      const raw = valid[i];
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      fileError.value = `Ошибка обработки (${raw.type}, ${Math.round(raw.size / 1024)}KB): ${msg}`;
    }
  });
}

// Ctrl+V paste support — добавляет кадр
useEventListener(document, 'paste', (e: ClipboardEvent) => {
  if (props.isOcrLoading || props.isOcrSuccess) return;
  const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
  if (file) {
    e.preventDefault();
    processFile(file);
  }
});
</script>

<template>
  <div class="h-full flex flex-col px-5 pt-4 pb-6 overflow-y-auto no-scrollbar">
    <!-- Hidden native file inputs -->
    <input
      ref="cameraInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="handleFileChange"
    />
    <input
      ref="galleryInputRef"
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      class="hidden"
      @change="handleFileChange"
    />

    <!-- === IDLE STATE === -->
    <template v-if="photosCount === 0">
      <!-- Черновик прошлого чека -->
      <Transition name="fade">
        <div
          v-if="draft"
          class="flex-shrink-0 flex items-center gap-3 px-4 py-3 mb-2 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
        >
          <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="history" size="sm" class="text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Продолжить прошлый чек?
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums">
              {{ draft.itemCount }}
              {{ pluralize(draft.itemCount, 'позиция', 'позиции', 'позиций') }} ·
              {{ formatCurrency(draft.totalAmount, draft.currency) }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
              @click="emit('continueDraft')"
            >
              Продолжить
            </button>
            <button
              type="button"
              aria-label="Удалить черновик"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger active:scale-90 transition-all"
              @click="emit('discardDraft')"
            >
              <UIcon name="close" size="xs" />
            </button>
          </div>
        </div>
      </Transition>

      <div class="flex-1 flex flex-col items-center justify-center gap-5 min-h-0">
        <!-- Receipt illustration area (Viewfinder) -->
        <div
          class="w-full max-w-[280px] aspect-[3/4] rounded-3xl relative bg-surface-light dark:bg-surface-dark flex flex-col items-center justify-center gap-4 transition-all duration-300 shadow-sm"
          aria-hidden="true"
        >
          <!-- Viewfinder corners -->
          <div class="absolute inset-2 pointer-events-none opacity-50">
            <div
              class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-2xl"
            ></div>
            <div
              class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-2xl"
            ></div>
            <div
              class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-2xl"
            ></div>
            <div
              class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-2xl"
            ></div>
          </div>

          <!-- Subtle animated scan line -->
          <div class="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            <div
              class="scan-line-idle absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/5 to-transparent mix-blend-overlay"
            ></div>
          </div>

          <!-- Camera icon -->
          <div
            class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center relative z-10"
          >
            <UIcon name="document_scanner" size="xl" class="text-primary" />
          </div>
          <div class="text-center px-6 relative z-10">
            <p
              class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
            >
              Наведите камеру на чек
            </p>
            <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
              Длинный чек можно снять по частям — до {{ MAX_RECEIPT_PHOTOS }} кадров
            </p>
          </div>
        </div>

        <!-- Tips -->
        <div class="flex gap-2 w-full max-w-[300px]">
          <div
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
          >
            <UIcon
              name="light_mode"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
            />
            <span
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight"
            >
              Свет
            </span>
          </div>
          <div
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
          >
            <UIcon
              name="crop_free"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
            />
            <span
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight"
            >
              Весь чек
            </span>
          </div>
          <div
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
          >
            <UIcon
              name="text_fields"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
            />
            <span
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight"
            >
              Чётко
            </span>
          </div>
        </div>
      </div>

      <!-- File validation error -->
      <Transition name="fade">
        <div
          v-if="fileError"
          class="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-light"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-danger flex-shrink-0" />
          <p class="text-body-sm text-danger">{{ fileError }}</p>
        </div>
      </Transition>

      <!-- Action buttons (Camera UI) -->
      <div class="flex-shrink-0 flex items-center justify-between px-8 mt-5">
        <button
          type="button"
          aria-label="Выбрать из галереи"
          class="w-12 h-12 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark active:scale-90 transition-transform"
          @click="openGallery"
        >
          <UIcon name="photo_library" size="md" />
        </button>

        <button
          type="button"
          aria-label="Сфотографировать"
          class="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center active:scale-95 transition-all group"
          @click="openCamera"
        >
          <div
            class="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-active:scale-95 transition-all"
          >
            <UIcon name="photo_camera" size="lg" class="text-white" />
          </div>
        </button>

        <!-- Placeholder for symmetry -->
        <div class="w-12 h-12" aria-hidden="true" />
      </div>

      <!-- Ручной режим -->
      <button
        type="button"
        class="flex-shrink-0 mx-auto mt-4 mb-1 flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:text-primary active:opacity-70 transition-colors"
        @click="emit('manual')"
      >
        <UIcon name="edit" size="xs" />
        Ввести вручную — без чека
      </button>
    </template>

    <!-- === PREVIEW STATE === -->
    <template v-else>
      <div class="flex-1 relative min-h-0">
        <img
          :src="activePreviewUrl ?? undefined"
          alt="Фото чека"
          class="w-full h-full object-contain rounded-2xl"
          style="max-height: calc(100dvh - 320px)"
        />

        <!-- OCR loading overlay with scanline -->
        <Transition name="fade">
          <div
            v-if="isOcrLoading"
            class="absolute inset-0 rounded-2xl overflow-hidden bg-background-dark/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3"
            aria-live="polite"
            aria-label="Распознаём текст чека..."
          >
            <!-- Animated scan line -->
            <div class="absolute inset-x-0 top-0 h-full pointer-events-none">
              <div
                class="scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
              />
            </div>
            <div class="relative z-10 flex flex-col items-center gap-3">
              <USpinner size="lg" class="text-white" />
              <div class="h-6 overflow-hidden relative w-40">
                <Transition name="slide-up">
                  <p
                    :key="currentOcrMessage"
                    class="absolute inset-0 text-center text-body-sm font-medium text-white"
                  >
                    {{ currentOcrMessage }}
                  </p>
                </Transition>
              </div>
            </div>
          </div>
        </Transition>

        <!-- OCR error overlay -->
        <Transition name="fade">
          <div
            v-if="ocrError && !isOcrLoading"
            class="absolute inset-0 rounded-2xl bg-background-dark/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-8"
            role="alert"
            aria-live="assertive"
          >
            <div class="w-14 h-14 rounded-full bg-danger/20 flex items-center justify-center">
              <UIcon name="error_outline" size="xl" class="text-danger" />
            </div>
            <div class="text-center">
              <p class="text-body font-semibold text-white mb-1">{{ ocrError.message }}</p>
              <p class="text-body-sm text-white/60 mb-2">
                Попробуйте ярче свет или переснимите ближе — текст должен быть читаемым
              </p>
              <details v-if="ocrError.details" class="group">
                <summary
                  class="text-caption text-white/40 cursor-pointer select-none list-none inline-flex items-center gap-1"
                >
                  Подробности
                  <UIcon
                    name="expand_more"
                    size="xs"
                    class="transition-transform group-open:rotate-180"
                  />
                </summary>
                <p class="text-caption text-white/40 break-all px-2 mt-1">
                  {{ ocrError.details }}
                </p>
              </details>
            </div>
            <div class="flex flex-col gap-2 w-full max-w-[250px]">
              <UButton variant="primary" size="md" full-width @click="emit('scan')">
                <UIcon name="refresh" size="sm" class="mr-2" />
                Попробовать снова
              </UButton>
              <UButton
                variant="ghost"
                size="md"
                full-width
                class="text-white/70"
                @click="emit('resetPhoto')"
              >
                Другое фото
              </UButton>
            </div>
          </div>
        </Transition>

        <!-- OCR success overlay -->
        <Transition name="fade">
          <div
            v-if="isOcrSuccess"
            class="absolute inset-0 rounded-2xl bg-success/15 backdrop-blur-[1px] flex items-center justify-center"
            aria-live="assertive"
          >
            <div
              class="w-16 h-16 rounded-full bg-success flex items-center justify-center animate-scaleIn shadow-lg shadow-success/30"
            >
              <UIcon name="check" size="xl" class="text-white" />
            </div>
          </div>
        </Transition>

        <!-- Reset button -->
        <button
          v-if="!isOcrLoading"
          type="button"
          aria-label="Начать заново"
          class="absolute top-3 right-3 w-9 h-9 rounded-full bg-background-dark/50 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
          @click="emit('resetPhoto')"
        >
          <UIcon name="close" size="sm" />
        </button>
      </div>

      <!-- Лента кадров -->
      <div class="flex-shrink-0 flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar">
        <div v-for="(url, index) in previewUrls" :key="url" class="relative flex-shrink-0">
          <button
            type="button"
            :aria-label="`Кадр ${index + 1}`"
            :class="
              cn(
                'block w-16 h-16 rounded-xl overflow-hidden border-2 transition-all active:scale-95',
                index === activeIdx
                  ? 'border-primary shadow-sm'
                  : 'border-border-light dark:border-border-dark opacity-70',
              )
            "
            @click="activeIdx = index"
          >
            <img :src="url" alt="" class="w-full h-full object-cover" />
          </button>
          <button
            v-if="canAddMore || previewUrls.length > 1"
            type="button"
            :aria-label="`Удалить кадр ${index + 1}`"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background-dark/70 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
            @click="emit('removeFile', index)"
          >
            <UIcon name="close" size="xs" />
          </button>
        </div>

        <!-- Добавить кадр: камера и галерея -->
        <template v-if="canAddMore">
          <button
            type="button"
            aria-label="Снять ещё кадр"
            class="flex-shrink-0 w-16 h-16 rounded-xl border border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center gap-0.5 text-text-tertiary-light dark:text-text-tertiary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
            @click="openCamera"
          >
            <UIcon name="photo_camera" size="sm" />
            <span class="text-caption-sm font-medium">Ещё</span>
          </button>
          <button
            type="button"
            aria-label="Добавить кадр из галереи"
            class="flex-shrink-0 w-16 h-16 rounded-xl border border-dashed border-border-light dark:border-border-dark flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
            @click="openGallery"
          >
            <UIcon name="photo_library" size="sm" />
          </button>
        </template>
      </div>

      <!-- File validation error -->
      <Transition name="fade">
        <div
          v-if="fileError"
          class="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-light"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-danger flex-shrink-0" />
          <p class="text-body-sm text-danger">{{ fileError }}</p>
        </div>
      </Transition>

      <!-- Action row below preview -->
      <div class="flex-shrink-0 mt-3">
        <UButton v-if="isOcrLoading" variant="primary" size="lg" full-width disabled loading>
          Распознаём...
        </UButton>

        <UButton
          v-else-if="!ocrError && !isOcrSuccess"
          variant="primary"
          size="lg"
          full-width
          @click="emit('scan')"
        >
          <UIcon name="document_scanner" size="sm" class="mr-2" />
          {{ scanLabel }}
        </UButton>
      </div>
    </template>
  </div>
</template>

<style>
@import '../transitions.css';
</style>

<style scoped>
@keyframes scanMove {
  0% {
    top: 0;
  }
  100% {
    top: 100%;
  }
}
.scan-line {
  animation: scanMove 2.5s ease-in-out infinite;
}

@keyframes scanMoveIdle {
  0% {
    top: -10%;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    top: 110%;
    opacity: 0;
  }
}
.scan-line-idle {
  animation: scanMoveIdle 3s linear infinite;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .scan-line,
  .scan-line-idle {
    animation: none;
  }
}
</style>
