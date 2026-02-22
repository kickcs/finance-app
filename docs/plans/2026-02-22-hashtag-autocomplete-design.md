# Hashtag Autocomplete Design

## Problem

Currently, hashtag suggestions in TransactionForm show all hashtags when the description field is focused, with no filtering. Users want to type text and see matching hashtags filtered by what they're typing.

## Solution: Filter by Last Word (Approach A)

### Behavior

1. **Focus** on description field → show all hashtags (current behavior preserved)
2. **Typing** → extract the last word (after last space) and filter hashtags that contain it (case-insensitive)
3. **After space** (empty last word) → show all hashtags again
4. **Click chip** → replace the last word with the selected hashtag + space, then show all hashtags
5. **Empty input + focus** → show all hashtags

### Implementation

**File**: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

Changes:
- Add `computed` that extracts the last word from `formData.description`
- Add `computed` that filters `hashtags` by the last word (case-insensitive, substring match on tag without `#`)
- Update the `v-for` to iterate over `filteredHashtags` instead of `hashtags`
- Update `insertHashtag()` to replace the last word instead of appending
- Hide suggestions when `filteredHashtags` is empty (no matches)

### Filter Logic

```
lastWord = description.split(' ').pop() || ''
filteredHashtags = lastWord === ''
  ? hashtags
  : hashtags.filter(h => h.tag.toLowerCase().includes(lastWord.toLowerCase().replace('#', '')))
```

### Insert Logic

```
words = description.split(' ')
words[words.length - 1] = tag  // replace last word with hashtag
newDescription = words.join(' ') + ' '
```

### No backend changes needed

All filtering is client-side on the already-fetched hashtags list.
