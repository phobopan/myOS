import { google, gmail_v1 } from 'googleapis';
import { gmailAuthService } from './gmailAuthService';
import type { GmailThread, GmailMessage, GmailAttachment } from './gmailTypes';

/**
 * Extract header value from message headers
 */
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

/**
 * Extract text/plain and text/html body from message payload
 * Recursively traverses multipart MIME structure
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { html: string; text: string } {
  let html = '';
  let text = '';

  function traverse(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  if (payload) traverse(payload);
  return { html, text };
}

/**
 * Extract attachment metadata from message payload
 * Identifies inline vs regular attachments
 */
function extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function traverse(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      const contentDisposition = part.headers?.find(
        h => h.name?.toLowerCase() === 'content-disposition'
      )?.value || '';

      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        isInline: contentDisposition.includes('inline'),
      });
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  if (payload) traverse(payload);
  return attachments;
}

/**
 * Convert Gmail API message to GmailMessage type
 */
function parseMessage(msg: gmail_v1.Schema$Message): GmailMessage {
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id!,
    threadId: msg.threadId!,
    date: new Date(parseInt(msg.internalDate!)),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    bcc: getHeader(headers, 'Bcc'),
    subject: getHeader(headers, 'Subject'),
    messageId: getHeader(headers, 'Message-ID'),
    body: extractBody(msg.payload),
    attachments: extractAttachments(msg.payload),
    snippet: msg.snippet || '',
  };
}

/**
 * Build Reply All recipients list
 * Removes authenticated user from recipients, places original sender in To
 */
function buildReplyAllRecipients(
  originalFrom: string,
  originalTo: string,
  originalCc: string,
  myEmail: string
): { to: string; cc: string } {
  // Collect all recipients
  const allRecipients = [
    originalFrom,
    ...originalTo.split(',').map(s => s.trim()),
    ...(originalCc ? originalCc.split(',').map(s => s.trim()) : []),
  ].filter(Boolean);

  // Remove myself (check for email in angle brackets or standalone)
  const others = allRecipients.filter(r =>
    !r.toLowerCase().includes(myEmail.toLowerCase())
  );

  // Original sender becomes To, everyone else becomes CC
  return {
    to: originalFrom,
    cc: others.length > 1 ? others.slice(1).join(', ') : '',
  };
}

class GmailServiceClass {
  /**
   * Get Gmail API client (lazily initialized)
   */
  private getGmail(): gmail_v1.Gmail {
    const auth = gmailAuthService.getOAuth2Client();
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Get threads from Primary inbox
   * @param maxResults Number of threads to fetch (default 20)
   */
  async getThreads(maxResults = 20): Promise<GmailThread[]> {
    const gmail = this.getGmail();
    const response = await gmail.users.threads.list({
      userId: 'me',
      q: 'category:primary',
      maxResults,
    });

    const threads = response.data.threads || [];

    // Fetch full details for each thread
    const fullThreads = await Promise.all(
      threads.map(t => this.getThread(t.id!))
    );

    return fullThreads;
  }

  /**
   * Get full thread with all messages
   * @param threadId Gmail thread ID
   */
  async getThread(threadId: string): Promise<GmailThread> {
    const gmail = this.getGmail();
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const thread = response.data;
    return {
      id: thread.id!,
      historyId: thread.historyId!,
      messages: (thread.messages || []).map(parseMessage),
    };
  }

  /**
   * Get attachment data for download
   * @param messageId Gmail message ID
   * @param attachmentId Attachment ID from GmailAttachment
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const gmail = this.getGmail();
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    return Buffer.from(response.data.data!, 'base64url');
  }

  /**
   * Send reply to a message
   * Maintains threading with In-Reply-To and References headers
   */
  async sendReply(
    threadId: string,
    originalMessageId: string,
    to: string,
    subject: string,
    body: string,
    options?: { cc?: string; bcc?: string }
  ): Promise<GmailMessage> {
    const gmail = this.getGmail();

    // Ensure subject has Re: prefix
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

    // Build RFC 2822 message
    const headers = [
      `To: ${to}`,
      options?.cc ? `Cc: ${options.cc}` : '',
      options?.bcc ? `Bcc: ${options.bcc}` : '',
      `Subject: ${replySubject}`,
      `In-Reply-To: ${originalMessageId}`,
      `References: ${originalMessageId}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ].filter(Boolean);

    const message = [...headers, '', body].join('\r\n');
    const raw = Buffer.from(message).toString('base64url');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId },
    });

    // Fetch and return the sent message with full details
    const sentMsg = await gmail.users.messages.get({
      userId: 'me',
      id: response.data.id!,
      format: 'full',
    });

    return parseMessage(sentMsg.data);
  }

  /**
   * Send reply to all recipients
   * Automatically computes Reply All recipient list
   */
  async sendReplyAll(
    threadId: string,
    originalMessage: GmailMessage,
    body: string,
    options?: { subject?: string }
  ): Promise<GmailMessage> {
    const myEmail = gmailAuthService.getUserEmail();
    if (!myEmail) throw new Error('Not authenticated');

    const { to, cc } = buildReplyAllRecipients(
      originalMessage.from,
      originalMessage.to,
      originalMessage.cc,
      myEmail
    );

    return this.sendReply(
      threadId,
      originalMessage.messageId,
      to,
      options?.subject || originalMessage.subject,
      body,
      { cc }
    );
  }

  /**
   * Forward message to new recipients
   * Creates new thread with forwarded content
   */
  async forward(
    originalMessage: GmailMessage,
    to: string,
    additionalBody?: string
  ): Promise<GmailMessage> {
    const gmail = this.getGmail();

    // Build forward subject
    const forwardSubject = originalMessage.subject.startsWith('Fwd:')
      ? originalMessage.subject
      : `Fwd: ${originalMessage.subject}`;

    // Build forwarded content
    const forwardHeader = [
      '---------- Forwarded message ---------',
      `From: ${originalMessage.from}`,
      `Date: ${originalMessage.date.toLocaleString()}`,
      `Subject: ${originalMessage.subject}`,
      `To: ${originalMessage.to}`,
      originalMessage.cc ? `Cc: ${originalMessage.cc}` : '',
      '',
    ].filter(Boolean).join('\r\n');

    const bodyContent = [
      additionalBody || '',
      '',
      forwardHeader,
      originalMessage.body.text || originalMessage.body.html,
    ].join('\r\n');

    const message = [
      `To: ${to}`,
      `Subject: ${forwardSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      bodyContent,
    ].join('\r\n');

    const raw = Buffer.from(message).toString('base64url');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },  // No threadId - forward starts new thread
    });

    const sentMsg = await gmail.users.messages.get({
      userId: 'me',
      id: response.data.id!,
      format: 'full',
    });

    return parseMessage(sentMsg.data);
  }
}

// Singleton instance
export const gmailService = new GmailServiceClass();
