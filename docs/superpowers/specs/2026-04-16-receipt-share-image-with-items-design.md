# Receipt Share: Image with Item Breakdown

**Date:** 2026-04-16  
**Feature:** `frontend/src/features/scan-receipt`

## Problem

When sharing a receipt via "Картинкой", `navigator.share({ files: [file], text })` causes Telegram (and some other apps) to send two separate messages — one for the image and one for the text. The user wants one unified message.

## Solution

Embed all text information into the canvas image itself, then share only `{ files: [file] }` without `text`. The image becomes fully self-contained.

## Changes — `useReceiptShare.ts`

### New constant

```ts
const ITEM_HEIGHT = 20; // px per item row under a participant
```

### `calcParticipantsHeight` update

For each ower participant, include item rows in the height:

```
participantHeight = PARTICIPANT_NAME_HEIGHT + participant.items.length * ITEM_HEIGHT
```

Current code counts only `owers.length * PARTICIPANT_NAME_HEIGHT`.

### `drawParticipants` update

After rendering the participant name/amount row, iterate `p.items` and for each item render:

- **Left column** — item name with `(1/N)` suffix if `sharedWith > 1`. Indented at `PADDING_X + 12`. Font: `400 12px`, color: `TEXT_SECONDARY`.
- **Right column** — `formatCurrency(item.share, currency)`. Font: `400 12px`, color: `TEXT_SECONDARY`. Right-aligned at `AMOUNT_X`.
- **Y position** — cumulative, stepping `ITEM_HEIGHT` per row.

No dividers or dots between items — keep visual weight light.

### `shareAsImage` update

```diff
- await navigator.share({ files: [file], text });
+ await navigator.share({ files: [file] });
```

`buildShareText` and `shareAsText` remain unchanged.

## Out of Scope

- `shareAsText` behaviour — unchanged
- `saveToGallery` — unchanged
- Backend — no changes
- Any other feature files — no changes

## Acceptance Criteria

1. Tapping "Картинкой" opens the system share sheet with only an image (no separate text payload).
2. When shared to Telegram, a single message with the receipt image is created.
3. The image visually shows each participant's name + total + their individual item breakdown beneath.
4. Shared items show `(1/N)` suffix when split across multiple people.
5. "Текстом" share continues to work as before.
