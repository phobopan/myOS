import { BrowserWindow, safeStorage } from 'electron';
import ElectronStore from 'electron-store';
import axios from 'axios';
import * as crypto from 'crypto';
import * as http from 'http';
import { InstagramTokens, InstagramAccountInfo } from './instagramTypes';

// OAuth configuration - Instagram API with Instagram Login
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
const OAUTH_PORT = 8848;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/callback`;

// Required scopes for Instagram DM access
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
].join(',');

// Token storage configuration
interface StoreSchema {
  instagram_tokens?: string | Buffer; // Encrypted or plain JSON string
  instagram_tokens_encrypted?: boolean;
  instagram_account_info?: string; // JSON string of InstagramAccountInfo
}

const store = new ElectronStore<StoreSchema>({ name: 'instagram-auth' });

class InstagramAuthServiceClass {
  private accessToken: string | null = null;
  private instagramUserId: string | null = null;
  private accountInfo: InstagramAccountInfo | null = null;

  constructor() {
    // Load tokens on initialization if they exist
    this.loadStoredTokens();
  }

  /**
   * Load tokens from storage and initialize service
   */
  private loadStoredTokens(): void {
    try {
      const tokens = this.loadTokens();
      const accountInfo = this.loadAccountInfo();

      if (tokens && accountInfo) {
        // Check if token is expired
        if (tokens.expiresAt > Date.now()) {
          this.accessToken = tokens.accessToken;
          this.instagramUserId = accountInfo.instagramAccountId;
          this.accountInfo = accountInfo;
          console.log('Instagram session restored from stored tokens');
        } else {
          console.log('Instagram token expired, clearing stored tokens');
          this.clearTokens();
        }
      }
    } catch (error) {
      console.error('Failed to load stored Instagram tokens:', error);
    }
  }

  /**
   * Save tokens to encrypted storage
   */
  private saveTokens(tokens: InstagramTokens, accountInfo: InstagramAccountInfo): void {
    const tokensJson = JSON.stringify(tokens);

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(tokensJson);
      store.set('instagram_tokens', encrypted);
      store.set('instagram_tokens_encrypted', true);
    } else {
      // Fallback to unencrypted storage if encryption unavailable
      store.set('instagram_tokens', tokensJson);
      store.set('instagram_tokens_encrypted', false);
    }

    // Store account info (not sensitive, no encryption needed)
    store.set('instagram_account_info', JSON.stringify(accountInfo));
  }

  /**
   * Load tokens from storage
   */
  private loadTokens(): InstagramTokens | null {
    const tokensData = store.get('instagram_tokens');
    if (!tokensData) return null;

    const isEncrypted = store.get('instagram_tokens_encrypted', false);

    try {
      let tokensJson: string;

      if (isEncrypted) {
        // Handle Buffer - could be actual Buffer or serialized as {type: "Buffer", data: [...]}
        let buffer: Buffer;
        if (Buffer.isBuffer(tokensData)) {
          buffer = tokensData;
        } else if (
          typeof tokensData === 'object' &&
          tokensData !== null &&
          'type' in tokensData &&
          (tokensData as any).type === 'Buffer' &&
          'data' in tokensData
        ) {
          // electron-store serializes Buffer as {type: "Buffer", data: [...]}
          buffer = Buffer.from((tokensData as any).data);
        } else {
          console.error('Invalid encrypted token data format');
          return null;
        }
        tokensJson = safeStorage.decryptString(buffer);
      } else if (typeof tokensData === 'string') {
        tokensJson = tokensData;
      } else {
        console.error('Invalid token data format');
        return null;
      }

      return JSON.parse(tokensJson) as InstagramTokens;
    } catch (error) {
      console.error('Failed to decrypt/parse Instagram tokens:', error);
      return null;
    }
  }

  /**
   * Load account info from storage
   */
  private loadAccountInfo(): InstagramAccountInfo | null {
    const accountInfoJson = store.get('instagram_account_info');
    if (!accountInfoJson) return null;

    try {
      return JSON.parse(accountInfoJson) as InstagramAccountInfo;
    } catch (error) {
      console.error('Failed to parse Instagram account info:', error);
      return null;
    }
  }

  /**
   * Clear tokens from storage
   */
  private clearTokens(): void {
    store.delete('instagram_tokens');
    store.delete('instagram_tokens_encrypted');
    store.delete('instagram_account_info');
    this.accessToken = null;
    this.instagramUserId = null;
    this.accountInfo = null;
  }

  /**
   * Exchange authorization code for short-lived access token
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        'Instagram App credentials not configured. Please set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET environment variables.'
      );
    }

    // Exchange code for short-lived token
    // Instagram uses form-urlencoded for this endpoint
    const params = new URLSearchParams();
    params.append('client_id', appId);
    params.append('client_secret', appSecret);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', REDIRECT_URI);
    params.append('code', code);

    const response = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  private async exchangeForLongLivedToken(shortLivedToken: string): Promise<InstagramTokens> {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!appSecret) {
      throw new Error('INSTAGRAM_APP_SECRET not configured');
    }

    const response = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortLivedToken,
      },
    });

    // Default to 60 days if expires_in not provided
    const expiresIn = response.data.expires_in || 60 * 24 * 60 * 60;

    return {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  }

  /**
   * Get user info from Instagram
   */
  private async getUserInfo(accessToken: string): Promise<InstagramAccountInfo> {
    const response = await axios.get('https://graph.instagram.com/me', {
      params: {
        fields: 'user_id,username,name',
        access_token: accessToken,
      },
    });

    const { user_id, username, name } = response.data;

    this.instagramUserId = user_id;

    return {
      pageId: user_id, // For compatibility with existing types
      pageName: name || username,
      instagramAccountId: user_id,
      instagramUsername: username,
      instagramName: name || null,
    };
  }

  /**
   * Perform OAuth authentication flow
   * Uses Instagram Login with localhost callback
   */
  async authenticate(): Promise<InstagramAccountInfo> {
    return new Promise((resolve, reject) => {
      try {
        const appId = process.env.INSTAGRAM_APP_ID;

        if (!appId) {
          reject(
            new Error(
              'Instagram App credentials not configured. Please set INSTAGRAM_APP_ID environment variable.'
            )
          );
          return;
        }

        // Generate state for CSRF protection
        const state = crypto.randomBytes(16).toString('hex');

        let server: http.Server | null = null;
        let authWindow: BrowserWindow | null = null;
        let resolved = false;

        const cleanup = () => {
          if (server) {
            server.close();
            server = null;
          }
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
            authWindow = null;
          }
        };

        // Create local server to receive OAuth callback
        server = http.createServer(async (req, res) => {
          if (!req.url?.startsWith('/callback')) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const url = new URL(req.url, `http://127.0.0.1:${OAUTH_PORT}`);
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');

          // Send response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
                <div style="text-align: center;">
                  <h1>${error ? '❌ Authentication Failed' : '✓ Authentication Successful'}</h1>
                  <p>${error ? errorDescription || error : 'You can close this window.'}</p>
                </div>
              </body>
            </html>
          `);

          if (resolved) return;

          if (error) {
            resolved = true;
            cleanup();
            reject(new Error(`OAuth error: ${error} - ${errorDescription || 'Unknown error'}`));
            return;
          }

          if (returnedState !== state) {
            resolved = true;
            cleanup();
            reject(new Error('State mismatch - possible CSRF attack'));
            return;
          }

          if (!code) {
            resolved = true;
            cleanup();
            reject(new Error('No authorization code received'));
            return;
          }

          try {
            // Exchange code for short-lived token
            const shortLivedToken = await this.exchangeCodeForToken(code);

            // Exchange for long-lived token
            const tokens = await this.exchangeForLongLivedToken(shortLivedToken);

            // Get user info
            const accountInfo = await this.getUserInfo(tokens.accessToken);

            // Save tokens and account info
            this.accessToken = tokens.accessToken;
            this.accountInfo = accountInfo;
            this.saveTokens(tokens, accountInfo);

            resolved = true;
            cleanup();
            resolve(accountInfo);
          } catch (exchangeError) {
            resolved = true;
            cleanup();
            reject(exchangeError);
          }
        });

        server.listen(OAUTH_PORT, '127.0.0.1', () => {
          // Build authorization URL for Instagram Login
          const authUrl =
            `https://www.instagram.com/oauth/authorize?` +
            `client_id=${appId}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&scope=${encodeURIComponent(SCOPES)}` +
            `&response_type=code` +
            `&state=${state}`;

          // Create BrowserWindow for authentication
          authWindow = new BrowserWindow({
            width: 600,
            height: 800,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
            },
          });

          authWindow.loadURL(authUrl);

          // Handle window close without completing auth
          authWindow.on('closed', () => {
            authWindow = null;
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(new Error('Authentication window closed before completing'));
            }
          });
        });

        server.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error(`Failed to start auth server: ${err.message}`));
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error('Authentication timeout - no response received within 5 minutes'));
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.accessToken || !this.instagramUserId) {
      // Try to restore from storage
      this.loadStoredTokens();
    }

    return !!(this.accessToken && this.instagramUserId);
  }

  /**
   * Get account info for display
   */
  getAccountInfo(): InstagramAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Get access token for API calls
   * Throws if not authenticated
   */
  getPageAccessToken(): string {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.accessToken;
  }

  /**
   * Get Page ID for API calls (returns user ID for Instagram Login)
   * Throws if not authenticated
   */
  getPageId(): string {
    if (!this.instagramUserId) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.instagramUserId;
  }

  /**
   * Get Instagram Account ID for API calls
   * Throws if not authenticated
   */
  getInstagramAccountId(): string {
    if (!this.instagramUserId) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.instagramUserId;
  }

  /**
   * Disconnect Instagram account
   * Clears stored tokens
   */
  disconnect(): void {
    this.clearTokens();
    console.log('Instagram account disconnected');
  }
}

// Singleton instance
export const instagramAuthService = new InstagramAuthServiceClass();
