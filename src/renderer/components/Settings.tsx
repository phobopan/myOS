interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
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
            <div className="space-y-2">
              <AccountRow
                name="iMessage"
                status="pending"
                description="Requires Full Disk Access"
              />
              <AccountRow
                name="Gmail"
                status="pending"
                description="Not connected"
              />
              <AccountRow
                name="Instagram"
                status="pending"
                description="Not connected"
              />
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
