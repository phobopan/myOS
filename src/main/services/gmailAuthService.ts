import { google } from 'googleapis';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { shell, safeStorage } from 'electron';
import ElectronStore from 'electron-store';
import * as crypto from 'crypto';
import * as http from 'http';
import { GmailTokens } from './gmailTypes';
import { getGmailCredentials } from './credentialStore';

// OAuth configuration
const REDIRECT_PORT = 8847;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth/callback`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Token storage configuration
interface StoreSchema {
  gmail_tokens?: string | Buffer; // Encrypted or plain JSON string
  gmail_tokens_encrypted?: boolean;
  gmail_user_email?: string;
}

const store = new ElectronStore<StoreSchema>({ name: 'gmail-auth' });

class GmailAuthServiceClass {
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    // Load tokens on initialization if they exist
    this.loadStoredTokens();
  }

  /**
   * Load tokens from storage and set up OAuth2Client
   */
  private loadStoredTokens(): void {
    try {
      const tokens = this.loadTokens();
      if (tokens) {
        this.oauth2Client = this.createOAuth2Client();
        this.oauth2Client.setCredentials(tokens);
        this.setupTokenRefreshHandler();
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
    }
  }

  /**
   * Create OAuth2Client with credentials from credential store (or env fallback)
   */
  private createOAuth2Client(): OAuth2Client {
    const creds = getGmailCredentials();

    if (!creds) {
      throw new Error(
        'Gmail OAuth credentials not configured. Please add your Google Cloud credentials in Settings or set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.'
      );
    }

    return new google.auth.OAuth2(creds.clientId, creds.clientSecret, REDIRECT_URI);
  }

  /**
   * Set up automatic token refresh and save
   */
  private setupTokenRefreshHandler(): void {
    if (!this.oauth2Client) return;

    this.oauth2Client.on('tokens', (tokens) => {
      console.log('[Gmail Auth] Token refresh event received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
      });

      // Merge with existing tokens to preserve refresh_token
      // (Google only returns refresh_token on first auth)
      const existingTokens = this.loadTokens();
      console.log('[Gmail Auth] Existing tokens for merge:', {
        hasRefreshToken: !!existingTokens?.refresh_token,
      });

      const mergedTokens = {
        ...existingTokens,
        ...tokens,
        // Keep existing refresh_token if new one isn't provided
        refresh_token: tokens.refresh_token || existingTokens?.refresh_token,
      };

      console.log('[Gmail Auth] Merged tokens:', {
        hasRefreshToken: !!mergedTokens.refresh_token,
      });

      this.saveTokens(mergedTokens as GmailTokens);
    });
  }

  /**
   * Proactively refresh token if it's about to expire
   * Call this before making API requests
   */
  async ensureValidToken(): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Not authenticated');
    }

    const tokens = this.oauth2Client.credentials;
    console.log('[Gmail Auth] ensureValidToken check:', {
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      expiresIn: tokens.expiry_date ? tokens.expiry_date - Date.now() : 'N/A',
    });

    if (!tokens.expiry_date) return;

    // Refresh if token expires in less than 5 minutes
    const expiresIn = tokens.expiry_date - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      console.log('[Gmail Auth] Token expiring soon, refreshing proactively...');

      // Check if we have a refresh token before attempting
      if (!tokens.refresh_token) {
        // Try to load from storage
        const storedTokens = this.loadTokens();
        if (storedTokens?.refresh_token) {
          console.log('[Gmail Auth] Found refresh_token in storage, restoring to client');
          this.oauth2Client.setCredentials({
            ...tokens,
            refresh_token: storedTokens.refresh_token,
          });
        } else {
          console.error('[Gmail Auth] No refresh_token available in client or storage');
          throw new Error('Gmail session expired. Please reconnect in Settings.');
        }
      }

      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        // Token refresh handler will save the new tokens
      } catch (error) {
        console.error('[Gmail Auth] Failed to refresh token:', error);
        throw new Error('Gmail session expired. Please reconnect in Settings.');
      }
    }
  }

  /**
   * Save tokens to encrypted storage
   */
  private saveTokens(tokens: GmailTokens): void {
    console.log('[Gmail Auth] Saving tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    const tokensJson = JSON.stringify(tokens);

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(tokensJson);
      store.set('gmail_tokens', encrypted);
      store.set('gmail_tokens_encrypted', true);
      console.log('[Gmail Auth] Tokens saved (encrypted)');
    } else {
      // Fallback to unencrypted storage if encryption unavailable
      store.set('gmail_tokens', tokensJson);
      store.set('gmail_tokens_encrypted', false);
      console.log('[Gmail Auth] Tokens saved (unencrypted)');
    }
  }

  /**
   * Load tokens from storage
   */
  private loadTokens(): GmailTokens | null {
    const tokensData = store.get('gmail_tokens');
    if (!tokensData) {
      console.log('[Gmail Auth] No tokens in storage');
      return null;
    }

    const isEncrypted = store.get('gmail_tokens_encrypted', false);

    try {
      let tokensJson: string;

      if (isEncrypted) {
        // Handle Buffer - could be actual Buffer or serialized as {type: "Buffer", data: [...]}
        let buffer: Buffer;
        if (Buffer.isBuffer(tokensData)) {
          buffer = tokensData;
        } else if (typeof tokensData === 'object' && tokensData !== null && 'type' in tokensData && (tokensData as any).type === 'Buffer' && 'data' in tokensData) {
          // electron-store serializes Buffer as {type: "Buffer", data: [...]}
          buffer = Buffer.from((tokensData as any).data);
        } else {
          console.error('[Gmail Auth] Invalid encrypted token data format');
          return null;
        }
        tokensJson = safeStorage.decryptString(buffer);
      } else if (typeof tokensData === 'string') {
        tokensJson = tokensData;
      } else {
        console.error('[Gmail Auth] Invalid token data format');
        return null;
      }

      const tokens = JSON.parse(tokensJson) as GmailTokens;
      console.log('[Gmail Auth] Tokens loaded:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      });
      return tokens;
    } catch (error) {
      console.error('[Gmail Auth] Failed to decrypt/parse tokens:', error);
      return null;
    }
  }

  /**
   * Clear tokens from storage
   */
  private clearTokens(): void {
    store.delete('gmail_tokens');
    store.delete('gmail_tokens_encrypted');
    store.delete('gmail_user_email');
  }

  /**
   * Perform OAuth authentication flow
   * Opens system browser and waits for callback
   */
  async authenticate(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.oauth2Client = this.createOAuth2Client();

        // Generate PKCE parameters
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');
        const state = crypto.randomBytes(16).toString('hex');

        // Generate authorization URL
        const authUrl = this.oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: CodeChallengeMethod.S256,
          prompt: 'consent', // Always request refresh_token
        });

        // Create HTTP server for callback
        const server = http.createServer(async (req, res) => {
          try {
            const url = new URL(req.url!, `http://127.0.0.1:${REDIRECT_PORT}`);

            if (url.pathname === '/oauth/callback') {
              const returnedState = url.searchParams.get('state');
              const code = url.searchParams.get('code');
              const error = url.searchParams.get('error');

              // Handle errors
              if (error) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>Authentication failed</h1><p>You can close this window.</p>');
                server.close();
                reject(new Error(`OAuth error: ${error}`));
                return;
              }

              // Verify state
              if (returnedState !== state) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>Authentication failed</h1><p>Invalid state parameter.</p>');
                server.close();
                reject(new Error('State mismatch'));
                return;
              }

              if (!code) {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>Authentication failed</h1><p>No authorization code received.</p>');
                server.close();
                reject(new Error('No authorization code'));
                return;
              }

              // Exchange code for tokens
              const { tokens } = await this.oauth2Client!.getToken({
                code,
                codeVerifier,
              });

              console.log('[Gmail Auth] Tokens received:', {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                expiryDate: tokens.expiry_date,
              });

              if (!tokens.refresh_token) {
                console.warn('[Gmail Auth] WARNING: No refresh_token received! User may need to revoke access and re-authenticate.');
              }

              this.oauth2Client!.setCredentials(tokens);
              this.saveTokens(tokens as GmailTokens);
              this.setupTokenRefreshHandler();

              // Get user email for display
              try {
                const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client! });
                const userInfo = await oauth2.userinfo.get();
                if (userInfo.data.email) {
                  store.set('gmail_user_email', userInfo.data.email);
                }
              } catch (emailError) {
                console.error('Failed to get user email:', emailError);
              }

              // Send success response
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <head>
                    <title>Authentication Successful</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
                      h1 { color: #10b981; }
                    </style>
                  </head>
                  <body>
                    <h1>✓ Authentication successful!</h1>
                    <p>You can close this window and return to phoebeOS.</p>
                  </body>
                </html>
              `);

              server.close();
              resolve(true);
            }
          } catch (callbackError) {
            console.error('Callback error:', callbackError);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication error</h1><p>Please try again.</p>');
            server.close();
            reject(callbackError);
          }
        });

        // Start server
        server.listen(REDIRECT_PORT, '127.0.0.1', () => {
          console.log(`OAuth callback server listening on ${REDIRECT_URI}`);
          // Open browser with auth URL
          shell.openExternal(authUrl);
        });

        // Set timeout to close server after 5 minutes
        setTimeout(() => {
          if (server.listening) {
            server.close();
            reject(new Error('Authentication timeout - no response received within 5 minutes'));
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get configured OAuth2Client
   * Throws if not authenticated
   */
  getOAuth2Client(): OAuth2Client {
    if (!this.oauth2Client) {
      throw new Error('Not authenticated with Gmail. Please call authenticate() first.');
    }
    return this.oauth2Client;
  }

  /**
   * Check if user is authenticated
   * Will attempt to restore session from stored tokens if needed
   */
  isAuthenticated(): boolean {
    const tokens = this.loadTokens();
    if (!tokens) return false;

    // If we have tokens but no client, try to restore the session
    if (!this.oauth2Client) {
      try {
        this.oauth2Client = this.createOAuth2Client();
        this.oauth2Client.setCredentials(tokens);
        this.setupTokenRefreshHandler();
        console.log('[Gmail Auth] Session restored from stored tokens');
      } catch (error) {
        console.error('[Gmail Auth] Failed to restore session:', error);
        return false;
      }
    } else {
      // Ensure the client has the refresh_token from storage
      const clientTokens = this.oauth2Client.credentials;
      if (!clientTokens.refresh_token && tokens.refresh_token) {
        console.log('[Gmail Auth] Restoring refresh_token from storage to client');
        this.oauth2Client.setCredentials({
          ...clientTokens,
          refresh_token: tokens.refresh_token,
        });
      }
    }

    return true;
  }

  /**
   * Get authenticated user's email
   */
  getUserEmail(): string | null {
    return store.get('gmail_user_email') ?? null;
  }

  /**
   * Get user email, fetching from Gmail API if not cached
   */
  async fetchUserEmail(): Promise<string | null> {
    const cached = this.getUserEmail();
    if (cached) return cached;

    if (!this.isAuthenticated()) return null;

    try {
      await this.ensureValidToken();
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client! });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const email = profile.data.emailAddress;
      if (email) {
        store.set('gmail_user_email', email);
        return email;
      }
    } catch (error) {
      console.error('[Gmail Auth] Failed to fetch user email:', error);
    }
    return null;
  }

  /**
   * Disconnect Gmail account
   * Clears stored tokens
   */
  disconnect(): void {
    this.clearTokens();
    this.oauth2Client = null;
  }
}

// Singleton instance
export const gmailAuthService = new GmailAuthServiceClass();
