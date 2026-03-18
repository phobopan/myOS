import { execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import type { LLMProvider } from '../llmProvider';

const CLAUDE_SEARCH_PATHS = [
  path.join(os.homedir(), '.local', 'bin', 'claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
];

export class ClaudeCliProvider implements LLMProvider {
  id = 'claude-cli';
  name = 'Claude Code CLI';
  private resolvedPath: string | null = null;

  private findClaudePath(): string | null {
    if (this.resolvedPath) return this.resolvedPath;

    for (const p of CLAUDE_SEARCH_PATHS) {
      if (existsSync(p)) {
        this.resolvedPath = p;
        return p;
      }
    }

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

  async isAvailable(): Promise<boolean> {
    return this.findClaudePath() !== null;
  }

  async sendMessage(system: string, user: string): Promise<string> {
    const claudePath = this.findClaudePath();
    if (!claudePath) throw new Error('Claude CLI not found');

    const fullPrompt = `${system}\n\n${user}`;

    return new Promise((resolve, reject) => {
      const proc = spawn(claudePath, ['-p', '--max-turns', '1'], {
        timeout: 120_000,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      proc.on('error', (err) => reject(new Error(`Claude CLI spawn failed: ${err.message}`)));
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

  async sendMessageStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const claudePath = this.findClaudePath();
    if (!claudePath) throw new Error('Claude CLI not found');

    const fullPrompt = `${system}\n\n${user}`;

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
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      proc.on('error', (err) => reject(new Error(`Claude CLI spawn failed: ${err.message}`)));
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
