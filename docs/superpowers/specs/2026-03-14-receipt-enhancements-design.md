# Receipt Scanner Enhancements — Design Spec

## Summary

Three enhancements to the scan-receipt feature:

1. **Desktop delete button** — visible trash icon on `ReceiptItemRow` for desktop users (swipe remains on mobile)
2. **Split item** — split a receipt line into two parts with proportional price recalculation
3. **"Paid by" (paidBy)** — link a participant to another who pays on their behalf; debt is created only for the payer

## 1. Desktop Delete Button

### Problem
Swipe-to-delete on `ReceiptItemRow` is not available on desktop. Users have no way to remove items when using a mouse.

### Solution
Add a trash/close icon button to `ReceiptItemRow`, visible on desktop (`useIsDesktop()`), hidden on mobile (swipe stays). Positioned in the top-right area of the row, next to the line total.

### Files Changed
- `ui/ReceiptItemRow.vue` — add delete icon button, conditionally visible via `useIsDesktop()`

## 2. Split Item

### Problem
A receipt line (e.g., "VIP cabin 317 min @ 1,500") needs to be split into two separate lines (180 min + 137 min) so each part can be assigned to different participants.

### Data Model

New function `splitItem(id: string, firstQty: number)` in `useReceiptWizard`:

```typescript
function splitItem(id: string, firstQty: number) {
  const idx = items.value.findIndex(i => i.id === id);
  if (idx === -1) return;
  const original = items.value[idx];
  const secondQty = original.qty - firstQty;
  if (firstQty <= 0 || secondQty <= 0) return;

  const ratio1 = firstQty / original.qty;
  const ratio2 = secondQty / original.qty;

  const item1: ReceiptItem = {
    id: uid(),
    name: `${original.name} (1/2)`,
    qty: firstQty,
    unitPrice: original.unitPrice,
    ocrTotalPrice: original.ocrTotalPrice ? Math.round(original.ocrTotalPrice * ratio1) : null,
    assignedParticipantIds: [],
  };

  const item2: ReceiptItem = {
    id: uid(),
    name: `${original.name} (2/2)`,
    qty: secondQty,
    unitPrice: original.unitPrice,
    ocrTotalPrice: original.ocrTotalPrice ? original.ocrTotalPrice - Math.round(original.ocrTotalPrice * ratio1) : null,
    assignedParticipantIds: [],
  };

  // Replace original with two parts at same index
  items.value.splice(idx, 1, item1, item2);
  trigger('success');
}
```

Note: second part's `ocrTotalPrice` is calculated as `original - first` to avoid rounding errors (total preserved exactly).

### UI

**Trigger on desktop**: Split icon button on `ReceiptItemRow` (next to delete button).

**Trigger on mobile**: Right swipe action on `SwipeableItem` (currently `undefined`, set to split action).

**Split Modal** (in `Step2EditItems.vue`):
- Title: "Разделить позицию"
- Shows item name and current qty
- Input field: "Первая часть" — user enters numeric value (e.g., 180)
- Auto-calculated: "Вторая часть" = originalQty - firstQty (e.g., 137)
- Preview of both parts' amounts (proportional calculation shown)
- "Разделить" button
- Validation: both parts > 0

### Emit Chain

`ReceiptItemRow` emits `split` → `Step2EditItems` emits `splitItem: [id: string, firstQty: number]` → `ScanReceiptPage` calls `wizard.splitItem(id, firstQty)`.

`splitItem` must be added to the `return {}` object of `useReceiptWizard`.

### Split input

The split input field uses `inputmode="decimal"` and `step="0.01"` to support fractional quantities (e.g., splitting qty=1 into 0.5 + 0.5).

### Files Changed
- `model/useReceiptWizard.ts` — add `splitItem()`, add to `return {}` object
- `ui/ReceiptItemRow.vue` — add split icon button (desktop), right swipe action (mobile), new `split` emit
- `ui/steps/Step2EditItems.vue` — add `splitItem: [id: string, firstQty: number]` emit, split modal with state management
- `pages/scan-receipt/ScanReceiptPage.vue` — add `@split-item="wizard.splitItem"` on `<Step2EditItems>`

## 3. "Paid By" (paidBy)

### Problem
When someone (e.g., Artem) pays for another person (e.g., Malika), the current system creates separate debts. The user wants Malika's share to be combined into Artem's debt.

### Data Model

Add `paidById` to `Participant`:

```typescript
export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  paidById: string | null; // ID of participant who pays for this person
}
```

Update `addParticipant`:
```typescript
function addParticipant(name: string, isMe = false, paidById: string | null = null) {
  // ... existing logic ...
  participants.value.push({
    id: uid(),
    name,
    isMe,
    color: ENTITY_COLORS[colorIndex],
    paidById,
  });
}
```

Update `participantSummaries` computed:
```typescript
// After calculating individual totals, redistribute paidBy amounts
const summaries = /* ... existing per-participant calculation ... */;

// For each participant with paidById, add their total to the payer
for (const summary of summaries) {
  const participant = participants.value.find(p => p.id === summary.id);
  if (participant?.paidById) {
    const payer = summaries.find(s => s.id === participant.paidById);
    if (payer) {
      payer.total += summary.total;
      // Mark in summary for UI display
      summary.paidByName = payer.name;
    }
  }
}
```

Update `handleSubmit` — skip debt creation for participants who have `paidById` (their share is already in the payer's total):
```typescript
const nonMeSummaries = participantSummaries.value.filter(p => {
  if (p.isMe) return false;
  if (p.total <= 0) return false;
  // Skip participants whose share is covered by someone else
  const participant = participants.value.find(pp => pp.id === p.id);
  if (participant?.paidById) return false;
  return true;
});
```

### UI

**Step 3 — Add Participant Modal**: When adding a new participant and there are already other participants present, show an optional select/dropdown: "Кто платит?" with options being existing participants (excluding those who themselves have `paidById`) + "Сам" (default, = null). Only shown when `participants.length > 1` (at least one non-self participant exists as a potential payer).

**ParticipantChip**: If participant has `paidById`, show a small label "→ Имя" below or beside the participant name.

**Step 4 — Summary**: For participants with `paidById`, show a note "Платит [Name]" and visually indicate their share is included in the payer's total. Do not show them as separate debt entries.

### ParticipantSummary type update

```typescript
export interface ParticipantSummary {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  itemCount: number;
  total: number;
  items: ParticipantSummaryItem[];
  paidByName?: string; // name of participant who pays for this one
}
```

### Files Changed
- `model/types.ts` — add `paidById` to `Participant`, `paidByName` to `ParticipantSummary`
- `model/useReceiptWizard.ts` — update `addParticipant` signature, update `removeParticipant` (clear stale `paidById` refs), update `participantSummaries`, update `handleSubmit`
- `ui/steps/Step3AssignParticipants.vue` — "Кто платит?" select in add modal
- `ui/ParticipantChip.vue` — show "→ Name" for paidBy participants
- `ui/steps/Step4Summary.vue` — "Платит X" label, combined debt display

## Edge Cases

- **Split validation**: both parts must be > 0; sum must equal original qty
- **paidBy chain**: A pays for B who pays for C — not supported, only one level deep. UI should not offer participants who themselves have a `paidById` as payer options
- **Remove payer**: if Artem is removed, Malika's `paidById` is cleared (she becomes self-paying). Implementation: update `removeParticipant` in `useReceiptWizard.ts` to clear `paidById` for all participants referencing the removed ID:
  ```typescript
  participants.value.forEach(p => {
    if (p.paidById === id) p.paidById = null;
  });
  ```
- **Remove paid-for participant**: standard removal, payer's total recalculates automatically
- **Split + paidBy interaction**: split items are independent lines, can be assigned to any participant including paidBy participants — no special handling needed
- **"Я" as paidBy target**: allowed — e.g., user pays for friend, friend's share doesn't create a debt

## Testing Plan

Manual testing:
1. Desktop: verify delete button visible, swipe hidden. Mobile: verify swipe works, button hidden
2. Split a line item, verify two new lines appear with correct names, qty, and proportional prices
3. Add participant with "Кто платит?" set to another participant
4. Verify ParticipantChip shows "→ Name"
5. Verify Step 4 summary shows combined total for payer
6. Submit and verify only one debt created for the payer (not for paid-for participant)
7. Edge: remove payer, verify paid-for participant becomes self-paying
8. Edge: split item with qty=1 into 0.5 + 0.5
