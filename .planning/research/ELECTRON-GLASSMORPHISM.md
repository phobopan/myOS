# Electron Glassmorphism on macOS: Implementation Guide

**Researched:** 2026-01-20
**Electron versions tested:** 32-39
**macOS versions:** Sonoma 14.x, Sequoia 15.x, Tahoe 26.x
**Confidence:** HIGH (verified against official Electron docs and recent GitHub issues)

---

## Quick Start: Recommended Configuration

```javascript
const { app, BrowserWindow, systemPreferences } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    // === TRANSPARENCY & VIBRANCY ===
    transparent: true,
    vibrancy: 'under-window',           // Best for full-window glassmorphism
    visualEffectState: 'active',         // Keep vibrancy even when unfocused

    // === FRAMELESS WITH TRAFFIC LIGHTS ===
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },

    // === PREVENT WHITE FLASH ===
    show: false,
    backgroundColor: '#00000000',        // Fully transparent

    // === macOS EXTRAS ===
    hasShadow: true,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadFile('index.html');

  // Show only when ready to prevent white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}

app.whenReady().then(createWindow);
```

---

## 1. Vibrancy API (`setVibrancy`)

### Available Materials (macOS only)

| Material | Use Case | Visual Effect |
|----------|----------|---------------|
| `under-window` | **RECOMMENDED** - Full window blur | Blurs desktop/windows behind app |
| `sidebar` | Navigation panels | Finder-style sidebar blur |
| `titlebar` | Title bar only | Subtle blur matching system |
| `menu` | Dropdown menus | Menu-style translucency |
| `popover` | Popover dialogs | Light blur for overlays |
| `sheet` | Modal sheets | Sheet-style backdrop |
| `header` | Header areas | Header-appropriate blur |
| `hud` | HUD overlays | Darker, high-contrast blur |
| `fullscreen-ui` | Fullscreen controls | Control overlay blur |
| `tooltip` | Tooltips | Subtle tooltip blur |
| `content` | Content areas | General content blur |
| `window` | Window backgrounds | Standard window blur |
| `selection` | Selection highlights | Selection-aware blur |

**Deprecated (do not use):** `appearance-based`, `light`, `medium-light`, `ultra-dark`

### Constructor vs Method

```javascript
// Option 1: In constructor (preferred)
const win = new BrowserWindow({
  vibrancy: 'under-window',
  visualEffectState: 'active'
});

// Option 2: Set after creation
win.setVibrancy('sidebar');
win.setVibrancy('sidebar', { animationDuration: 300 }); // With fade

// Remove vibrancy
win.setVibrancy(null);
```

### `visualEffectState` Options

Controls vibrancy behavior when window loses focus:

| Value | Behavior |
|-------|----------|
| `followWindow` | **Default** - Dims when unfocused (native macOS behavior) |
| `active` | Always vibrant, even when unfocused |
| `inactive` | Always dimmed appearance |

**Recommendation:** Use `active` for always-on glassmorphism. Use `followWindow` for native feel.

---

## 2. Transparent Window Setup

### Required Configuration

```javascript
const win = new BrowserWindow({
  transparent: true,           // REQUIRED for transparency
  frame: false,                // Usually needed for custom UI
  backgroundColor: '#00000000', // Fully transparent (8-char hex with alpha)
  hasShadow: true,             // Optional: macOS window shadow
  resizable: false,            // IMPORTANT: resizable can break transparency
});
```

### CSS Requirements

```css
/* Root must be transparent */
html, body {
  background: transparent;
  /* Or with slight tint for legibility */
  background: rgba(255, 255, 255, 0.1);
}
```

### Preventing White Flash

```javascript
const win = new BrowserWindow({
  show: false,                  // Start hidden
  backgroundColor: '#00000000', // Transparent background
  transparent: true,
});

win.loadFile('index.html');

// Show only after first paint
win.once('ready-to-show', () => {
  win.show();
});
```

**Warning:** Setting `paintWhenInitiallyHidden: false` will prevent `ready-to-show` from firing.

---

## 3. CSS `backdrop-filter` for Additional Blur

Use CSS for element-level glassmorphism on TOP of the window vibrancy.

### Basic Glassmorphism

```css
.glass-panel {
  /* Semi-transparent background */
  background: rgba(255, 255, 255, 0.15);

  /* Blur effect */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);  /* Safari/older WebKit */

  /* Subtle border for depth */
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;

  /* Optional: shadow for floating effect */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### Dark Mode Variant

```css
.glass-panel-dark {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Performance Tips

- Limit to 2-3 glassmorphic elements per viewport
- Use `blur(8-12px)` on mobile/lower-powered devices
- Avoid animating elements with `backdrop-filter`
- `backdrop-filter` only blurs elements BEHIND the target (within the webview)

**Key distinction:**
- `vibrancy` (Electron) = blurs desktop/other apps behind window
- `backdrop-filter` (CSS) = blurs web content behind element

---

## 4. Frameless Window with Custom Titlebar

### BrowserWindow Configuration

```javascript
const HEADER_HEIGHT = 52;
const TRAFFIC_LIGHT_HEIGHT = 14;

const win = new BrowserWindow({
  titleBarStyle: 'hiddenInset',  // Hide title, show traffic lights
  trafficLightPosition: {
    x: 20,
    y: Math.round(HEADER_HEIGHT / 2 - TRAFFIC_LIGHT_HEIGHT / 2)
  },

  // For Windows: use overlay instead
  ...(process.platform === 'win32' && {
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: HEADER_HEIGHT
    }
  })
});
```

### `titleBarStyle` Options (macOS)

| Value | Effect |
|-------|--------|
| `default` | Standard macOS title bar |
| `hidden` | No title bar, traffic lights visible top-left |
| `hiddenInset` | **RECOMMENDED** - No title bar, inset traffic lights |
| `customButtonsOnHover` | Traffic lights only visible on hover (experimental) |

### CSS for Draggable Regions

```css
/* Make custom titlebar draggable */
.titlebar {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  height: 52px;
  display: flex;
  align-items: center;
  padding-left: 80px;  /* Space for traffic lights */
}

/* Exclude interactive elements from drag */
.titlebar button,
.titlebar input,
.titlebar a {
  -webkit-app-region: no-drag;
}
```

### Handling Double-Click (macOS Maximize/Minimize)

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  titlebarDoubleClick: () => ipcRenderer.send('titlebar-double-click')
});

// main.js
const { ipcMain, systemPreferences, BrowserWindow } = require('electron');

ipcMain.on('titlebar-double-click', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');

  if (action === 'Minimize') {
    win.minimize();
  } else if (action === 'Maximize') {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});
```

```javascript
// renderer.js (React example)
function Titlebar() {
  const handleDoubleClick = (e) => {
    if (e.target === e.currentTarget) {
      window.electron.titlebarDoubleClick();
    }
  };

  return (
    <div className="titlebar" onDoubleClick={handleDoubleClick}>
      {/* Titlebar content */}
    </div>
  );
}
```

---

## 5. Limitations and Gotchas

### Known Issues by macOS Version

| Issue | macOS Versions | Workaround |
|-------|----------------|------------|
| Vibrancy + transparency white flash | All | Use `show: false` + `ready-to-show` |
| GPU load regression with vibrancy corners | Tahoe 26.x | Update to Electron 36.9.2+ |
| `setVibrancy` crash on renderer-created windows | Sequoia 15.x | Fixed in Electron 32.2.7+ |
| Vibrancy dims when unfocused | All (by design) | Set `visualEffectState: 'active'` |

### General Limitations

1. **Transparent windows cannot be resized reliably**
   ```javascript
   // If you need resizing, accept potential visual glitches
   resizable: true  // May cause white flash on resize
   ```

2. **DevTools disables transparency**
   - Transparency stops working when DevTools are open
   - No workaround; close DevTools for production testing

3. **Cannot click through transparent areas**
   - Electron limitation, no workaround

4. **Native shadow not shown on transparent windows**
   - Use CSS `box-shadow` instead
   ```css
   .window-content {
     box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
   }
   ```

5. **Only rectangular draggable regions**
   - Cannot define circular or complex draggable shapes

6. **Context menu issues on draggable regions**
   - Don't use custom context menus on draggable areas

### Electron Version Compatibility

| Feature | Minimum Version | Notes |
|---------|-----------------|-------|
| `vibrancy` | 1.4.0 | macOS only |
| `visualEffectState` | 11.0.0 | Requires `vibrancy` |
| `trafficLightPosition` | 8.0.0 | macOS only |
| `titleBarOverlay` | 13.0.0 | Windows/Linux |
| Vibrancy corner fix | 36.9.2 | Fixes Tahoe GPU issue |

**Recommended minimum:** Electron 35+ for best stability

---

## 6. Complete Example: Glassmorphism App

### main.js

```javascript
const { app, BrowserWindow, systemPreferences, ipcMain } = require('electron');
const path = require('path');

const HEADER_HEIGHT = 52;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Transparency & Vibrancy
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',

    // Frameless with traffic lights
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 19 },

    // Prevent white flash
    show: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle titlebar double-click
  ipcMain.on('titlebar-double-click', (event) => {
    const clickedWin = BrowserWindow.fromWebContents(event.sender);
    const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');

    if (action === 'Minimize') {
      clickedWin.minimize();
    } else if (action === 'Maximize') {
      clickedWin.isMaximized() ? clickedWin.unmaximize() : clickedWin.maximize();
    }
  });

  return win;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

### preload.js

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  titlebarDoubleClick: () => ipcRenderer.send('titlebar-double-click'),
  platform: process.platform,
});
```

### styles.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a1a;
}

/* Custom Titlebar */
.titlebar {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  height: 52px;
  display: flex;
  align-items: center;
  padding-left: 80px; /* Space for traffic lights */
  padding-right: 16px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.titlebar-title {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.8;
}

.titlebar button {
  -webkit-app-region: no-drag;
}

/* Main Content */
.content {
  padding: 24px;
  height: calc(100% - 52px);
  overflow-y: auto;
}

/* Glass Cards */
.glass-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body {
    color: #f0f0f0;
  }

  .titlebar {
    background: rgba(30, 30, 30, 0.5);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .glass-card {
    background: rgba(40, 40, 40, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
```

### index.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="styles.css">
  <title>Glassmorphism App</title>
</head>
<body>
  <div class="titlebar" id="titlebar">
    <span class="titlebar-title">My Glass App</span>
  </div>

  <div class="content">
    <div class="glass-card">
      <h2>Welcome</h2>
      <p>This is a glassmorphism card with blur effect.</p>
    </div>

    <div class="glass-card">
      <h2>Another Card</h2>
      <p>The blur stacks: window vibrancy + CSS backdrop-filter.</p>
    </div>
  </div>

  <script>
    document.getElementById('titlebar').addEventListener('dblclick', (e) => {
      if (e.target === e.currentTarget || e.target.classList.contains('titlebar-title')) {
        window.electron.titlebarDoubleClick();
      }
    });
  </script>
</body>
</html>
```

---

## 7. Advanced: Multiple Vibrancy Regions

Electron only supports ONE vibrancy material per window. For multiple regions (e.g., sidebar + content), use a native module.

### Using `electron-tinted-with-sidebar`

```bash
npm install electron-tinted-with-sidebar
```

```javascript
const tint = require('electron-tinted-with-sidebar');

const win = new BrowserWindow({
  backgroundColor: '#00000000',
  titleBarStyle: 'hidden',
  vibrancy: 'sidebar',  // Base vibrancy
});

// MUST call before window is shown
tint.setWindowAnimationBehavior(win.getNativeWindowHandle(), true);
tint.setWindowLayout(
  win.getNativeWindowHandle(),
  200,  // sidebar width
  52,   // titlebar height
  0     // right margin (optional)
);

win.loadFile('index.html');
```

**Note:** This is a native module requiring compilation. Only use if you truly need multiple vibrancy regions.

---

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron BaseWindowConstructorOptions](https://www.electronjs.org/docs/latest/api/structures/base-window-options)
- [Electron Window Customization Tutorial](https://www.electronjs.org/docs/latest/tutorial/window-customization)
- [Electron Custom Window Styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles)
- [Building a Custom Title Bar in Electron (DoltHub, 2025)](https://www.dolthub.com/blog/2025-02-11-building-a-custom-title-bar-in-electron/)
- [Vibrancy + Transparent Background Bug #31862](https://github.com/electron/electron/issues/31862)
- [macOS Tahoe GPU Load Fix PR #48376](https://github.com/electron/electron/pull/48376)
- [setVibrancy Crash Fix (VSCode #236772)](https://github.com/microsoft/vscode/issues/236772)
- [NSVisualEffectView Apple Documentation](https://developer.apple.com/documentation/appkit/nsvisualeffectview)
- [NSWindow Styles Reference](https://lukakerr.github.io/swift/nswindow-styles)
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
