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
    // Give user time to toggle, then they'll click retry
    setOpening(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="max-w-md p-8 text-center rounded-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="text-5xl mb-4">
          <span role="img" aria-label="lock">&#128274;</span>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-3">
          Full Disk Access Required
        </h2>
        <p className="text-white/70 mb-6 leading-relaxed">
          To read your iMessages, {appName} needs Full Disk Access permission.
          Your messages stay on your device - we never upload or share them.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleOpenSettings}
            disabled={opening}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            {opening ? 'Opening Settings...' : 'Open System Settings'}
          </button>

          <button
            onClick={onRetry}
            className="w-full bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            I've Granted Access
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm text-white/50">
            In System Settings, find {appName} in the list and toggle the switch to enable access.
          </p>
        </div>
      </div>
    </div>
  );
}
