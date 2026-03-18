import { app } from 'electron';
import ElectronStore from 'electron-store';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { InstagramAccountInfo } from './instagramTypes';

// Config paths - matches Python scripts
const CONFIG_DIR = path.join(app.getPath('home'), '.config', 'instagram');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

// Python script paths
const SCRIPTS_DIR = path.join(app.getPath('home'), '.local', 'bin');
const AUTH_SCRIPT = path.join(SCRIPTS_DIR, 'instagram-auth.py');

// Token storage configuration
interface StoreSchema {
  instagram_session_id?: string;
  instagram_account_info?: string; // JSON string of InstagramAccountInfo
}

const store = new ElectronStore<StoreSchema>({ name: 'instagram-auth' });

/**
 * Run a Python script and return the JSON output
 */
function runPythonScript(scriptPath: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    // Try python3 first, then python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const homeDir = app.getPath('home');

    const proc = spawn(pythonCmd, [scriptPath, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', HOME: homeDir },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }

      try {
        // Try to parse JSON from stdout
        const trimmed = stdout.trim();
        if (trimmed) {
          const result = JSON.parse(trimmed);
          resolve(result);
        } else {
          resolve(null);
        }
      } catch (e) {
        // If not JSON, return raw output
        resolve({ raw: stdout, stderr });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

class InstagramAuthServiceClass {
  private accountInfo: InstagramAccountInfo | null = null;

  constructor() {
    this.loadStoredSession();
  }

  /**
   * Load session from storage
   */
  private loadStoredSession(): void {
    try {
      const accountInfoJson = store.get('instagram_account_info');
      if (accountInfoJson) {
        this.accountInfo = JSON.parse(accountInfoJson) as InstagramAccountInfo;
      }

      // Check if session file exists (created by Python scripts)
      if (fs.existsSync(SESSION_FILE)) {
        console.log('Instagram session found');
      }
    } catch (error) {
      console.error('Failed to load stored Instagram session:', error);
    }
  }

  /**
   * Save account info to storage
   */
  private saveAccountInfo(accountInfo: InstagramAccountInfo): void {
    store.set('instagram_account_info', JSON.stringify(accountInfo));
    this.accountInfo = accountInfo;
  }

  /**
   * Clear session from storage
   */
  private clearSession(): void {
    store.delete('instagram_session_id');
    store.delete('instagram_account_info');
    this.accountInfo = null;

    // Also remove the Python session file
    if (fs.existsSync(SESSION_FILE)) {
      try {
        fs.unlinkSync(SESSION_FILE);
      } catch (e) {
        console.error('Failed to delete session file:', e);
      }
    }
  }

  /**
   * Authenticate with Instagram using username and password
   * This creates a proper device session that lasts longer
   */
  async authenticateWithCredentials(username: string, password: string): Promise<InstagramAccountInfo> {
    // Create config directory if needed
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Create a temporary Python script to login with username/password
    const tempScript = `
import json
import sys
import getpass
from pathlib import Path
from instagrapi import Client
from instagrapi.exceptions import TwoFactorRequired, ChallengeRequired

username = sys.argv[1]
password = sys.argv[2]
session_file = Path.home() / '.config' / 'instagram' / 'session.json'

try:
    cl = Client()
    cl.login(username, password)

    # Save session
    session_file.parent.mkdir(parents=True, exist_ok=True)
    cl.dump_settings(session_file)

    # Get account info
    user_info = cl.account_info()
    print(json.dumps({
        "success": True,
        "user_id": str(user_info.pk),
        "username": user_info.username,
        "full_name": user_info.full_name,
        "profile_pic_url": str(user_info.profile_pic_url) if user_info.profile_pic_url else None
    }))
except TwoFactorRequired:
    print(json.dumps({
        "error": True,
        "requires_2fa": True,
        "message": "Two-factor authentication required"
    }))
except ChallengeRequired:
    print(json.dumps({
        "error": True,
        "challenge_required": True,
        "message": "Instagram requires verification. Please log in via the Instagram app first, then try again."
    }))
except Exception as e:
    print(json.dumps({
        "error": True,
        "message": str(e)
    }))
`;

    const tempScriptPath = path.join(CONFIG_DIR, 'temp_login.py');
    fs.writeFileSync(tempScriptPath, tempScript);

    try {
      const result = await runPythonScript(tempScriptPath, [username, password]);

      // Clean up temp script
      fs.unlinkSync(tempScriptPath);

      if (result.error) {
        if (result.requires_2fa) {
          throw new Error('2FA_REQUIRED');
        }
        if (result.challenge_required) {
          throw new Error('CHALLENGE_REQUIRED: ' + result.message);
        }
        throw new Error(result.message || 'Authentication failed');
      }

      const accountInfo: InstagramAccountInfo = {
        pageId: result.user_id,
        pageName: result.full_name || result.username,
        instagramAccountId: result.user_id,
        instagramUsername: result.username,
        instagramName: result.full_name,
        profilePicUrl: result.profile_pic_url,
      };

      this.saveAccountInfo(accountInfo);

      console.log('Instagram authentication successful:', accountInfo.instagramUsername);
      return accountInfo;
    } catch (error) {
      // Clean up temp script on error
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
      throw error;
    }
  }

  /**
   * Complete 2FA authentication
   */
  async completeWithTwoFactor(username: string, password: string, code: string): Promise<InstagramAccountInfo> {
    // Create config directory if needed
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const tempScript = `
import json
import sys
from pathlib import Path
from instagrapi import Client

username = sys.argv[1]
password = sys.argv[2]
code = sys.argv[3]
session_file = Path.home() / '.config' / 'instagram' / 'session.json'

try:
    cl = Client()
    cl.login(username, password, verification_code=code)

    # Save session
    session_file.parent.mkdir(parents=True, exist_ok=True)
    cl.dump_settings(session_file)

    # Get account info
    user_info = cl.account_info()
    print(json.dumps({
        "success": True,
        "user_id": str(user_info.pk),
        "username": user_info.username,
        "full_name": user_info.full_name,
        "profile_pic_url": str(user_info.profile_pic_url) if user_info.profile_pic_url else None
    }))
except Exception as e:
    print(json.dumps({
        "error": True,
        "message": str(e)
    }))
`;

    const tempScriptPath = path.join(CONFIG_DIR, 'temp_2fa.py');
    fs.writeFileSync(tempScriptPath, tempScript);

    try {
      const result = await runPythonScript(tempScriptPath, [username, password, code]);

      // Clean up temp script
      fs.unlinkSync(tempScriptPath);

      if (result.error) {
        throw new Error(result.message || '2FA verification failed');
      }

      const accountInfo: InstagramAccountInfo = {
        pageId: result.user_id,
        pageName: result.full_name || result.username,
        instagramAccountId: result.user_id,
        instagramUsername: result.username,
        instagramName: result.full_name,
        profilePicUrl: result.profile_pic_url,
      };

      this.saveAccountInfo(accountInfo);

      console.log('Instagram 2FA authentication successful:', accountInfo.instagramUsername);
      return accountInfo;
    } catch (error) {
      // Clean up temp script on error
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
      throw error;
    }
  }

  /**
   * Check current session status
   */
  async checkStatus(): Promise<{ valid: boolean; username?: string; error?: string }> {
    try {
      const result = await runPythonScript(AUTH_SCRIPT, ['status']);

      if (result.valid) {
        return {
          valid: true,
          username: result.username,
        };
      } else {
        return {
          valid: false,
          error: result.message || 'Session invalid',
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Check if session file exists
    return fs.existsSync(SESSION_FILE);
  }

  /**
   * Validate the current session is still working
   * Call this before making API requests
   * Throws if session is invalid
   */
  async ensureValidSession(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Instagram not authenticated');
    }

    // If session was already marked invalid, throw immediately
    if (this.sessionValid === false) {
      throw new Error('Instagram session expired. Please reconnect in Settings.');
    }

    // Check session validity (but cache the result to avoid too many checks)
    const now = Date.now();
    if (!this.lastSessionCheck || now - this.lastSessionCheck > 5 * 60 * 1000) {
      const status = await this.checkStatus();
      this.lastSessionCheck = now;
      this.sessionValid = status.valid;

      if (!status.valid) {
        console.error('Instagram session expired:', status.error);
        throw new Error('Instagram session expired. Please reconnect in Settings.');
      }
    }
  }

  /**
   * Mark the session as invalid (called when API returns auth errors)
   */
  invalidateSession(): void {
    console.log('Instagram session invalidated');
    this.sessionValid = false;
    this.lastSessionCheck = Date.now();
  }

  private lastSessionCheck: number | null = null;
  private sessionValid: boolean | null = null;

  /**
   * Get account info for display
   */
  getAccountInfo(): InstagramAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Disconnect Instagram account
   */
  disconnect(): void {
    this.clearSession();
    console.log('Instagram account disconnected');
  }

  /**
   * Get session file path (for Python scripts)
   */
  getSessionFilePath(): string {
    return SESSION_FILE;
  }
}

// Singleton instance
export const instagramAuthService = new InstagramAuthServiceClass();
