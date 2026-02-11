# Finance App API Documentation

Base URL: `http://localhost:3000/api`

## Authentication

All endpoints (except those marked as public) require JWT token in header:
```
Authorization: Bearer <access_token>
```

Refresh tokens stored in httpOnly cookie `refresh_token`.

---

## Identity Module

### Auth (`/api/auth`)

#### POST `/auth/register` (Public)
Register new user.

**Request:**
```json
{
  "email": "string",
  "password": "string (min 6)",
  "name": "string (optional)"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string | null",
    "currency": "string",
    "hasCompletedOnboarding": "boolean",
    "defaultAccountId": "uuid | null",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

#### POST `/auth/login` (Public)
Login with credentials.

**Request:**
```json
{
  "email": "string",
  "password": "string (min 6)"
}
```

**Response:** Same as register

#### POST `/auth/login/anonymous` (Public, Rate Limited: 5/min)
Create anonymous session.

**Request:** Empty body

**Response:** Same as register

#### POST `/auth/refresh` (Public)
Refresh access token using cookie.

**Request:** None (uses `refresh_token` cookie)

**Response:**
```json
{
  "accessToken": "string"
}
```

#### POST `/auth/logout`
Logout and clear refresh token.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### GET `/auth/me`
Get current user with anonymous status.

**Response:**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string | null",
  "currency": "string",
  "hasCompletedOnboarding": "boolean",
  "defaultAccountId": "uuid | null",
  "isAnonymous": "boolean",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

---

### Profiles (`/api/profiles`)

#### GET `/profiles/me`
Get current user profile.

**Response:** `ProfileResponse`

#### POST `/profiles/get-or-create`
Get or create profile for authenticated user.

**Response:** `ProfileResponse`

#### PATCH `/profiles/me`
Update current user profile.

**Request:**
```json
{
  "name": "string (optional)",
  "currency": "string (optional)",
  "hasCompletedOnboarding": "boolean (optional)",
  "defaultAccountId": "uuid | null (optional)"
}
```

**Response:** `ProfileResponse`

---

## Accounting Module

### Accounts (`/api/accounts`)

#### GET `/accounts`
Get all user accounts.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "icon": "string",
    "color": "string",
    "type": "basic | savings",
    "order": "number",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
]
```

#### GET `/accounts/:id`
Get account by ID.

**Response:** `AccountResponse`

#### GET `/accounts/:id/with-balances`
Get account with all currency balances.

**Response:** `AccountResponse` with balances array

#### POST `/accounts`
Create new account.

**Request:**
```json
{
  "name": "string",
  "icon": "string",
  "color": "string",
  "type": "basic | savings (default: basic)",
  "order": "number (optional)",
  "balances": [
    {
      "currency": "string",
      "balance": "number"
    }
  ]
}
```

**Response:** `AccountResponse`

#### PATCH `/accounts/:id`
Update account.

**Request:**
```json
{
  "name": "string (optional)",
  "icon": "string (optional)",
  "color": "string (optional)",
  "type": "basic | savings (optional)",
  "order": "number (optional)"
}
```

**Response:** `AccountResponse`

#### DELETE `/accounts/:id`
Delete account.

**Response:** 204 No Content

#### POST `/accounts/reorder`
Reorder accounts.

**Request:**
```json
{
  "accountIds": ["uuid", "uuid", "..."]
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Transactions (`/api/transactions`)

#### GET `/transactions`
Get paginated transactions.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| pageSize | number | Items per page |
| cursorDate | string | Cursor date for pagination |
| cursorCreatedAt | string | Cursor createdAt for pagination |
| type | income/expense/transfer/debt | Filter by type |
| accountId | uuid | Filter by account |
| categoryId | string | Filter by category |
| search | string | Search in description |

**Response:**
```json
{
  "data": [TransactionResponse],
  "nextCursor": {
    "date": "ISO date",
    "createdAt": "ISO date"
  } | null,
  "hasMore": "boolean"
}
```

#### GET `/transactions/:id`
Get transaction by ID.

**Response:**
```json
{
  "id": "uuid",
  "accountId": "uuid",
  "categoryId": "string",
  "amount": "number",
  "currency": "string",
  "type": "income | expense | transfer",
  "description": "string | null",
  "date": "ISO date",
  "isDebtRelated": "boolean",
  "toAccountId": "uuid | null",
  "toAmount": "number | null",
  "toCurrency": "string | null",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

#### POST `/transactions`
Create transaction.

**Request:**
```json
{
  "accountId": "uuid",
  "categoryId": "string",
  "amount": "number (positive)",
  "currency": "string",
  "type": "income | expense | transfer",
  "description": "string (optional)",
  "date": "ISO date",
  "isDebtRelated": "boolean (optional)",
  "toAccountId": "uuid (required for transfer)",
  "toAmount": "number (optional for transfer)",
  "toCurrency": "string (optional for transfer)"
}
```

**Response:** `TransactionResponse`

#### PATCH `/transactions/:id`
Update transaction.

**Request:** All fields optional

**Response:** `TransactionResponse`

#### DELETE `/transactions/:id`
Delete transaction.

**Response:** 204 No Content

#### GET `/transactions/stats/monthly`
Get monthly statistics.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| year | number | Yes |
| month | number | Yes |

**Response:**
```json
{
  "totalIncome": "number",
  "totalExpense": "number",
  "balance": "number"
}
```

#### GET `/transactions/stats/analytics`
Get analytics for date range.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| startDate | ISO date | Yes |
| endDate | ISO date | Yes |
| accountIds | string[] | No |

**Response:** Analytics data object

#### GET `/transactions/by-date-range`
Get transactions in date range.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| startDate | ISO date | Yes |
| endDate | ISO date | Yes |

**Response:** `TransactionResponse[]`

#### GET `/transactions/by-account/:accountId`
Get all transactions for account.

**Response:** `TransactionResponse[]`

#### GET `/transactions/by-account/:accountId/with-incoming`
Get transactions including incoming transfers.

**Response:** `TransactionResponse[]`

#### GET `/transactions/by-account/:accountId/paginated`
Get paginated transactions for account.

**Query Parameters:**
| Param | Type |
|-------|------|
| pageSize | number |
| cursorDate | string |
| cursorCreatedAt | string |

**Response:** Paginated response

---

### Categories (`/api/categories`)

#### GET `/categories`
Get all categories.

**Query Parameters:**
| Param | Type |
|-------|------|
| type | income/expense (optional) |

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "icon": "string",
    "color": "string",
    "type": "income | expense",
    "sortOrder": "number",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
]
```

#### POST `/categories`
Create category.

**Request:**
```json
{
  "name": "string",
  "icon": "string",
  "color": "string",
  "type": "income | expense",
  "sortOrder": "number (optional)"
}
```

**Response:** `CategoryResponse`

#### POST `/categories/initialize-defaults`
Initialize default categories for user.

**Response:** `CategoryResponse[]`

#### PATCH `/categories/:id`
Update category.

**Request:** All fields optional

**Response:** `CategoryResponse`

#### DELETE `/categories/:id`
Delete category.

**Response:** 204 No Content

#### POST `/categories/reorder`
Reorder categories.

**Request:**
```json
{
  "categoryIds": ["string", "string", "..."]
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Account Balances (`/api/account-balances`)

#### GET `/account-balances/by-account/:accountId`
Get all balances for account.

**Response:**
```json
[
  {
    "accountId": "uuid",
    "currency": "string",
    "balance": "number"
  }
]
```

#### POST `/account-balances/by-accounts`
Get balances for multiple accounts.

**Request:**
```json
{
  "accountIds": ["uuid", "uuid"]
}
```

**Response:** `BalanceResponse[][]`

#### POST `/account-balances/upsert`
Create or update balance.

**Request:**
```json
{
  "accountId": "uuid",
  "currency": "string",
  "balance": "number"
}
```

**Response:** `BalanceResponse`

#### POST `/account-balances/create-many`
Create multiple balances for account.

**Request:**
```json
{
  "accountId": "uuid",
  "balances": [
    {
      "currency": "string",
      "balance": "number"
    }
  ]
}
```

**Response:** `BalanceResponse[]`

#### POST `/account-balances/update-by-delta`
Update balance by delta amount.

**Request:**
```json
{
  "accountId": "uuid",
  "currency": "string",
  "delta": "number"
}
```

**Response:** `BalanceResponse`

#### DELETE `/account-balances/:accountId/:currency`
Delete specific balance.

**Response:** 204 No Content

#### DELETE `/account-balances/by-account/:accountId`
Delete all balances for account.

**Response:** 204 No Content

---

## Debt Module

### Debts (`/api/debts`)

#### GET `/debts`
Get all debts.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "totalAmount": "number",
    "remainingAmount": "number",
    "debtType": "given | taken",
    "monthlyPayment": "number | null",
    "nextPaymentDate": "ISO date | null",
    "personName": "string | null",
    "accountId": "uuid | null",
    "isClosed": "boolean",
    "currency": "string",
    "transactionId": "uuid | null",
    "sourceTransactionId": "uuid | null",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
]
```

#### GET `/debts/:id`
Get debt by ID.

**Response:** `DebtResponse`

#### POST `/debts`
Create debt.

**Request:**
```json
{
  "name": "string",
  "totalAmount": "number",
  "remainingAmount": "number",
  "debtType": "given | taken",
  "monthlyPayment": "number (optional)",
  "nextPaymentDate": "ISO date (optional)",
  "personName": "string (optional)",
  "accountId": "uuid (optional)",
  "isClosed": "boolean (optional)",
  "currency": "string (optional)",
  "transactionId": "uuid (optional)",
  "sourceTransactionId": "uuid (optional)"
}
```

**Response:** `DebtResponse`

#### PATCH `/debts/:id`
Update debt.

**Request:** All fields optional, nullable fields can be set to null

**Response:** `DebtResponse`

#### DELETE `/debts/:id`
Delete debt.

**Response:** 204 No Content

---

## Planning Module

### Goals (`/api/goals`)

#### GET `/goals`
Get all goals.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "targetAmount": "number",
    "currentAmount": "number",
    "icon": "string",
    "color": "string",
    "deadline": "ISO date | null",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
]
```

#### GET `/goals/:id`
Get goal by ID.

**Response:** `GoalResponse`

#### POST `/goals`
Create goal.

**Request:**
```json
{
  "name": "string",
  "targetAmount": "number (min 0)",
  "icon": "string",
  "color": "string",
  "deadline": "ISO date (optional)",
  "currentAmount": "number (optional, default 0)"
}
```

**Response:** `GoalResponse`

#### PATCH `/goals/:id`
Update goal.

**Request:** All fields optional, deadline can be null

**Response:** `GoalResponse`

#### DELETE `/goals/:id`
Delete goal.

**Response:** 204 No Content

---

### Reminders (`/api/reminders`)

#### GET `/reminders`
Get all reminders.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "amount": "number",
    "frequency": "weekly | monthly | yearly | once",
    "nextDate": "ISO date",
    "icon": "string",
    "color": "string",
    "isActive": "boolean",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
]
```

#### GET `/reminders/:id`
Get reminder by ID.

**Response:** `ReminderResponse`

#### POST `/reminders`
Create reminder.

**Request:**
```json
{
  "name": "string",
  "amount": "number (min 0)",
  "frequency": "weekly | monthly | yearly | once",
  "nextDate": "ISO date",
  "icon": "string",
  "color": "string"
}
```

**Response:** `ReminderResponse`

#### PATCH `/reminders/:id`
Update reminder.

**Request:** All fields optional, includes `isActive: boolean`

**Response:** `ReminderResponse`

#### DELETE `/reminders/:id`
Delete reminder.

**Response:** 204 No Content

---

## Exchange Module

### Exchange Rates (`/api/exchange-rates`)

#### GET `/exchange-rates/:baseCurrency/:targetCurrency`
Get exchange rate between currencies.

**Response:**
```json
{
  "rate": "number",
  "baseCurrency": "string",
  "targetCurrency": "string"
}
```

#### POST `/exchange-rates`
Create or update exchange rate.

**Request:**
```json
{
  "baseCurrency": "string (3-char ISO)",
  "targetCurrency": "string (3-char ISO)",
  "rate": "number (positive)"
}
```

**Response:** Exchange rate record

#### GET `/exchange-rates/convert`
Convert amount between currencies.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| amount | number | Yes |
| from | string (3-char ISO) | Yes |
| to | string (3-char ISO) | Yes |

**Response:**
```json
{
  "amount": "number",
  "fromCurrency": "string",
  "toCurrency": "string",
  "convertedAmount": "number"
}
```

#### POST `/exchange-rates/convert`
Convert amount (POST version).

**Request:**
```json
{
  "amount": "number",
  "fromCurrency": "string (3-char ISO)",
  "toCurrency": "string (3-char ISO)"
}
```

**Response:** Same as GET

---

## Health Check

### GET `/api/health`
Check API health status.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": "number",
  "message": "string | string[]",
  "error": "string"
}
```

Common status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
