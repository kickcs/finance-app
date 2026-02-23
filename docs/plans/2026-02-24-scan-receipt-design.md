# Scan Receipt & Split by Items — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Type:** Premium Feature

## Problem

Users want to split restaurant/cafe bills by individual items rather than just dividing the total equally. Currently, split-expense only supports equal/custom division of the total amount.

## Solution

A wizard-style page that lets users photograph a receipt, OCR-parse individual items via GPT-4o Vision, assign items to participants, and automatically create a transaction + debts.

## User Flow

```
[Photo] → [Edit Items] → [Assign People] → [Summary + Create]
```

### Step 1: Photo Capture
- Two options: camera capture or gallery selection (via `<input type="file" accept="image/*">`)
- Show image preview after selection
- Loading state: "Распознаём чек..." with spinner
- Error handling: retry button if OCR fails

### Step 2: Edit Items
- List of recognized items: name, quantity, unit price, total price
- User can edit any field (fix OCR errors), delete items, add items manually
- Bottom: total amount (auto-calculated from items)
- Validation: total must be > 0, at least 1 item

### Step 3: Assign Participants
- Top section: participant list with "add by name" input
- "Я" (current user) added by default, toggleable
- Item list below: tap item → participant chips appear → tap chip to toggle assignment
- Each participant has a distinct color (from ENTITY_COLORS)
- One item can be shared by multiple people (cost split equally among assignees)
- Unassigned items highlighted with warning

### Step 4: Summary & Create
- Per-participant breakdown: name → list of their items → total amount owed
- Account selector + category selector (defaults: user's default account, "Еда" category)
- Description field (pre-filled with store name from receipt)
- Date picker (pre-filled from receipt date)
- "Создать" button → creates transaction + debts for each participant

## Technical Architecture

### Backend

**New module: `receipt`** (`backend/src/modules/receipt/`)

Stateless — no database tables needed.

**Endpoint:**
- `POST /api/receipts/scan` — JWT + PremiumGuard
  - Input: `multipart/form-data` with `image` field (max 10MB)
  - Processing: sends image to OpenAI GPT-4o Vision with structured prompt
  - Output:
    ```json
    {
      "items": [
        { "name": "Капучино", "quantity": 2, "unitPrice": 35000, "totalPrice": 70000 }
      ],
      "totalAmount": 115000,
      "currency": "UZS",
      "date": "2026-02-24",
      "storeName": "Costa Coffee"
    }
    ```

**Dependencies:**
- `openai` npm package
- `OPENAI_API_KEY` env variable
- Multer for file upload handling

**GPT-4o Vision Prompt Strategy:**
- System prompt instructs to extract line items from receipt image
- Structured output (JSON mode) for reliable parsing
- Handle various receipt formats (Uzbek, Russian, English)

### Frontend

**New feature: `scan-receipt`** (`frontend/src/features/scan-receipt/`)

```
scan-receipt/
  api/
    receiptApi.ts          # POST /api/receipts/scan
  model/
    types.ts               # ReceiptItem, Participant, Assignment, ScanResult
    useScanReceipt.ts      # Wizard state management composable
    useItemAssignment.ts   # Item-to-participant assignment logic
  ui/
    ScanReceiptPage.vue    # Main wizard container
    PhotoStep.vue          # Step 1: camera/gallery capture
    ItemsStep.vue          # Step 2: edit recognized items
    AssignStep.vue         # Step 3: assign items to people
    SummaryStep.vue        # Step 4: review and create
    ReceiptItemRow.vue     # Editable item row component
    ParticipantChip.vue    # Colored participant chip
```

**Route:** `/scan-receipt` (auth required)

**Types:**
```ts
interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Participant {
  id: string
  name: string
  color: string
  isMe: boolean
}

interface ItemAssignment {
  itemId: string
  participantIds: string[]
}

interface ScanResult {
  items: ReceiptItem[]
  totalAmount: number
  currency: string
  date: string
  storeName: string | null
}
```

**Integration with existing code:**
- `transactionsApi.create()` — create expense transaction for total amount
- `debtsApi.create()` — create "given" debt per participant (same as split-expense flow)
- `requirePremium('Сканирование чека')` — gate at page entry
- `invalidateTransactionRelated()` + `invalidateAccountRelated()` — cache invalidation

### Entry Points
- Button on dashboard or BottomNav "+" menu
- Can also be accessed from add-transaction page

## Premium Gating

- Backend: `@UseGuards(PremiumGuard)` on `/api/receipts/scan`
- Frontend: `requirePremium()` check on page mount
- Add to `PREMIUM_FEATURES` constant

## Edge Cases

- **Poor photo quality:** Show error with "Попробуйте сфотографировать ещё раз"
- **Unrecognized items:** Allow full manual editing
- **Currency detection:** Default to user's account currency if OCR can't determine
- **No participants assigned to item:** Warn but don't block (assume "Я" pays)
- **Single participant:** Skip assignment step, create transaction without debts
- **Service charge / tips on receipt:** Recognized as separate line item, assignable like any other
