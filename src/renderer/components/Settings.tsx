import { memo, useState, useEffect } from 'react';
import type { Tag, DigestCategory } from '../types';
import { DEFAULT_TIER_TAGS } from '../types';
import { TagCreateModal } from './TagCreateModal';
import { DigestCategoryModal } from './DigestCategoryModal';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  gmailAuth?: { authenticated: boolean; email: string | null; error: string | null };
  onGmailConnect?: () => void;
  onGmailDisconnect?: () => void;
  imessageConnected?: boolean;
  onImessageOpenSettings?: () => void;
  // Instagram props
  instagramAuth?: { authenticated: boolean; username: string | null; error: string | null };
  onInstagramConnect?: (username: string, password: string) => Promise<void>;
  onInstagramConnect2FA?: (username: string, password: string, code: string) => Promise<void>;
  onInstagramDisconnect?: () => void;
  // Notification settings
  notificationsEnabled?: boolean;
  onNotificationsChange?: (enabled: boolean) => void;
  // Tag settings
  customTags?: Tag[];
  onTagCreate?: (tag: { name: string; importance: number; color: string }) => Promise<void>;
  onTagUpdate?: (tagId: string, updates: { name?: string; color?: string; importance?: number }) => Promise<void>;
  onTagDelete?: (tagId: string) => Promise<void>;
  // Claude AI settings
  claudeAvailable?: boolean;
  // Digest settings
  digestCategories?: DigestCategory[];
  onDigestCategoryCreate?: (category: { name: string; color: string; description?: string }) => Promise<void>;
  onDigestCategoryUpdate?: (id: string, updates: { name?: string; color?: string; description?: string }) => Promise<void>;
  onDigestCategoryDelete?: (id: string) => Promise<void>;
  digestAutoEnabled?: boolean;
  digestAutoTime?: string;
  digestFrequency?: 'hourly' | 'daily' | 'weekly';
  digestLookbackDays?: number;
  digestIntervalHours?: number;
  digestWeekday?: number;
  onDigestAutoSettingsChange?: (enabled: boolean, time: string, frequency: 'hourly' | 'daily' | 'weekly', lookbackDays: number, intervalHours: number, weekday: number) => Promise<void>;
  // App name
  appName?: string;
}

export const Settings = memo(function Settings({
  isOpen,
  onClose,
  gmailAuth,
  onGmailConnect,
  onGmailDisconnect,
  imessageConnected,
  onImessageOpenSettings,
  instagramAuth,
  onInstagramConnect,
  onInstagramConnect2FA,
  onInstagramDisconnect,
  notificationsEnabled = true,
  onNotificationsChange,
  customTags = [],
  onTagCreate,
  onTagUpdate,
  onTagDelete,
  claudeAvailable = false,
  digestCategories = [],
  onDigestCategoryCreate,
  onDigestCategoryUpdate,
  onDigestCategoryDelete,
  digestAutoEnabled = false,
  digestAutoTime = '18:00',
  digestFrequency = 'daily',
  digestLookbackDays = 7,
  digestIntervalHours = 1,
  digestWeekday = 1,
  onDigestAutoSettingsChange,
  appName = 'OS',
}: SettingsProps) {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => { window.electron.app.getVersion().then(setAppVersion); }, []);

  const [showInstagramLogin, setShowInstagramLogin] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramPassword, setInstagramPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Tag management state
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Digest category state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DigestCategory | null>(null);

  if (!isOpen) return null;

  const handleInstagramSubmit = async () => {
    if (!instagramUsername.trim() || !instagramPassword.trim() || !onInstagramConnect) return;
    setIsConnecting(true);
    setLoginError(null);

    try {
      await onInstagramConnect(instagramUsername.trim(), instagramPassword);
      // Success - close the form
      setShowInstagramLogin(false);
      setInstagramUsername('');
      setInstagramPassword('');
      setNeeds2FA(false);
      setTwoFactorCode('');
    } catch (err: any) {
      const errorMsg = err?.message || 'Login failed';
      if (errorMsg === '2FA_REQUIRED') {
        setNeeds2FA(true);
        setLoginError(null);
      } else if (errorMsg.includes('CHALLENGE_REQUIRED')) {
        setLoginError('Instagram requires verification. Please log in via the Instagram app first, then try again.');
      } else {
        setLoginError(errorMsg);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handle2FASubmit = async () => {
    if (!twoFactorCode.trim() || !onInstagramConnect2FA) return;
    setIsConnecting(true);
    setLoginError(null);

    try {
      await onInstagramConnect2FA(instagramUsername.trim(), instagramPassword, twoFactorCode.trim());
      // Success - close the form
      setShowInstagramLogin(false);
      setInstagramUsername('');
      setInstagramPassword('');
      setNeeds2FA(false);
      setTwoFactorCode('');
    } catch (err: any) {
      setLoginError(err?.message || '2FA verification failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const resetInstagramForm = () => {
    setShowInstagramLogin(false);
    setInstagramUsername('');
    setInstagramPassword('');
    setTwoFactorCode('');
    setNeeds2FA(false);
    setLoginError(null);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-modal w-[500px] max-h-[600px] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[500px]">
          {/* Accounts Section */}
          <section>
            <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              Connected Accounts
            </h3>
            <div className="space-y-3">
              {/* iMessage */}
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${imessageConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">iMessage</div>
                      {imessageConnected ? (
                        <div className="text-xs text-white/70">Connected via Full Disk Access</div>
                      ) : (
                        <div className="text-xs text-white/50">Requires Full Disk Access</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onImessageOpenSettings}
                    className={`text-xs transition-colors px-3 py-1 rounded bg-white/10 ${
                      imessageConnected
                        ? 'text-white/60 hover:text-white'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    {imessageConnected ? 'Manage Access' : 'Grant Access'}
                  </button>
                </div>
                {!imessageConnected && (
                  <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">
                      Click "Grant Access" to open System Settings and enable Full Disk Access for phoebeOS
                    </p>
                  </div>
                )}
              </div>

              {/* Gmail */}
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${gmailAuth?.authenticated ? 'bg-green-500' : gmailAuth?.error ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">Gmail</div>
                      {gmailAuth?.authenticated ? (
                        <div className="text-xs text-white/70">{gmailAuth.email}</div>
                      ) : (
                        <div className="text-xs text-white/50">Not connected</div>
                      )}
                    </div>
                  </div>
                  {gmailAuth?.authenticated ? (
                    <button
                      onClick={onGmailDisconnect}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1 rounded bg-white/10"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={onGmailConnect}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 rounded bg-white/10"
                    >
                      Connect
                    </button>
                  )}
                </div>
                {gmailAuth?.error && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{gmailAuth.error}</p>
                  </div>
                )}
              </div>

              {/* Instagram (only shown when enabled) */}
              {instagramAuth !== undefined && (
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${instagramAuth?.authenticated ? 'bg-green-500' : instagramAuth?.error ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">Instagram</div>
                      {instagramAuth?.authenticated ? (
                        <div className="text-xs text-white/70">@{instagramAuth.username}</div>
                      ) : (
                        <div className="text-xs text-white/50">Not connected</div>
                      )}
                    </div>
                  </div>
                  {instagramAuth?.authenticated ? (
                    <button
                      onClick={onInstagramDisconnect}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1 rounded bg-white/10"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowInstagramLogin(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 rounded bg-white/10"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Login Form */}
                {showInstagramLogin && !instagramAuth?.authenticated && (
                  <div className="mt-3 space-y-3">
                    {!needs2FA ? (
                      <>
                        <input
                          type="text"
                          value={instagramUsername}
                          onChange={(e) => setInstagramUsername(e.target.value)}
                          placeholder="Instagram username"
                          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                          disabled={isConnecting}
                        />
                        <input
                          type="password"
                          value={instagramPassword}
                          onChange={(e) => setInstagramPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                          disabled={isConnecting}
                          onKeyDown={(e) => e.key === 'Enter' && handleInstagramSubmit()}
                        />
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs text-blue-400">Enter the 2FA code from your authenticator app</p>
                        </div>
                        <input
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="6-digit code"
                          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 text-center tracking-widest"
                          disabled={isConnecting}
                          maxLength={6}
                          onKeyDown={(e) => e.key === 'Enter' && handle2FASubmit()}
                        />
                      </div>
                    )}

                    {loginError && (
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400">{loginError}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={resetInstagramForm}
                        className="flex-1 text-xs text-white/60 hover:text-white transition-colors px-3 py-2 rounded bg-white/10"
                        disabled={isConnecting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={needs2FA ? handle2FASubmit : handleInstagramSubmit}
                        disabled={
                          isConnecting ||
                          (needs2FA ? !twoFactorCode.trim() : (!instagramUsername.trim() || !instagramPassword.trim()))
                        }
                        className="flex-1 text-xs text-white hover:bg-blue-600 transition-colors px-3 py-2 rounded bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? 'Connecting...' : (needs2FA ? 'Verify' : 'Login')}
                      </button>
                    </div>
                  </div>
                )}

                {instagramAuth?.error && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{instagramAuth.error}</p>
                  </div>
                )}
                {!instagramAuth?.authenticated && !instagramAuth?.error && !showInstagramLogin && (
                  <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">Login with your Instagram credentials</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </section>

          {/* Claude AI Section */}
          <section>
            <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              Claude AI
            </h3>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${claudeAvailable ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <div className="text-sm font-medium text-white">Claude Code CLI</div>
                  <div className="text-xs text-white/50">
                    {claudeAvailable ? 'Connected — powers Daily Digest' : 'Not detected'}
                  </div>
                </div>
              </div>
              {!claudeAvailable && (
                <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400">
                    Claude Code CLI was not found. Make sure it's installed and on your PATH.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Digest Settings Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Digest Categories
              </h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Create Category
              </button>
            </div>
            {digestCategories.length === 0 ? (
              <div className="text-sm text-white/40 p-3 rounded-lg bg-white/5 text-center">
                No categories yet. Create categories for Claude to sort your emails.
              </div>
            ) : (
              <div className="space-y-1">
                {digestCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5 group"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white">{cat.name}</span>
                      {cat.description && (
                        <div className="text-xs text-white/40 truncate">{cat.description}</div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setShowCategoryModal(true);
                        }}
                        className="text-xs text-white/60 hover:text-white px-2 py-1 rounded bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDigestCategoryDelete?.(cat.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-white/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-digest settings */}
            <div className="mt-3 space-y-2">
              <div className="text-xs text-white/50 mb-2">Auto-generate</div>

              {/* Enable toggle */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <button
                  onClick={() => onDigestAutoSettingsChange?.(!digestAutoEnabled, digestAutoTime, digestFrequency, digestLookbackDays, digestIntervalHours, digestWeekday)}
                  className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                    digestAutoEnabled ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      digestAutoEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-white flex-1">Auto-generate digest</span>
              </div>

              {/* Frequency selector */}
              <div className="p-2 rounded-lg bg-white/5">
                <div className="text-xs text-white/50 mb-2">Frequency</div>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(['hourly', 'daily', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => onDigestAutoSettingsChange?.(digestAutoEnabled, digestAutoTime, freq, digestLookbackDays, digestIntervalHours, digestWeekday)}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                        digestFrequency === freq
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hourly: interval selector */}
              {digestFrequency === 'hourly' && (
                <div className="p-2 rounded-lg bg-white/5">
                  <div className="text-xs text-white/50 mb-2">Every</div>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    {([1, 2, 3, 4, 6] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => onDigestAutoSettingsChange?.(digestAutoEnabled, digestAutoTime, digestFrequency, digestLookbackDays, h, digestWeekday)}
                        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                          digestIntervalHours === h
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly: day-of-week selector */}
              {digestFrequency === 'weekly' && (
                <div className="p-2 rounded-lg bg-white/5">
                  <div className="text-xs text-white/50 mb-2">Day</div>
                  <div className="flex rounded-lg overflow-hidden border border-white/10">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day, i) => {
                      const weekday = i === 6 ? 0 : i + 1; // Mon=1..Sat=6, Sun=0
                      return (
                        <button
                          key={day}
                          onClick={() => onDigestAutoSettingsChange?.(digestAutoEnabled, digestAutoTime, digestFrequency, digestLookbackDays, digestIntervalHours, weekday)}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                            digestWeekday === weekday
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time picker — shown for daily & weekly only */}
              {digestFrequency !== 'hourly' && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <span className="text-sm text-white flex-1">Generate at</span>
                  <input
                    type="time"
                    value={digestAutoTime}
                    onChange={(e) => onDigestAutoSettingsChange?.(digestAutoEnabled, e.target.value, digestFrequency, digestLookbackDays, digestIntervalHours, digestWeekday)}
                    className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Lookback window */}
              <div className="p-2 rounded-lg bg-white/5">
                <div className="text-xs text-white/50 mb-2">Lookback window</div>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {([1, 3, 7, 14, 30] as const).map((days) => (
                    <button
                      key={days}
                      onClick={() => onDigestAutoSettingsChange?.(digestAutoEnabled, digestAutoTime, digestFrequency, days, digestIntervalHours, digestWeekday)}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                        digestLookbackDays === days
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Tags Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Contact Tags
              </h3>
              <button
                onClick={() => {
                  setEditingTag(null);
                  setShowTagModal(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Create Tag
              </button>
            </div>

            {/* Tier Tags */}
            <div className="mb-3">
              <div className="text-xs text-white/50 mb-2">Priority Tiers (built-in)</div>
              <div className="space-y-1">
                {DEFAULT_TIER_TAGS.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-white flex-1">{tag.name}</span>
                    <span className="text-xs text-white/40">
                      Importance: {tag.importance}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Tags */}
            <div>
              <div className="text-xs text-white/50 mb-2">Custom Tags</div>
              {customTags.length === 0 ? (
                <div className="text-sm text-white/40 p-3 rounded-lg bg-white/5 text-center">
                  No custom tags yet. Create one to organize your contacts.
                </div>
              ) : (
                <div className="space-y-1">
                  {customTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/5 group"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-white flex-1">{tag.name}</span>
                      <span className="text-xs text-white/40">
                        Importance: {tag.importance}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => {
                            setEditingTag(tag);
                            setShowTagModal(true);
                          }}
                          className="text-xs text-white/60 hover:text-white px-2 py-1 rounded bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onTagDelete?.(tag.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-white/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* About Section */}
          <section>
            <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              About
            </h3>
            <p className="text-sm text-white/50">
              {appName} v{appVersion}
            </p>
          </section>
        </div>
      </div>

      {/* Tag Create/Edit Modal */}
      <TagCreateModal
        isOpen={showTagModal}
        onClose={() => {
          setShowTagModal(false);
          setEditingTag(null);
        }}
        onSave={async (tagData) => {
          if (editingTag) {
            await onTagUpdate?.(editingTag.id, tagData);
          } else {
            await onTagCreate?.(tagData);
          }
        }}
        editTag={editingTag}
      />

      {/* Digest Category Create/Edit Modal */}
      <DigestCategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        onSave={async (catData) => {
          if (editingCategory) {
            await onDigestCategoryUpdate?.(editingCategory.id, catData);
          } else {
            await onDigestCategoryCreate?.(catData);
          }
        }}
        editCategory={editingCategory}
      />
    </div>
  );
});

function ToggleRow({
  label,
  description,
  enabled = false,
  onChange,
}: {
  label: string;
  description: string;
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
}) {
  const handleClick = () => {
    if (onChange) {
      onChange(!enabled);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/50">{description}</div>
      </div>
      <button
        onClick={handleClick}
        className={`w-10 h-6 rounded-full relative transition-colors ${
          enabled ? 'bg-blue-500' : 'bg-white/20'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
