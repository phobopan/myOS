# Technology Stack Research

**Project:** phoebeOS - Native macOS Unified Inbox
**Researched:** 2026-01-20
**Overall Confidence:** HIGH

---

## Executive Summary

For a native macOS unified inbox app in 2025/2026, the stack is clear: **SwiftUI + Swift 6 + GRDB.swift** with native Apple frameworks for networking and glassmorphism. This is a well-trodden path with mature tooling and excellent documentation.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Swift** | 6.1+ | Language | Current stable, required for latest GRDB and SwiftUI features | HIGH |
| **SwiftUI** | macOS 26 / macOS 15+ | UI Framework | Native macOS app with declarative UI, built-in glassmorphism via materials and new Liquid Glass | HIGH |
| **Xcode** | 16.3+ | IDE | Required for Swift 6.1 and latest SwiftUI | HIGH |

**Rationale:** SwiftUI on macOS has matured significantly. WWDC 2025 showed lists of 100,000+ items now load 6x faster, and macOS-specific performance issues are largely resolved. Testing shows 10,000 items in a list feels snappy for drawing, scrolling, and selecting.

### Database (Reading iMessage)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **GRDB.swift** | 7.9.0 | SQLite access | Read ~/Library/Messages/chat.db, migrations, database observation, full-text search | HIGH |

**Rationale:** GRDB is the clear winner over SQLite.swift for this use case because:
1. **Database observation** - Get notifications when chat.db changes (crucial for auto-refresh)
2. **Swift concurrency support** - Native async/await integration
3. **Active maintenance** - v7.9.0 released December 2025
4. **macOS 10.15+** - Supports all recent macOS versions
5. **Point-Free's SharingGRDB** - Additional SwiftUI integration layer available

**Critical note:** macOS Ventura+ encodes messages as hex blobs in `attributedBody` column, not plain text. GRDB can handle this, but you'll need to decode the attributed string format.

### Authentication & API Access

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **GoogleSignIn-iOS** | 9.1.0 | Gmail OAuth | Official Google SDK, supports macOS, Swift 6, SwiftUI button | HIGH |
| **URLSession** | Built-in | HTTP networking | Native async/await, no dependencies, sufficient for API calls | HIGH |

**Rationale for GoogleSignIn-iOS:**
- Official Google SDK, actively maintained (v9.1.0 released January 2025)
- Swift 6 support
- macOS support (though GIDSignInButton needs SwiftUI wrapper via hosting view)
- Handles OAuth 2.0 flow, token refresh automatically

**Rationale against Alamofire:**
- URLSession with async/await is clean enough for API calls
- No need for Alamofire's advanced features (retry logic, certificate pinning)
- One less dependency
- Performance: URLSession is 15% faster in high-load scenarios

### Sending iMessages

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **NSAppleScript / Process** | Built-in | Execute AppleScript | Only reliable way to send iMessages programmatically | HIGH |

**Rationale:** There is no public API for sending iMessages. AppleScript via the Messages app is the only supported approach:

```swift
let script = """
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "\(phoneNumber)" of targetService
    send "\(message)" to targetBuddy
end tell
"""
```

**Limitation:** Recipient must have an existing conversation and be a contact with iMessage enabled.

### Instagram Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **URLSession** | Built-in | Instagram Graph API calls | Direct REST API calls, no Swift SDK needed | HIGH |
| **Meta OAuth** | N/A | Authentication | Required for Instagram Graph API | HIGH |

**Rationale:** There is no official Instagram Swift SDK for the Graph API. The options are:
1. **Direct REST API calls via URLSession** (recommended)
2. Third-party libraries that are either unmaintained (SwiftyInsta) or use private APIs (Swiftagram - risky)

**Critical Instagram API Constraints:**
- Requires Business/Creator account with 1,000+ followers
- 24-hour messaging window (can only reply within 24hrs of customer message)
- 200 API calls per user per hour rate limit
- Cannot initiate conversations - customer must message first
- HUMAN_AGENT tag extends window to 7 days for human responses

### Keyboard Shortcuts

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **SwiftUI .keyboardShortcut()** | Built-in | In-app shortcuts | Native modifier, works with CommandMenu and CommandGroup | HIGH |
| **KeyboardShortcuts** | Latest | Global hotkeys (optional) | Sindre Sorhus library for shortcuts when app not focused | MEDIUM |

**Rationale:** SwiftUI's built-in `.keyboardShortcut()` modifier handles most needs:
- Command key is default modifier
- Works with Button, Toggle, menu items
- Scope-aware (key window -> main window -> command groups)

For global shortcuts (app not in foreground), KeyboardShortcuts package is the standard choice.

### Glassmorphism / Visual Effects

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **SwiftUI Materials** | Built-in | Blur effects | `.thinMaterial`, `.ultraThinMaterial`, vibrancy | HIGH |
| **Liquid Glass** | macOS 26+ | New glassmorphism | `.liquidGlassMaterial` for next-gen glass effects | HIGH |

**Rationale:** Apple's WWDC 2025 introduced Liquid Glass - a system-wide frosted-glass material with dynamic blur, refraction, and tinting. For macOS 26+, use `.liquidGlassMaterial`. For backwards compatibility, use existing material modifiers.

### State Management & Concurrency

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@Observable** | Swift 5.9+ | Observable models | Modern replacement for ObservableObject, less boilerplate | HIGH |
| **async/await** | Swift 5.5+ | Async operations | API calls, database queries | HIGH |
| **Combine** | Built-in | Reactive streams (limited) | Only for debouncing input, timers - use async/await for everything else | MEDIUM |

**Rationale:** Use async/await as the default for all async operations. Combine is still valuable for:
- Debouncing user input (search fields)
- Continuous data streams
- Timer-based polling

But for one-shot operations (API calls, database reads), async/await is cleaner.

### App Data Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **SwiftData** | macOS 14+ | App settings, cache | Simple persistence for app's own data | MEDIUM |
| **UserDefaults** | Built-in | Preferences | Simple key-value settings | HIGH |
| **Keychain** | Built-in | Secure storage | OAuth tokens, credentials | HIGH |

**Rationale for SwiftData over Core Data:**
- New projects in 2025 should use SwiftData
- Simpler API, automatic iCloud sync
- Perfect for app settings, message cache

**Rationale against SwiftData for critical data:**
- Complex queries still favor GRDB (for reading chat.db)
- SwiftData requires macOS 14+

---

## Full Dependency List

### Swift Package Manager

```swift
// Package.swift dependencies
dependencies: [
    // Database
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.9.0"),

    // Google Sign-In for Gmail OAuth
    .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "9.1.0"),

    // Global keyboard shortcuts (optional)
    .package(url: "https://github.com/sindresorhus/KeyboardShortcuts.git", from: "2.0.0"),
]
```

### No External Dependencies Needed For

- **Networking**: URLSession (built-in)
- **UI**: SwiftUI (built-in)
- **JSON**: Codable (built-in)
- **Concurrency**: async/await, Combine (built-in)
- **Glassmorphism**: SwiftUI materials (built-in)
- **iMessage sending**: AppleScript (built-in)
- **Keychain**: Security framework (built-in)

---

## Why These Choices

### GRDB over SQLite.swift

| Feature | GRDB | SQLite.swift |
|---------|------|--------------|
| Database observation | Yes | No |
| Async/await | Yes | Limited |
| Migrations | Yes | Yes |
| Full-text search | Yes | Yes |
| SwiftUI integration | SharingGRDB | Manual |
| Recent updates | Dec 2025 | Less active |

GRDB's database observation is critical - when Messages.app receives new messages, chat.db updates, and GRDB can notify your app to refresh the UI automatically.

### URLSession over Alamofire

For this app's needs (simple REST API calls to Gmail and Instagram):
- URLSession with async/await is clean and sufficient
- No need for Alamofire's advanced features
- One less dependency to maintain
- Native performance

### GoogleSignIn-iOS over DIY OAuth

- OAuth 2.0 is complex with token refresh, PKCE, etc.
- Google's SDK handles it all
- Official support, actively maintained
- Works on macOS with SwiftUI

### SwiftUI over AppKit

- Modern, declarative API
- Built-in materials for glassmorphism
- Excellent macOS performance in 2025
- Easier to maintain long-term
- Can drop down to AppKit via NSViewRepresentable when needed

---

## What NOT to Use

### Avoid These Libraries

| Library | Why Avoid |
|---------|-----------|
| **Swiftagram** | Private Instagram API - account ban risk |
| **SwiftyInsta** | Unmaintained, recommends Swiftagram |
| **p2/OAuth2** | GoogleSignIn-iOS is simpler for Gmail |
| **Realm** | Overkill for this use case, GRDB is lighter |
| **Core Data** | SwiftData is recommended for new projects |
| **RxSwift** | Use Combine + async/await instead |
| **PromiseKit** | Use async/await instead |

### Avoid These Approaches

| Approach | Why Avoid |
|----------|-----------|
| **Unofficial Instagram APIs** | Account restrictions, ToS violation |
| **Electron/web wrapper** | Project requires native macOS |
| **UIKit on macOS** | SwiftUI is better for new macOS apps |
| **Global state singletons** | Use @Observable with proper dependency injection |
| **Heavy use of Combine** | async/await is cleaner for most operations |

---

## Confidence Assessment

| Component | Confidence | Reasoning |
|-----------|------------|-----------|
| **SwiftUI + Swift 6** | HIGH | Official Apple stack, well documented |
| **GRDB.swift 7.9.0** | HIGH | Verified via GitHub, actively maintained |
| **GoogleSignIn-iOS 9.1.0** | HIGH | Verified via GitHub releases, official Google SDK |
| **URLSession for APIs** | HIGH | Native framework, mature async/await support |
| **AppleScript for iMessage** | HIGH | Only supported method, well documented |
| **Instagram Graph API** | HIGH | Official API, but constraints are significant |
| **SwiftUI Materials** | HIGH | Native framework, WWDC 2025 improvements |
| **KeyboardShortcuts** | MEDIUM | Third-party, but from trusted author (Sindre Sorhus) |
| **SwiftData** | MEDIUM | Good for app data, but newer framework |

---

## Installation Commands

```bash
# Create new Xcode project: macOS App, SwiftUI, Swift

# Add packages via Xcode:
# File -> Add Package Dependencies

# GRDB.swift
https://github.com/groue/GRDB.swift.git

# GoogleSignIn-iOS
https://github.com/google/GoogleSignIn-iOS.git

# KeyboardShortcuts (optional)
https://github.com/sindresorhus/KeyboardShortcuts.git
```

---

## Minimum System Requirements

| Requirement | Value |
|-------------|-------|
| **macOS deployment target** | macOS 14.0 (for SwiftData) or macOS 15.0 (for latest SwiftUI) |
| **Xcode** | 16.3+ |
| **Swift** | 6.1+ |
| **User permissions** | Full Disk Access (for chat.db) |

---

## Sources

### Official Documentation
- [Apple SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Apple SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui/creating-a-macos-app)
- [WWDC 2025: What's new in SwiftUI](https://developer.apple.com/videos/play/wwdc2025/256/)

### GitHub Repositories (Verified)
- [GRDB.swift](https://github.com/groue/GRDB.swift) - v7.9.0, Dec 2025
- [GoogleSignIn-iOS](https://github.com/google/GoogleSignIn-iOS) - v9.1.0, Jan 2025
- [KeyboardShortcuts](https://github.com/sindresorhus/KeyboardShortcuts)
- [VisualEffects](https://github.com/twostraws/VisualEffects) - Apple's wrapper

### Technical References
- [SwiftUI for Mac 2025](https://troz.net/post/2025/swiftui-mac-2025/)
- [Modern iOS Architecture 2025](https://medium.com/@csmax/the-ultimate-guide-to-modern-ios-architecture-in-2025-9f0d5fdc892f)
- [Instagram Graph API Guide 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [Instagram DM API Guide](https://www.bot.space/blog/the-instagram-dm-api-your-ultimate-guide-to-automation-sales-and-customer-loyalty-svpt5)
- [SwiftData vs Core Data 2025](https://byby.dev/swiftdata-or-coredata)
- [Combine vs async/await 2025](https://medium.com/@rajputpragat/combine-vs-async-await-in-2025-is-combine-still-relevant-134ef8449a22)
- [Alamofire vs URLSession](https://www.avanderlee.com/swift/alamofire-vs-urlsession/)
- [iMessage SQL Database](https://spin.atomicobject.com/search-imessage-sql/)
- [Send iMessage with AppleScript](https://chrispennington.blog/blog/send-imessage-with-applescript/)
