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

function openCamera() {
  cameraInputRef.value?.click();
}

function openGallery() {
  galleryInputRef.value?.click();
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // reset so same file can be re-selected
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    fileError.value = 'Неверный формат файла. Поддерживаются JPG, PNG, HEIC.';
    return;
  }
  if (file.size > MAX_SIZE) {
    fileError.value = 'Файл слишком большой. Максимальный размер — 10 МБ.';
    return;
  }

  fileError.value = null;
  emit('selectFile', file);
}
</script>

<template>
  <div class="h-full flex flex-col px-5 pt-6 pb-6 overflow-y-auto no-scrollbar">

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
      <!-- Illustration zone -->
      <div class="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">

        <!-- Receipt placeholder -->
        <div
          class="w-full max-w-[280px] aspect-[3/4] rounded-2xl
                 border-2 border-dashed border-border-light dark:border-border-dark
                 bg-surface-light dark:bg-surface-dark
                 flex flex-col items-center justify-center gap-4"
          aria-hidden="true"
        >
          <div class="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
            <UIcon name="photo_camera" size="xl" class="text-primary" />
          </div>
          <div class="text-center px-6">
            <p class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Сфотографируйте чек
            </p>
            <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
              Держите чек ровно, текст должен быть чётким
            </p>
          </div>
        </div>

        <!-- Tips row -->
        <div class="flex gap-3 w-full">
          <!-- TipChip: good light -->
          <div class="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="light_mode" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
            <span class="text-caption text-center text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
              Хорошее освещение
            </span>
          </div>
          <!-- TipChip: full receipt in frame -->
          <div class="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="crop_free" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
            <span class="text-caption text-center text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
              Весь чек в кадре
            </span>
          </div>
          <!-- TipChip: clear text -->
          <div class="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-light dark:bg-surface-dark">
            <UIcon name="text_fields" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
            <span class="text-caption text-center text-text-tertiary-light dark:text-text-tertiary-dark leading-tight">
              Чёткий текст
            </span>
          </div>
        </div>

      </div>

      <!-- File validation error -->
      <Transition name="fade">
        <div
          v-if="fileError"
          class="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-light animate-shake"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-danger flex-shrink-0" />
          <p class="text-body-sm text-danger">{{ fileError }}</p>
        </div>
      </Transition>

      <!-- Action buttons -->
      <div class="flex-shrink-0 space-y-3 mt-6">
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
          Выбрать из галереи
        </UButton>
      </div>
    </template>

    <!-- === PREVIEW STATE === -->
    <template v-else>
      <!-- Image preview with overlays -->
      <div class="flex-1 relative min-h-0">
        <img
          :src="previewUrl"
          alt="Фото чека"
          class="w-full h-full object-contain rounded-2xl"
          style="max-height: calc(100dvh - 280px)"
        />

        <!-- OCR loading overlay -->
        <Transition name="fade">
          <div
            v-if="isOcrLoading"
            class="absolute inset-0 rounded-2xl
                   bg-background-dark/70 backdrop-blur-sm
                   flex flex-col items-center justify-center gap-3"
            aria-live="polite"
            aria-label="Распознаём текст чека..."
          >
            <USpinner size="lg" class="text-white" />
            <p class="text-body-sm font-medium text-white">Распознаём текст...</p>
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
            <div class="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center">
              <UIcon name="error_outline" size="xl" class="text-danger" />
            </div>
            <div class="text-center">
              <p class="text-body font-semibold text-white mb-1">Не удалось распознать</p>
              <p class="text-body-sm text-white/70">
                Убедитесь, что чек хорошо освещён и полностью в кадре
              </p>
            </div>
            <div class="flex flex-col gap-2 w-full">
              <UButton variant="primary" size="md" :full-width="true" @click="emit('retryOcr')">
                <UIcon name="refresh" size="sm" class="mr-2" />
                Попробовать снова
              </UButton>
              <UButton variant="ghost" size="md" :full-width="true" class="text-white/80" @click="emit('resetPhoto')">
                Выбрать другое фото
              </UButton>
            </div>
          </div>
        </Transition>

        <!-- OCR success overlay -->
        <Transition name="fade">
          <div
            v-if="isOcrSuccess"
            class="absolute inset-0 rounded-2xl
                   bg-success/20 flex items-center justify-center"
            aria-live="assertive"
          >
            <div class="w-16 h-16 rounded-full bg-success flex items-center justify-center animate-scaleIn">
              <UIcon name="check" size="xl" class="text-white" />
            </div>
          </div>
        </Transition>

        <!-- Retake button top-right -->
        <button
          v-if="!isOcrLoading"
          type="button"
          aria-label="Переснять фото"
          class="absolute top-3 right-3
                 w-9 h-9 rounded-full bg-background-dark/60 backdrop-blur-sm
                 flex items-center justify-center
                 text-white active:scale-90 transition-transform"
          @click="emit('resetPhoto')"
        >
          <UIcon name="refresh" size="sm" />
        </button>
      </div>

      <!-- Action row below preview -->
      <div class="flex-shrink-0 space-y-3 mt-4">
        <!-- While OCR loading: disabled loading button -->
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

        <!-- OCR error: no continue button shown — buttons are in the overlay -->

        <!-- OCR idle (preview selected, not loading, no error, not success): show retake -->
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
