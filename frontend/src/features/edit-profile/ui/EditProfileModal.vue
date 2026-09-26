<script setup lang="ts">
import { computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { UModal, UInput, UButton } from '@/shared/ui';
import { useCardNumberInput } from '@/shared/lib/hooks/useCardNumberInput';
import { useEditProfile } from '../model/useEditProfile';

const props = defineProps<{
  modelValue: boolean;
  userId: MaybeRefOrGetter<string | null>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { formData, isValid, isCardValid, isSubmitting, initForm, saveProfile } = useEditProfile(() =>
  toValue(props.userId),
);

/**
 * В поле номер живёт по четыре цифры, в модели — голыми цифрами: так его и
 * сверяют с пластиком, и сравнивают с сохранённым.
 */
const cardModel = computed({
  get: () => formData.value.cardNumber,
  set: (value: string) => {
    formData.value.cardNumber = value;
  },
});
const { view: cardNumber, onInput: onCardInput } = useCardNumberInput(cardModel);

const cardError = computed(() =>
  isCardValid.value ? undefined : 'Номер карты — от 12 до 19 цифр',
);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      initForm();
    }
  },
);

function closeModal() {
  emit('update:modelValue', false);
}

async function handleSave() {
  await saveProfile();
  closeModal();
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Редактирование профиля"
    @update:model-value="emit('update:modelValue', $event)"
    @close="closeModal"
  >
    <div class="space-y-4">
      <UInput
        v-model="formData.name"
        data-testid="edit-profile-name-input"
        label="Имя"
        placeholder="Введите ваше имя"
      />

      <div class="space-y-1.5">
        <UInput
          :model-value="cardNumber"
          type="tel"
          icon="credit_card"
          data-testid="edit-profile-card-input"
          label="Карта для переводов"
          placeholder="0000 0000 0000 0000"
          :error="cardError"
          @update:model-value="onCardInput"
        />
        <p class="px-0.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Подставим её, когда делитесь долгами, — чтобы человеку было куда вернуть
        </p>
      </div>
    </div>

    <template #actions>
      <UButton
        variant="secondary"
        full-width
        data-testid="edit-profile-cancel-btn"
        @click="closeModal"
      >
        Отмена
      </UButton>
      <UButton
        variant="primary"
        full-width
        data-testid="edit-profile-save-btn"
        :disabled="!isValid || isSubmitting"
        @click="handleSave"
      >
        {{ isSubmitting ? 'Сохранение...' : 'Сохранить' }}
      </UButton>
    </template>
  </UModal>
</template>
