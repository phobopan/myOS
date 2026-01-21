# Phase 1: Foundation (Electron) - Research

**Researched:** 2026-01-21
**Domain:** Electron desktop app with glassmorphism UI, React, TypeScript, Tailwind CSS
**Confidence:** HIGH

## Summary

This phase establishes an Electron desktop application with a glassmorphism (frosted glass) UI using React, TypeScript, and Tailwind CSS. The standard approach in 2025-2026 is to use **electron-vite** for fast development builds with HMR, combined with a well-structured project separating main, preload, and renderer processes.

Key technical decisions:
- **Scaffolding**: Use `electron-vite` (v5.0) with the React TypeScript template for fastest development experience and native HMR support
- **Glassmorphism**: Combine Electron's `vibrancy: 'under-window'` for native macOS blur with CSS `backdrop-filter` for layered glass effects
- **Layout**: Use `react-resizable-panels` for the two-pane list/detail layout with persistence
- **State**: Use Zustand for lightweight state management (settings, UI state)
- **Settings Storage**: Use `electron-store` for persistent JSON-based settings

**Primary recommendation:** Scaffold with `npm create @quick-start/electron@latest phoebeOS -- --template react-ts`, then add Tailwind CSS v4, react-resizable-panels, and electron-store.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | 35+ | Desktop app framework | Required; v35+ for stability with vibrancy |
| electron-vite | 5.0.x | Build tooling | Fast HMR, first-class React/TS support, recommended over Forge for dev experience |
| react | 18.x/19.x | UI framework | Specified in requirements |
| typescript | 5.x | Type safety | Specified in requirements |
| tailwindcss | 4.x | Utility CSS | Specified in requirements; v4 has smaller runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | 2.x | Resizable two-pane layout | Required for list/detail layout |
| zustand | 5.x | State management | UI state, settings state (lightweight, no providers) |
| electron-store | 10.x | Persistent settings | User preferences, app state persistence |
| @tailwindcss/postcss | 4.x | PostCSS integration | Required for Tailwind v4 with Vite |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | electron-forge + vite | Forge is official but Vite plugin is experimental; electron-vite has better HMR |
| zustand | Redux Toolkit | Redux better for large teams/complex apps; Zustand simpler for this scope |
| electron-store | localStorage | electron-store persists across app updates, supports encryption |
| react-resizable-panels | react-split-pane | react-resizable-panels is actively maintained, better accessibility |

**Installation:**
```bash
# Scaffold project
npm create @quick-start/electron@latest phoebeOS -- --template react-ts
cd phoebeOS

# Add Tailwind CSS v4
npm install tailwindcss @tailwindcss/postcss postcss

# Add UI and state libraries
npm install react-resizable-panels zustand electron-store
```

## Architecture Patterns

### Recommended Project Structure
```
phoebeOS/
├── electron.vite.config.ts     # Build configuration
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # App entry, window creation
│   │   └── ipc/                # IPC handlers
│   │       └── settings.ts     # Settings IPC handlers
│   ├── preload/                # Context bridge scripts
│   │   └── index.ts            # Expose safe APIs
│   └── renderer/               # React app (browser context)
│       ├── src/
│       │   ├── App.tsx         # Root component
│       │   ├── components/
│       │   │   ├── layout/     # Layout components
│       │   │   │   ├── TitleBar.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   └── DetailPane.tsx
│       │   │   ├── settings/   # Settings panel components
│       │   │   └── ui/         # Reusable UI components
│       │   ├── stores/         # Zustand stores
│       │   │   └── settingsStore.ts
│       │   ├── hooks/          # Custom hooks
│       │   ├── types/          # TypeScript types
│       │   └── styles/
│       │       └── index.css   # Tailwind entry
│       └── index.html
├── resources/                  # App icons, assets
└── out/                        # Build output
```

### Pattern 1: Glassmorphism Window Configuration
**What:** Configure BrowserWindow for native macOS glassmorphism with vibrancy
**When to use:** Always for the main window on macOS
**Example:**
```typescript
// Source: Electron BrowserWindow API docs
import { BrowserWindow, systemPreferences, ipcMain } from 'electron';

const HEADER_HEIGHT = 52;
const TRAFFIC_LIGHT_HEIGHT = 14;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Glassmorphism
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',  // Stay vibrant when unfocused
    backgroundColor: '#00000000',

    // Frameless with traffic lights
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: {
      x: 20,
      y: Math.round(HEADER_HEIGHT / 2 - TRAFFIC_LIGHT_HEIGHT / 2)
    },

    // Prevent white flash
    show: false,
    hasShadow: true,

    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });

  win.once('ready-to-show', () => win.show());
  return win;
}
```

### Pattern 2: Secure IPC with contextBridge
**What:** Expose typed, safe APIs from main process to renderer
**When to use:** Any main/renderer communication
**Example:**
```typescript
// src/preload/index.ts
// Source: Electron Context Isolation docs
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Partial<Settings>) =>
    ipcRenderer.invoke('settings:set', settings),

  // Window controls
  titlebarDoubleClick: () => ipcRenderer.send('titlebar:double-click'),

  // Platform info
  platform: process.platform,
} as const;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// src/renderer/src/types/electron.d.ts
export interface IElectronAPI {
  getSettings: () => Promise<Settings>;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  titlebarDoubleClick: () => void;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

### Pattern 3: Two-Pane Resizable Layout
**What:** Master/detail layout with resizable panels
**When to use:** Main app layout
**Example:**
```tsx
// Source: react-resizable-panels GitHub
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <PanelGroup
        direction="horizontal"
        autoSaveId="main-layout"
      >
        <Panel
          defaultSize={30}
          minSize={20}
          maxSize={50}
          className="glass-panel"
        >
          <MessageList />
        </Panel>

        <PanelResizeHandle className="w-1 bg-white/10 hover:bg-white/20 transition-colors" />

        <Panel minSize={50} className="glass-panel">
          <ThreadView />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

### Pattern 4: Zustand Store with Persistence
**What:** Lightweight state management synced with electron-store
**When to use:** Settings, UI preferences
**Example:**
```typescript
// src/renderer/src/stores/settingsStore.ts
import { create } from 'zustand';

interface SettingsState {
  notifications: boolean;
  soundEnabled: boolean;
  setNotifications: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  notifications: true,
  soundEnabled: true,

  setNotifications: async (enabled) => {
    set({ notifications: enabled });
    await window.electronAPI.setSettings({ notifications: enabled });
  },

  setSoundEnabled: async (enabled) => {
    set({ soundEnabled: enabled });
    await window.electronAPI.setSettings({ soundEnabled: enabled });
  },

  loadSettings: async () => {
    const settings = await window.electronAPI.getSettings();
    set(settings);
  },
}));
```

### Anti-Patterns to Avoid
- **Exposing raw ipcRenderer:** Never expose `ipcRenderer.send` or `ipcRenderer.on` directly; wrap each operation in a specific function
- **Using localStorage for settings:** Breaks on app updates; use electron-store
- **frame: false without titleBarStyle:** Loses native window controls; use `titleBarStyle: 'hiddenInset'`
- **Rendering to document.body directly:** Creates issues with React 18; use a dedicated root element

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panels | CSS resize or manual drag | react-resizable-panels | Keyboard accessibility, persistence, edge cases |
| Settings persistence | JSON file operations | electron-store | Atomic writes, migrations, encryption support |
| State management | React Context for everything | Zustand | Context causes full re-renders; Zustand has selective subscriptions |
| Glass blur effect | Complex CSS-only solutions | Electron vibrancy + Tailwind backdrop | Native performance, proper macOS integration |
| Traffic light positioning | Manual calculations | trafficLightPosition option | Handles macOS version differences automatically |

**Key insight:** Electron provides native APIs (vibrancy, trafficLightPosition) that CSS cannot replicate. Use them for authentic macOS experience.

## Common Pitfalls

### Pitfall 1: White Flash on Window Load
**What goes wrong:** Brief white flash before glassmorphism renders
**Why it happens:** Window shown before transparent background is applied
**How to avoid:**
```typescript
const win = new BrowserWindow({
  show: false,
  backgroundColor: '#00000000',
  transparent: true,
});
win.once('ready-to-show', () => win.show());
```
**Warning signs:** Users report "flicker" on app launch

### Pitfall 2: Vibrancy Dims When Unfocused
**What goes wrong:** Glass effect disappears when clicking away from app
**Why it happens:** Default macOS behavior dims inactive windows
**How to avoid:** Set `visualEffectState: 'active'` in BrowserWindow options
**Warning signs:** App looks different when not in foreground

### Pitfall 3: electron-store ESM Compatibility
**What goes wrong:** `require is not defined` or import errors
**Why it happens:** electron-store v10+ is ESM-only, no CommonJS
**How to avoid:**
- Ensure `"type": "module"` in package.json for main process
- Or use dynamic import: `const Store = (await import('electron-store')).default`
**Warning signs:** Build errors mentioning ESM/CommonJS

### Pitfall 4: DevTools Breaks Transparency
**What goes wrong:** Transparency stops working during development
**Why it happens:** Known Electron limitation when DevTools are open
**How to avoid:** Close DevTools for visual testing; no workaround exists
**Warning signs:** Works in production, not in development

### Pitfall 5: Draggable Region Blocks Clicks
**What goes wrong:** Buttons in titlebar area don't respond to clicks
**Why it happens:** `-webkit-app-region: drag` captures all events
**How to avoid:** Add `-webkit-app-region: no-drag` to interactive elements
**Warning signs:** Titlebar buttons unresponsive

### Pitfall 6: react-resizable-panels Needs Height
**What goes wrong:** Panels don't render or have zero height
**Why it happens:** PanelGroup requires parent with explicit height
**How to avoid:** Ensure container has `height: 100vh` or `h-screen` class
**Warning signs:** Empty layout, no visible panels

## Code Examples

Verified patterns from official sources:

### Tailwind CSS Glassmorphism Classes
```css
/* src/renderer/src/styles/index.css */
@import "tailwindcss";

@layer components {
  .glass-panel {
    @apply bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl;
  }

  .glass-panel-dark {
    @apply bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl;
  }

  .glass-titlebar {
    @apply bg-white/5 backdrop-blur-md border-b border-white/10;
    -webkit-app-region: drag;
  }

  .glass-button {
    @apply bg-white/10 hover:bg-white/20 backdrop-blur-sm
           border border-white/20 rounded-lg px-4 py-2
           transition-colors duration-200;
    -webkit-app-region: no-drag;
  }
}

/* Ensure transparent background */
html, body, #root {
  @apply bg-transparent h-full;
}

/* White text for glass UI */
body {
  @apply text-white;
}
```

### Titlebar Double-Click Handler (macOS)
```typescript
// src/main/index.ts
import { ipcMain, systemPreferences, BrowserWindow } from 'electron';

ipcMain.on('titlebar:double-click', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const action = systemPreferences.getUserDefault(
    'AppleActionOnDoubleClick',
    'string'
  );

  if (action === 'Minimize') {
    win.minimize();
  } else if (action === 'Maximize') {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
  // 'None' = do nothing (user preference)
});
```

### Settings IPC Handler
```typescript
// src/main/ipc/settings.ts
import Store from 'electron-store';
import { ipcMain } from 'electron';

interface Settings {
  notifications: boolean;
  soundEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
}

const store = new Store<Settings>({
  defaults: {
    notifications: true,
    soundEnabled: true,
    theme: 'system',
  },
});

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => store.store);

  ipcMain.handle('settings:set', (_, settings: Partial<Settings>) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key as keyof Settings, value);
    }
  });
}
```

### Settings Panel Component
```tsx
// src/renderer/src/components/settings/SettingsPanel.tsx
import { useSettingsStore } from '../../stores/settingsStore';

export function SettingsPanel() {
  const { notifications, soundEnabled, setNotifications, setSoundEnabled } =
    useSettingsStore();

  return (
    <div className="glass-panel p-6 space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <span>Notifications</span>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="glass-button w-5 h-5"
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="glass-button w-5 h-5"
          />
        </label>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Webpack for Electron | Vite (electron-vite) | 2023-2024 | 10x faster HMR, simpler config |
| electron-store CommonJS | electron-store ESM only | v10.0 (2024) | Must use ESM or dynamic import |
| Tailwind v3 config file | Tailwind v4 CSS-based config | Jan 2025 | Simpler setup, smaller runtime |
| Redux for all state | Zustand for small/medium apps | 2023+ | Less boilerplate, same DevTools support |
| Custom resize handles | react-resizable-panels | 2023+ | Built-in accessibility, persistence |

**Deprecated/outdated:**
- `electron-forge` Vite plugin is still experimental; use electron-vite for development
- Tailwind v3 config approach (tailwind.config.js) replaced by CSS-based config in v4
- `appearance-based`, `light`, `medium-light`, `ultra-dark` vibrancy values deprecated

## Open Questions

Things that couldn't be fully resolved:

1. **Tailwind v4 + electron-vite integration specifics**
   - What we know: Both work independently; PostCSS setup required
   - What's unclear: Whether electron-vite template needs additional Tailwind v4 config
   - Recommendation: Start with official React-TS template, add Tailwind v4 per their docs

2. **macOS Notch handling for custom titlebars**
   - What we know: trafficLightPosition handles standard positioning
   - What's unclear: Whether MacBooks with notch need additional safe area considerations
   - Recommendation: Test on notched MacBooks; traffic lights should be fine with standard inset

## Sources

### Primary (HIGH confidence)
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) - vibrancy, trafficLightPosition, transparent options
- [Electron Context Isolation Tutorial](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - contextBridge patterns
- [electron-vite Official Site](https://electron-vite.org/) - project setup, templates
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Panel API, usage patterns
- [electron-store GitHub](https://github.com/sindresorhus/electron-store) - ESM requirement, API

### Secondary (MEDIUM confidence)
- [Electron Forge Vite Template](https://www.electronforge.io/templates/vite-+-typescript) - alternative scaffolding
- [Tailwind CSS Glassmorphism Guide](https://flyonui.com/blog/glassmorphism-with-tailwind-css/) - Tailwind glass patterns
- [Zustand vs Redux Comparison](https://zustand.docs.pmnd.rs/getting-started/comparison) - state management choice

### Tertiary (LOW confidence)
- Blog posts on electron-vite + Tailwind v4 setup (2025) - integration specifics
- Community templates (GitHub) - implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against official docs and npm
- Architecture: HIGH - patterns from Electron and library documentation
- Pitfalls: HIGH - documented in GitHub issues and official docs
- Tailwind v4 integration: MEDIUM - newer, fewer verified examples with electron-vite

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable technology stack)
