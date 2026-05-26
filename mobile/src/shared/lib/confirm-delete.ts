import { Alert } from 'react-native';

export function confirmDelete(opts: { title: string; message?: string; confirmLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmLabel ?? 'Удалить', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
