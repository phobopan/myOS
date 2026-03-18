import ElectronStore from 'electron-store';
import type { LLMProvider } from './llmProvider';
import { ClaudeCliProvider } from './providers/claudeCliProvider';
import { ClaudeApiProvider } from './providers/claudeApiProvider';
import { OpenAIProvider } from './providers/openaiProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { getLLMApiKey } from './credentialStore';

interface LLMStoreSchema {
  activeProvider: string;
}

const store = new ElectronStore<LLMStoreSchema>({
  name: 'llm-settings',
  defaults: {
    activeProvider: 'claude-cli',
  },
});

class LLMServiceClass {
  private providers = new Map<string, LLMProvider>();
  private claudeCliProvider = new ClaudeCliProvider();

  constructor() {
    // Claude CLI is always available as a built-in provider
    this.providers.set('claude-cli', this.claudeCliProvider);
  }

  /**
   * Build/rebuild API-key-based providers from stored credentials.
   */
  refreshProviders(): void {
    const claudeKey = getLLMApiKey('claude');
    if (claudeKey) {
      this.providers.set('claude-api', new ClaudeApiProvider(claudeKey));
    } else {
      this.providers.delete('claude-api');
    }

    const openaiKey = getLLMApiKey('openai');
    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider(openaiKey));
    } else {
      this.providers.delete('openai');
    }

    const geminiKey = getLLMApiKey('gemini');
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiKey));
    } else {
      this.providers.delete('gemini');
    }
  }

  getActiveProviderId(): string {
    return store.get('activeProvider');
  }

  setActiveProvider(providerId: string): void {
    store.set('activeProvider', providerId);
  }

  private getActiveProvider(): LLMProvider {
    const id = this.getActiveProviderId();
    const provider = this.providers.get(id);
    if (!provider) {
      // Fall back to Claude CLI
      console.warn(`[LLM] Provider '${id}' not available, falling back to claude-cli`);
      return this.claudeCliProvider;
    }
    return provider;
  }

  /**
   * Check if any LLM provider is available (used by digest, draft, etc.)
   */
  async isAvailable(): Promise<boolean> {
    const provider = this.getActiveProvider();
    return provider.isAvailable();
  }

  /**
   * Send a message to the active LLM provider.
   * Drop-in replacement for claudeService.sendMessage().
   */
  async sendMessage(systemPrompt: string, userMessage: string): Promise<string> {
    const provider = this.getActiveProvider();
    return provider.sendMessage(systemPrompt, userMessage);
  }

  /**
   * Generate a draft reply with platform-specific tone.
   * Drop-in replacement for claudeService.generateDraft().
   */
  async generateDraft(
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context?: { contactName?: string; subject?: string },
  ): Promise<string> {
    const systemPrompts: Record<string, string> = {
      imessage:
        'You are drafting an iMessage reply for the user. Keep it casual, concise, and conversational. Match the tone of the conversation. Just output the message text, nothing else.',
      gmail:
        'You are drafting an email reply for the user. Be professional but natural. Match the formality of the thread. Just output the reply body text, no greeting/signature unless contextually appropriate. Nothing else.',
      instagram:
        'You are drafting an Instagram DM reply for the user. Keep it brief and casual. Max 1000 characters. Just output the message text, nothing else.',
    };

    const systemPrompt = systemPrompts[platform] || systemPrompts.imessage;

    let userMessage = '';
    if (context?.subject) userMessage += `Subject: ${context.subject}\n\n`;
    if (context?.contactName) userMessage += `Conversation with: ${context.contactName}\n\n`;
    userMessage += 'Here is the conversation so far:\n';
    for (const msg of messages) {
      userMessage += `${msg.sender}: ${msg.text}\n`;
    }
    userMessage += '\nDraft a reply from me.';

    return this.sendMessage(systemPrompt, userMessage);
  }

  /**
   * Stream a draft reply, calling onChunk with each piece as it arrives.
   * Drop-in replacement for claudeService.generateDraftStream().
   */
  async generateDraftStream(
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context: { contactName?: string; subject?: string } | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const systemPrompts: Record<string, string> = {
      imessage:
        'You are drafting an iMessage reply for the user. Keep it casual, concise, and conversational. Match the tone of the conversation. Just output the message text, nothing else.',
      gmail:
        'You are drafting an email reply for the user. Be professional but natural. Match the formality of the thread. Just output the reply body text, no greeting/signature unless contextually appropriate. Nothing else.',
      instagram:
        'You are drafting an Instagram DM reply for the user. Keep it brief and casual. Max 1000 characters. Just output the message text, nothing else.',
    };

    const systemPrompt = systemPrompts[platform] || systemPrompts.imessage;

    let userMessage = '';
    if (context?.subject) userMessage += `Subject: ${context.subject}\n\n`;
    if (context?.contactName) userMessage += `Conversation with: ${context.contactName}\n\n`;
    userMessage += 'Here is the conversation so far:\n';
    for (const msg of messages) {
      userMessage += `${msg.sender}: ${msg.text}\n`;
    }
    userMessage += '\nDraft a reply from me.';

    const provider = this.getActiveProvider();
    return provider.sendMessageStream(systemPrompt, userMessage, onChunk);
  }

  /**
   * Test if a specific provider works with its current key.
   */
  async testConnection(providerId?: string): Promise<{ success: boolean; error?: string }> {
    const id = providerId || this.getActiveProviderId();
    const provider = this.providers.get(id);
    if (!provider) {
      return { success: false, error: `Provider '${id}' not configured` };
    }

    try {
      const available = await provider.isAvailable();
      if (!available) {
        return { success: false, error: 'Provider not available (missing API key or CLI)' };
      }
      // Send a minimal test message
      const result = await provider.sendMessage(
        'Reply with exactly: OK',
        'Test connection',
      );
      return { success: result.includes('OK') || result.length > 0 };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Connection test failed' };
    }
  }
}

export const llmService = new LLMServiceClass();
