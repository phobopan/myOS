import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env — try multiple paths for dev and packaged builds
for (const p of [
  path.join(__dirname, '../../../.env'),          // dev: dist/main/main -> project root
  path.join(process.resourcesPath || '', '.env'), // packaged: Contents/Resources/.env
]) {
  if (config({ path: p }).parsed) break;
}

import { app, BrowserWindow, ipcMain, session, systemPreferences, Notification } from 'electron';
import https from 'https';
import http from 'http';
import os from 'os';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);
import { registerIpcHandlers } from './ipc';
import ElectronStore from 'electron-store';
import type { Tag, ContactTagAssignment, ContactIdentifier, DigestCategory, DismissedThread, PinnedDashboard, Cluster, PinnedChat } from '../shared/ipcTypes';
import { DEFAULT_TIER_TAGS } from '../shared/ipcTypes';
import { randomUUID } from 'crypto';
import { llmService } from './services/llmService';
import { digestService } from './services/digestService';
import { setGmailCredentials, hasGmailCredentials, setLLMApiKey, hasLLMApiKey } from './services/credentialStore';

// Settings store for app preferences
interface AppSettings {
  notificationsEnabled: boolean;
  customTags: Tag[];
  contactTagAssignments: ContactTagAssignment[];
  dismissedThreads: DismissedThread[];
  userName: string;
  onboardingComplete: boolean;
  pinnedDashboard: PinnedDashboard;
}

const settingsStore = new ElectronStore<AppSettings>({
  name: 'app-settings',
  defaults: {
    notificationsEnabled: true,
    customTags: [],
    contactTagAssignments: [],
    dismissedThreads: [],
    userName: '',
    onboardingComplete: false,
    pinnedDashboard: {
      clusters: [],
      unclusteredPins: [],
      canvasOffset: { x: 0, y: 0 },
    },
  },
});

const HEADER_HEIGHT = 52;
const TRAFFIC_LIGHT_HEIGHT = 14;

function getAppDisplayName(): string {
  const name = settingsStore.get('userName');
  return name ? `${name}OS` : 'OS';
}


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Transparent window with native macOS vibrancy blur
    // Note: transparent + vibrancy is GPU-heavy but provides the glassmorphism aesthetic
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'hud',
    visualEffectState: 'active',

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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Development: load from Vite dev server
  // Production: load built files
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show only when ready to prevent white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle titlebar double-click (macOS behavior)
  ipcMain.on('titlebar-double-click', (event) => {
    const clickedWin = BrowserWindow.fromWebContents(event.sender);
    if (!clickedWin) return;

    const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    if (action === 'Minimize') {
      clickedWin.minimize();
    } else if (action === 'Maximize') {
      clickedWin.isMaximized() ? clickedWin.unmaximize() : clickedWin.maximize();
    }
  });

  return win;
}

// Register notification IPC handlers
function registerAppHandlers() {
  // Get/set notification settings
  ipcMain.handle('settings:getNotificationsEnabled', () => {
    const value = settingsStore.get('notificationsEnabled');
    console.log('[Settings] getNotificationsEnabled:', value);
    return value;
  });

  ipcMain.handle('settings:setNotificationsEnabled', (_, enabled: boolean) => {
    console.log('[Settings] setNotificationsEnabled:', enabled);
    settingsStore.set('notificationsEnabled', enabled);
  });

  // Show notification
  ipcMain.handle('app:showNotification', (_, options: { title: string; body: string; subtitle?: string }) => {
    console.log('[Notification] Request received:', options.title);

    if (!settingsStore.get('notificationsEnabled')) {
      console.log('[Notification] Disabled in settings');
      return { sent: false, reason: 'disabled' };
    }

    if (!Notification.isSupported()) {
      console.log('[Notification] Not supported on this platform');
      return { sent: false, reason: 'not_supported' };
    }

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        subtitle: options.subtitle,
        silent: false,
      });

      notification.on('show', () => {
        console.log('[Notification] Shown successfully');
      });

      notification.on('click', () => {
        // Bring app to front when notification clicked
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          wins[0].show();
          wins[0].focus();
        }
      });

      notification.on('failed', (_, error) => {
        console.error('[Notification] Failed:', error);
      });

      notification.show();
      return { sent: true };
    } catch (err) {
      console.error('[Notification] Error:', err);
      return { sent: false, reason: 'error', error: String(err) };
    }
  });

  // Check notification permission status (for debugging)
  ipcMain.handle('app:getNotificationStatus', () => {
    return {
      supported: Notification.isSupported(),
      enabled: settingsStore.get('notificationsEnabled'),
    };
  });

  // ============ Tag System IPC Handlers ============

  // Get all tags (tier + custom combined)
  ipcMain.handle('tags:getAll', () => {
    const customTags = settingsStore.get('customTags') || [];
    return [...DEFAULT_TIER_TAGS, ...customTags];
  });

  // Get only custom tags
  ipcMain.handle('tags:getCustom', () => {
    return settingsStore.get('customTags') || [];
  });

  // Helper to notify renderer of tag changes
  const emitTagsChanged = () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('tags:changed');
    }
  };

  // Create a new custom tag
  ipcMain.handle('tags:create', (_, tag: Omit<Tag, 'id' | 'type'>) => {
    const customTags = settingsStore.get('customTags') || [];
    const newTag: Tag = {
      id: randomUUID(),
      type: 'custom',
      name: tag.name,
      importance: tag.importance,
      color: tag.color,
    };
    customTags.push(newTag);
    settingsStore.set('customTags', customTags);
    emitTagsChanged();
    return newTag;
  });

  // Update an existing tag (name, color, importance)
  ipcMain.handle('tags:update', (_, tagId: string, updates: Partial<Pick<Tag, 'name' | 'color' | 'importance'>>) => {
    const customTags = settingsStore.get('customTags') || [];
    const index = customTags.findIndex(t => t.id === tagId);
    if (index !== -1) {
      customTags[index] = { ...customTags[index], ...updates };
      settingsStore.set('customTags', customTags);
      emitTagsChanged();
      return customTags[index];
    }
    return null;
  });

  // Delete a custom tag and remove it from all assignments
  ipcMain.handle('tags:delete', (_, tagId: string) => {
    // Remove from custom tags list
    const customTags = settingsStore.get('customTags') || [];
    const filtered = customTags.filter(t => t.id !== tagId);
    settingsStore.set('customTags', filtered);
    emitTagsChanged();

    // Remove from all contact assignments
    const assignments = settingsStore.get('contactTagAssignments') || [];
    const updatedAssignments = assignments
      .map(a => ({
        ...a,
        tagIds: a.tagIds.filter(id => id !== tagId),
      }))
      .filter(a => a.tagIds.length > 0); // Remove contacts with no tags
    settingsStore.set('contactTagAssignments', updatedAssignments);

    return { success: true };
  });

  // Get all contact-tag assignments
  ipcMain.handle('tags:getAssignments', () => {
    return settingsStore.get('contactTagAssignments') || [];
  });

  // Get tags for a specific contact
  ipcMain.handle('tags:getContactTags', (_, contact: ContactIdentifier) => {
    const assignments = settingsStore.get('contactTagAssignments') || [];
    const assignment = assignments.find(
      a => a.contact.platform === contact.platform && a.contact.identifier === contact.identifier
    );
    return assignment?.tagIds || [];
  });

  // Assign tags to a contact (replaces existing tags)
  ipcMain.handle('tags:assignToContact', (_, contact: ContactIdentifier, tagIds: string[], displayName?: string) => {
    const assignments = settingsStore.get('contactTagAssignments') || [];
    const existingIndex = assignments.findIndex(
      a => a.contact.platform === contact.platform && a.contact.identifier === contact.identifier
    );

    if (tagIds.length === 0) {
      // Remove assignment if no tags
      if (existingIndex !== -1) {
        assignments.splice(existingIndex, 1);
      }
    } else {
      const newAssignment: ContactTagAssignment = {
        contact,
        tagIds,
        displayName,
      };
      if (existingIndex !== -1) {
        assignments[existingIndex] = newAssignment;
      } else {
        assignments.push(newAssignment);
      }
    }

    settingsStore.set('contactTagAssignments', assignments);
    emitTagsChanged();
    return { success: true };
  });

  // ============ Dismissed Threads IPC Handlers ============

  ipcMain.handle('threads:getDismissed', () => {
    return settingsStore.get('dismissedThreads') || [];
  });

  ipcMain.handle('threads:dismiss', (_, thread: DismissedThread) => {
    const threads = settingsStore.get('dismissedThreads') || [];
    // Replace if already exists for same id+source
    const filtered = threads.filter(t => !(t.id === thread.id && t.source === thread.source));
    filtered.push(thread);
    settingsStore.set('dismissedThreads', filtered);
  });

  ipcMain.handle('threads:undismiss', (_, id: string, source: string) => {
    const threads = settingsStore.get('dismissedThreads') || [];
    const filtered = threads.filter(t => !(t.id === id && t.source === source));
    settingsStore.set('dismissedThreads', filtered);
  });

  // ============ Claude CLI IPC Handlers ============

  ipcMain.handle('claude:isAvailable', async () => {
    return llmService.isAvailable();
  });

  // ============ LLM Provider IPC Handlers ============

  ipcMain.handle('llm:getProvider', () => {
    return llmService.getActiveProviderId();
  });

  ipcMain.handle('llm:setProvider', (_, providerId: string) => {
    llmService.setActiveProvider(providerId);
    return { success: true };
  });

  ipcMain.handle('llm:getApiKey', (_, provider: string) => {
    return { hasKey: hasLLMApiKey(provider) };
  });

  ipcMain.handle('llm:setApiKey', (_, provider: string, key: string) => {
    setLLMApiKey(provider, key);
    llmService.refreshProviders();
    return { success: true };
  });

  ipcMain.handle('llm:testConnection', async (_, providerId?: string) => {
    return llmService.testConnection(providerId);
  });

  // ============ Digest IPC Handlers ============

  ipcMain.handle('digest:generate', async () => {
    return digestService.generateDigest();
  });

  ipcMain.handle('digest:getLast', () => {
    return digestService.getLastDigest();
  });

  ipcMain.handle('digest:getCategories', () => {
    return digestService.getCategories();
  });

  ipcMain.handle('digest:createCategory', (_, category: Omit<DigestCategory, 'id'>) => {
    return digestService.createCategory(category);
  });

  ipcMain.handle('digest:updateCategory', (_, id: string, updates: Partial<Omit<DigestCategory, 'id'>>) => {
    return digestService.updateCategory(id, updates);
  });

  ipcMain.handle('digest:deleteCategory', (_, id: string) => {
    return digestService.deleteCategory(id);
  });

  ipcMain.handle('digest:getAutoSettings', () => {
    return digestService.getAutoSettings();
  });

  ipcMain.handle('digest:setAutoSettings', (_, enabled: boolean, time: string, frequency: 'hourly' | 'daily' | 'weekly', lookbackDays: number, intervalHours: number, weekday: number) => {
    digestService.setAutoSettings(enabled, time, frequency, lookbackDays, intervalHours, weekday);
    return { success: true };
  });

  // ============ App Config IPC Handlers ============

  ipcMain.handle('app:getUserName', () => {
    return settingsStore.get('userName') || '';
  });

  ipcMain.handle('app:setUserName', (_, name: string) => {
    settingsStore.set('userName', name);
    // Update window title
    const wins = BrowserWindow.getAllWindows();
    const displayName = name ? `${name}OS` : 'myOS';
    for (const win of wins) {
      win.setTitle(displayName);
    }
  });

  ipcMain.handle('app:getOnboardingComplete', () => {
    return settingsStore.get('onboardingComplete') || false;
  });

  ipcMain.handle('app:setOnboardingComplete', (_, complete: boolean) => {
    settingsStore.set('onboardingComplete', complete);
  });

  ipcMain.handle('app:getAppName', () => {
    return getAppDisplayName();
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:restartApp', () => {
    app.relaunch();
    app.exit(0);
  });

  // ============ Pinned Dashboard IPC Handlers ============

  ipcMain.handle('dashboard:get', () => {
    return settingsStore.get('pinnedDashboard');
  });

  ipcMain.handle('dashboard:save', (_, dashboard: PinnedDashboard) => {
    settingsStore.set('pinnedDashboard', dashboard);
    return { success: true };
  });

  ipcMain.handle('dashboard:createCluster', (_, cluster: Omit<Cluster, 'id'>) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    const newCluster: Cluster = {
      id: randomUUID(),
      name: cluster.name,
      color: cluster.color,
      position: cluster.position,
      pins: cluster.pins || [],
    };
    dashboard.clusters.push(newCluster);
    settingsStore.set('pinnedDashboard', dashboard);
    return newCluster;
  });

  ipcMain.handle('dashboard:updateCluster', (_, clusterId: string, updates: Partial<Pick<Cluster, 'name' | 'color' | 'position'>>) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    const index = dashboard.clusters.findIndex(c => c.id === clusterId);
    if (index !== -1) {
      dashboard.clusters[index] = { ...dashboard.clusters[index], ...updates };
      settingsStore.set('pinnedDashboard', dashboard);
      return dashboard.clusters[index];
    }
    return null;
  });

  ipcMain.handle('dashboard:deleteCluster', (_, clusterId: string) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    const cluster = dashboard.clusters.find(c => c.id === clusterId);
    if (cluster) {
      // Move pins to unclustered
      dashboard.unclusteredPins.push(...cluster.pins);
      dashboard.clusters = dashboard.clusters.filter(c => c.id !== clusterId);
      settingsStore.set('pinnedDashboard', dashboard);
    }
    return { success: true };
  });

  ipcMain.handle('dashboard:pinChat', (_, pin: PinnedChat, clusterId?: string) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    if (clusterId) {
      const cluster = dashboard.clusters.find(c => c.id === clusterId);
      if (cluster) {
        // Remove from anywhere else first
        dashboard.unclusteredPins = dashboard.unclusteredPins.filter(
          p => !(p.source === pin.source && p.id === pin.id)
        );
        for (const c of dashboard.clusters) {
          c.pins = c.pins.filter(p => !(p.source === pin.source && p.id === pin.id));
        }
        cluster.pins.push(pin);
      }
    } else {
      // Remove from anywhere else first
      dashboard.unclusteredPins = dashboard.unclusteredPins.filter(
        p => !(p.source === pin.source && p.id === pin.id)
      );
      for (const c of dashboard.clusters) {
        c.pins = c.pins.filter(p => !(p.source === pin.source && p.id === pin.id));
      }
      dashboard.unclusteredPins.push(pin);
    }
    settingsStore.set('pinnedDashboard', dashboard);
    return { success: true };
  });

  ipcMain.handle('dashboard:unpinChat', (_, source: string, id: string) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    dashboard.unclusteredPins = dashboard.unclusteredPins.filter(
      p => !(p.source === source && p.id === id)
    );
    for (const c of dashboard.clusters) {
      c.pins = c.pins.filter(p => !(p.source === source && p.id === id));
    }
    settingsStore.set('pinnedDashboard', dashboard);
    return { success: true };
  });

  ipcMain.handle('dashboard:movePin', (_, source: string, id: string, targetClusterId: string | null) => {
    const dashboard = settingsStore.get('pinnedDashboard');
    // Find and remove the pin from its current location
    let pin: PinnedChat | undefined;
    const unpinIdx = dashboard.unclusteredPins.findIndex(p => p.source === source && p.id === id);
    if (unpinIdx !== -1) {
      pin = dashboard.unclusteredPins.splice(unpinIdx, 1)[0];
    } else {
      for (const c of dashboard.clusters) {
        const idx = c.pins.findIndex(p => p.source === source && p.id === id);
        if (idx !== -1) {
          pin = c.pins.splice(idx, 1)[0];
          break;
        }
      }
    }
    if (pin) {
      if (targetClusterId) {
        const target = dashboard.clusters.find(c => c.id === targetClusterId);
        if (target) target.pins.push(pin);
        else dashboard.unclusteredPins.push(pin);
      } else {
        dashboard.unclusteredPins.push(pin);
      }
    }
    settingsStore.set('pinnedDashboard', dashboard);
    return { success: true };
  });

  // ============ Gmail Credentials IPC Handlers ============

  ipcMain.handle('gmail:setCredentials', (_, clientId: string, clientSecret: string) => {
    setGmailCredentials(clientId, clientSecret);
    return { success: true };
  });

  ipcMain.handle('gmail:hasCredentials', () => {
    return hasGmailCredentials();
  });
}

// ============ Self-Update Logic ============

import type { UpdateProgress } from '../shared/ipcTypes';

function sendUpdateProgress(progress: UpdateProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update-progress', progress);
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (u: string) => {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, { headers: { 'User-Agent': 'myOS' } }, (res) => {
        // Follow redirects (GitHub sends 302)
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (totalBytes > 0) {
            sendUpdateProgress({ phase: 'downloading', percent: Math.round((downloaded / totalBytes) * 100) });
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(() => resolve()); });
      }).on('error', (err) => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
    };
    follow(url);
  });
}

async function installUpdate(dmgUrl: string): Promise<void> {
  const dmgPath = path.join(os.tmpdir(), 'myOS-update.dmg');
  let mountPoint = '';

  try {
    // 1. Download DMG
    sendUpdateProgress({ phase: 'downloading', percent: 0 });
    await downloadFile(dmgUrl, dmgPath);

    // 2. Install
    sendUpdateProgress({ phase: 'installing' });

    // Mount DMG
    const { stdout: plistOut } = await execFile('hdiutil', [
      'attach', dmgPath, '-nobrowse', '-noautoopen', '-plist',
    ]);

    // Parse mount point from plist output
    const mountMatch = plistOut.match(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/);
    if (!mountMatch) throw new Error('Could not find mount point in hdiutil output');
    mountPoint = mountMatch[1];

    // Find .app in mounted volume
    const entries = fs.readdirSync(mountPoint);
    const appName = entries.find(e => e.endsWith('.app'));
    if (!appName) throw new Error('No .app found in DMG');

    const srcApp = path.join(mountPoint, appName);
    const destApp = path.join('/Applications', appName);

    // Remove old app and copy new one
    await execFile('rm', ['-rf', destApp]);
    await execFile('cp', ['-R', srcApp, destApp]);

    // Strip quarantine and re-sign (unsigned app needs ad-hoc signature)
    await execFile('xattr', ['-r', '-d', 'com.apple.quarantine', destApp]);
    await execFile('codesign', ['--force', '--deep', '--sign', '-', destApp]);

    sendUpdateProgress({ phase: 'done' });

    // Relaunch from new location
    app.relaunch({ execPath: path.join(destApp, 'Contents', 'MacOS', 'myOS') });
    app.exit(0);

  } catch (err: any) {
    sendUpdateProgress({ phase: 'error', message: err.message || String(err) });
    throw err;
  } finally {
    // Cleanup: unmount and remove DMG
    try {
      if (mountPoint) await execFile('hdiutil', ['detach', mountPoint, '-force']);
    } catch { /* ignore */ }
    try {
      if (fs.existsSync(dmgPath)) fs.unlinkSync(dmgPath);
    } catch { /* ignore */ }
  }
}

// GPU/rendering optimizations
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');

// Prevent macOS TCC prompts for Photos/Downloads by redirecting download path
// and disabling Chromium features that probe protected directories
app.commandLine.appendSwitch('disable-features', 'DesktopCapture,PictureInPicture');

app.whenReady().then(() => {
  // Redirect default download path away from ~/Downloads to avoid TCC prompt
  const ses = session.defaultSession;
  ses.setDownloadPath(path.join(app.getPath('userData'), 'downloads'));
  // Initialize LLM providers from stored API keys
  llmService.refreshProviders();

  registerIpcHandlers();
  registerAppHandlers();
  createWindow();

  // Start digest auto-scheduler if enabled
  digestService.startAutoSchedule();

  // Update check — compare local version against latest GitHub release
  const checkForUpdate = async () => {
    try {
      const https = await import('https');
      const data = await new Promise<string>((resolve, reject) => {
        https.get('https://api.github.com/repos/phobopan/myOS/releases/latest', {
          headers: { 'User-Agent': 'myOS' },
        }, (res) => {
          let body = '';
          res.on('data', (chunk: string) => { body += chunk; });
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const release = JSON.parse(data);
      const latest = release.tag_name?.replace(/^v/, '');
      const current = app.getVersion();
      if (latest && latest !== current) {
        console.log(`[Update] New version available: ${latest} (current: ${current})`);
        const dmg = release.assets?.find((a: any) => a.name.endsWith('.dmg'));
        const downloadUrl = dmg?.browser_download_url || release.html_url;
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('update-available', { version: latest, url: downloadUrl });
        }
      } else {
        console.log(`[Update] Up to date (${current})`);
      }
    } catch (err) {
      console.error('[Update] Check failed:', err);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    checkForUpdate();
  }

  ipcMain.handle('app:checkForUpdates', () => checkForUpdate());
  ipcMain.handle('app:installUpdate', (_, url: string) => installUpdate(url));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow();
});
