# Scan Receipt Refactoring — Design Spec

## Problem

Components in `features/scan-receipt/` are too large:
- `Step4Summary.vue` — 850 lines
- `Step3AssignParticipants.vue` — 632 lines
- `Step1PhotoCapture.vue` — 469 lines
- `Step2EditItems.vue` — 447 lines
- `useReceiptWizard.ts` — 486 lines

Goal: decompose into focused, self-contained units (each <250 lines) while keeping the external API unchanged.

## Approach

**Approach A — Section-based extraction**: extract self-contained UI sections from Step components + split wizard composable by step. Optimal balance between file size and number of new abstractions.

## Design

### 1. Wizard Composable Split

Current `useReceiptWizard.ts` (486 lines) → orchestrator + 4 step composables.

```
model/
├── useReceiptWizard.ts        (~120 lines) — step navigation + combines sub-composables, proxies return API
├── usePhotoStep.ts            (~80 lines)  — selectedFile, previewUrl, OCR loading/error/success, scanReceipt()
├── useItemsStep.ts            (~100 lines) — items[], charges[], CRUD operations
├── useParticipantsStep.ts     (~60 lines)  — participants[], add/remove/toggle, hasMe, unassignedCount
├── useSubmitStep.ts           (~120 lines) — formData, participantSummaries computed, handleSubmit, isFormValid, isSuccess
├── calcLineTotal.ts           (unchanged)
├── types.ts                   (unchanged)
└── constants.ts               (unchanged)
```

**Key constraint:** The external return API of `useReceiptWizard` stays **identical** — `ScanReceiptPage.vue` requires zero changes.

**Sub-composable signatures:**
- `usePhotoStep(goNext: () => void)` — receives `goNext` callback from orchestrator for auto-advance after OCR success (`setTimeout(() => goNext(), 600)`)
- `useItemsStep()` — owns `items` ref and `charges` ref, all CRUD. Realistically ~130 lines (items CRUD + charges CRUD + subtotal/chargesAmount/totalAmount computeds)
- `useParticipantsStep(items: Ref<ReceiptItem[]>)` — receives `items` ref from `useItemsStep` to modify `assignedParticipantIds` on removal
- `useSubmitStep(items, participants, charges, storeName)` — receives refs from other steps. `storeName` from `usePhotoStep` is needed for debt naming (`Чек: ${storeName}`). Does NOT receive `goNext` — submit terminates by setting `isSuccess = true`, not advancing steps

**Dependencies between sub-composables:**
- `useSubmitStep` receives `items`, `participants`, `charges`, `storeName` refs from other steps
- `useItemsStep` and `useParticipantsStep` share `items` ref (participants step modifies `assignedParticipantIds`)
- `usePhotoStep` receives `goNext` callback — calls it after OCR success via `setTimeout`

### 2. Step4Summary (850 → ~250 lines)

Extract 4 components:

| Component | Lines | Props |
|-----------|-------|-------|
| `SuccessOverlay.vue` | ~170 | `isSuccess, totalAmount, currency, storeName, displayDate` (pre-formatted string from parent), `owers, hasCharges, enabledCharges, isSharing, shareActions` |
| `ReceiptTotalCard.vue` | ~80 | `subtotal, charges, chargesAmount, totalAmount, currency` |
| `TransactionFormSection.vue` | ~100 | `formData, accounts`, emit `update:formData` |
| `CreateDebtsToggle.vue` | ~70 | `v-model:createDebts, debtCount, participantSummaries` |

**Remaining in Step4Summary (~250 lines):** PayerTree section (core step content), imports of 4 extracted components, sticky footer with submit button.

`SuccessOverlay` includes: fullscreen receipt card, share action buttons, "На главную" button, all staggered animations, receipt-edge CSS.

`ReceiptTotalCard` includes: skeuomorphic receipt with zigzag border, subtotal/charges/total breakdown, receipt-edge CSS.

`TransactionFormSection` includes: AccountSelector, CategoryChips, date Popover with Calendar, description input. Owns `calendarOpen` state internally (not surfaced to parent).

`CreateDebtsToggle` includes: iOS-style toggle card, debt count, info hint text.

### 3. Step3AssignParticipants (632 → ~250 lines)

Extract 2 components:

| Component | Lines | Props |
|-----------|-------|-------|
| `AddParticipantModal.vue` | ~200 | `v-model:open, participants, hasMe`, emits `addParticipant, removeParticipant`. Calls `usePeople(userId)` internally (FSD-compliant: entities/person is valid dependency from features/) |
| `ParticipantsBar.vue` | ~100 | `participants, activeParticipantId, unassignedCount`, emits `setActive, remove, assignAll, openAdd` |

**Remaining in Step3 (~250 lines):** empty state, assignment progress bar, items list with AssignableItemRow, footer warning + button.

`AddParticipantModal` encapsulates: selectedContactIds, newName, nameError, selectedPaidById, resolvePaidById logic, "Я" quick-add, contacts multi-select, manual input, paidBy selector, already-added preview. **Timing note:** `resolvePaidById()` emits `addParticipant('Я')` then immediately reads `participants` prop to find the new ID — this works because Vue emits are synchronous and the wizard mutates `participants` in-place. The `participants` prop must be reactive (not a stale copy).

`ParticipantsBar` encapsulates: horizontal scrollable chips with TransitionGroup, "Добавить" button, "Назначить все пустые" / "Убрать" action row.

### 4. Step2EditItems (447 → ~250 lines)

Extract 2 components:

| Component | Lines | Props |
|-----------|-------|-------|
| `SplitItemModal.vue` | ~90 | `v-model:open, item, currency`, emit `confirm(firstQty)` |
| `TotalFooter.vue` | ~120 | `subtotal, charges, chargesAmount, totalAmount, currency, itemCount, validationError, disabled`, emits `addCharge, removeCharge, toggleCharge, updateChargePercent, requestNext` |

**Remaining in Step2 (~250 lines):** items list with TransitionGroup, empty state, add button, validation logic (`validateAndNext` + `invalidItemId` state).

**Validation flow:** `TotalFooter` emits `requestNext` when button clicked. `Step2` intercepts, runs `validateAndNext()` which sets `validationError` + `invalidItemId`, then emits `next` to wizard only if valid. `validationError` is passed as prop to `TotalFooter` for display. `invalidItemId` stays in `Step2` to highlight the invalid `ReceiptItemRow`.

`SplitItemModal` encapsulates: splitFirstQty, splitSecondQty, splitValid, splitPreviewAmounts computed values. Imports `calcSplitAmounts` from `calcLineTotal.ts`.

`TotalFooter` encapsulates: sticky glass footer with subtotal, ChargeRow list, add-charge Popover with presets, total display, validation error, next button.

### 5. Step1PhotoCapture — No changes

Step1 (469 lines) stays as-is. The idle/preview states are two facets of one cohesive screen. Extracting would create artificial boundaries.

## File Structure After Refactoring

```
features/scan-receipt/
├── api/receiptApi.ts
├── index.ts
├── model/
│   ├── calcLineTotal.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── useReceiptWizard.ts       (orchestrator, ~120 lines)
│   ├── usePhotoStep.ts           (NEW, ~80 lines)
│   ├── useItemsStep.ts           (NEW, ~130 lines)
│   ├── useParticipantsStep.ts    (NEW, ~60 lines)
│   ├── useSubmitStep.ts          (NEW, ~120 lines)
│   └── useReceiptShare.ts
└── ui/
    ├── steps/
    │   ├── Step1PhotoCapture.vue   (unchanged, 469 lines)
    │   ├── Step2EditItems.vue      (refactored, ~250 lines)
    │   ├── Step3AssignParticipants.vue (refactored, ~250 lines)
    │   └── Step4Summary.vue        (refactored, ~250 lines)
    ├── AddParticipantModal.vue     (NEW, ~200 lines)
    ├── AssignableItemRow.vue       (unchanged)
    ├── ChargeRow.vue               (unchanged)
    ├── CreateDebtsToggle.vue       (NEW, ~70 lines)
    ├── ParticipantChip.vue         (unchanged)
    ├── ParticipantsBar.vue         (NEW, ~100 lines)
    ├── ReceiptItemRow.vue          (unchanged)
    ├── ReceiptTotalCard.vue        (NEW, ~80 lines)
    ├── SplitItemModal.vue          (NEW, ~90 lines)
    ├── StepProgressIndicator.vue   (unchanged)
    ├── SuccessOverlay.vue          (NEW, ~170 lines)
    ├── TotalFooter.vue             (NEW, ~120 lines)
    ├── TransactionFormSection.vue  (NEW, ~100 lines)
    └── transitions.css             (unchanged)
```

**New files:** 12 (8 components + 4 composables)
**Modified files:** 4 (Step2, Step3, Step4, useReceiptWizard)
**Unchanged files:** 11

## Constraints

- `ScanReceiptPage.vue` requires **zero changes** — wizard external API unchanged
- No changes to types, constants, calcLineTotal, or API layer
- All extracted components stay within `features/scan-receipt/` (FSD compliant)
- No new shared abstractions — all extractions are feature-local
