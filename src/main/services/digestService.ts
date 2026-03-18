import ElectronStore from 'electron-store';
import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { llmService } from './llmService';
import { gmailService } from './gmailService';
import { gmailAuthService } from './gmailAuthService';
import { google } from 'googleapis';
import { iMessageService } from './iMessageService';
import type { DigestCategory, Digest, DigestEmailItem, DigestImessageItem } from '../../shared/ipcTypes';

interface DigestStoreSchema {
  categories: DigestCategory[];
  lastDigest: Digest | null;
  autoEnabled: boolean;
  autoTime: string; // HH:MM format
  autoFrequency: 'hourly' | 'daily' | 'weekly';
  autoIntervalHours: number; // for hourly: 1, 2, 3, 4, 6
  autoWeekday: number; // for weekly: 0=Sun..6=Sat
  lookbackDays: number;
  lastAutoRun: string | null; // ISO timestamp
}

const store = new ElectronStore<DigestStoreSchema>({
  name: 'digest-data',
  defaults: {
    categories: [],
    lastDigest: null,
    autoEnabled: false,
    autoTime: '18:00',
    autoFrequency: 'daily',
    autoIntervalHours: 1,
    autoWeekday: 1,
    lookbackDays: 7,
    lastAutoRun: null,
  },
});

class DigestServiceClass {
  private autoInterval: ReturnType<typeof setInterval> | null = null;

  // ============ Category CRUD ============

  getCategories(): DigestCategory[] {
    const userCategories = store.get('categories') || [];
    // Always include Miscellaneous as a catch-all
    const MISC_ID = '__miscellaneous__';
    const hasMisc = userCategories.some(c => c.id === MISC_ID || c.name.toLowerCase() === 'miscellaneous');
    if (!hasMisc) {
      return [...userCategories, { id: MISC_ID, name: 'Miscellaneous', color: '#6b7280', description: 'Important emails that don\'t fit other categories' }];
    }
    return userCategories;
  }

  createCategory(category: Omit<DigestCategory, 'id'>): DigestCategory {
    const categories = this.getCategories();
    const newCategory: DigestCategory = { id: randomUUID(), ...category };
    categories.push(newCategory);
    store.set('categories', categories);
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<Omit<DigestCategory, 'id'>>): DigestCategory | null {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return null;
    categories[index] = { ...categories[index], ...updates };
    store.set('categories', categories);
    return categories[index];
  }

  deleteCategory(id: string): { success: boolean } {
    const categories = this.getCategories();
    store.set('categories', categories.filter(c => c.id !== id));
    return { success: true };
  }

  // ============ Digest Generation ============

  getLastDigest(): Digest | null {
    return store.get('lastDigest') || null;
  }

  async generateDigest(): Promise<Digest> {
    const digest: Digest = {
      id: randomUUID(),
      generatedAt: new Date(),
      emailItems: [],
      imessageItems: [],
      imessageSummary: '',
      status: 'generating',
    };

    store.set('lastDigest', digest);

    try {
      // Run email and iMessage digests in parallel; each catches its own errors
      const [emailResult, imessageResult] = await Promise.all([
        this.digestEmails().catch(err => {
          console.error('[Digest] Email digest failed:', err);
          return [] as DigestEmailItem[];
        }),
        this.digestImessages().catch(err => {
          console.error('[Digest] iMessage digest failed:', err);
          return { summary: '', items: [] as DigestImessageItem[] };
        }),
      ]);

      digest.emailItems = emailResult;
      digest.imessageItems = imessageResult.items;
      digest.imessageSummary = imessageResult.summary;
      digest.status = 'complete';
    } catch (err: any) {
      console.error('[Digest] Failed:', err);
      digest.status = 'error';
      digest.error = err?.message || 'Failed to generate digest';
    }

    store.set('lastDigest', digest);
    return digest;
  }

  private async digestEmails(): Promise<DigestEmailItem[]> {
    const userCategories = this.getCategories();

    // Always include a Miscellaneous category as a catch-all
    const MISC_ID = '__miscellaneous__';
    const hasMisc = userCategories.some(c => c.id === MISC_ID || c.name.toLowerCase() === 'miscellaneous');
    const categories = hasMisc ? userCategories : [
      ...userCategories,
      { id: MISC_ID, name: 'Miscellaneous', color: '#6b7280', description: 'Important emails that don\'t fit other categories' },
    ];

    if (userCategories.length === 0) {
      console.log('[Digest] No email categories configured, using only Miscellaneous.');
    }

    if (!gmailAuthService.isAuthenticated()) {
      throw new Error('Gmail not connected. Connect Gmail in Settings.');
    }

    // Fetch past week of inbox threads (use Gmail search query for date range)
    console.log('[Digest] Fetching Gmail threads from past week...');
    const lookbackDays = store.get('lookbackDays');
    const result = await gmailService.getThreads(100, undefined, `newer_than:${lookbackDays}d`);
    const threads = result.threads || [];
    console.log('[Digest] Fetched', threads.length, 'threads from past week');

    if (threads.length === 0) {
      return [];
    }

    // Get user's email for filtering out sent messages
    let userEmail = gmailAuthService.getUserEmail();
    if (!userEmail) {
      // Try fetching from Gmail profile (email wasn't stored during original auth)
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: gmailAuthService.getOAuth2Client() });
        const userInfo = await oauth2.userinfo.get();
        userEmail = userInfo.data.email || null;
        console.log('[Digest] Fetched user email from profile:', userEmail);
      } catch (e) {
        console.warn('[Digest] Could not fetch user email from profile:', e);
      }
    }
    console.log('[Digest] User email:', userEmail);

    // Filter to threads where last message is NOT from user
    const unreplied = threads.filter(t => {
      const lastMsg = t.messages[t.messages.length - 1];
      if (!lastMsg) return false;
      // If we have the user's email, filter out threads where the last message is from them
      if (userEmail) {
        return !lastMsg.from.toLowerCase().includes(userEmail.toLowerCase());
      }
      // Without user email, include all threads and let Claude sort it out
      return true;
    });
    console.log('[Digest] Unreplied threads:', unreplied.length);

    if (unreplied.length === 0) {
      return [];
    }

    // Build email data — include more context for Claude
    const emailData = unreplied.map((t, i) => {
      const lastMsg = t.messages[t.messages.length - 1];
      const msgCount = t.messages.length;
      return {
        index: i,
        threadId: t.id,
        subject: lastMsg.subject,
        from: lastMsg.from,
        snippet: lastMsg.snippet,
        date: lastMsg.date,
        messageCount: msgCount,
      };
    });

    const categoryList = categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
    }));

    const systemPrompt = `You are an executive assistant triaging an email inbox. You categorize emails into the user's categories, decide priority, and write a short contextual note for each.

CATEGORIZATION RULES:
- Read each category's name AND description carefully. Match emails based on the category's purpose, not just keyword overlap.
- An email must CLEARLY belong to a category to be assigned there. If it's ambiguous or only loosely related, put it in "Miscellaneous" (id: "${MISC_ID}").
- The "Miscellaneous" category MUST be used for any important email that doesn't clearly fit another category. There should almost always be some emails in Miscellaneous — it's a catch-all for legitimate correspondence that doesn't match your defined categories.
- Skip newsletters, automated notifications, marketing, and low-value emails entirely — do NOT include them at all.

IMPORTANT: Return ONLY a valid JSON array. No markdown, no explanation, no wrapping.`;

    const userMessage = `Triage these unread/unreplied emails from the past week. For each email worth the user's attention:
1. Assign it to the BEST-FITTING category. Be strict — only assign to a specific category if the email clearly belongs there based on the category description. When in doubt, use "Miscellaneous" (id: "${MISC_ID}").
2. Assign a priority (1 = most urgent/important, higher = less urgent)
3. Write a SHORT note (like a human assistant would) — who it's from, what they need, what action to take. Examples:
   - "DCG speaker invitation"
   - "Cibele from LTK sent agreement for review - forward to Marissa"
   - "Daniel (as an FYI)"
   - "Audrey re: pitch competition details + next steps"
   - "Jay Lundy about Monique investment, P said hold"

Skip ONLY truly low-value emails (newsletters, automated notifications, marketing, receipts). Keep notes brief and actionable. Use names, not email addresses.

Categories (use the exact id values):
${JSON.stringify(categoryList, null, 2)}

Emails:
${JSON.stringify(emailData, null, 2)}

Return a JSON array where each element has:
- "index": number (the email's index from above)
- "categoryId": string (MUST be one of the exact category ids listed above)
- "priority": number (1 = highest priority)
- "note": string (short assistant-style note)

Return ONLY the JSON array. Include all emails worth attention. Use "${MISC_ID}" for anything that doesn't clearly fit another category.`;

    console.log('[Digest] Sending', unreplied.length, 'emails to Claude for triage...');
    const response = await llmService.sendMessage(systemPrompt, userMessage);
    console.log('[Digest] Claude response length:', response.length);

    // Parse response
    let triaged: Array<{ index: number; categoryId: string; priority: number; note: string }>;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      triaged = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      console.error('[Digest] Failed to parse Claude response:', response.slice(0, 500));
      throw new Error('Failed to parse Claude response. The AI returned an unexpected format.');
    }

    // Build result items
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const items: DigestEmailItem[] = [];

    for (const t of triaged) {
      const email = emailData[t.index];
      if (!email) continue;

      // Validate the categoryId exists, fall back to first category
      const validCategoryId = categoryMap.has(t.categoryId) ? t.categoryId : categories[0].id;

      items.push({
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        snippet: email.snippet,
        date: email.date,
        categoryId: validCategoryId,
        note: t.note || '',
        priority: t.priority || 99,
      });
    }

    // Sort by priority within each category
    items.sort((a, b) => a.priority - b.priority);

    console.log('[Digest] Triaged', items.length, 'emails across', new Set(items.map(i => i.categoryId)).size, 'categories');
    return items;
  }

  private async digestImessages(): Promise<{ summary: string; items: DigestImessageItem[] }> {
    let convs;
    try {
      convs = iMessageService.getConversations(30);
    } catch (err) {
      console.log('[Digest] iMessage not accessible, skipping.');
      return { summary: '', items: [] };
    }

    // Filter to conversations where the last message is NOT from me (i.e. needs reply)
    // and within the lookback window
    const lookbackDays = store.get('lookbackDays');
    const APPLE_EPOCH_PRE = 978307200;
    const cutoffMs = Date.now() - (lookbackDays * 24 * 60 * 60 * 1000);
    const needsReply = convs.filter(c => {
      if (c.is_from_me === 1) return false; // already replied
      const dateMs = ((c.last_message_date / 1_000_000_000) + APPLE_EPOCH_PRE) * 1000;
      return dateMs >= cutoffMs;
    });
    console.log('[Digest] iMessage conversations needing reply:', needsReply.length);

    if (needsReply.length === 0) {
      return { summary: '', items: [] };
    }

    // Resolve contact names for display
    const { resolveHandle, isContactsCacheBuilt, buildContactCache } = await import('./contactService');

    // Ensure contact cache is built before resolving names
    if (!isContactsCacheBuilt()) {
      console.log('[Digest] Contact cache not built, building now...');
      await buildContactCache();
    }

    // Convert Apple nanosecond timestamps and resolve names
    const APPLE_EPOCH = 978307200;
    const toDateMs = (appleNano: number) => ((appleNano / 1_000_000_000) + APPLE_EPOCH) * 1000;
    const now = Date.now();
    const contextData = needsReply.map((c, i) => {
      const dateMs = toDateMs(c.last_message_date);
      const isGroup = c.style === 43;
      let resolvedName: string;

      if (isGroup) {
        // For group chats: use display_name if set, otherwise resolve participant names
        if (c.display_name) {
          resolvedName = c.display_name;
        } else {
          const participants = iMessageService.getGroupParticipants(c.id);
          const names = participants.map(p => {
            const info = resolveHandle(p.handle_id);
            return info?.displayName || p.handle_id;
          });
          resolvedName = names.length > 0 ? names.join(', ') : c.chat_identifier;
        }
      } else {
        const contact = resolveHandle(c.handle_id || c.chat_identifier);
        resolvedName = contact?.displayName || c.display_name || c.chat_identifier;
      }

      return {
        index: i,
        conversationId: c.id,
        contactName: resolvedName,
        chatIdentifier: c.chat_identifier,
        isGroup,
        lastMessage: c.last_message,
        waitingHours: Math.round((now - dateMs) / 3600000),
      };
    });

    const systemPrompt = `You are an assistant reviewing iMessage conversations awaiting reply.
Write 2-3 paragraphs summarizing the conversations that need attention. Cover the most urgent/important ones in detail and briefly mention others worth noting. Focus on what matters — urgent requests, time-sensitive replies, important people.

CRITICAL — LINKING FORMAT: Every time you mention a person's name, you MUST wrap it with their conversation index using this EXACT format: <<index:Name>>
Examples of correct usage:
- "<<0:Mom>> needs to know about dinner plans by 5pm."
- "<<3:Alex>> sent over the project brief for review."
- "<<7:Sarah, Mike, Jen>> group chat is discussing weekend plans."

Every person name MUST be wrapped in <<index:Name>> markers. Never write a bare name without the markers.

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`;

    const userMessage = `Review these iMessage conversations that need a reply. Write 2-3 paragraphs covering the important ones. Every person mentioned MUST use the <<index:ContactName>> format so we can create clickable links.

Conversations:
${JSON.stringify(contextData, null, 2)}

Return JSON with this exact shape:
{
  "paragraph": "2-3 paragraphs with <<index:Name>> markers for every person mentioned. Example: <<0:Mom>> asked about dinner, and <<3:Alex>> sent project details.",
  "conversations": [
    { "index": 0, "priority": 1, "note": "short action note" }
  ]
}

RULES:
- The "paragraph" field must contain 2-3 paragraphs (use \\n\\n between paragraphs)
- EVERY person name must be wrapped in <<index:Name>> markers — no exceptions
- Include all conversations worth attention in the "conversations" array
- Return ONLY the JSON object, no other text`;

    console.log('[Digest] Sending', needsReply.length, 'iMessage conversations to Claude...');
    const response = await llmService.sendMessage(systemPrompt, userMessage);
    console.log('[Digest] Claude iMessage response length:', response.length);

    let parsed: { paragraph?: string; summary?: string; conversations: Array<{ index: number; priority: number; note: string }> };
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      console.error('[Digest] Failed to parse iMessage Claude response:', response.slice(0, 500));
      throw new Error('Failed to parse Claude iMessage response.');
    }

    const items: DigestImessageItem[] = [];
    for (const c of parsed.conversations) {
      const conv = needsReply[c.index];
      const ctx = contextData[c.index];
      if (!conv || !ctx) continue;
      const dateMs = toDateMs(conv.last_message_date);
      items.push({
        conversationId: conv.id,
        contactName: ctx.contactName,
        chatIdentifier: conv.chat_identifier,
        isGroup: conv.style === 43,
        lastMessage: conv.last_message,
        lastMessageDate: new Date(dateMs),
        note: c.note || '',
        priority: c.priority || 99,
      });
    }

    items.sort((a, b) => a.priority - b.priority);
    console.log('[Digest] Triaged', items.length, 'iMessage conversations');

    // Resolve <<index:Name>> markers to <<conversationId:Name>> for frontend linking
    let paragraph = parsed.paragraph || parsed.summary || '';
    paragraph = paragraph.replace(/<<(\d+):([^>]+)>>/g, (_, indexStr, name) => {
      const idx = parseInt(indexStr, 10);
      const conv = needsReply[idx];
      if (conv) return `<<${conv.id}:${name}>>`;
      return name; // fallback to plain name if index invalid
    });

    return { summary: paragraph, items };
  }

  // ============ Auto-scheduling ============

  getAutoSettings(): { enabled: boolean; time: string; frequency: 'hourly' | 'daily' | 'weekly'; lookbackDays: number; intervalHours: number; weekday: number } {
    return {
      enabled: store.get('autoEnabled'),
      time: store.get('autoTime'),
      frequency: store.get('autoFrequency') || 'daily',
      lookbackDays: store.get('lookbackDays') ?? 7,
      intervalHours: store.get('autoIntervalHours') ?? 1,
      weekday: store.get('autoWeekday') ?? 1,
    };
  }

  setAutoSettings(enabled: boolean, time: string, frequency: 'hourly' | 'daily' | 'weekly', lookbackDays: number, intervalHours: number, weekday: number): void {
    store.set('autoEnabled', enabled);
    store.set('autoTime', time);
    store.set('autoFrequency', frequency);
    store.set('lookbackDays', lookbackDays);
    store.set('autoIntervalHours', intervalHours);
    store.set('autoWeekday', weekday);
    this.stopAutoSchedule();
    if (enabled) this.startAutoSchedule();
  }

  startAutoSchedule(): void {
    if (this.autoInterval) return;
    if (!store.get('autoEnabled')) return;

    this.autoInterval = setInterval(() => {
      this.checkAutoGenerate();
    }, 60_000);
  }

  stopAutoSchedule(): void {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
  }

  private async checkAutoGenerate(): Promise<void> {
    if (!store.get('autoEnabled')) return;
    const available = await llmService.isAvailable();
    if (!available) return;

    const now = new Date();
    const frequency = store.get('autoFrequency') || 'daily';
    const lastRun = store.get('lastAutoRun');
    const lastRunDate = lastRun ? new Date(lastRun) : null;
    const msSinceLastRun = lastRunDate ? now.getTime() - lastRunDate.getTime() : Infinity;

    let shouldRun = false;

    if (frequency === 'hourly') {
      const intervalHours = store.get('autoIntervalHours') || 1;
      shouldRun = msSinceLastRun >= intervalHours * 60 * 60 * 1000;
    } else if (frequency === 'daily') {
      // Run once per day at configured time
      const todayStr = now.toISOString().split('T')[0];
      const lastRunDay = lastRunDate ? lastRunDate.toISOString().split('T')[0] : null;
      if (lastRunDay === todayStr) return;

      const [targetH, targetM] = store.get('autoTime').split(':').map(Number);
      shouldRun = now.getHours() > targetH || (now.getHours() === targetH && now.getMinutes() >= targetM);
    } else if (frequency === 'weekly') {
      const autoWeekday = store.get('autoWeekday') ?? 1;
      if (now.getDay() !== autoWeekday) return;

      // Only run once per day on the target weekday
      const todayStr = now.toISOString().split('T')[0];
      const lastRunDay = lastRunDate ? lastRunDate.toISOString().split('T')[0] : null;
      if (lastRunDay === todayStr) return;

      const [targetH, targetM] = store.get('autoTime').split(':').map(Number);
      shouldRun = now.getHours() > targetH || (now.getHours() === targetH && now.getMinutes() >= targetM);
    }

    if (shouldRun) {
      console.log(`[Digest] Auto-generating ${frequency} digest...`);
      store.set('lastAutoRun', now.toISOString());

      try {
        await this.generateDigest();
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('digest:auto-generated');
        }
      } catch (err) {
        console.error('[Digest] Auto-generation failed:', err);
      }
    }
  }
}

export const digestService = new DigestServiceClass();
