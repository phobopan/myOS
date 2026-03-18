import { safeStorage } from 'electron';
import ElectronStore from 'electron-store';

interface CredentialStoreSchema {
  gmail_client_id?: string | Buffer;
  gmail_client_secret?: string | Buffer;
  gmail_credentials_encrypted?: boolean;
  // LLM API keys
  llm_key_claude?: string | Buffer;
  llm_key_openai?: string | Buffer;
  llm_key_gemini?: string | Buffer;
  llm_keys_encrypted?: boolean;
}

const store = new ElectronStore<CredentialStoreSchema>({ name: 'credentials' });

function encryptValue(value: string): string | Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value);
  }
  return value;
}

function decryptValue(data: string | Buffer, isEncrypted: boolean): string | null {
  try {
    if (isEncrypted) {
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'object' && data !== null && 'type' in data && (data as any).type === 'Buffer' && 'data' in data) {
        buffer = Buffer.from((data as any).data);
      } else {
        return null;
      }
      return safeStorage.decryptString(buffer);
    }
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function setGmailCredentials(clientId: string, clientSecret: string): void {
  const encrypted = safeStorage.isEncryptionAvailable();
  store.set('gmail_client_id', encryptValue(clientId));
  store.set('gmail_client_secret', encryptValue(clientSecret));
  store.set('gmail_credentials_encrypted', encrypted);
  console.log('[CredentialStore] Gmail credentials saved (encrypted:', encrypted, ')');
}

export function getGmailCredentials(): { clientId: string; clientSecret: string } | null {
  const idData = store.get('gmail_client_id');
  const secretData = store.get('gmail_client_secret');

  if (!idData || !secretData) {
    // Fall back to environment variables (dev mode)
    const envId = process.env.GMAIL_CLIENT_ID;
    const envSecret = process.env.GMAIL_CLIENT_SECRET;
    if (envId && envSecret) {
      return { clientId: envId, clientSecret: envSecret };
    }
    return null;
  }

  const isEncrypted = store.get('gmail_credentials_encrypted', false);
  const clientId = decryptValue(idData, isEncrypted);
  const clientSecret = decryptValue(secretData, isEncrypted);

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function hasGmailCredentials(): boolean {
  // Check stored credentials first
  if (store.get('gmail_client_id') && store.get('gmail_client_secret')) {
    return true;
  }
  // Fall back to env vars
  return !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
}

// ============ LLM API Key Storage ============

const LLM_KEY_MAP: Record<string, 'llm_key_claude' | 'llm_key_openai' | 'llm_key_gemini'> = {
  claude: 'llm_key_claude',
  openai: 'llm_key_openai',
  gemini: 'llm_key_gemini',
};

export function setLLMApiKey(provider: string, key: string): void {
  const storeKey = LLM_KEY_MAP[provider];
  if (!storeKey) throw new Error(`Unknown LLM provider: ${provider}`);

  const encrypted = safeStorage.isEncryptionAvailable();
  store.set(storeKey, encryptValue(key));
  store.set('llm_keys_encrypted', encrypted);
  console.log(`[CredentialStore] LLM key for '${provider}' saved (encrypted: ${encrypted})`);
}

export function getLLMApiKey(provider: string): string | null {
  const storeKey = LLM_KEY_MAP[provider];
  if (!storeKey) return null;

  const data = store.get(storeKey);
  if (!data) return null;

  const isEncrypted = store.get('llm_keys_encrypted', false);
  return decryptValue(data, isEncrypted);
}

export function hasLLMApiKey(provider: string): boolean {
  const storeKey = LLM_KEY_MAP[provider];
  if (!storeKey) return false;
  return !!store.get(storeKey);
}
