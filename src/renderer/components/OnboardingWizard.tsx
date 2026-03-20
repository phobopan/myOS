import { useState, useEffect } from 'react';

interface OnboardingWizardProps {
  onComplete: () => void;
  onNameChange?: (name: string) => void;
}

type LLMProviderOption = 'claude-cli' | 'claude-api' | 'openai' | 'gemini';

const TOTAL_STEPS = 4;

export function OnboardingWizard({ onComplete, onNameChange: onNameChangeProp }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  // Notify parent when name changes so titlebar updates live
  const handleNameChange = (value: string) => {
    setName(value);
    const displayName = value.trim() ? `${value.trim()}OS` : 'OS';
    onNameChangeProp?.(displayName);
  };

  // Step 2 - FDA
  const [fdaStatus, setFdaStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');

  // Step 3 - Gmail
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Step 4 - LLM Setup
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderOption>('claude-cli');
  const [apiKey, setApiKey] = useState('');
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [llmTestError, setLlmTestError] = useState<string | null>(null);
  const [cliDetected, setCliDetected] = useState<boolean | null>(null);

  // Check FDA on step 2
  useEffect(() => {
    if (step === 2) {
      checkFDA();
    }
  }, [step]);

  // Check CLI and load current provider on step 4
  useEffect(() => {
    if (step === 4) {
      checkClaudeCliAvailability();
    }
  }, [step]);

  const checkFDA = async () => {
    setFdaStatus('checking');
    try {
      const status = await window.electron.checkFullDiskAccess();
      setFdaStatus(status === 'authorized' ? 'authorized' : 'denied');
    } catch {
      setFdaStatus('denied');
    }
  };

  const checkClaudeCliAvailability = async () => {
    try {
      const available = await window.electron.claude.isAvailable();
      setCliDetected(available);
    } catch {
      setCliDetected(false);
    }
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    setGmailError(null);
    try {
      const hasCreds = await window.electron.gmail.hasCredentials();
      if (!hasCreds) {
        setGmailError('Gmail is not configured for this build. Contact the app developer.');
        return;
      }
      const success = await window.electron.gmail.authenticate();
      if (success) {
        const email = await window.electron.gmail.getUserEmail();
        setGmailEmail(email);
        setGmailConnected(true);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      if (msg.includes('access_denied') || msg.includes('admin_policy')) {
        setGmailError('Your Google account hasn\'t been approved for this app yet. Ask the app developer to add your email as a test user.');
      } else if (msg.includes('timeout')) {
        setGmailError('Authentication timed out. Please try again.');
      } else if (msg.includes('credentials not configured')) {
        setGmailError('Gmail is not configured for this build. Contact the app developer.');
      } else {
        setGmailError(msg);
      }
    } finally {
      setGmailConnecting(false);
    }
  };

  const handleLlmSave = async () => {
    await window.electron.llm.setProvider(selectedProvider);
    if (selectedProvider !== 'claude-cli' && apiKey.trim()) {
      const providerKey = selectedProvider === 'claude-api' ? 'claude' : selectedProvider;
      await window.electron.llm.setApiKey(providerKey, apiKey.trim());
    }
  };

  const handleLlmTest = async () => {
    setLlmTestStatus('testing');
    setLlmTestError(null);
    await handleLlmSave();
    try {
      const result = await window.electron.llm.testConnection(selectedProvider);
      if (result.success) {
        setLlmTestStatus('success');
      } else {
        setLlmTestStatus('error');
        setLlmTestError(result.error || 'Connection test failed');
      }
    } catch (err: any) {
      setLlmTestStatus('error');
      setLlmTestError(err?.message || 'Test failed');
    }
  };

  const handleFinish = async () => {
    if (name.trim()) {
      await window.electron.app.setUserName(name.trim());
    }
    await handleLlmSave();
    await window.electron.app.setOnboardingComplete(true);
    onComplete();
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const appDisplayName = name.trim() ? `${name.trim()}OS` : 'OS';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i + 1 <= step ? 'w-8 bg-white/60' : 'w-4 bg-white/15'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">
        {step === 1 && (
          <Step1Name
            name={name}
            onNameChange={handleNameChange}
            appDisplayName={appDisplayName}
          />
        )}
        {step === 2 && (
          <Step2FDA
            status={fdaStatus}
            onCheckAgain={checkFDA}
          />
        )}
        {step === 3 && (
          <Step3Gmail
            connecting={gmailConnecting}
            connected={gmailConnected}
            email={gmailEmail}
            error={gmailError}
            onConnect={handleConnectGmail}
          />
        )}
        {step === 4 && (
          <Step4LLMSetup
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            testStatus={llmTestStatus}
            testError={llmTestError}
            onTest={handleLlmTest}
            cliDetected={cliDetected}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-5 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
          >
            Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <>
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 rounded-lg bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              Continue
            </button>
            {step > 1 && (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 text-white/30 hover:text-white/50 text-sm transition-colors"
              >
                Skip
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleFinish}
            className="px-8 py-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
          >
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────

function Step1Name({
  name,
  onNameChange,
  appDisplayName,
}: {
  name: string;
  onNameChange: (name: string) => void;
  appDisplayName: string;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* App icon */}
      <img
        src="./icon.png"
        alt=""
        className="w-16 h-16 mb-6"
        draggable={false}
      />

      {/* Title */}
      <h2 className="text-sm font-medium text-white mb-1">
        {name.trim() ? appDisplayName : 'Set up your app'}
      </h2>
      <p className="text-xs text-white/40 mb-6">Enter your first name to personalize.</p>

      {/* Input — matches app's glass input style */}
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value.toLowerCase())}
        placeholder="first name"
        className="w-full max-w-[220px] px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-white text-sm text-center placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
        autoFocus
      />
    </div>
  );
}

function Step2FDA({
  status,
  onCheckAgain,
}: {
  status: 'checking' | 'authorized' | 'denied';
  onCheckAgain: () => void;
}) {
  const handleOpenSettings = async () => {
    await window.electron.requestFullDiskAccess();
  };

  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold text-white mb-2">Full Disk Access</h2>
      <p className="text-white/50 mb-6 text-sm">
        Required to read your iMessages. Everything stays on your device.
      </p>

      <div className="flex items-center justify-center gap-2.5 mb-6">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            status === 'authorized'
              ? 'bg-green-500'
              : status === 'checking'
              ? 'bg-white/40 animate-pulse'
              : 'bg-white/30'
          }`}
        />
        <span className="text-sm text-white/60">
          {status === 'authorized'
            ? 'Access granted'
            : status === 'checking'
            ? 'Checking...'
            : 'Not yet granted'}
        </span>
      </div>

      {status !== 'authorized' && (
        <div className="space-y-2">
          <button
            onClick={handleOpenSettings}
            className="w-full bg-white/15 hover:bg-white/25 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Open System Settings
          </button>
          <button
            onClick={onCheckAgain}
            className="w-full text-white/40 hover:text-white/60 px-6 py-2 text-sm transition-colors"
          >
            Check Again
          </button>
        </div>
      )}

      {status === 'authorized' && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">iMessage access is ready.</p>
        </div>
      )}
    </div>
  );
}

function Step3Gmail({
  connecting,
  connected,
  email,
  error,
  onConnect,
}: {
  connecting: boolean;
  connected: boolean;
  email: string | null;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <div className="text-center">
      <h2 className="text-lg font-semibold text-white mb-2">Connect Gmail</h2>
      <p className="text-white/50 mb-6 text-sm">
        Sign in with Google to see your emails here.
      </p>

      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-white/60">Connected{email ? ` as ${email}` : ''}</span>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400">Gmail is ready.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="w-full bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-white/30 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Gmail'}
          </button>

          {connecting && (
            <p className="text-xs text-white/30">
              A browser window will open for Google sign-in.
            </p>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const LLM_PROVIDERS: Array<{ id: LLMProviderOption; name: string; description: string; needsKey: boolean }> = [
  { id: 'claude-cli', name: 'Claude Code CLI', description: 'Uses locally installed Claude CLI', needsKey: false },
  { id: 'claude-api', name: 'Claude API', description: 'Anthropic API with your own key', needsKey: true },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o with your API key', needsKey: true },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini 2.0 Flash with your API key', needsKey: true },
];

function Step4LLMSetup({
  selectedProvider,
  onSelectProvider,
  apiKey,
  onApiKeyChange,
  testStatus,
  testError,
  onTest,
  cliDetected,
}: {
  selectedProvider: LLMProviderOption;
  onSelectProvider: (id: LLMProviderOption) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testError: string | null;
  onTest: () => void;
  cliDetected: boolean | null;
}) {
  const currentProvider = LLM_PROVIDERS.find(p => p.id === selectedProvider)!;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2 text-center">AI Provider</h2>
      <p className="text-white/50 mb-6 text-sm text-center">
        Powers message drafting and daily digest.
      </p>

      <div className="space-y-1.5 mb-6">
        {LLM_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            onClick={() => {
              onSelectProvider(provider.id);
              onApiKeyChange('');
            }}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedProvider === provider.id
                ? 'border-white/30 bg-white/10'
                : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{provider.name}</div>
                <div className="text-xs text-white/40">{provider.description}</div>
              </div>
              <div className="flex items-center gap-2">
                {provider.id === 'claude-cli' && cliDetected !== null && (
                  <div className={`w-2 h-2 rounded-full ${cliDetected ? 'bg-green-500' : 'bg-white/30'}`} />
                )}
                {selectedProvider === provider.id && (
                  <div className="w-2 h-2 rounded-full bg-white/70" />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* API Key input for key-based providers */}
      {currentProvider.needsKey && (
        <div className="mb-4">
          <label className="block text-sm text-white/50 mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={`Enter your ${currentProvider.name} API key`}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/30 text-sm font-mono"
          />
        </div>
      )}

      {/* CLI status for Claude CLI */}
      {selectedProvider === 'claude-cli' && cliDetected === false && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 mb-4">
          <p className="text-xs text-white/50">
            Claude CLI not detected. Install it from{' '}
            <button
              onClick={() => window.electron.shell.openExternal('https://docs.anthropic.com/en/docs/claude-code/overview')}
              className="underline text-white/70"
            >
              anthropic.com
            </button>
            , or choose an API provider.
          </p>
        </div>
      )}

      {/* Test button */}
      <button
        onClick={onTest}
        disabled={testStatus === 'testing' || (currentProvider.needsKey && !apiKey.trim())}
        className="w-full bg-white/[0.06] hover:bg-white/10 disabled:bg-white/[0.03] disabled:text-white/20 text-white/60 px-4 py-2 rounded-lg text-sm transition-colors"
      >
        {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
      </button>

      {testStatus === 'success' && (
        <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">Connection successful!</p>
        </div>
      )}

      {testStatus === 'error' && testError && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{testError}</p>
        </div>
      )}
    </div>
  );
}
