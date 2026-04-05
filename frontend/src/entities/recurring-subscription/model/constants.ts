export interface ServicePreset {
  name: string;
  icon: string;
  color: string;
}

export const SERVICE_PRESETS: Record<string, ServicePreset> = {
  netflix: { name: 'Netflix', icon: 'netflix', color: '#e50914' },
  spotify: { name: 'Spotify', icon: 'spotify', color: '#1DB954' },
  youtube: { name: 'YouTube Premium', icon: 'youtube', color: '#FF0000' },
  apple_music: { name: 'Apple Music', icon: 'apple_music', color: '#FA2D48' },
  icloud: { name: 'iCloud', icon: 'icloud', color: '#3498db' },
  telegram: { name: 'Telegram Premium', icon: 'telegram', color: '#2AABEE' },
  yandex_plus: { name: 'Яндекс Плюс', icon: 'yandex_plus', color: '#FFCC00' },
  chatgpt: { name: 'ChatGPT Plus', icon: 'chatgpt', color: '#10A37F' },
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  quarterly: 'Раз в квартал',
  yearly: 'Ежегодно',
  custom: 'Другое',
};

export const SUBSCRIPTION_ICONS = [
  'subscriptions',
  'fitness_center',
  'school',
  'medical_services',
  'music_note',
  'tv',
  'sports_esports',
  'movie',
  'cloud',
  'laptop_mac',
  'phone_android',
  'wifi',
  'electric_bolt',
] as const;
