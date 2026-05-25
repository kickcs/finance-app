import { ScrollView, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background-light dark:bg-background-dark"
    >
      <View className="px-4 py-6">
        <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Профиль
        </Text>
      </View>
    </ScrollView>
  );
}
