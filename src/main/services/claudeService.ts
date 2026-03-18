import { execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

// Common install locations for the claude CLI
const CLAUDE_SEARCH_PATHS = [
  path.join(os.homedir(), '.local', 'bin', 'claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
];

class ClaudeServiceClass {
  private resolvedPath: string | null = null;

  /**
   * Find the claude binary. Checks known paths first, then falls back to
   * shell-based `which` so it works even when Electron strips PATH.
   */
  private findClaudePath(): string | null {
    if (this.resolvedPath) return this.resolvedPath;

    // Check known install locations
    for (const p of CLAUDE_SEARCH_PATHS) {
      if (existsSync(p)) {
        this.resolvedPath = p;
        return p;
      }
    }

    // Fall back to `which` using a login shell to get full PATH
    try {
      const result = execFileSync('/bin/sh', ['-lc', 'which claude'], {
        timeout: 5000,
        encoding: 'utf-8',
      }).trim();
      if (result && existsSync(result)) {
        this.resolvedPath = result;
        return result;
      }
    } catch {
      // not found
    }

    return null;
  }

  /**
   * Check if the claude CLI binary exists on this machine.
   */
  async isAvailable(): Promise<boolean> {
    return this.findClaudePath() !== null;
  }

  /**
   * Send a prompt to Claude via the CLI.
   * Uses stdin pipe to avoid command-line length limits.
   */
  async sendMessage(systemPrompt: string, userMessage: string): Promise<string> {
    const claudePath = this.findClaudePath();
    if (!claudePath) {
      throw new Error('Claude CLI not found');
    }

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    return new Promise((resolve, reject) => {
      const proc = spawn(claudePath, ['-p', '--max-turns', '1'], {
        timeout: 120_000,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        console.error('[Claude CLI] spawn error:', err);
        reject(new Error(`Claude CLI spawn failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('[Claude CLI] exit code:', code);
          console.error('[Claude CLI] stderr:', stderr);
          console.error('[Claude CLI] stdout:', stdout.slice(0, 500));
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }
        resolve(stdout.trim());
      });

      // Write the prompt to stdin and close it
      proc.stdin.write(fullPrompt);
      proc.stdin.end();
    });
  }
  /**
   * Generate a draft reply using Claude CLI, with platform-specific tone.
   */
  async generateDraft(
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context?: { contactName?: string; subject?: string }
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
    if (context?.subject) {
      userMessage += `Subject: ${context.subject}\n\n`;
    }
    if (context?.contactName) {
      userMessage += `Conversation with: ${context.contactName}\n\n`;
    }
    userMessage += 'Here is the conversation so far:\n';
    for (const msg of messages) {
      userMessage += `${msg.sender}: ${msg.text}\n`;
    }
    userMessage += '\nDraft a reply from me.';

    return this.sendMessage(systemPrompt, userMessage);
  }

  /**
   * Stream a draft reply, calling onChunk with each piece of stdout as it arrives.
   * Returns the complete text when done.
   */
  async generateDraftStream(
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context: { contactName?: string; subject?: string } | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const claudePath = this.findClaudePath();
    if (!claudePath) {
      throw new Error('Claude CLI not found');
    }

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
    if (context?.subject) {
      userMessage += `Subject: ${context.subject}\n\n`;
    }
    if (context?.contactName) {
      userMessage += `Conversation with: ${context.contactName}\n\n`;
    }
    userMessage += 'Here is the conversation so far:\n';
    for (const msg of messages) {
      userMessage += `${msg.sender}: ${msg.text}\n`;
    }
    userMessage += '\nDraft a reply from me.';

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    return new Promise((resolve, reject) => {
      const proc = spawn(claudePath, ['-p', '--max-turns', '1'], {
        timeout: 120_000,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        onChunk(chunk);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`Claude CLI spawn failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }
        resolve(stdout.trim());
      });

      proc.stdin.write(fullPrompt);
      proc.stdin.end();
    });
  }
}

export const claudeService = new ClaudeServiceClass();
