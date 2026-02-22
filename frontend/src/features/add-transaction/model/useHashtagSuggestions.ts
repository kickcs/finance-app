import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { Hashtag } from '@/entities/transaction';

const normalize = (s: string) => s.toLowerCase().replaceAll('#', '');

export function useHashtagSuggestions(
  description: MaybeRefOrGetter<string>,
  hashtags: MaybeRefOrGetter<Hashtag[]>,
) {
  const lastWord = computed(() => {
    const desc = toValue(description);
    if (desc.endsWith(' ') || desc === '') return '';
    const words = desc.split(' ');
    return words[words.length - 1];
  });

  const filtered = computed(() => {
    const all = toValue(hashtags);
    const query = normalize(lastWord.value);
    if (!query) return all;
    return all.filter((h) => normalize(h.tag).includes(query));
  });

  function buildInsertedDescription(tag: string): string {
    const desc = toValue(description) || '';
    if (!desc || desc.endsWith(' ')) {
      return desc + tag + ' ';
    }
    const words = desc.split(' ');
    words[words.length - 1] = tag;
    return words.join(' ') + ' ';
  }

  return { filtered, buildInsertedDescription };
}
