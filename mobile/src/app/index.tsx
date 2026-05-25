import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <Text className="text-2xl font-bold text-primary">NativeWind works</Text>
      <Text className="text-text-secondary-light dark:text-text-secondary-dark mt-2">
        Design tokens loaded
      </Text>
    </View>
  );
}
