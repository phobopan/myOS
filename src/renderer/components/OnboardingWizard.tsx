import { useState, useEffect } from 'react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type LLMProviderOption = 'claude-cli' | 'claude-api' | 'openai' | 'gemini';

const TOTAL_STEPS = 7;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

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
    // Save selected provider
    await window.electron.llm.setProvider(selectedProvider);

    // If API key provided, save it
    if (selectedProvider !== 'claude-cli' && apiKey.trim()) {
      const providerKey = selectedProvider === 'claude-api' ? 'claude' : selectedProvider;
      await window.electron.llm.setApiKey(providerKey, apiKey.trim());
    }
  };

  const handleLlmTest = async () => {
    setLlmTestStatus('testing');
    setLlmTestError(null);

    // Save first so the test uses the right provider/key
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
    // Save LLM settings
    await handleLlmSave();
    await window.electron.app.setOnboardingComplete(true);
    onComplete();
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const appDisplayName = name.trim() ? `${name.trim()}OS` : 'myOS';

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i + 1 === step
                ? 'bg-blue-400'
                : i + 1 < step
                ? 'bg-blue-400/50'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div
        className="w-full max-w-lg rounded-2xl p-8"
        style={cardStyle}
      >
        {step === 1 && (
          <Step1Name
            name={name}
            onNameChange={setName}
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
        {step === 5 && <Step5TourMessaging appDisplayName={appDisplayName} />}
        {step === 6 && <Step6TourOrganization />}
        {step === 7 && <Step7TourDigest />}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium transition-colors"
          >
            Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {step === 1 ? 'Continue' : 'Next'}
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="px-8 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            Get Started
          </button>
        )}
        {step > 1 && step < TOTAL_STEPS && (
          <button
            onClick={() => setStep(step + 1)}
            className="px-4 py-2 text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Skip
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
    <div className="text-center">
      <h2 className="text-3xl font-bold text-white mb-2">
        Welcome to <span className="text-blue-400">{appDisplayName}</span>
      </h2>
      <p className="text-white/60 mb-8">
        Your unified inbox. Let's personalize it.
      </p>
      <div className="max-w-xs mx-auto">
        <label className="block text-sm text-white/70 mb-2 text-left">
          Your first name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500 text-center text-lg"
          autoFocus
        />
      </div>
      {name.trim() && (
        <p className="text-white/40 text-sm mt-4">
          Your app will be called <span className="text-white/70 font-medium">{appDisplayName}</span>
        </p>
      )}
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
      <h2 className="text-2xl font-bold text-white mb-2">Full Disk Access</h2>
      <p className="text-white/60 mb-6">
        Required to read your iMessages. Your messages stay on your device.
      </p>

      <div className="flex items-center justify-center gap-3 mb-6">
        <div
          className={`w-3 h-3 rounded-full ${
            status === 'authorized'
              ? 'bg-green-500'
              : status === 'checking'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-yellow-500'
          }`}
        />
        <span className="text-sm text-white/70">
          {status === 'authorized'
            ? 'Full Disk Access granted'
            : status === 'checking'
            ? 'Checking...'
            : 'Not yet granted'}
        </span>
      </div>

      {status !== 'authorized' && (
        <div className="space-y-3">
          <button
            onClick={handleOpenSettings}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Open System Settings
          </button>
          <button
            onClick={onCheckAgain}
            className="w-full bg-white/10 hover:bg-white/20 text-white/80 px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Check Again
          </button>
        </div>
      )}

      {status === 'authorized' && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
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
      <h2 className="text-2xl font-bold text-white mb-2">Connect Gmail</h2>
      <p className="text-white/60 mb-6 text-sm">
        Sign in with your Google account to see your emails here.
      </p>

      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-white/70">Connected{email ? ` as ${email}` : ''}</span>
          </div>
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400">Gmail is ready.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Gmail'}
          </button>

          {connecting && (
            <p className="text-xs text-white/40">
              A browser window will open for Google sign-in.
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const LLM_PROVIDERS: Array<{ id: LLMProviderOption; name: string; description: string; needsKey: boolean }> = [
  { id: 'claude-cli', name: 'Claude Code CLI', description: 'Uses locally installed Claude CLI (free with Claude subscription)', needsKey: false },
  { id: 'claude-api', name: 'Claude API', description: 'Anthropic API with your own key', needsKey: true },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o with your OpenAI API key', needsKey: true },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini 2.0 Flash with your Google AI key', needsKey: true },
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
      <h2 className="text-2xl font-bold text-white mb-2 text-center">AI Provider</h2>
      <p className="text-white/60 mb-6 text-sm text-center">
        Choose which AI powers features like message drafting and daily digest.
      </p>

      <div className="space-y-2 mb-6">
        {LLM_PROVIDERS.map(provider => (
          <button
            key={provider.id}
            onClick={() => {
              onSelectProvider(provider.id);
              onApiKeyChange('');
            }}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${
              selectedProvider === provider.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{provider.name}</div>
                <div className="text-xs text-white/50">{provider.description}</div>
              </div>
              {provider.id === 'claude-cli' && cliDetected !== null && (
                <div className={`w-2.5 h-2.5 rounded-full ${cliDetected ? 'bg-green-500' : 'bg-yellow-500'}`} />
              )}
              {selectedProvider === provider.id && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* API Key input for key-based providers */}
      {currentProvider.needsKey && (
        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={`Enter your ${currentProvider.name} API key`}
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500 text-sm font-mono"
          />
        </div>
      )}

      {/* CLI status for Claude CLI */}
      {selectedProvider === 'claude-cli' && cliDetected === false && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
          <p className="text-xs text-yellow-400">
            Claude CLI not detected. Install it from{' '}
            <button
              onClick={() => window.electron.shell.openExternal('https://docs.anthropic.com/en/docs/claude-code/overview')}
              className="underline"
            >
              anthropic.com
            </button>
            , or choose an API provider instead.
          </p>
        </div>
      )}

      {/* Test button */}
      <button
        onClick={onTest}
        disabled={testStatus === 'testing' || (currentProvider.needsKey && !apiKey.trim())}
        className="w-full bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white/80 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
      >
        {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
      </button>

      {testStatus === 'success' && (
        <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">Connection successful!</p>
        </div>
      )}

      {testStatus === 'error' && testError && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{testError}</p>
        </div>
      )}
    </div>
  );
}

function Step5TourMessaging({ appDisplayName }: { appDisplayName: string }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Unified Inbox</h2>
      <p className="text-white/60 mb-6 text-sm">
        {appDisplayName} brings all your messages into one place.
      </p>

      <div className="space-y-3 mb-4">
        <FeatureCard
          icon={<InboxIcon />}
          title="All Messages, One View"
          description="iMessage, Gmail, and Instagram conversations appear in a single sidebar sorted by time or priority."
        />
        <FeatureCard
          icon={<FilterIcon />}
          title="Filter by Source"
          description="Quickly toggle between All, iMessage, and Gmail using the filter pills at the top."
        />
        <FeatureCard
          icon={<CheckIcon />}
          title="Mark as Done"
          description="Right-click any conversation and mark it as done to clear it from your inbox. It comes back if they reply."
        />
        <FeatureCard
          icon={<PinIcon />}
          title="Pin to Dashboard"
          description="Pin important conversations to your dashboard for quick access and visual organization."
        />
      </div>
    </div>
  );
}

function Step6TourOrganization() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Stay Organized</h2>
      <p className="text-white/60 mb-6 text-sm">
        Tags, clusters, and filters help you focus on what matters.
      </p>

      <div className="space-y-3 mb-4">
        <FeatureCard
          icon={<TagIcon />}
          title="Tags"
          description="Assign priority tiers (Tier 1-4) or custom tags to contacts. Filter your inbox by tag to see only VIPs."
        />
        <FeatureCard
          icon={<GridIcon />}
          title="Dashboard Clusters"
          description="Group pinned conversations into clusters like 'Work', 'Family', or 'Projects' on your dashboard."
        />
        <FeatureCard
          icon={<FilterIcon />}
          title="Tag & Cluster Filters"
          description="Click filter pills in the sidebar to instantly show only contacts with specific tags or in specific clusters."
        />
      </div>
    </div>
  );
}

function Step7TourDigest() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Daily Digest</h2>
      <p className="text-white/60 mb-6 text-sm">
        AI-powered summaries of what needs your attention.
      </p>

      <div className="space-y-3 mb-4">
        <FeatureCard
          icon={<DigestIcon />}
          title="Smart Triage"
          description="AI reads your unread emails and messages, categorizes them, and highlights what's urgent."
        />
        <FeatureCard
          icon={<CategoryIcon />}
          title="Custom Categories"
          description="Create categories like 'Deals', 'Personal', 'Work' in Settings. The AI sorts emails into them."
        />
        <FeatureCard
          icon={<ClockIcon />}
          title="Auto-Schedule"
          description="Set daily, hourly, or weekly digest generation. Get a fresh summary without lifting a finger."
        />
        <FeatureCard
          icon={<CalendarIcon />}
          title="Lookback Window"
          description="Choose how many days back to scan — from 1 day for quick daily updates to 30 days for a full review."
        />
      </div>

      <p className="text-xs text-white/40">
        Configure everything in Settings after you get started.
      </p>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 text-left">
      <div className="text-blue-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/50">{description}</div>
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────

function InboxIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function DigestIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
