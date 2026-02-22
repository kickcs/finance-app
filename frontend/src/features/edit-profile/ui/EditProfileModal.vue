<script setup lang="ts">
import { watch, toValue, type MaybeRefOrGetter } from 'vue';
import { UModal, UInput, UButton } from '@/shared/ui';
import { useEditProfile } from '../model/useEditProfile';

const props = defineProps<{
  modelValue: boolean;
  userId: MaybeRefOrGetter<string | null>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { formData, isValid, isSubmitting, initForm, saveProfile } = useEditProfile(() =>
  toValue(props.userId),
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
      <UInput v-model="formData.name" label="Имя" placeholder="Введите ваше имя" />
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="closeModal">Отмена</UButton>
      <UButton
        variant="primary"
        full-width
        :disabled="!isValid || isSubmitting"
        @click="handleSave"
      >
        {{ isSubmitting ? 'Сохранение...' : 'Сохранить' }}
      </UButton>
    </template>
  </UModal>
</template>
