import { useState } from 'react';

interface PermissionOnboardingProps {
  onRetry: () => void;
  appName?: string;
}

export function PermissionOnboarding({ onRetry, appName = 'OS' }: PermissionOnboardingProps) {
  const [opening, setOpening] = useState(false);

  const handleOpenSettings = async () => {
    setOpening(true);
    await window.electron.requestFullDiskAccess();
    setOpening(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <span className="text-sm text-white/60">Not yet granted</span>
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">Full Disk Access</h2>
        <p className="text-white/50 mb-6 text-sm">
          {appName} needs Full Disk Access to read your iMessages. Everything stays on your device.
        </p>

        <div className="space-y-2">
          <button
            onClick={handleOpenSettings}
            disabled={opening}
            className="w-full bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-white/30 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {opening ? 'Opening Settings...' : 'Open System Settings'}
          </button>
          <button
            onClick={onRetry}
            className="w-full text-white/40 hover:text-white/60 px-6 py-2 text-sm transition-colors"
          >
            Check Again
          </button>
        </div>
      </div>
    </div>
  );
}
