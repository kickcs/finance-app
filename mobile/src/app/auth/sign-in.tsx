import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { signIn, signInAnonymously } from '@/shared/api/composables/useAuth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const onAnonymous = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-background-light dark:bg-background-dark">
      <Text className="text-3xl font-bold mb-6 text-text-primary-light dark:text-text-primary-dark">
        Вход
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3 mb-3 text-text-primary-light dark:text-text-primary-dark"
      />
      <TextInput
        secureTextEntry
        placeholder="Пароль"
        placeholderTextColor="#9CA3AF"
        value={password}
        onChangeText={setPassword}
        className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3 mb-3 text-text-primary-light dark:text-text-primary-dark"
      />
      {error ? <Text className="text-danger mb-3">{error}</Text> : null}
      <Pressable
        onPress={onSubmit}
        disabled={loading}
        className="bg-primary rounded-xl py-3 items-center mb-3"
      >
        <Text className="text-white font-semibold">{loading ? 'Вход…' : 'Войти'}</Text>
      </Pressable>
      <Pressable onPress={onAnonymous} disabled={loading} className="py-3 items-center">
        <Text className="text-primary">Попробовать без аккаунта</Text>
      </Pressable>
    </View>
  );
}
