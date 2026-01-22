import { BrowserWindow, safeStorage } from 'electron';
import ElectronStore from 'electron-store';
import axios from 'axios';
import * as crypto from 'crypto';
import { InstagramTokens, InstagramAccountInfo } from './instagramTypes';

// OAuth configuration
const REDIRECT_URI = 'https://www.facebook.com/connect/login_success.html';
const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Required scopes for Instagram DM access
const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
].join(',');

// Token storage configuration
interface StoreSchema {
  instagram_tokens?: string | Buffer; // Encrypted or plain JSON string
  instagram_tokens_encrypted?: boolean;
  instagram_account_info?: string; // JSON string of InstagramAccountInfo
}

const store = new ElectronStore<StoreSchema>({ name: 'instagram-auth' });

class InstagramAuthServiceClass {
  private pageAccessToken: string | null = null;
  private pageId: string | null = null;
  private instagramBusinessAccountId: string | null = null;
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
          this.pageAccessToken = tokens.accessToken;
          this.pageId = accountInfo.pageId;
          this.instagramBusinessAccountId = accountInfo.instagramAccountId;
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
    this.pageAccessToken = null;
    this.pageId = null;
    this.instagramBusinessAccountId = null;
    this.accountInfo = null;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<InstagramTokens> {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        'Facebook App credentials not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET environment variables.'
      );
    }

    // Exchange code for short-lived user access token
    const tokenResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: REDIRECT_URI,
        code: code,
      },
    });

    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange for long-lived user access token (60 days)
    const longLivedResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    // Default to 60 days if expires_in not provided
    const expiresIn = longLivedResponse.data.expires_in || 60 * 24 * 60 * 60;

    return {
      accessToken: longLivedResponse.data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  }

  /**
   * Initialize service from user access token
   * Gets Page Access Token and Instagram Business Account ID
   */
  private async initializeFromToken(userAccessToken: string): Promise<InstagramAccountInfo> {
    // Get user's Pages with Instagram Business Account
    const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        access_token: userAccessToken,
        fields: 'id,name,access_token,instagram_business_account{id,username,name}',
      },
    });

    const pages = response.data.data;

    if (!pages || pages.length === 0) {
      throw new Error(
        'No Facebook Pages found. Please create a Facebook Page and link it to your Instagram Business/Creator account.'
      );
    }

    // Find a Page with linked Instagram Business Account
    const pageWithInstagram = pages.find((p: any) => p.instagram_business_account);

    if (!pageWithInstagram) {
      throw new Error(
        'No Instagram Business/Creator account linked to your Facebook Pages. ' +
          'Please link your Instagram account to a Facebook Page in Meta Business Suite.'
      );
    }

    // Store Page Access Token (not user token) for API calls
    this.pageId = pageWithInstagram.id;
    this.pageAccessToken = pageWithInstagram.access_token;
    this.instagramBusinessAccountId = pageWithInstagram.instagram_business_account.id;

    const accountInfo: InstagramAccountInfo = {
      pageId: this.pageId!,
      pageName: pageWithInstagram.name,
      instagramAccountId: this.instagramBusinessAccountId!,
      instagramUsername: pageWithInstagram.instagram_business_account.username,
      instagramName: pageWithInstagram.instagram_business_account.name || null,
    };

    this.accountInfo = accountInfo;

    return accountInfo;
  }

  /**
   * Perform OAuth authentication flow
   * Opens BrowserWindow and intercepts Facebook success page redirect
   */
  async authenticate(): Promise<InstagramAccountInfo> {
    return new Promise((resolve, reject) => {
      try {
        const appId = process.env.FACEBOOK_APP_ID;

        if (!appId) {
          reject(
            new Error(
              'Facebook App credentials not configured. Please set FACEBOOK_APP_ID environment variable.'
            )
          );
          return;
        }

        // Generate state for CSRF protection
        const state = crypto.randomBytes(16).toString('hex');

        // Build authorization URL
        const authUrl =
          `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?` +
          `client_id=${appId}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&scope=${SCOPES}` +
          `&response_type=code` +
          `&state=${state}`;

        // Create BrowserWindow for authentication
        const authWindow = new BrowserWindow({
          width: 600,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        authWindow.loadURL(authUrl);

        let resolved = false;

        // Intercept redirect to Facebook success page
        authWindow.webContents.on('will-redirect', async (event, url) => {
          if (url.startsWith(REDIRECT_URI)) {
            event.preventDefault();

            const urlParams = new URL(url);
            const code = urlParams.searchParams.get('code');
            const returnedState = urlParams.searchParams.get('state');
            const error = urlParams.searchParams.get('error');
            const errorDescription = urlParams.searchParams.get('error_description');

            if (error) {
              authWindow.close();
              resolved = true;
              reject(new Error(`OAuth error: ${error} - ${errorDescription || 'Unknown error'}`));
              return;
            }

            if (returnedState !== state) {
              authWindow.close();
              resolved = true;
              reject(new Error('State mismatch - possible CSRF attack'));
              return;
            }

            if (!code) {
              authWindow.close();
              resolved = true;
              reject(new Error('No authorization code received'));
              return;
            }

            try {
              // Exchange code for tokens
              const tokens = await this.exchangeCodeForToken(code);

              // Initialize service with Page Access Token
              const accountInfo = await this.initializeFromToken(tokens.accessToken);

              // Save tokens and account info (use Page Access Token for storage)
              const pageTokens: InstagramTokens = {
                accessToken: this.pageAccessToken!,
                expiresAt: tokens.expiresAt,
              };
              this.saveTokens(pageTokens, accountInfo);

              authWindow.close();
              resolved = true;
              resolve(accountInfo);
            } catch (exchangeError) {
              authWindow.close();
              resolved = true;
              reject(exchangeError);
            }
          }
        });

        // Handle window close without completing auth
        authWindow.on('closed', () => {
          if (!resolved) {
            reject(new Error('Authentication window closed before completing'));
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!resolved && !authWindow.isDestroyed()) {
            authWindow.close();
            resolved = true;
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
    if (!this.pageAccessToken || !this.pageId || !this.instagramBusinessAccountId) {
      // Try to restore from storage
      this.loadStoredTokens();
    }

    return !!(this.pageAccessToken && this.pageId && this.instagramBusinessAccountId);
  }

  /**
   * Get account info for display
   */
  getAccountInfo(): InstagramAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Get Page Access Token for API calls
   * Throws if not authenticated
   */
  getPageAccessToken(): string {
    if (!this.pageAccessToken) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.pageAccessToken;
  }

  /**
   * Get Page ID for API calls
   * Throws if not authenticated
   */
  getPageId(): string {
    if (!this.pageId) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.pageId;
  }

  /**
   * Get Instagram Business Account ID for API calls
   * Throws if not authenticated
   */
  getInstagramAccountId(): string {
    if (!this.instagramBusinessAccountId) {
      throw new Error('Not authenticated with Instagram. Please call authenticate() first.');
    }
    return this.instagramBusinessAccountId;
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
