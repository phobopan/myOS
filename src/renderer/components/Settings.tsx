interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  gmailAuth?: { authenticated: boolean; email: string | null; error: string | null };
  onGmailConnect?: () => void;
  onGmailDisconnect?: () => void;
  imessageConnected?: boolean;
  // Instagram props
  instagramAuth?: { authenticated: boolean; username: string | null; error: string | null };
  onInstagramConnect?: () => void;
  onInstagramDisconnect?: () => void;
}

export function Settings({ isOpen, onClose, gmailAuth, onGmailConnect, onGmailDisconnect, imessageConnected, instagramAuth, onInstagramConnect, onInstagramDisconnect }: SettingsProps) {
  if (!isOpen) return null;

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
              <AccountRow
                name="iMessage"
                status={imessageConnected ? 'connected' : 'pending'}
                description={imessageConnected ? 'Connected via Full Disk Access' : 'Requires Full Disk Access'}
              />

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

              {/* Instagram */}
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
                      onClick={onInstagramConnect}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 rounded bg-white/10"
                    >
                      Connect
                    </button>
                  )}
                </div>
                {instagramAuth?.error && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{instagramAuth.error}</p>
                  </div>
                )}
                {!instagramAuth?.authenticated && !instagramAuth?.error && (
                  <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">Requires Instagram Business or Creator account</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section>
            <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              Notifications
            </h3>
            <div className="space-y-2">
              <ToggleRow
                label="Desktop notifications"
                description="Show system notifications for new messages"
                disabled
              />
              <ToggleRow
                label="Badge count"
                description="Show unread count on dock icon"
                disabled
              />
            </div>
          </section>

          {/* About Section */}
          <section>
            <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
              About
            </h3>
            <p className="text-sm text-white/50">
              phoebeOS v0.1.0 (Foundation)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  name,
  status,
  description,
}: {
  name: string;
  status: 'connected' | 'pending' | 'error';
  description: string;
}) {
  const statusColors = {
    connected: 'bg-green-500',
    pending: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <div>
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-white/50">{description}</div>
        </div>
      </div>
      <button
        className="text-xs text-white/60 hover:text-white transition-colors px-3 py-1 rounded bg-white/10 cursor-not-allowed"
        disabled
      >
        Configure
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  disabled = false,
}: {
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg bg-white/5 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/50">{description}</div>
      </div>
      <div className="w-10 h-6 rounded-full bg-white/20 relative cursor-not-allowed">
        <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/60 transition-transform" />
      </div>
    </div>
  );
}
