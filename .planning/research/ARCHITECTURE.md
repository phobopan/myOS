# Architecture Research

**Project:** phoebeOS - Unified macOS Inbox
**Researched:** 2026-01-20
**Confidence:** HIGH (patterns well-established in SwiftUI ecosystem)

## Executive Summary

Native macOS unified inbox apps follow a layered architecture with clear separation between data sources, a unified domain model, and the UI layer. The recommended pattern for phoebeOS is a **Clean Architecture with Repository Pattern**, using SwiftUI's modern `@Observable` macro for state management. This architecture cleanly handles the core challenge: normalizing three disparate data sources (iMessage SQLite, Gmail REST API, Instagram Graph API) into a single unified message stream.

---

## Major Components

### 1. Data Source Layer (Platform Adapters)

Three independent adapters, each encapsulating platform-specific logic:

| Adapter | Data Source | Auth Mechanism | Update Strategy |
|---------|-------------|----------------|-----------------|
| **iMessageAdapter** | Local SQLite (chat.db) | Full Disk Access permission | File system polling / FSEvents |
| **GmailAdapter** | REST API | OAuth 2.0 (Google) | Pub/Sub push or polling |
| **InstagramAdapter** | Graph API | OAuth 2.0 (Meta/Facebook) | Webhook or polling |

**Responsibilities:**
- Raw data fetching from platform
- Platform-specific authentication flows
- Error handling and retry logic
- Data transformation to unified models

**Key insight:** Each adapter should expose an identical interface (protocol) so the aggregation layer treats them uniformly.

```swift
protocol MessageSourceAdapter {
    var sourceType: MessageSource { get }
    func fetchUnrepliedConversations() async throws -> [UnifiedConversation]
    func fetchThread(conversationId: String) async throws -> [UnifiedMessage]
    func sendReply(conversationId: String, content: ReplyContent) async throws
    func startMonitoring() async
    func stopMonitoring()
}
```

### 2. Domain Layer (Unified Models)

Platform-agnostic models representing the unified inbox:

```
UnifiedConversation
  - id: String
  - source: MessageSource (iMessage | Gmail | Instagram)
  - participants: [Participant]
  - lastMessage: UnifiedMessage
  - lastReceivedAt: Date
  - requiresReply: Bool
  - metadata: SourceMetadata (platform-specific extras)

UnifiedMessage
  - id: String
  - conversationId: String
  - content: MessageContent (text, attachment, email body)
  - sender: Participant
  - timestamp: Date
  - isFromMe: Bool
  - reactions: [Reaction]? (iMessage specific)

Participant
  - id: String
  - displayName: String
  - handle: String (phone/email/instagram handle)
  - avatarURL: URL?

ReplyContent
  - text: String
  - subject: String? (Gmail only)
  - cc: [String]? (Gmail only)
  - bcc: [String]? (Gmail only)
  - replyType: ReplyType? (reply/replyAll/forward for Gmail)
```

### 3. Repository Layer (Data Aggregation)

The **UnifiedInboxRepository** aggregates data from all adapters:

```swift
@Observable
class UnifiedInboxRepository {
    private let adapters: [MessageSourceAdapter]

    var conversations: [UnifiedConversation] = []
    var isLoading: Bool = false
    var errors: [SourceError] = []

    func refresh() async { ... }
    func fetchThread(for conversation: UnifiedConversation) async throws -> [UnifiedMessage]
    func sendReply(to conversation: UnifiedConversation, content: ReplyContent) async throws
}
```

**Key behaviors:**
- Fetches from all adapters concurrently (`async let` / `TaskGroup`)
- Merges results into unified sorted list
- Handles partial failures gracefully (show available sources if one fails)
- Caches last-known state for offline resilience

### 4. State Management Layer (AppState)

Central application state using modern `@Observable`:

```swift
@Observable
class AppState {
    // Navigation state
    var selectedConversation: UnifiedConversation?
    var activeFilter: MessageSource? // nil = all sources

    // UI state
    var isComposerFocused: Bool = false
    var sidebarWidth: CGFloat = 300

    // Sub-states (split when complex)
    var authState = AuthState()
    var settingsState = SettingsState()
}

@Observable
class AuthState {
    var gmailAuthenticated: Bool = false
    var instagramAuthenticated: Bool = false
    var iMessagePermissionGranted: Bool = false
}
```

**Injection pattern:**
```swift
@main
struct PhoebeOSApp: App {
    @State private var appState = AppState()
    @State private var repository = UnifiedInboxRepository()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(repository)
        }
    }
}
```

### 5. View Layer (SwiftUI)

Hierarchical view structure:

```
ContentView (root)
  |-- Sidebar
  |     |-- FilterBar (All / iMessage / Gmail / Instagram)
  |     |-- ConversationList
  |           |-- ConversationRow (repeated)
  |
  |-- DetailPanel
        |-- ThreadView
        |     |-- MessageBubble (repeated)
        |
        |-- ComposerView
              |-- iMessageComposer (chat-style)
              |-- GmailComposer (email-style with CC/BCC/Subject)
              |-- InstagramComposer (chat-style, text-only)
```

### 6. Services Layer

Supporting services outside the main data flow:

| Service | Responsibility |
|---------|----------------|
| **AuthService** | OAuth flow coordination, token storage (Keychain) |
| **ContactResolver** | Resolve phone numbers to names (Contacts framework) |
| **NotificationService** | System notification preferences, badge management |
| **KeyboardShortcutService** | Global shortcut handling, FocusedValue bindings |

---

## Component Boundaries

### Clear Interface Contracts

```
+----------------+     +------------------+     +-----------+
|   View Layer   | --> |  AppState +      | --> |  Adapters |
|   (SwiftUI)    |     |  Repository      |     |  (Data)   |
+----------------+     +------------------+     +-----------+
        |                      |                     |
        |    @Environment      |   async/await       |
        |    (observation)     |   (protocols)       |
        v                      v                     v
   UI responds to          Business logic      Platform-specific
   state changes           coordinates         implementations
```

### Dependency Direction

```
Views --> AppState --> Repository --> Adapters --> External Systems
                                         |
                                         v
                                   Domain Models
                                   (shared by all)
```

**Rule:** Dependencies point inward. Adapters know about domain models. Domain models know nothing about adapters or views.

### Protocol Boundaries

| Protocol | Implemented By | Used By |
|----------|----------------|---------|
| `MessageSourceAdapter` | iMessageAdapter, GmailAdapter, InstagramAdapter | UnifiedInboxRepository |
| `AuthProvider` | GoogleAuthProvider, MetaAuthProvider | AuthService |
| `ContactResolving` | ContactResolver | iMessageAdapter |

---

## Data Flow

### 1. Initial Load Flow

```
App Launch
    |
    v
AppState initialized --> Repository initialized --> Adapters initialized
    |                           |
    v                           v
Check auth state           Start monitoring
    |                           |
    +-- Missing auth? -----> Show onboarding
    |                           |
    +-- All authed --------> Fetch conversations (parallel)
                                    |
                                    v
                              Merge + Sort by lastReceivedAt
                                    |
                                    v
                              Update repository.conversations
                                    |
                                    v
                              Views update via @Observable
```

### 2. New Message Detection Flow

```
iMessage: FSEvents detects chat.db change --> Adapter re-queries --> Emits update
Gmail:    Pub/Sub webhook / polling timer --> Adapter fetches delta --> Emits update
Instagram: Webhook / polling timer --------> Adapter fetches delta --> Emits update
                                                    |
                                                    v
                                          Repository merges into conversations
                                                    |
                                                    v
                                          Views update automatically
```

### 3. Reply Flow

```
User types in Composer
    |
    v
Submit action triggered (Enter / Send button)
    |
    v
ComposerView calls repository.sendReply(conversation, content)
    |
    v
Repository routes to appropriate adapter based on conversation.source
    |
    v
Adapter sends via platform API
    |
    v
On success: Repository removes conversation from list
            (or marks as replied, depending on re-fetch strategy)
    |
    v
Navigation returns to inbox (or next conversation)
```

### 4. Filter Flow

```
User taps filter button (e.g., "Gmail only")
    |
    v
appState.activeFilter = .gmail
    |
    v
ConversationList computed property filters:
    repository.conversations.filter {
        appState.activeFilter == nil || $0.source == appState.activeFilter
    }
    |
    v
View updates to show filtered list
```

---

## Suggested Build Order

Based on dependencies between components, the recommended implementation sequence:

### Phase 1: Foundation

**Build first (no dependencies):**

1. **Domain Models** - `UnifiedConversation`, `UnifiedMessage`, `Participant`, etc.
   - Zero dependencies, pure Swift structs
   - Defines the contract everything else implements

2. **MessageSourceAdapter Protocol** - The interface adapters will implement
   - Defines what the repository expects from any data source

3. **AppState Shell** - Basic navigation/UI state
   - Selected conversation, active filter
   - No data fetching yet

4. **Basic UI Shell** - Sidebar + Detail split view
   - Static/mock data
   - Establishes layout patterns

### Phase 2: First Data Source (iMessage)

**Why iMessage first:**
- Local data (no network/auth complexity)
- Validates the unified model design
- Fastest path to seeing real data

Build order:
1. **iMessageAdapter** - Read chat.db, transform to domain models
2. **UnifiedInboxRepository** (single adapter) - Wire up iMessage only
3. **ConversationList** - Display real iMessage conversations
4. **ThreadView** - Display message thread
5. **iMessageComposer** - Send replies via AppleScript

### Phase 3: OAuth Infrastructure

**Build before Gmail/Instagram:**
1. **AuthService** - Token storage, refresh logic
2. **GoogleAuthProvider** - OAuth 2.0 flow for Gmail
3. **Onboarding flow** - Guide user through auth

### Phase 4: Gmail Integration

1. **GmailAdapter** - REST API integration
2. **GmailComposer** - Email-style with subject/CC/BCC
3. **Repository update** - Multi-source aggregation
4. **Filter UI** - Toggle between sources

### Phase 5: Instagram Integration

1. **MetaAuthProvider** - OAuth 2.0 flow
2. **InstagramAdapter** - Graph API integration
3. **InstagramComposer** - Text-only, 24-hour window awareness
4. **24-hour window UI** - Visual indicator when reply window expires

### Phase 6: Polish

1. **Keyboard shortcuts** - FocusedValue bindings
2. **Notifications** - Badge management
3. **Glassmorphism refinement** - Materials, animations
4. **Error handling** - Graceful degradation, retry UI

---

## Architecture Patterns to Follow

### 1. Repository Pattern for Data Aggregation

Centralizes all data access. Views never talk directly to adapters.

```swift
// Good: View uses repository
struct ConversationList: View {
    @Environment(UnifiedInboxRepository.self) var repository

    var body: some View {
        List(repository.conversations) { ... }
    }
}

// Bad: View talks directly to adapter
struct ConversationList: View {
    let gmailAdapter = GmailAdapter()  // Don't do this
}
```

### 2. Protocol-Driven Adapters

Each adapter implements the same protocol. Enables testing with mock adapters.

```swift
#if DEBUG
class MockAdapter: MessageSourceAdapter {
    func fetchUnrepliedConversations() async throws -> [UnifiedConversation] {
        return [.preview1, .preview2]  // Test data
    }
}
#endif
```

### 3. Async/Await Over Combine

Modern Swift concurrency is cleaner than Combine for this use case:

```swift
// Prefer async/await
func refresh() async {
    async let imessage = iMessageAdapter.fetchUnrepliedConversations()
    async let gmail = gmailAdapter.fetchUnrepliedConversations()
    async let instagram = instagramAdapter.fetchUnrepliedConversations()

    let all = try await imessage + gmail + instagram
    conversations = all.sorted { $0.lastReceivedAt > $1.lastReceivedAt }
}
```

### 4. @Observable Over ObservableObject

Use the modern `@Observable` macro (iOS 17+ / macOS 14+):

```swift
// Modern (use this)
@Observable class AppState { ... }

// Legacy (avoid for new code)
class AppState: ObservableObject {
    @Published var selectedConversation: ...
}
```

### 5. Environment Injection Over Singletons

```swift
// Good: Injectable, testable
@main struct App {
    @State var repository = UnifiedInboxRepository()
    var body: some Scene {
        WindowGroup {
            ContentView().environment(repository)
        }
    }
}

// Bad: Global singleton
class Repository {
    static let shared = Repository()  // Avoid
}
```

---

## Anti-Patterns to Avoid

### 1. Tight Coupling to Platform APIs

**Bad:** Passing raw Gmail API response to views
```swift
struct ThreadView: View {
    let gmailThread: GmailAPIResponse  // Platform-specific!
}
```

**Good:** Always transform to unified models
```swift
struct ThreadView: View {
    let messages: [UnifiedMessage]  // Platform-agnostic
}
```

### 2. Auth Logic in Views

**Bad:** OAuth handling in SwiftUI view
```swift
struct SettingsView: View {
    func handleOAuth() {
        // OAuth logic here - don't do this
    }
}
```

**Good:** Delegate to AuthService
```swift
struct SettingsView: View {
    @Environment(AuthService.self) var auth

    Button("Connect Gmail") {
        Task { await auth.authenticateGmail() }
    }
}
```

### 3. Massive AppState

**Bad:** Everything in one object
```swift
@Observable class AppState {
    var conversations: [Conversation]
    var selectedConversation: ...
    var gmailToken: ...
    var instagramToken: ...
    var notificationSettings: ...
    // 50 more properties
}
```

**Good:** Split into focused sub-states
```swift
@Observable class AppState {
    var navigation = NavigationState()
    var auth = AuthState()
    var settings = SettingsState()
}
```

### 4. Synchronous Database Access

**Bad:** Blocking main thread
```swift
func loadMessages() {
    let db = try! Connection(chatDbPath)  // Blocks UI!
    let messages = try! db.prepare(query)
}
```

**Good:** Background actor
```swift
actor DatabaseActor {
    func loadMessages() async throws -> [Message] {
        // Runs off main thread
    }
}
```

---

## Scalability Considerations

| Concern | At 100 conversations | At 1,000 conversations | At 10,000 conversations |
|---------|---------------------|------------------------|-------------------------|
| **List rendering** | No issue | Use `LazyVStack` | Add pagination |
| **Memory** | No issue | Cache thread data | Evict old threads |
| **Refresh time** | < 1 second | 2-3 seconds | Incremental sync |
| **Search** | In-memory filter | In-memory filter | SQLite FTS index |

**For v1 (target: < 500 conversations):** Simple approach is fine. Load all, sort in memory, filter in memory.

---

## Sources

### Architecture Patterns
- [Clean Architecture for SwiftUI - Alexey Naumov](https://nalexn.github.io/clean-architecture-swiftui)
- [MVVM in SwiftUI - Matteo Manferdini](https://matteomanferdini.com/swiftui-mvvm/)
- [Repository Pattern in Swift - Phil Yates](https://pyartez.github.io/architecture/repository-pattern-in-swift-and-combine.html)
- [Building Large-Scale Apps with SwiftUI - Mohammad Azam](https://azamsharp.medium.com/building-large-scale-apps-with-swiftui-a-guide-to-modular-architecture-9c967be13001)

### State Management
- [iOS 17+ SwiftUI State Management Guide](https://zoewave.medium.com/new-swiftui-state-management-3a6c9b737724)
- [Global AppState Architecture in SwiftUI](https://dev.to/sebastienlato/global-appstate-architecture-in-swiftui-pfe)
- [Understanding @Observable Macro](https://hasanalidev.medium.com/understanding-the-swiftui-observable-macro-a-modern-guide-to-apples-observation-framework-80b052cb0161)

### Data Sources
- [Deep Dive into iMessage - Fatbobman](https://fatbobman.com/en/posts/deep-dive-into-imessage)
- [Accessing iMessage with SQL](https://davidbieber.com/snippets/2020-05-20-imessage-sql-db/)
- [Gmail Push Notifications Guide](https://developers.google.com/workspace/gmail/api/guides/push)
- [Instagram Graph API Guide 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)

### OAuth & Auth
- [OAuth2 Framework for macOS](https://github.com/p2/OAuth2)
- [OAuthSwift Library](https://github.com/OAuthSwift/OAuthSwift)

### Navigation & Keyboard
- [SwiftUI Coordinator Pattern with NavigationStack](https://medium.com/macoclock/swiftui-flow-coordinator-pattern-with-navigationstack-to-coordinate-navigation-between-views-ios-1a2b6cd239d7)
- [SwiftUI FocusedValue and Responder Chain](https://philz.blog/swiftui-focusedvalue-macos-menus-and-the-responder-chain/)
- [KeyboardShortcuts Library](https://github.com/sindresorhus/KeyboardShortcuts)
