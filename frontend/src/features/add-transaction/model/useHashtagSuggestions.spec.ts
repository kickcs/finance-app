import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useHashtagSuggestions } from './useHashtagSuggestions';
import type { Hashtag } from '@/entities/transaction';

// ---------------------------------------------------------------------------
// useHashtagSuggestions — pure unit tests
// ---------------------------------------------------------------------------

const SAMPLE_HASHTAGS: Hashtag[] = [
  { tag: '#продукты', count: 15 },
  { tag: '#транспорт', count: 10 },
  { tag: '#кафе', count: 8 },
  { tag: '#магазин', count: 5 },
  { tag: '#еда', count: 3 },
];

describe('useHashtagSuggestions', () => {
  // ── filtered ──────────────────────────────────────────────────────────────

  describe('filtered', () => {
    it('returns all hashtags when description is empty', () => {
      const { filtered } = useHashtagSuggestions(ref(''), ref(SAMPLE_HASHTAGS));
      expect(filtered.value).toHaveLength(SAMPLE_HASHTAGS.length);
    });

    it('returns all hashtags when description ends with a space (no active word)', () => {
      const { filtered } = useHashtagSuggestions(ref('#продукты '), ref(SAMPLE_HASHTAGS));
      expect(filtered.value).toHaveLength(SAMPLE_HASHTAGS.length);
    });

    it('filters by partial match on last word (case-insensitive)', () => {
      const { filtered } = useHashtagSuggestions(ref('#про'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value.map((h) => h.tag)).toContain('#продукты');
      expect(filtered.value.map((h) => h.tag)).not.toContain('#транспорт');
    });

    it('filters using # prefix in last word', () => {
      const { filtered } = useHashtagSuggestions(ref('#транс'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value.map((h) => h.tag)).toContain('#транспорт');
    });

    it('filters word WITHOUT # prefix', () => {
      const { filtered } = useHashtagSuggestions(ref('кафе'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value.map((h) => h.tag)).toContain('#кафе');
    });

    it('matches mid-word query', () => {
      const { filtered } = useHashtagSuggestions(ref('#агаз'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value.map((h) => h.tag)).toContain('#магазин');
    });

    it('returns empty array when no hashtags match', () => {
      const { filtered } = useHashtagSuggestions(ref('#xyz'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value).toHaveLength(0);
    });

    it('uses only the last word as filter query', () => {
      // "покупка #про" → last word is "#про"
      const { filtered } = useHashtagSuggestions(ref('покупка #про'), ref(SAMPLE_HASHTAGS));
      expect(filtered.value.map((h) => h.tag)).toContain('#продукты');
      expect(filtered.value.map((h) => h.tag)).not.toContain('#транспорт');
    });
  });

  // ── buildInsertedDescription ──────────────────────────────────────────────

  describe('buildInsertedDescription', () => {
    it('appends tag to empty description', () => {
      const { buildInsertedDescription } = useHashtagSuggestions(ref(''), ref(SAMPLE_HASHTAGS));
      expect(buildInsertedDescription('#продукты')).toBe('#продукты ');
    });

    it('appends tag to description ending with space', () => {
      const { buildInsertedDescription } = useHashtagSuggestions(
        ref('#первый '),
        ref(SAMPLE_HASHTAGS),
      );
      expect(buildInsertedDescription('#продукты')).toBe('#первый #продукты ');
    });

    it('replaces last word with selected tag', () => {
      const { buildInsertedDescription } = useHashtagSuggestions(ref('#про'), ref(SAMPLE_HASHTAGS));
      expect(buildInsertedDescription('#продукты')).toBe('#продукты ');
    });

    it('replaces last word in multi-word description', () => {
      const { buildInsertedDescription } = useHashtagSuggestions(
        ref('покупка #про'),
        ref(SAMPLE_HASHTAGS),
      );
      expect(buildInsertedDescription('#продукты')).toBe('покупка #продукты ');
    });

    it('adds trailing space after inserted tag', () => {
      const { buildInsertedDescription } = useHashtagSuggestions(ref('#ка'), ref(SAMPLE_HASHTAGS));
      const result = buildInsertedDescription('#кафе');
      expect(result.endsWith(' ')).toBe(true);
    });
  });

  // ── Reactivity ────────────────────────────────────────────────────────────

  describe('reactivity', () => {
    it('recomputes filtered when description changes', () => {
      const desc = ref('');
      const { filtered } = useHashtagSuggestions(desc, ref(SAMPLE_HASHTAGS));

      expect(filtered.value).toHaveLength(SAMPLE_HASHTAGS.length);

      desc.value = '#кафе';
      expect(filtered.value.map((h) => h.tag)).toContain('#кафе');
      expect(filtered.value.length).toBeLessThan(SAMPLE_HASHTAGS.length);
    });

    it('recomputes filtered when hashtags list changes', () => {
      const hashtagsRef = ref<Hashtag[]>([]);
      const { filtered } = useHashtagSuggestions(ref(''), hashtagsRef);

      expect(filtered.value).toHaveLength(0);

      hashtagsRef.value = SAMPLE_HASHTAGS;
      expect(filtered.value).toHaveLength(SAMPLE_HASHTAGS.length);
    });
  });
});
