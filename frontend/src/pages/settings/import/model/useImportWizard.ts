import { ref, computed } from 'vue';
import { parseMoneyLoverCsv } from '@/shared/lib/csv/parseMoneyLoverCsv';
import type { ParseResult } from '@/shared/lib/csv/parseMoneyLoverCsv';
import { useImportData } from '@/features/import-data';
import type { ImportResult } from '@/features/import-data';

export type ImportStep = 'select' | 'preview' | 'result';

export function useImportWizard() {
  const step = ref<ImportStep>('select');
  const parseResult = ref<ParseResult | null>(null);
  const importResult = ref<ImportResult | null>(null);
  const parseError = ref<string | null>(null);

  const { importMutation } = useImportData();

  const fileInput = ref<HTMLInputElement | null>(null);

  const previewTransactions = computed(() => parseResult.value?.data.slice(0, 20) ?? []);

  function openFilePicker() {
    fileInput.value?.click();
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    parseError.value = null;

    try {
      const result = await parseMoneyLoverCsv(file);
      if (result.data.length === 0) {
        parseError.value = 'Файл не содержит транзакций';
        return;
      }
      parseResult.value = result;
      step.value = 'preview';
    } catch {
      parseError.value = 'Не удалось прочитать файл';
    }

    target.value = '';
  }

  async function handleImport() {
    if (!parseResult.value) return;

    try {
      const result = await importMutation.mutateAsync(parseResult.value.data);
      importResult.value = result;
      step.value = 'result';
    } catch {
      // Error handled by mutation state
    }
  }

  return {
    step,
    parseResult,
    importResult,
    parseError,
    importMutation,
    fileInput,
    previewTransactions,
    openFilePicker,
    handleFileChange,
    handleImport,
  };
}
