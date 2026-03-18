import { parsePhoneNumber } from 'libphonenumber-js';
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface ContactInfo {
  firstName?: string;
  lastName?: string;
  displayName: string;
}

// Cache for fast lookups: normalized phone/email -> ContactInfo
let contactCache: Map<string, ContactInfo> = new Map();
let cacheBuilt = false;

/**
 * Normalize a phone number for cache lookup.
 * Strips all non-digits and removes leading country code variations.
 */
function normalizePhone(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [digits];

  // If starts with 1 and is 11 digits, also store 10-digit version
  if (digits.startsWith('1') && digits.length === 11) {
    variants.push(digits.slice(1));
  }
  // If 10 digits, also store with leading 1
  if (digits.length === 10) {
    variants.push('1' + digits);
  }

  return variants;
}

/**
 * Build contact cache from macOS AddressBook SQLite database.
 * Directly queries AddressBook-v22.abcddb for phone numbers and emails.
 */
export async function buildContactCache(): Promise<void> {
  contactCache.clear();

  const addressBookDir = path.join(app.getPath('home'), 'Library', 'Application Support', 'AddressBook', 'Sources');

  if (!fs.existsSync(addressBookDir)) {
    console.log('AddressBook directory not found');
    cacheBuilt = true;
    return;
  }

  try {
    const sources = fs.readdirSync(addressBookDir);

    for (const source of sources) {
      const dbPath = path.join(addressBookDir, source, 'AddressBook-v22.abcddb');
      if (!fs.existsSync(dbPath)) continue;

      try {
        const db = new Database(dbPath, { readonly: true });

        // Query phone numbers with contact names
        const phoneStmt = db.prepare(`
          SELECT
            p.ZFULLNUMBER as phone,
            r.ZFIRSTNAME as firstName,
            r.ZLASTNAME as lastName,
            r.ZNICKNAME as nickname
          FROM ZABCDPHONENUMBER p
          JOIN ZABCDRECORD r ON p.ZOWNER = r.Z_PK
          WHERE p.ZFULLNUMBER IS NOT NULL
        `);

        const phoneRows = phoneStmt.all() as Array<{
          phone: string;
          firstName: string | null;
          lastName: string | null;
          nickname: string | null;
        }>;

        for (const row of phoneRows) {
          const displayName = row.nickname ||
            [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
            row.phone;

          const contactInfo: ContactInfo = {
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            displayName,
          };

          // Store under multiple normalized forms for flexible lookup
          for (const variant of normalizePhone(row.phone)) {
            contactCache.set(variant, contactInfo);
          }
        }

        // Query email addresses with contact names
        const emailStmt = db.prepare(`
          SELECT
            e.ZADDRESS as email,
            r.ZFIRSTNAME as firstName,
            r.ZLASTNAME as lastName,
            r.ZNICKNAME as nickname
          FROM ZABCDEMAILADDRESS e
          JOIN ZABCDRECORD r ON e.ZOWNER = r.Z_PK
          WHERE e.ZADDRESS IS NOT NULL
        `);

        const emailRows = emailStmt.all() as Array<{
          email: string;
          firstName: string | null;
          lastName: string | null;
          nickname: string | null;
        }>;

        for (const row of emailRows) {
          const displayName = row.nickname ||
            [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
            row.email;

          const contactInfo: ContactInfo = {
            firstName: row.firstName || undefined,
            lastName: row.lastName || undefined,
            displayName,
          };

          contactCache.set(row.email.toLowerCase(), contactInfo);
        }

        db.close();
      } catch (err) {
        console.error(`Failed to read AddressBook source ${source}:`, err);
      }
    }

    console.log(`Contact cache built: ${contactCache.size} entries`);
  } catch (err) {
    console.error('Failed to build contact cache:', err);
  }

  cacheBuilt = true;
}

/**
 * Resolve a phone number or email address to a contact name.
 * Handles various phone formats via normalization.
 *
 * @param handle Phone number or email from iMessage
 * @returns ContactInfo if found, null otherwise
 */
export function resolveHandle(handle: string | null): ContactInfo | null {
  if (!handle || !cacheBuilt) return null;

  // Try email lookup (case-insensitive)
  if (handle.includes('@')) {
    return contactCache.get(handle.toLowerCase()) || null;
  }

  // Try all normalized phone variants
  for (const variant of normalizePhone(handle)) {
    const found = contactCache.get(variant);
    if (found) return found;
  }

  // Try E.164 normalized phone format as fallback
  try {
    const parsed = parsePhoneNumber(handle, 'US');
    if (parsed) {
      const e164 = parsed.format('E.164').replace('+', '');
      const found = contactCache.get(e164);
      if (found) return found;
    }
  } catch {
    // Not a valid phone number
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
