import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { parseMoneyLoverCsv, type ParseResult } from '@/shared/lib/csv/parseMoneyLoverCsv';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Spinner } from '@/shared/ui/spinner';

export default function ImportScreen() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets || picked.assets.length === 0) return;
      const asset = picked.assets[0]!;
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = parseMoneyLoverCsv(content);
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Импорт Money Lover' }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <Card>
          <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Экспортируйте данные из Money Lover в формате CSV и выберите файл. После
            предпросмотра можно будет загрузить транзакции в приложение (импорт
            подключим к серверу в ближайшем апдейте).
          </Text>
        </Card>

        <Button
          title={busy ? 'Чтение…' : 'Выбрать CSV-файл'}
          onPress={() => void pick()}
          loading={busy}
          disabled={busy}
        />

        {error ? (
          <Card className="border border-danger">
            <Text className="text-sm text-danger">{error}</Text>
          </Card>
        ) : null}

        {busy ? (
          <View className="items-center py-4">
            <Spinner />
          </View>
        ) : null}

        {result ? (
          <View className="gap-3">
            <Card>
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
                Распознано
              </Text>
              <Text
                className="mt-1 text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {result.stats.total_rows}
              </Text>
              <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                транзакций
              </Text>
              {result.stats.date_range ? (
                <Text className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {new Date(result.stats.date_range.from).toLocaleDateString('ru-RU')} —{' '}
                  {new Date(result.stats.date_range.to).toLocaleDateString('ru-RU')}
                </Text>
              ) : null}
            </Card>

            <Card>
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
                Категории ({result.stats.unique_categories.length})
              </Text>
              <Text className="mt-1 text-sm text-text-primary-light dark:text-text-primary-dark">
                {result.stats.unique_categories.slice(0, 8).join(', ')}
                {result.stats.unique_categories.length > 8 ? ' …' : ''}
              </Text>
            </Card>

            <Card>
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
                Счета ({result.stats.unique_accounts.length})
              </Text>
              <Text className="mt-1 text-sm text-text-primary-light dark:text-text-primary-dark">
                {result.stats.unique_accounts.join(', ')}
              </Text>
            </Card>

            {result.errors.length > 0 ? (
              <Card className="border border-warning">
                <Text className="text-xs font-medium uppercase tracking-wide text-warning">
                  Предупреждения ({result.errors.length})
                </Text>
                {result.errors.slice(0, 5).map((e, i) => (
                  <Text
                    key={i}
                    className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    {e}
                  </Text>
                ))}
                {result.errors.length > 5 ? (
                  <Text className="mt-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                    и ещё {result.errors.length - 5}
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
