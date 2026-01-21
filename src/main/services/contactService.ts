import { parsePhoneNumber } from 'libphonenumber-js';

export interface ContactInfo {
  firstName?: string;
  lastName?: string;
  displayName: string;
}

// Cache for fast lookups: normalized handle -> ContactInfo
let contactCache: Map<string, ContactInfo> = new Map();
let cacheBuilt = false;

/**
 * Build contact cache from macOS Contacts.
 *
 * NOTE: node-mac-contacts failed to build with Node.js 24 due to N-API changes
 * (napi_add_finalizer signature). This implementation provides the expected
 * interface but with limited functionality until an alternative is found.
 *
 * Options for future implementation:
 * 1. Direct SQLite query to AddressBook-v22.abcddb
 * 2. Use AppleScript to query Contacts.app
 * 3. Wait for node-mac-contacts Node.js 24 fix
 */
export async function buildContactCache(): Promise<void> {
  // For now, cache remains empty until we implement an alternative
  // This means contacts will show as phone numbers/emails
  console.log('Contact cache building skipped - node-mac-contacts unavailable');
  cacheBuilt = true;
}

/**
 * Resolve a phone number or email address to a contact name.
 * Handles various phone formats via libphonenumber-js.
 *
 * @param handle Phone number or email from iMessage
 * @returns ContactInfo if found, null otherwise
 */
export function resolveHandle(handle: string | null): ContactInfo | null {
  if (!handle || !cacheBuilt) return null;

  // Try direct lookup first (exact match)
  const direct = contactCache.get(handle.toLowerCase());
  if (direct) return direct;

  // Try E.164 normalized phone format
  try {
    const parsed = parsePhoneNumber(handle, 'US');
    if (parsed) {
      const normalized = parsed.format('E.164');
      const found = contactCache.get(normalized);
      if (found) return found;
    }
  } catch {
    // Not a valid phone number, continue to other methods
  }

  // Try stripping non-digits for phone matching
  const digitsOnly = handle.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    const found = contactCache.get(digitsOnly);
    if (found) return found;

    // Try with +1 prefix (US country code)
    const withPrefix = '+1' + digitsOnly.slice(-10);
    const foundWithPrefix = contactCache.get(withPrefix);
    if (foundWithPrefix) return foundWithPrefix;
  }

  return null;
}

/**
 * Refresh the contact cache from macOS Contacts.
 * Call this if user adds new contacts while app is running.
 */
export async function refreshContacts(): Promise<void> {
  await buildContactCache();
}

/**
 * Check if the contact cache has been built.
 */
export function isContactsCacheBuilt(): boolean {
  return cacheBuilt;
}
