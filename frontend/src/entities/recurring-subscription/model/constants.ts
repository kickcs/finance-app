export interface ServicePreset {
  name: string;
  icon: string;
  color: string;
}

// Brand colors are official brand HEX values.
// `icon` matches keys in `shared/ui/icon/brandIconPaths.ts`.
export const SERVICE_PRESETS: Record<string, ServicePreset> = {
  // Видео
  netflix: { name: 'Netflix', icon: 'netflix', color: '#E50914' },
  youtube: { name: 'YouTube', icon: 'youtube', color: '#FF0000' },

  // Музыка
  spotify: { name: 'Spotify', icon: 'spotify', color: '#1DB954' },
  apple_music: { name: 'Apple', icon: 'apple_music', color: '#FA2D48' },
  yandex_plus: { name: 'Яндекс', icon: 'yandex_plus', color: '#FFCC00' },

  // AI / Дизайн
  chatgpt: { name: 'ChatGPT', icon: 'chatgpt', color: '#10A37F' },
  figma: { name: 'Figma', icon: 'figma', color: '#F24E1E' },

  // Облако
  icloud: { name: 'iCloud', icon: 'icloud', color: '#3498DB' },

  // Соцсети
  telegram: { name: 'Telegram', icon: 'telegram', color: '#2AABEE' },
  linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },

  // Игры
  playstation: { name: 'PlayStation', icon: 'playstation', color: '#003791' },
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
