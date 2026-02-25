<script setup lang="ts">
import { ref } from 'vue';
import { UButton, UIcon, USpinner } from '@/shared/ui';

defineProps<{
  previewUrl: string | null;
  isOcrLoading: boolean;
  isOcrSuccess: boolean;
  ocrError: string | null;
}>();

const emit = defineEmits<{
  selectFile: [file: File];
  resetPhoto: [];
  retryOcr: [];
}>();

const cameraInputRef = ref<HTMLInputElement | null>(null);
const galleryInputRef = ref<HTMLInputElement | null>(null);
const fileError = ref<string | null>(null);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const NEEDS_CONVERSION = /^image\/(heic|heif|tiff|bmp)$/i;
const MAX_DIMENSION = 2048; // OpenAI recommends ≤2048px for detail:high

function openCamera() {
  cameraInputRef.value?.click();
}

function openGallery() {
  galleryInputRef.value?.click();
}

/** Convert any image to JPEG via Canvas (handles HEIC, resizes large images) */
async function toJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Downscale if too large
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const rawFile = input.files?.[0];
  input.value = ''; // reset so same file can be re-selected
  if (!rawFile) return;

  if (!rawFile.type.startsWith('image/')) {
    fileError.value = 'Неверный формат файла. Поддерживаются JPG, PNG, HEIC.';
    return;
  }
  if (rawFile.size > MAX_SIZE) {
    fileError.value = 'Файл слишком большой. Максимальный размер — 10 МБ.';
    return;
  }

  fileError.value = null;

  // Convert HEIC/HEIF/TIFF/BMP or oversized images to JPEG
  try {
    const file = NEEDS_CONVERSION.test(rawFile.type) ? await toJpeg(rawFile) : rawFile;
    emit('selectFile', file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileError.value = `Не удалось обработать изображение (${rawFile.type}, ${Math.round(rawFile.size / 1024)}KB): ${msg}`;
  }
}
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
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- === IDLE STATE === -->
    <template v-if="!previewUrl">
      <div class="flex-1 flex flex-col items-center justify-center gap-5 min-h-0">

        <!-- Receipt illustration area -->
        <div
          class="w-full max-w-[260px] aspect-[3/4] rounded-2xl relative
                 border-2 border-dashed border-primary/30
                 bg-gradient-to-b from-primary/[0.04] to-primary/[0.08]
                 flex flex-col items-center justify-center gap-3
                 transition-all duration-300"
          aria-hidden="true"
        >
          <!-- Decorative receipt lines -->
          <div class="absolute inset-x-8 top-8 space-y-2.5 opacity-[0.15]">
            <div class="h-2 bg-primary rounded-full w-3/4" />
            <div class="h-2 bg-primary rounded-full w-full" />
            <div class="h-2 bg-primary rounded-full w-5/6" />
            <div class="h-2 bg-primary rounded-full w-2/3" />
            <div class="h-2 bg-primary rounded-full w-full" />
            <div class="h-2 bg-primary rounded-full w-1/2" />
          </div>

          <!-- Camera icon -->
          <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center relative z-10">
            <UIcon name="document_scanner" size="xl" class="text-primary" />
          </div>
          <div class="text-center px-6 relative z-10">
            <p class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Сфотографируйте чек
            </p>
            <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
              Текст должен быть чётким и читаемым
            </p>
          </div>
        </div>

        <!-- Tips -->
        <div class="flex gap-2 w-full max-w-[300px]">
          <div class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="light_mode" size="xs" class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0" />
            <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
              Свет
            </span>
          </div>
          <div class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="crop_free" size="xs" class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0" />
            <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
              Весь чек
            </span>
          </div>
          <div class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="text_fields" size="xs" class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0" />
            <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
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

      <!-- Action buttons -->
      <div class="flex-shrink-0 space-y-2.5 mt-5">
        <UButton
          variant="primary"
          size="lg"
          :full-width="true"
          aria-label="Открыть камеру"
          @click="openCamera"
        >
          <UIcon name="photo_camera" size="sm" class="mr-2" />
          Сфотографировать
        </UButton>

        <UButton
          variant="outline"
          size="lg"
          :full-width="true"
          aria-label="Выбрать из галереи"
          @click="openGallery"
        >
          <UIcon name="photo_library" size="sm" class="mr-2" />
          Из галереи
        </UButton>
      </div>
    </template>

    <!-- === PREVIEW STATE === -->
    <template v-else>
      <div class="flex-1 relative min-h-0">
        <img
          :src="previewUrl"
          alt="Фото чека"
          class="w-full h-full object-contain rounded-2xl"
          style="max-height: calc(100dvh - 260px)"
        />

        <!-- OCR loading overlay with scanline -->
        <Transition name="fade">
          <div
            v-if="isOcrLoading"
            class="absolute inset-0 rounded-2xl overflow-hidden
                   bg-background-dark/60 backdrop-blur-[2px]
                   flex flex-col items-center justify-center gap-3"
            aria-live="polite"
            aria-label="Распознаём текст чека..."
          >
            <!-- Animated scan line -->
            <div class="absolute inset-x-0 top-0 h-full pointer-events-none">
              <div class="scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
            </div>
            <div class="relative z-10 flex flex-col items-center gap-2">
              <USpinner size="lg" class="text-white" />
              <p class="text-body-sm font-medium text-white">Распознаём чек...</p>
            </div>
          </div>
        </Transition>

        <!-- OCR error overlay -->
        <Transition name="fade">
          <div
            v-if="ocrError && !isOcrLoading"
            class="absolute inset-0 rounded-2xl bg-background-dark/80 backdrop-blur-sm
                   flex flex-col items-center justify-center gap-4 px-8"
            role="alert"
            aria-live="assertive"
          >
            <div class="w-14 h-14 rounded-full bg-danger/20 flex items-center justify-center">
              <UIcon name="error_outline" size="xl" class="text-danger" />
            </div>
            <div class="text-center">
              <p class="text-body font-semibold text-white mb-1">Не удалось распознать</p>
              <p class="text-body-sm text-white/60">
                Убедитесь, что чек хорошо освещён и полностью виден
              </p>
            </div>
            <div class="flex flex-col gap-2 w-full max-w-[250px]">
              <UButton variant="primary" size="md" :full-width="true" @click="emit('retryOcr')">
                <UIcon name="refresh" size="sm" class="mr-2" />
                Попробовать снова
              </UButton>
              <UButton variant="ghost" size="md" :full-width="true" class="text-white/70" @click="emit('resetPhoto')">
                Другое фото
              </UButton>
            </div>
          </div>
        </Transition>

        <!-- OCR success overlay -->
        <Transition name="fade">
          <div
            v-if="isOcrSuccess"
            class="absolute inset-0 rounded-2xl bg-success/15 backdrop-blur-[1px]
                   flex items-center justify-center"
            aria-live="assertive"
          >
            <div class="w-16 h-16 rounded-full bg-success flex items-center justify-center animate-scaleIn shadow-lg shadow-success/30">
              <UIcon name="check" size="xl" class="text-white" />
            </div>
          </div>
        </Transition>

        <!-- Retake button -->
        <button
          v-if="!isOcrLoading"
          type="button"
          aria-label="Переснять фото"
          class="absolute top-3 right-3
                 w-9 h-9 rounded-full bg-background-dark/50 backdrop-blur-sm
                 flex items-center justify-center
                 text-white active:scale-90 transition-transform"
          @click="emit('resetPhoto')"
        >
          <UIcon name="close" size="sm" />
        </button>
      </div>

      <!-- Action row below preview -->
      <div class="flex-shrink-0 mt-3">
        <UButton
          v-if="isOcrLoading"
          variant="primary"
          size="lg"
          :full-width="true"
          :disabled="true"
          :loading="true"
        >
          Распознаём...
        </UButton>

        <template v-if="!isOcrLoading && !ocrError && !isOcrSuccess">
          <UButton
            variant="ghost"
            size="md"
            :full-width="true"
            @click="emit('resetPhoto')"
          >
            Переснять
          </UButton>
        </template>
      </div>
    </template>

  </div>
</template>

<style>
@import '../transitions.css';
</style>

<style scoped>
@keyframes scanMove {
  0% { top: 0; }
  100% { top: 100%; }
}
.scan-line {
  animation: scanMove 2s ease-in-out infinite;
}
</style>
