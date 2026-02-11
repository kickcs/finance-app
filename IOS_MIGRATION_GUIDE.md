# Руководство по миграции Vue 3 → iOS SwiftUI

> **Референс:** Папка `frontend/` содержит исходный Vue 3 код для справки

## Обзор проекта

**Исходный стек:** Vue 3 + TypeScript + TanStack Query + Tailwind CSS + Reka UI
**Целевой стек:** iOS 17+ / SwiftUI
**Дистрибуция:** TestFlight (бета-тестирование)

**Приложение:** Личные финансы с multi-currency поддержкой, долгами, напоминаниями и аналитикой

---

## 1. Архитектура iOS проекта

### Структура папок (Clean Architecture + MVVM)

```
OuroFinance/
├── App/                          # Entry point
│   ├── OuroFinanceApp.swift
│   └── AppDelegate.swift
│
├── Core/                         # Utilities
│   ├── DI/DependencyContainer.swift
│   ├── Extensions/
│   └── Utils/
│
├── Domain/                       # Business logic (чистый Swift)
│   ├── Entities/                 # Account, Transaction, Debt, etc.
│   ├── Repositories/             # Protocols
│   └── UseCases/                 # Business operations
│
├── Data/                         # API layer (аналог entities/*/api/)
│   ├── Network/
│   │   ├── HTTPClient.swift      # JWT auth, refresh logic
│   │   ├── APIEndpoints.swift
│   │   └── RequestInterceptor.swift
│   ├── DTOs/                     # Response types (camelCase)
│   ├── Mappers/                  # DTO → Domain
│   ├── Repositories/             # Implementations
│   └── Cache/CacheManager.swift  # Аналог TanStack Query
│
├── Presentation/
│   ├── DesignSystem/
│   │   ├── Theme/                # Colors, Typography
│   │   ├── Components/           # OButton, OCard, OIcon, etc.
│   │   └── Modifiers/
│   ├── Features/                 # CreateAccount, AddTransaction, etc.
│   ├── Screens/                  # Dashboard, History, Analytics, etc.
│   ├── Navigation/               # TabBar, Router
│   └── Shared/                   # LoadingView, ErrorView
│
└── Resources/
    ├── Assets.xcassets/
    └── Localizable.strings
```

---

## 2. Маппинг компонентов

| Vue/FSD Layer | iOS/SwiftUI | Файлы для портирования |
|---------------|-------------|------------------------|
| `shared/api/http.ts` | `Data/Network/HTTPClient.swift` | JWT auth, refresh tokens |
| `shared/api/composables/useAuth.ts` | `Data/Network/AuthManager.swift` | Auth state |
| `entities/*/api/` | `Data/Repositories/` | API calls + cache |
| `entities/*/model/types.ts` | `Domain/Entities/` | Data models |
| `features/*/` | `Presentation/Features/` | UI + ViewModels |
| `pages/*/` | `Presentation/Screens/` | Full screens |
| `widgets/*/` | `Presentation/Screens/Components/` | Reusable sections |
| `shared/ui/` | `Presentation/DesignSystem/Components/` | UI primitives |

---

## 3. Entities для портирования (8)

| Entity | Ключевые поля | API endpoints |
|--------|---------------|---------------|
| **Account** | id, name, icon, color, type, balances[] | GET/POST/PATCH/DELETE /accounts |
| **Transaction** | amount, type, category_id, date, cursor pagination | GET/POST/PATCH/DELETE /transactions |
| **Category** | name, icon, color, type (income/expense) | GET/POST/PATCH/DELETE /categories |
| **Debt** | total_amount, remaining_amount, debt_type (given/taken) | GET/POST/PATCH/DELETE /debts |
| **Reminder** | amount, frequency, next_date, is_active | GET/POST/PATCH/DELETE /reminders |
| **Goal** | target_amount, current_amount, deadline | GET/POST/PATCH/DELETE /goals |
| **AccountBalance** | account_id, currency, balance | Multi-currency support |
| **Currency** | exchange rates, conversion | GET /exchange-rates |

---

## 4. Features для портирования (19)

**Core (высокий приоритет):**
- create-account, add-transaction, edit-account, edit-transaction

**Debts:**
- create-debt, close-debt, partial-payment

**Reminders:**
- create-reminder, edit-reminder

**Settings:**
- manage-categories, select-currency, toggle-theme, edit-profile

**Utilities:**
- search-transactions, analytics-filters, demo-mode

---

## 5. Screens (Pages) для портирования (11)

**Tab screens (4):**
- Dashboard (`/`)
- History (`/history`)
- Analytics (`/analytics`)
- Profile (`/profile`)

**Detail screens:**
- AccountsListView, AccountDetailView
- DebtsListView, DebtDetailView
- RemindersListView, ReminderDetailView

**Settings:**
- CurrencySettingsView, CategoriesView

**Auth:**
- LoginView, OnboardingView, FirstAccountView

---

## 6. Design System

### Цветовая палитра

```swift
// Primary - Deep Indigo
static let primary = Color(hex: "#4F46E5")
static let primaryHover = Color(hex: "#6366F1")

// Semantic
static let success = Color(hex: "#059669")
static let danger = Color(hex: "#E11D48")
static let warning = Color(hex: "#D97706")

// Background (Light / Dark)
Light: #FAFAFA / Card: #FFFFFF
Dark: #09090B / Card: #18181B
```

### SF Symbols маппинг (Material → SF)

| Material | SF Symbol |
|----------|-----------|
| home | house.fill |
| pie_chart | chart.pie.fill |
| history | clock.arrow.circlepath |
| wallet | creditcard.fill |
| add | plus |
| edit | pencil |
| delete | trash |

### Компоненты

| Vue | SwiftUI |
|-----|---------|
| UButton | OButton (variants: primary, secondary, ghost, danger) |
| UCard | OCard (ViewModifier) |
| UIcon | OIcon (SF Symbols wrapper) |
| UInput | OTextField |
| UModal | .sheet() / .fullScreenCover() |
| BottomNav | Custom TabBarView с FAB |

---

## 7. Networking Layer

### HTTPClient (аналог http.ts)

```swift
actor HTTPClient {
    func get<T: Decodable>(_ endpoint: String) async throws -> T
    func post<T: Decodable>(_ endpoint: String, body: Encodable?) async throws -> T
    func patch<T: Decodable>(_ endpoint: String, body: Encodable?) async throws -> T
    func delete(_ endpoint: String) async throws

    // JWT refresh on 401
    private func refreshToken() async -> Bool
}
```

### CacheManager (аналог TanStack Query)

```swift
actor CacheManager {
    // staleTime: 5 min, gcTime: 30 min
    func get<T>(_ key: QueryKey) -> T?
    func set<T>(_ data: T, for key: QueryKey)
    func invalidate(_ key: QueryKey)
    func invalidateAll(matching prefix: [String])
}
```

### Cursor Pagination

```swift
struct PaginatedResponse<T: Decodable> {
    let data: [T]
    let nextCursor: Cursor?  // { date, createdAt }
    let hasMore: Bool
}
```

---

## 8. Фазы разработки

### Phase 1: Foundation
- Xcode project setup (iOS 17+)
- HTTPClient + KeychainManager (JWT tokens)
- AuthManager + LoginView
- Domain entities
- Базовый CacheManager

**Результат:** Работающий auth flow

### Phase 2: Core Features
- Design System (OButton, OCard, OIcon, etc.)
- Accounts feature (list, detail, create)
- Transactions feature (add, list with pagination)
- Dashboard с BalanceCard, AccountStack
- TabBarView navigation

**Результат:** Рабочий Dashboard с accounts/transactions

### Phase 3: Secondary Features
- Debts feature (list, detail, create, payments)
- Reminders feature (list, detail, create)
- Categories management
- History с search и filters
- Local notifications

**Результат:** Полный функционал debts/reminders

### Phase 4: Analytics & Polish
- Analytics с Swift Charts
- Profile settings
- Theme toggle (dark mode)
- Demo mode
- Animations, haptics, polish

**Результат:** Полнофункциональное приложение

### Phase 5: Production Ready
- Unit tests (Use Cases)
- UI tests (critical flows)
- Performance optimization
- App Store assets
- Firebase Crashlytics

**Результат:** Ready for App Store

---

## 9. Ключевые файлы для справки

При реализации использовать как reference:

1. **`frontend/src/shared/api/http.ts`** — JWT refresh logic
2. **`frontend/src/shared/api/database.types.ts`** — Все типы данных
3. **`frontend/src/entities/transaction/api/transactionsApi.ts`** — Cursor pagination
4. **`frontend/src/app/styles/index.css`** — Design tokens
5. **`frontend/src/pages/dashboard/DashboardPage.vue`** — Композиция виджетов
6. **`frontend/src/widgets/bottom-nav/ui/BottomNav.vue`** — Tab navigation

---

## 10. Детальные примеры кода

### 10.1 HTTPClient.swift (полная реализация)

Референс: `frontend/src/shared/api/http.ts`

```swift
import Foundation

// MARK: - Network Errors
enum NetworkError: LocalizedError {
    case invalidURL
    case unauthorized
    case serverError(Int)
    case decodingError
    case noData
    case tokenRefreshFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .unauthorized: return "Unauthorized"
        case .serverError(let code): return "Server error: \(code)"
        case .decodingError: return "Failed to decode response"
        case .noData: return "No data received"
        case .tokenRefreshFailed: return "Failed to refresh token"
        }
    }
}

// MARK: - HTTP Client
actor HTTPClient {
    static let shared = HTTPClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // Token refresh state
    private var isRefreshing = false
    private var refreshContinuations: [CheckedContinuation<Bool, Never>] = []

    private init() {
        // Из frontend/.env: VITE_API_URL
        self.baseURL = URL(string: "https://your-api.com/api")!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Public Methods

    func get<T: Decodable>(_ endpoint: String, params: [String: Any]? = nil) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, method: "GET", params: params)
        return try await execute(request)
    }

    func post<T: Decodable>(_ endpoint: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "POST")
        if let body = body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return try await execute(request)
    }

    func patch<T: Decodable>(_ endpoint: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PATCH")
        if let body = body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return try await execute(request)
    }

    func delete(_ endpoint: String) async throws {
        let request = try buildRequest(endpoint: endpoint, method: "DELETE")
        let _: EmptyResponse = try await execute(request)
    }

    // MARK: - Token Management

    var accessToken: String? {
        get { KeychainManager.shared.getString(forKey: .accessToken) }
        set {
            if let token = newValue {
                KeychainManager.shared.set(token, forKey: .accessToken)
            } else {
                KeychainManager.shared.delete(forKey: .accessToken)
            }
        }
    }

    var refreshToken: String? {
        get { KeychainManager.shared.getString(forKey: .refreshToken) }
        set {
            if let token = newValue {
                KeychainManager.shared.set(token, forKey: .refreshToken)
            } else {
                KeychainManager.shared.delete(forKey: .refreshToken)
            }
        }
    }

    func clearTokens() {
        accessToken = nil
        refreshToken = nil
    }

    // MARK: - Private Methods

    private func buildRequest(
        endpoint: String,
        method: String,
        params: [String: Any]? = nil
    ) throws -> URLRequest {
        var urlComponents = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: true)

        if let params = params {
            urlComponents?.queryItems = params.map {
                URLQueryItem(name: $0.key, value: "\($0.value)")
            }
        }

        guard let url = urlComponents?.url else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add auth header (как в http.ts)
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.noData
        }

        // Handle 401 - token refresh (как в http.ts refreshTokens)
        if httpResponse.statusCode == 401 {
            let refreshed = await refreshAccessToken()
            if refreshed {
                // Retry request with new token
                var newRequest = request
                if let token = accessToken {
                    newRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                return try await execute(newRequest)
            } else {
                throw NetworkError.unauthorized
            }
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.serverError(httpResponse.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            print("Decoding error: \(error)")
            throw NetworkError.decodingError
        }
    }

    // Аналог refreshTokens() из http.ts
    private func refreshAccessToken() async -> Bool {
        // Debounce concurrent refresh requests
        guard !isRefreshing else {
            return await withCheckedContinuation { continuation in
                refreshContinuations.append(continuation)
            }
        }

        isRefreshing = true
        defer {
            isRefreshing = false
            refreshContinuations.forEach { $0.resume(returning: accessToken != nil) }
            refreshContinuations.removeAll()
        }

        guard let refreshToken = refreshToken else {
            return false
        }

        do {
            var request = URLRequest(url: baseURL.appendingPathComponent("/auth/refresh"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(["refreshToken": refreshToken])

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                clearTokens()
                return false
            }

            let tokenResponse = try decoder.decode(TokenResponse.self, from: data)
            accessToken = tokenResponse.accessToken
            self.refreshToken = tokenResponse.refreshToken

            return true
        } catch {
            clearTokens()
            return false
        }
    }
}

// MARK: - Helper Types

struct EmptyResponse: Decodable {}

struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init<T: Encodable>(_ wrapped: T) {
        encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}
```

### 10.2 KeychainManager.swift

```swift
import Foundation
import Security

class KeychainManager {
    static let shared = KeychainManager()

    private let service = "com.yourapp.finance"

    enum Key: String {
        case accessToken
        case refreshToken
    }

    func set(_ value: String, forKey key: Key) {
        let data = Data(value.utf8)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]

        SecItemDelete(query as CFDictionary)

        var newQuery = query
        newQuery[kSecValueData as String] = data

        SecItemAdd(newQuery as CFDictionary, nil)
    }

    func getString(forKey key: Key) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
        ]

        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)

        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(forKey key: Key) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]

        SecItemDelete(query as CFDictionary)
    }
}
```

### 10.3 Domain Entities

Референс: `frontend/src/shared/api/database.types.ts`

```swift
// Domain/Entities/Account.swift
import Foundation

struct Account: Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let icon: String
    let color: String
    let type: AccountType
    let order: Int
    let createdAt: Date
    var balances: [AccountBalance]

    var totalBalance: Decimal {
        balances.reduce(0) { $0 + $1.balance }
    }
}

enum AccountType: String, Codable, CaseIterable {
    case basic
    case savings
}

// Domain/Entities/AccountBalance.swift
struct AccountBalance: Identifiable, Equatable {
    let id: String
    let accountId: String
    let currency: String
    let balance: Decimal
    let createdAt: Date
}

// Domain/Entities/Transaction.swift
struct Transaction: Identifiable, Equatable {
    let id: String
    let userId: String
    let accountId: String
    let categoryId: String
    let amount: Decimal
    let currency: String
    let type: TransactionType
    let description: String?
    let date: Date
    let createdAt: Date

    // Debt-related
    let isDebtRelated: Bool
    let toAccountId: String?
    let toAmount: Decimal?
    let toCurrency: String?
    let returnedAmount: Decimal
    let netAmount: Decimal
    let hasDebtReturns: Bool
}

enum TransactionType: String, Codable, CaseIterable {
    case income
    case expense
    case transfer
}

// Domain/Entities/Category.swift
struct Category: Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let icon: String
    let color: String
    let type: CategoryType
    let sortOrder: Int
    let createdAt: Date
}

enum CategoryType: String, Codable, CaseIterable {
    case expense
    case income
}

// Domain/Entities/Debt.swift
struct Debt: Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let totalAmount: Decimal
    let remainingAmount: Decimal
    let monthlyPayment: Decimal?
    let nextPaymentDate: Date?
    let debtType: DebtType
    let personName: String?
    let accountId: String?
    let isClosed: Bool
    let currency: String
    let createdAt: Date

    var progress: Double {
        guard totalAmount > 0 else { return 0 }
        return Double(truncating: (totalAmount - remainingAmount) / totalAmount as NSNumber)
    }
}

enum DebtType: String, Codable, CaseIterable {
    case given  // Я дал в долг
    case taken  // Я взял в долг
}

// Domain/Entities/Reminder.swift
struct Reminder: Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let amount: Decimal
    let frequency: ReminderFrequency
    let nextDate: Date
    let icon: String
    let color: String
    let isActive: Bool
    let createdAt: Date
}

enum ReminderFrequency: String, Codable, CaseIterable {
    case weekly
    case monthly
    case yearly
    case once
}

// Domain/Entities/Goal.swift
struct Goal: Identifiable, Equatable {
    let id: String
    let userId: String
    let name: String
    let targetAmount: Decimal
    let currentAmount: Decimal
    let deadline: Date?
    let icon: String
    let color: String
    let createdAt: Date

    var progress: Double {
        guard targetAmount > 0 else { return 0 }
        return Double(truncating: currentAmount / targetAmount as NSNumber)
    }
}

// Domain/Entities/User.swift
struct User: Identifiable, Equatable {
    let id: String
    let name: String?
    let email: String?
    let currency: String
    let hasCompletedOnboarding: Bool
    let defaultAccountId: String?
    let isDemo: Bool
    let demoExpiresAt: Date?
    let createdAt: Date
}
```

### 10.4 AuthManager.swift

Референс: `frontend/src/shared/api/composables/useAuth.ts`

```swift
import Foundation
import Combine

@MainActor
@Observable
class AuthManager {
    static let shared = AuthManager()

    private(set) var user: User?
    private(set) var isLoading = true
    private(set) var isInitialized = false
    private(set) var error: Error?

    var isAuthenticated: Bool { user != nil }
    var isAnonymous: Bool { user?.isDemo == true }

    private init() {}

    // Аналог initializeAuth()
    func initialize() async {
        guard !isInitialized else { return }

        isLoading = true
        defer {
            isLoading = false
            isInitialized = true
        }

        guard let token = await HTTPClient.shared.accessToken,
              !isTokenExpired(token) else {
            return
        }

        do {
            let response: UserResponse = try await HTTPClient.shared.get("/auth/me")
            user = UserMapper.toDomain(response)
        } catch {
            await HTTPClient.shared.clearTokens()
            self.error = error
        }
    }

    func signIn(email: String, password: String) async throws {
        isLoading = true
        defer { isLoading = false }

        let body = SignInRequest(email: email, password: password)
        let response: AuthResponse = try await HTTPClient.shared.post("/auth/login", body: body)

        await HTTPClient.shared.accessToken = response.accessToken
        await HTTPClient.shared.refreshToken = response.refreshToken
        user = UserMapper.toDomain(response.user)
    }

    func signUp(email: String, password: String) async throws {
        isLoading = true
        defer { isLoading = false }

        let body = SignUpRequest(email: email, password: password)
        let response: AuthResponse = try await HTTPClient.shared.post("/auth/register", body: body)

        await HTTPClient.shared.accessToken = response.accessToken
        await HTTPClient.shared.refreshToken = response.refreshToken
        user = UserMapper.toDomain(response.user)
    }

    // Аналог signInAnonymously()
    func signInAnonymously() async throws {
        isLoading = true
        defer { isLoading = false }

        let response: AuthResponse = try await HTTPClient.shared.post("/auth/anonymous", body: nil)

        await HTTPClient.shared.accessToken = response.accessToken
        await HTTPClient.shared.refreshToken = response.refreshToken
        user = UserMapper.toDomain(response.user)
    }

    func signOut() async {
        isLoading = true
        defer { isLoading = false }

        try? await HTTPClient.shared.post("/auth/logout", body: nil) as EmptyResponse
        await HTTPClient.shared.clearTokens()
        user = nil

        // Clear cache
        await CacheManager.shared.clear()
    }

    func refreshUser() async throws {
        let response: UserResponse = try await HTTPClient.shared.get("/profiles/me")
        user = UserMapper.toDomain(response)
    }

    // JWT expiration check
    private func isTokenExpired(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3,
              let payloadData = Data(base64Encoded: String(parts[1]).base64Padded()) else {
            return true
        }

        guard let payload = try? JSONDecoder().decode(JWTPayload.self, from: payloadData) else {
            return true
        }

        return Date(timeIntervalSince1970: TimeInterval(payload.exp)) < Date()
    }
}

// MARK: - DTOs

struct SignInRequest: Encodable {
    let email: String
    let password: String
}

struct SignUpRequest: Encodable {
    let email: String
    let password: String
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: UserResponse
}

struct UserResponse: Decodable {
    let id: String
    let name: String?
    let email: String?
    let currency: String
    let hasCompletedOnboarding: Bool
    let defaultAccountId: String?
    let isDemo: Bool
    let demoExpiresAt: String?
    let createdAt: String
}

struct JWTPayload: Decodable {
    let exp: Int
}

// MARK: - Mapper

struct UserMapper {
    static func toDomain(_ dto: UserResponse) -> User {
        User(
            id: dto.id,
            name: dto.name,
            email: dto.email,
            currency: dto.currency,
            hasCompletedOnboarding: dto.hasCompletedOnboarding,
            defaultAccountId: dto.defaultAccountId,
            isDemo: dto.isDemo,
            demoExpiresAt: dto.demoExpiresAt.flatMap { ISO8601DateFormatter().date(from: $0) },
            createdAt: ISO8601DateFormatter().date(from: dto.createdAt) ?? Date()
        )
    }
}

// MARK: - String Extension

extension String {
    func base64Padded() -> String {
        var result = self
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        while result.count % 4 != 0 {
            result += "="
        }
        return result
    }
}
```

### 10.5 CacheManager.swift

Референс: TanStack Query config из `frontend/src/shared/api/queryClient.ts`

```swift
import Foundation

actor CacheManager {
    static let shared = CacheManager()

    private var cache: [QueryKey: CacheEntry] = [:]

    // Default: staleTime=5min, gcTime=30min (как в Vue)
    struct CacheEntry {
        let data: Any
        let timestamp: Date
        let staleTime: TimeInterval
        let gcTime: TimeInterval

        var isStale: Bool {
            Date().timeIntervalSince(timestamp) > staleTime
        }

        var isExpired: Bool {
            Date().timeIntervalSince(timestamp) > gcTime
        }
    }

    // Query keys (аналог queryKeys.ts)
    struct QueryKey: Hashable {
        let keys: [String]

        // Accounts
        static func accounts(_ userId: String) -> QueryKey {
            QueryKey(keys: ["accounts", "list", userId])
        }

        static func account(_ id: String) -> QueryKey {
            QueryKey(keys: ["accounts", "detail", id])
        }

        // Transactions
        static func transactions(_ userId: String) -> QueryKey {
            QueryKey(keys: ["transactions", "list", userId])
        }

        static func transactionsInfinite(_ userId: String, filters: String = "") -> QueryKey {
            QueryKey(keys: ["transactions", "infinite", userId, filters])
        }

        static func monthlyStats(_ userId: String, year: Int, month: Int) -> QueryKey {
            QueryKey(keys: ["transactions", "stats", userId, "\(year)", "\(month)"])
        }

        // Categories
        static func categories(_ userId: String) -> QueryKey {
            QueryKey(keys: ["categories", "list", userId])
        }

        // Debts
        static func debts(_ userId: String) -> QueryKey {
            QueryKey(keys: ["debts", "list", userId])
        }

        static func debt(_ id: String) -> QueryKey {
            QueryKey(keys: ["debts", "detail", id])
        }

        // Reminders
        static func reminders(_ userId: String) -> QueryKey {
            QueryKey(keys: ["reminders", "list", userId])
        }

        // Goals
        static func goals(_ userId: String) -> QueryKey {
            QueryKey(keys: ["goals", "list", userId])
        }

        // Exchange rates
        static func exchangeRates(_ baseCurrency: String) -> QueryKey {
            QueryKey(keys: ["exchange-rates", baseCurrency])
        }
    }

    // MARK: - Public Methods

    func get<T>(_ key: QueryKey) -> T? {
        guard let entry = cache[key], !entry.isExpired else {
            cache.removeValue(forKey: key)
            return nil
        }
        return entry.data as? T
    }

    func isStale(_ key: QueryKey) -> Bool {
        guard let entry = cache[key] else { return true }
        return entry.isStale
    }

    func set<T>(
        _ data: T,
        for key: QueryKey,
        staleTime: TimeInterval = 300,  // 5 min
        gcTime: TimeInterval = 1800      // 30 min
    ) {
        cache[key] = CacheEntry(
            data: data,
            timestamp: Date(),
            staleTime: staleTime,
            gcTime: gcTime
        )
    }

    func invalidate(_ key: QueryKey) {
        cache.removeValue(forKey: key)
    }

    func invalidateAll(matching prefix: [String]) {
        cache = cache.filter { entry in
            !entry.key.keys.starts(with: prefix)
        }
    }

    func clear() {
        cache.removeAll()
    }

    // Cleanup expired entries periodically
    func cleanup() {
        cache = cache.filter { !$0.value.isExpired }
    }
}
```

### 10.6 Design System - Colors

Референс: `frontend/src/app/styles/index.css`

```swift
// Presentation/DesignSystem/Theme/AppColors.swift
import SwiftUI

extension Color {
    // MARK: - Primary (Deep Indigo)
    static let appPrimary = Color(hex: "#4F46E5")
    static let appPrimaryHover = Color(hex: "#6366F1")
    static let appPrimaryPressed = Color(hex: "#3730A3")
    static let appPrimaryLight = Color(hex: "#4F46E5").opacity(0.12)

    // MARK: - Semantic
    static let appSuccess = Color(hex: "#059669")
    static let appDanger = Color(hex: "#E11D48")
    static let appWarning = Color(hex: "#D97706")
    static let appInfo = Color(hex: "#4F46E5")

    // MARK: - Category Colors
    static let categoryGroceries = Color(hex: "#059669")
    static let categoryTransport = Color(hex: "#4F46E5")
    static let categoryHealth = Color(hex: "#E11D48")
    static let categoryHousing = Color(hex: "#6366F1")
    static let categoryCafe = Color(hex: "#EA580C")
    static let categoryEntertainment = Color(hex: "#9333EA")
    static let categoryGifts = Color(hex: "#DB2777")
    static let categoryEducation = Color(hex: "#0891B2")
    static let categoryFamily = Color(hex: "#0D9488")
    static let categorySport = Color(hex: "#65A30D")
    static let categoryTravel = Color(hex: "#D97706")
    static let categoryOther = Color(hex: "#64748B")

    // MARK: - Adaptive Colors
    static func appBackground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#09090B") : Color(hex: "#FAFAFA")
    }

    static func appCard(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#18181B") : .white
    }

    static func appSurface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#27272A") : Color(hex: "#F4F4F5")
    }

    static func appBorder(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#27272A") : Color(hex: "#E4E4E7")
    }

    static func appTextPrimary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#FAFAFA") : Color(hex: "#09090B")
    }

    static func appTextSecondary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#A1A1AA") : Color(hex: "#71717A")
    }

    static func appTextTertiary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(hex: "#71717A") : Color(hex: "#A1A1AA")
    }

    // MARK: - Hex Initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
```

### 10.7 SF Symbols Mapping

Референс: Material Symbols из `frontend/src/shared/ui/icon/UIcon.vue`

```swift
// Presentation/DesignSystem/Components/OIcon.swift
import SwiftUI

struct OIcon: View {
    let name: String
    var size: IconSize = .md
    var filled: Bool = false
    var color: Color?

    // Material Symbols -> SF Symbols
    static let symbolMapping: [String: String] = [
        // Navigation
        "home": "house",
        "pie_chart": "chart.pie",
        "history": "clock.arrow.circlepath",
        "person": "person",
        "settings": "gearshape",

        // Actions
        "add": "plus",
        "edit": "pencil",
        "delete": "trash",
        "close": "xmark",
        "check": "checkmark",
        "search": "magnifyingglass",
        "filter_list": "line.3.horizontal.decrease",
        "sort": "arrow.up.arrow.down",
        "refresh": "arrow.clockwise",

        // Finance
        "wallet": "creditcard",
        "savings": "banknote",
        "attach_money": "dollarsign.circle",
        "account_balance": "building.columns",
        "trending_up": "chart.line.uptrend.xyaxis",
        "trending_down": "chart.line.downtrend.xyaxis",
        "receipt": "doc.text",
        "payments": "arrow.left.arrow.right",

        // Arrows
        "arrow_upward": "arrow.up",
        "arrow_downward": "arrow.down",
        "arrow_forward": "arrow.right",
        "arrow_back": "arrow.left",
        "chevron_right": "chevron.right",
        "chevron_left": "chevron.left",
        "expand_more": "chevron.down",
        "expand_less": "chevron.up",

        // Categories
        "restaurant": "fork.knife",
        "directions_car": "car",
        "local_hospital": "cross.case",
        "house": "house",
        "local_cafe": "cup.and.saucer",
        "movie": "film",
        "card_giftcard": "gift",
        "school": "graduationcap",
        "family_restroom": "figure.2.and.child.holdinghands",
        "fitness_center": "dumbbell",
        "flight": "airplane",
        "more_horiz": "ellipsis",

        // Utilities
        "electric_bolt": "bolt",
        "water_drop": "drop",
        "wifi": "wifi",
        "phone": "phone",
        "subscriptions": "play.rectangle.on.rectangle",

        // Status
        "notifications": "bell",
        "visibility": "eye",
        "visibility_off": "eye.slash",
        "info": "info.circle",
        "warning": "exclamationmark.triangle",
        "error": "xmark.circle",

        // Calendar
        "calendar_today": "calendar",
        "schedule": "clock",
        "event": "calendar.badge.plus",

        // Other
        "logout": "rectangle.portrait.and.arrow.right",
        "login": "rectangle.portrait.and.arrow.forward",
        "share": "square.and.arrow.up",
        "copy": "doc.on.doc",
        "link": "link",
        "image": "photo",
        "camera": "camera",
        "mic": "mic",
    ]

    var body: some View {
        let sfSymbol = Self.symbolMapping[name] ?? name

        Image(systemName: sfSymbol)
            .font(.system(size: size.points, weight: .medium))
            .symbolVariant(filled ? .fill : .none)
            .foregroundColor(color)
    }

    enum IconSize {
        case xs, sm, md, lg, xl, xxl

        var points: CGFloat {
            switch self {
            case .xs: return 12
            case .sm: return 14
            case .md: return 16
            case .lg: return 20
            case .xl: return 24
            case .xxl: return 30
            }
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        OIcon(name: "home", size: .lg, filled: true, color: .appPrimary)
        OIcon(name: "wallet", size: .xl)
        OIcon(name: "trending_up", color: .appSuccess)
    }
}
```

### 10.8 OButton.swift

Референс: `frontend/src/shared/ui/button/UButton.vue`

```swift
// Presentation/DesignSystem/Components/OButton.swift
import SwiftUI

struct OButton: View {
    let title: String
    let action: () -> Void

    var variant: Variant = .primary
    var size: Size = .md
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var icon: String? = nil
    var iconPosition: IconPosition = .leading
    var fullWidth: Bool = false

    @Environment(\.colorScheme) private var colorScheme

    enum Variant {
        case primary, secondary, ghost, danger, outline
    }

    enum Size {
        case sm, md, lg

        var height: CGFloat {
            switch self {
            case .sm: return 32
            case .md: return 40
            case .lg: return 48
            }
        }

        var fontSize: CGFloat {
            switch self {
            case .sm: return 13
            case .md: return 14
            case .lg: return 16
            }
        }

        var padding: CGFloat {
            switch self {
            case .sm: return 12
            case .md: return 16
            case .lg: return 20
            }
        }
    }

    enum IconPosition {
        case leading, trailing
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: foregroundColor))
                        .scaleEffect(0.8)
                } else {
                    if let icon = icon, iconPosition == .leading {
                        OIcon(name: icon, size: .sm, color: foregroundColor)
                    }

                    Text(title)
                        .font(.system(size: size.fontSize, weight: .semibold))

                    if let icon = icon, iconPosition == .trailing {
                        OIcon(name: icon, size: .sm, color: foregroundColor)
                    }
                }
            }
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: size.height)
            .padding(.horizontal, size.padding)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(borderColor, lineWidth: variant == .outline ? 1 : 0)
            )
        }
        .disabled(isDisabled || isLoading)
        .opacity(isDisabled ? 0.5 : 1)
    }

    private var backgroundColor: Color {
        switch variant {
        case .primary:
            return .appPrimary
        case .secondary:
            return Color.appSurface(colorScheme)
        case .ghost:
            return .clear
        case .danger:
            return .appDanger
        case .outline:
            return .clear
        }
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary, .danger:
            return .white
        case .secondary:
            return Color.appTextPrimary(colorScheme)
        case .ghost:
            return .appPrimary
        case .outline:
            return .appPrimary
        }
    }

    private var borderColor: Color {
        switch variant {
        case .outline:
            return .appPrimary
        default:
            return .clear
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        OButton(title: "Primary", action: {})
        OButton(title: "Secondary", action: {}, variant: .secondary)
        OButton(title: "Ghost", action: {}, variant: .ghost)
        OButton(title: "Danger", action: {}, variant: .danger)
        OButton(title: "Outline", action: {}, variant: .outline)
        OButton(title: "Loading", action: {}, isLoading: true)
        OButton(title: "With Icon", action: {}, icon: "add")
        OButton(title: "Full Width", action: {}, fullWidth: true)
    }
    .padding()
}
```

### 10.9 OCard.swift

Референс: `frontend/src/shared/ui/card/UCard.vue`

```swift
// Presentation/DesignSystem/Components/OCard.swift
import SwiftUI

struct OCard<Content: View>: View {
    let content: Content
    var padding: CGFloat = 16
    var cornerRadius: CGFloat = 16

    @Environment(\.colorScheme) private var colorScheme

    init(
        padding: CGFloat = 16,
        cornerRadius: CGFloat = 16,
        @ViewBuilder content: () -> Content
    ) {
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(Color.appCard(colorScheme))
            .cornerRadius(cornerRadius)
            .shadow(
                color: colorScheme == .dark ? .clear : .black.opacity(0.04),
                radius: 8,
                x: 0,
                y: 2
            )
    }
}

// ViewModifier version
struct CardModifier: ViewModifier {
    var padding: CGFloat = 16
    var cornerRadius: CGFloat = 16

    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color.appCard(colorScheme))
            .cornerRadius(cornerRadius)
            .shadow(
                color: colorScheme == .dark ? .clear : .black.opacity(0.04),
                radius: 8,
                x: 0,
                y: 2
            )
    }
}

extension View {
    func cardStyle(padding: CGFloat = 16, cornerRadius: CGFloat = 16) -> some View {
        modifier(CardModifier(padding: padding, cornerRadius: cornerRadius))
    }
}

#Preview {
    VStack(spacing: 16) {
        OCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Card Title")
                    .font(.headline)
                Text("Card content goes here")
                    .foregroundStyle(.secondary)
            }
        }

        Text("Using modifier")
            .cardStyle()
    }
    .padding()
    .background(Color.appBackground(.light))
}
```

### 10.10 OTextField.swift

Референс: `frontend/src/shared/ui/input/UInput.vue`

```swift
// Presentation/DesignSystem/Components/OTextField.swift
import SwiftUI

struct OTextField: View {
    let placeholder: String
    @Binding var text: String

    var label: String? = nil
    var icon: String? = nil
    var isSecure: Bool = false
    var isDisabled: Bool = false
    var error: String? = nil
    var keyboardType: UIKeyboardType = .default

    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label = label {
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color.appTextSecondary(colorScheme))
            }

            HStack(spacing: 12) {
                if let icon = icon {
                    OIcon(name: icon, size: .md, color: Color.appTextTertiary(colorScheme))
                }

                Group {
                    if isSecure {
                        SecureField(placeholder, text: $text)
                    } else {
                        TextField(placeholder, text: $text)
                    }
                }
                .keyboardType(keyboardType)
                .focused($isFocused)
                .disabled(isDisabled)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.appSurface(colorScheme))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(borderColor, lineWidth: 1)
            )

            if let error = error {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(.appDanger)
            }
        }
    }

    private var borderColor: Color {
        if error != nil {
            return .appDanger
        } else if isFocused {
            return .appPrimary
        } else {
            return Color.appBorder(colorScheme)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        OTextField(placeholder: "Enter email", text: .constant(""), label: "Email", icon: "person")
        OTextField(placeholder: "Enter password", text: .constant(""), label: "Password", isSecure: true)
        OTextField(placeholder: "With error", text: .constant(""), error: "This field is required")
    }
    .padding()
}
```

### 10.11 Repository Pattern Example

Референс: `frontend/src/entities/account/api/accountsApi.ts`

```swift
// Domain/Repositories/AccountRepository.swift
protocol AccountRepository {
    func getAccounts() async throws -> [Account]
    func getAccount(id: String) async throws -> Account
    func createAccount(_ request: CreateAccountRequest) async throws -> Account
    func updateAccount(id: String, _ request: UpdateAccountRequest) async throws -> Account
    func deleteAccount(id: String) async throws
}

// Data/DTOs/AccountDTO.swift
struct AccountDTO: Decodable {
    let id: String
    let userId: String
    let name: String
    let icon: String
    let color: String
    let type: String
    let order: Int
    let createdAt: String
    let balances: [AccountBalanceDTO]?
}

struct AccountBalanceDTO: Decodable {
    let id: String
    let accountId: String
    let currency: String
    let balance: String  // Backend sends as string
    let createdAt: String
}

struct CreateAccountRequest: Encodable {
    let name: String
    let icon: String
    let color: String
    let type: String
    let initialBalance: Decimal?
    let currency: String?
}

struct UpdateAccountRequest: Encodable {
    let name: String?
    let icon: String?
    let color: String?
    let type: String?
    let order: Int?
}

// Data/Mappers/AccountMapper.swift
struct AccountMapper {
    static func toDomain(_ dto: AccountDTO) -> Account {
        Account(
            id: dto.id,
            userId: dto.userId,
            name: dto.name,
            icon: dto.icon,
            color: dto.color,
            type: AccountType(rawValue: dto.type) ?? .basic,
            order: dto.order,
            createdAt: ISO8601DateFormatter().date(from: dto.createdAt) ?? Date(),
            balances: dto.balances?.map { balanceDTO in
                AccountBalance(
                    id: balanceDTO.id,
                    accountId: balanceDTO.accountId,
                    currency: balanceDTO.currency,
                    balance: Decimal(string: balanceDTO.balance) ?? 0,
                    createdAt: ISO8601DateFormatter().date(from: balanceDTO.createdAt) ?? Date()
                )
            } ?? []
        )
    }
}

// Data/Repositories/AccountRepositoryImpl.swift
class AccountRepositoryImpl: AccountRepository {
    private let httpClient: HTTPClient
    private let cache: CacheManager

    init(httpClient: HTTPClient = .shared, cache: CacheManager = .shared) {
        self.httpClient = httpClient
        self.cache = cache
    }

    func getAccounts() async throws -> [Account] {
        let userId = await AuthManager.shared.user?.id ?? ""
        let cacheKey = CacheManager.QueryKey.accounts(userId)

        // Check cache first
        if let cached: [Account] = await cache.get(cacheKey),
           !(await cache.isStale(cacheKey)) {
            return cached
        }

        // Fetch from API
        let dtos: [AccountDTO] = try await httpClient.get("/accounts")
        let accounts = dtos.map(AccountMapper.toDomain)

        // Update cache
        await cache.set(accounts, for: cacheKey)

        return accounts
    }

    func getAccount(id: String) async throws -> Account {
        let cacheKey = CacheManager.QueryKey.account(id)

        if let cached: Account = await cache.get(cacheKey),
           !(await cache.isStale(cacheKey)) {
            return cached
        }

        let dto: AccountDTO = try await httpClient.get("/accounts/\(id)")
        let account = AccountMapper.toDomain(dto)

        await cache.set(account, for: cacheKey)

        return account
    }

    func createAccount(_ request: CreateAccountRequest) async throws -> Account {
        let dto: AccountDTO = try await httpClient.post("/accounts", body: request)
        let account = AccountMapper.toDomain(dto)

        // Invalidate list cache
        let userId = await AuthManager.shared.user?.id ?? ""
        await cache.invalidate(.accounts(userId))

        return account
    }

    func updateAccount(id: String, _ request: UpdateAccountRequest) async throws -> Account {
        let dto: AccountDTO = try await httpClient.patch("/accounts/\(id)", body: request)
        let account = AccountMapper.toDomain(dto)

        // Invalidate caches
        let userId = await AuthManager.shared.user?.id ?? ""
        await cache.invalidate(.accounts(userId))
        await cache.invalidate(.account(id))

        return account
    }

    func deleteAccount(id: String) async throws {
        try await httpClient.delete("/accounts/\(id)")

        // Invalidate caches
        let userId = await AuthManager.shared.user?.id ?? ""
        await cache.invalidate(.accounts(userId))
        await cache.invalidate(.account(id))
    }
}
```

### 10.12 ViewModel Pattern Example

Референс: `frontend/src/entities/account/api/useAccounts.ts`

```swift
// Presentation/Screens/Accounts/AccountsViewModel.swift
import SwiftUI

@MainActor
@Observable
class AccountsViewModel {
    private let repository: AccountRepository

    var accounts: [Account] = []
    var isLoading = false
    var error: Error?

    init(repository: AccountRepository = AccountRepositoryImpl()) {
        self.repository = repository
    }

    func loadAccounts() async {
        isLoading = true
        error = nil

        do {
            accounts = try await repository.getAccounts()
        } catch {
            self.error = error
        }

        isLoading = false
    }

    func deleteAccount(_ account: Account) async {
        do {
            try await repository.deleteAccount(id: account.id)
            accounts.removeAll { $0.id == account.id }
        } catch {
            self.error = error
        }
    }

    func refresh() async {
        await loadAccounts()
    }
}

// Presentation/Screens/Accounts/AccountsListView.swift
struct AccountsListView: View {
    @State private var viewModel = AccountsViewModel()
    @State private var showCreateSheet = false

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.accounts.isEmpty {
                    ProgressView()
                } else if let error = viewModel.error {
                    ErrorView(error: error, retryAction: {
                        Task { await viewModel.loadAccounts() }
                    })
                } else if viewModel.accounts.isEmpty {
                    EmptyStateView(
                        icon: "wallet",
                        title: "No accounts yet",
                        description: "Create your first account to start tracking",
                        actionTitle: "Create Account",
                        action: { showCreateSheet = true }
                    )
                } else {
                    accountsList
                }
            }
            .navigationTitle("Accounts")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        OIcon(name: "add", color: .appPrimary)
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                CreateAccountView { newAccount in
                    viewModel.accounts.append(newAccount)
                }
            }
            .task {
                await viewModel.loadAccounts()
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }

    private var accountsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.accounts) { account in
                    NavigationLink(destination: AccountDetailView(account: account)) {
                        AccountCard(account: account)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .background(Color.appBackground(colorScheme))
    }
}
```

### 10.13 TabBar Navigation

Референс: `frontend/src/widgets/bottom-nav/ui/BottomNav.vue`

```swift
// Presentation/Navigation/MainTabView.swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .dashboard
    @State private var showAddTransaction = false

    @Environment(\.colorScheme) private var colorScheme

    enum Tab: String, CaseIterable {
        case dashboard = "Dashboard"
        case history = "History"
        case analytics = "Analytics"
        case profile = "Profile"

        var icon: String {
            switch self {
            case .dashboard: return "home"
            case .history: return "history"
            case .analytics: return "pie_chart"
            case .profile: return "person"
            }
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tag(Tab.dashboard)

                HistoryView()
                    .tag(Tab.history)

                AnalyticsView()
                    .tag(Tab.analytics)

                ProfileView()
                    .tag(Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Custom Tab Bar
            customTabBar
        }
        .sheet(isPresented: $showAddTransaction) {
            AddTransactionView()
        }
    }

    private var customTabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                if tab == .analytics {
                    // FAB button in the middle
                    Spacer()

                    fabButton

                    Spacer()
                }

                tabButton(for: tab)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 28)
        .background(
            Color.appCard(colorScheme)
                .shadow(color: .black.opacity(0.1), radius: 20, y: -5)
        )
    }

    private func tabButton(for tab: Tab) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedTab = tab
            }
        } label: {
            VStack(spacing: 4) {
                OIcon(
                    name: tab.icon,
                    size: .lg,
                    filled: selectedTab == tab,
                    color: selectedTab == tab ? .appPrimary : Color.appTextTertiary(colorScheme)
                )

                Text(tab.rawValue)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(
                        selectedTab == tab ? .appPrimary : Color.appTextTertiary(colorScheme)
                    )
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var fabButton: some View {
        Button {
            showAddTransaction = true
        } label: {
            ZStack {
                Circle()
                    .fill(Color.appPrimary)
                    .frame(width: 56, height: 56)
                    .shadow(color: .appPrimary.opacity(0.3), radius: 8, y: 4)

                OIcon(name: "add", size: .xl, color: .white)
            }
        }
        .offset(y: -20)
    }
}
```

### 10.14 App Entry Point

```swift
// App/OuroFinanceApp.swift
import SwiftUI

@main
struct OuroFinanceApp: App {
    @State private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authManager)
        }
    }
}

// App/RootView.swift
struct RootView: View {
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        Group {
            if authManager.isLoading && !authManager.isInitialized {
                SplashView()
            } else if authManager.isAuthenticated {
                if authManager.user?.hasCompletedOnboarding == true {
                    MainTabView()
                } else {
                    OnboardingView()
                }
            } else {
                LoginView()
            }
        }
        .task {
            await authManager.initialize()
        }
    }
}

// Presentation/Shared/SplashView.swift
struct SplashView: View {
    var body: some View {
        ZStack {
            Color.appPrimary
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.white)

                Text("OuroFinance")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
            }
        }
    }
}
```

---

## 11. Verification Checklist

После каждой фазы проверять:

### Phase 1 ✓
- [ ] Login с email/password работает
- [ ] Anonymous login (demo) работает
- [ ] Logout очищает токены и кэш
- [ ] Token refresh при 401 работает

### Phase 2 ✓
- [ ] Dashboard показывает баланс
- [ ] Список счетов загружается
- [ ] Создание счёта работает
- [ ] Добавление транзакции работает
- [ ] Infinite scroll для транзакций

### Phase 3 ✓
- [ ] CRUD для долгов
- [ ] CRUD для напоминаний
- [ ] Категории отображаются
- [ ] Поиск транзакций работает

### Phase 4 ✓
- [ ] Графики в Analytics
- [ ] Смена темы (dark/light)
- [ ] Profile редактирование
- [ ] Demo mode с expiry

### Phase 5 ✓
- [ ] Unit tests проходят
- [ ] UI tests для login flow
- [ ] Нет memory leaks
- [ ] TestFlight build работает

---

## 12. Дополнительные ресурсы

### Apple Documentation
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Swift Concurrency](https://developer.apple.com/documentation/swift/concurrency)
- [Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Swift Charts](https://developer.apple.com/documentation/charts)

### Architecture Patterns
- [Clean Architecture for iOS](https://github.com/kudoleh/iOS-Clean-Architecture-MVVM)
- [The Composable Architecture](https://github.com/pointfreeco/swift-composable-architecture)

### Testing
- [XCTest Documentation](https://developer.apple.com/documentation/xctest)
- [Swift Testing (iOS 18+)](https://developer.apple.com/documentation/testing)
