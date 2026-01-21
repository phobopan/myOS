# Phase 1: Foundation - Research

**Researched:** 2026-01-20
**Domain:** SwiftUI macOS glassmorphism, window configuration, layout patterns
**Confidence:** HIGH

## Summary

This research covers the technical implementation of a glassmorphism-styled macOS app shell with transparent window background, two-pane layout, and custom slide-over settings panel. The standard approach uses SwiftUI's Material system (`.ultraThinMaterial`, `.thinMaterial`) combined with `NSVisualEffectView` via `NSViewRepresentable` for window-level transparency. The two-pane layout is best achieved with a custom `GeometryReader`-based approach rather than `NavigationSplitView` to ensure exact 33/67 proportions with a fixed divider.

Key findings: (1) Window transparency requires bridging to AppKit via `NSVisualEffectView` with `.behindWindow` blending mode; (2) NavigationSplitView has known layout issues on macOS and its column widths can be ignored by the system; (3) Left-side slide-over requires custom implementation using `ZStack`, `.offset()`, and `.transition(.move(edge: .leading))`; (4) iOS 26/macOS 26 introduces Liquid Glass with `.glassEffect()` modifier, but for macOS 15 compatibility, use traditional Materials.

**Primary recommendation:** Use `NSVisualEffectView` wrapped in `NSViewRepresentable` for window background, SwiftUI Materials (`.thinMaterial`, `.ultraThinMaterial`) for inner glass containers, and a custom `GeometryReader`-based layout for the fixed 33/67 split.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SwiftUI | 5.x (Xcode 16+) | UI framework | Apple's declarative UI framework, native macOS support |
| AppKit (NSVisualEffectView) | macOS 14+ | Window transparency | Only way to achieve true window-level blur behind content |
| Combine | Built-in | State/binding | Native reactive framework for SwiftUI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SF Symbols | 5+ | Icons | System icons that match macOS style |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GeometryReader layout | NavigationSplitView | NavigationSplitView has layout bugs on macOS, system may ignore column widths |
| NSVisualEffectView wrapper | SwiftUI .background(.ultraThinMaterial) | Material only blurs within view bounds, not window background |
| Custom ZStack slide-over | .sheet() modifier | .sheet() only slides from bottom/right, no left-side support |

**Installation:**
```bash
# No external dependencies - pure SwiftUI + AppKit
# Create new Xcode project: macOS > App > SwiftUI lifecycle
```

## Architecture Patterns

### Recommended Project Structure
```
phoebeOS/
├── phoebeOSApp.swift           # App entry point, window configuration
├── ContentView.swift           # Main container with ZStack for settings overlay
├── Views/
│   ├── MainSplitView.swift     # Two-pane layout container
│   ├── MessageListPane.swift   # Left pane (33%)
│   ├── ThreadViewPane.swift    # Right pane (67%)
│   ├── SettingsPanel.swift     # Slide-over settings
│   └── GlassCard.swift         # Reusable glass container component
├── Components/
│   ├── VisualEffectView.swift  # NSVisualEffectView wrapper
│   └── PlaceholderData.swift   # Sample messages for demo
└── Preview Content/
    └── SampleMessages.swift    # Mock data for previews
```

### Pattern 1: Window Transparency with NSVisualEffectView
**What:** Wrap `NSVisualEffectView` in `NSViewRepresentable` to achieve window-level blur
**When to use:** When you need the desktop to show through the window background
**Example:**
```swift
// Source: https://zachwaugh.com/posts/swiftui-blurred-window-background-macos
struct VisualEffectView: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .hudWindow
    var blendingMode: NSVisualEffectView.BlendingMode = .behindWindow

    func makeNSView(context: Context) -> NSVisualEffectView {
        let effectView = NSVisualEffectView()
        effectView.material = material
        effectView.blendingMode = blendingMode
        effectView.state = .active
        return effectView
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
    }
}

// Usage in ContentView
struct ContentView: View {
    var body: some View {
        MainContent()
            .background(VisualEffectView().ignoresSafeArea())
    }
}
```

### Pattern 2: Layered Glass Cards
**What:** Inner containers with slightly more opaque materials than background
**When to use:** For message list pane, thread view pane, settings panel
**Example:**
```swift
// Source: https://dev.to/sebastienlato/how-to-build-apple-style-glassmorphic-ui-in-swiftui-3lgh
struct GlassCard<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 16
    var material: Material = .thinMaterial  // More opaque than background

    init(cornerRadius: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .background(material)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
    }
}
```

### Pattern 3: Fixed Proportional Split Layout
**What:** GeometryReader-based two-pane with exact 33/67 ratio and fixed divider
**When to use:** For the main message list / thread view layout
**Example:**
```swift
struct MainSplitView: View {
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Left pane: 1/3 width
                GlassCard {
                    MessageListPane()
                }
                .frame(width: geometry.size.width * 0.33)

                // Thin divider line
                Rectangle()
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 1)

                // Right pane: 2/3 width (minus divider)
                GlassCard {
                    ThreadViewPane()
                }
            }
            .padding(12) // Gap between panes and window edge
        }
    }
}
```

### Pattern 4: Left-Side Slide-Over Settings
**What:** Custom overlay panel that slides from left edge
**When to use:** For settings panel requirement
**Example:**
```swift
// Source: https://blog.logrocket.com/create-custom-collapsible-sidebar-swiftui/
struct ContentView: View {
    @State private var showSettings = false

    var body: some View {
        ZStack(alignment: .leading) {
            // Main content
            MainSplitView()

            // Dimming overlay
            if showSettings {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                    .onTapGesture { showSettings = false }
                    .transition(.opacity)
            }

            // Settings panel
            SettingsPanel(isPresented: $showSettings)
                .frame(width: 320)
                .offset(x: showSettings ? 0 : -320)
                .animation(.spring(response: 0.3), value: showSettings)
        }
    }
}
```

### Anti-Patterns to Avoid
- **Using NavigationSplitView for exact proportions:** The system may ignore your `navigationSplitViewColumnWidth()` values. Use GeometryReader for guaranteed sizing.
- **Using `.sheet()` for left-side panels:** SwiftUI sheets only slide from bottom (iOS) or appear as modal windows (macOS). Custom ZStack approach required.
- **Applying `.background(.material)` to window:** This only blurs within view bounds. For window-level transparency, use `NSVisualEffectView`.
- **Setting `window?.backgroundColor = .clear` without vibrancy:** Creates harsh transparent window. Use `NSVisualEffectView` for proper frosted glass effect.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blur effects | Custom CIFilter blur | SwiftUI Materials (`.thinMaterial`, etc.) | Materials are GPU-accelerated, respect system settings, update dynamically |
| Window vibrancy | Custom transparency code | `NSVisualEffectView` | Only AppKit provides proper behind-window blending |
| Rounded corners | Custom Path drawing | `RoundedRectangle(style: .continuous)` | `.continuous` style matches Apple's superellipse corners |
| System icons | Custom icon assets | SF Symbols | Scale properly, respect accessibility, match system style |
| Animation curves | Custom timing functions | `.spring()`, `.easeInOut` | Tested values that feel native |

**Key insight:** SwiftUI Materials and AppKit's NSVisualEffectView handle complex compositing, accessibility (reduced transparency), and system appearance changes automatically. Custom blur implementations break in accessibility modes and look wrong in different lighting conditions.

## Common Pitfalls

### Pitfall 1: Window Loses Transparency on Focus Change
**What goes wrong:** Window background reverts to solid color when window loses/gains focus
**Why it happens:** Default NSWindow behavior; SwiftUI doesn't persist transparent state
**How to avoid:** Set `NSVisualEffectView.state = .active` (not `.followsWindowActiveState`)
**Warning signs:** Background flickers or changes opacity when clicking other apps

### Pitfall 2: NavigationSplitView Column Widths Ignored
**What goes wrong:** Sidebar is wrong width despite using `.navigationSplitViewColumnWidth()`
**Why it happens:** System reserves right to override your width specifications
**How to avoid:** Use `GeometryReader` with explicit frame calculations for guaranteed sizing
**Warning signs:** Layout looks different on different screen sizes

### Pitfall 3: Settings Sheet Appears as Modal Window
**What goes wrong:** Using `.sheet()` creates a separate modal window instead of slide-over
**Why it happens:** macOS sheets are modal windows, not overlays like iOS
**How to avoid:** Build custom slide-over with ZStack, offset, and animation
**Warning signs:** Settings opens in a separate floating window

### Pitfall 4: Content Clipped by Window Titlebar
**What goes wrong:** Content area has unexpected gap at top
**Why it happens:** Window has toolbar/titlebar taking space
**How to avoid:** Use `.windowStyle(.hiddenTitleBar)` on WindowGroup, enable background drag
**Warning signs:** Content starts below an empty area at window top

### Pitfall 5: Blur Effect Not Working in Previews
**What goes wrong:** SwiftUI previews show solid color instead of blur
**Why it happens:** `NSVisualEffectView` requires actual window context
**How to avoid:** Accept that blur won't show in previews; test in running app. Use `#if DEBUG` to show placeholder color in previews.
**Warning signs:** Preview looks wrong but app looks correct

### Pitfall 6: Text Unreadable on Transparent Background
**What goes wrong:** White text disappears against light desktop backgrounds
**Why it happens:** Glassmorphism depends on blur to create contrast
**How to avoid:** Ensure sufficient blur (heavy frosted glass), add subtle text shadow, test against various desktop backgrounds
**Warning signs:** Text hard to read with certain wallpapers

## Code Examples

Verified patterns from official sources:

### Window Configuration with Hidden Titlebar
```swift
// Source: https://nilcoalescing.com/blog/CustomizingMacOSWindowBackgroundInSwiftUI/
@main
struct phoebeOSApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowBackgroundDragBehavior(.enabled)
        .defaultSize(width: 1200, height: 800)
    }
}
```

### Window Size Constraints
```swift
// Source: https://swiftwithmajid.com/2024/08/06/customizing-windows-in-swiftui/
WindowGroup {
    ContentView()
        .frame(minWidth: 900, minHeight: 600)
}
.windowResizability(.contentMinSize)
```

### Material Types for Layering
```swift
// Background layer: heaviest blur (most transparent)
.background(VisualEffectView(material: .hudWindow))  // NSVisualEffectView

// Inner widgets: more opaque materials
.background(.thinMaterial)      // Moderate blur, readable
.background(.regularMaterial)   // More opaque, higher contrast

// Material hierarchy from most to least transparent:
// .ultraThinMaterial < .thinMaterial < .regularMaterial < .thickMaterial < .ultraThickMaterial
```

### Complete GlassCard with Shadow
```swift
struct GlassCard<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 16

    init(cornerRadius: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .background(.thinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 4)
    }
}
```

### Placeholder Message Data
```swift
// Place in Preview Content/ folder - stripped from release builds
struct SampleMessage: Identifiable {
    let id = UUID()
    let sender: String
    let preview: String
    let timestamp: Date
    let isRead: Bool
}

extension SampleMessage {
    static let samples: [SampleMessage] = [
        SampleMessage(sender: "Sarah Chen", preview: "Hey! Are we still meeting tomorrow?", timestamp: Date().addingTimeInterval(-3600), isRead: false),
        SampleMessage(sender: "Alex Rivera", preview: "Thanks for sending that over", timestamp: Date().addingTimeInterval(-7200), isRead: true),
        SampleMessage(sender: "Mom", preview: "Call me when you get a chance", timestamp: Date().addingTimeInterval(-86400), isRead: false),
        SampleMessage(sender: "James Wilson", preview: "The project looks great!", timestamp: Date().addingTimeInterval(-172800), isRead: true),
    ]
}
```

### Settings Panel with Sidebar Navigation
```swift
struct SettingsPanel: View {
    @Binding var isPresented: Bool
    @State private var selectedSection: SettingsSection = .accounts

    enum SettingsSection: String, CaseIterable {
        case accounts = "Accounts"
        case notifications = "Notifications"
        case shortcuts = "Shortcuts"
        case appearance = "Appearance"

        var icon: String {
            switch self {
            case .accounts: return "person.crop.circle"
            case .notifications: return "bell"
            case .shortcuts: return "keyboard"
            case .appearance: return "paintbrush"
            }
        }
    }

    var body: some View {
        GlassCard {
            HStack(spacing: 0) {
                // Mini sidebar
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Settings")
                            .font(.headline)
                            .foregroundStyle(.white)
                        Spacer()
                        Button(action: { isPresented = false }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.white.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.bottom)

                    ForEach(SettingsSection.allCases, id: \.self) { section in
                        Button(action: { selectedSection = section }) {
                            Label(section.rawValue, systemImage: section.icon)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 8)
                        .background(selectedSection == section ? Color.white.opacity(0.1) : Color.clear)
                        .cornerRadius(6)
                    }
                    Spacer()
                }
                .frame(width: 140)
                .padding()

                Divider()

                // Content area
                VStack {
                    Text(selectedSection.rawValue)
                        .font(.title2)
                        .foregroundStyle(.white)
                    Spacer()
                    Text("Settings content here")
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .padding()
            }
        }
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UIBlurEffect custom views | SwiftUI Materials | iOS 15 / macOS 12 (2021) | Use `.background(.thinMaterial)` directly |
| AppDelegate lifecycle | SwiftUI App protocol | iOS 14 / macOS 11 (2020) | Use @main App struct, @NSApplicationDelegateAdaptor only if needed |
| NSViewController hosting | Pure SwiftUI windows | macOS 11+ | WindowGroup handles everything |
| Manual window sizing | `.defaultSize()`, `.windowResizability()` | macOS 13 (2022) | Declarative window configuration |
| Custom blur implementations | Liquid Glass `.glassEffect()` | macOS 26 (2025) | New API for glass effects (requires macOS 26) |

**Deprecated/outdated:**
- `NSVisualEffectView.Material.appearanceBased` - deprecated in macOS 10.14
- Color-named materials (`.dark`, `.light`) - deprecated, use semantic names (`.hudWindow`, `.windowBackground`)
- `NavigationView` - deprecated in favor of `NavigationSplitView` and `NavigationStack`

**Note on Liquid Glass:** macOS 26 introduces `.glassEffect()` modifier with `.regular`, `.clear`, and `.identity` variants. This is the future direction but requires macOS 26. For macOS 15 compatibility, continue using Materials and NSVisualEffectView.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact NSVisualEffectView.Material for heavy blur**
   - What we know: `.hudWindow` and `.fullScreenUI` are available, provide heavy blur
   - What's unclear: Exact visual difference between materials on current macOS
   - Recommendation: Test `.hudWindow` first, adjust if needed

2. **Window state persistence with custom configuration**
   - What we know: SwiftUI auto-saves window frame to UserDefaults
   - What's unclear: Whether custom NSVisualEffectView configuration persists correctly
   - Recommendation: Test window state restoration after app restart

3. **Performance with multiple layered materials**
   - What we know: Materials are GPU-accelerated
   - What's unclear: Performance impact of multiple GlassCard layers
   - Recommendation: Profile if app feels sluggish; reduce layers if needed

## Sources

### Primary (HIGH confidence)
- Apple Developer Documentation - NavigationSplitView, Materials, Window styling
- https://zachwaugh.com/posts/swiftui-blurred-window-background-macos - NSVisualEffectView wrapper approach
- https://nilcoalescing.com/blog/CustomizingMacOSWindowBackgroundInSwiftUI/ - containerBackground, windowStyle modifiers
- https://swiftwithmajid.com/2024/08/06/customizing-windows-in-swiftui/ - Window size configuration

### Secondary (MEDIUM confidence)
- https://dev.to/sebastienlato/how-to-build-apple-style-glassmorphic-ui-in-swiftui-3lgh - Glass card patterns
- https://blog.logrocket.com/create-custom-collapsible-sidebar-swiftui/ - Custom sidebar slide-over pattern
- https://github.com/conorluddy/LiquidGlassReference - iOS 26 Liquid Glass reference
- https://troz.net/post/2025/swiftui-mac-2025/ - SwiftUI for Mac 2025 updates

### Tertiary (LOW confidence)
- https://github.com/lukakerr/NSWindowStyles - NSWindow configuration options (reference, not tutorial)
- WebSearch results for NavigationSplitView issues - multiple developer reports of column width bugs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SwiftUI Materials and NSVisualEffectView are well-documented Apple APIs
- Architecture: HIGH - GeometryReader layouts and ZStack overlays are standard SwiftUI patterns
- Pitfalls: MEDIUM - Based on developer community reports, some may be version-specific
- Glassmorphism styling: MEDIUM - Visual design is subjective, may need iteration
- Window configuration: HIGH - Apple documentation covers windowStyle, defaultSize, resizability

**Research date:** 2026-01-20
**Valid until:** 60 days (stable APIs, not rapidly changing domain)
