import { google } from "googleapis";
import { prisma } from "./prisma";

/**
 * Gets an authenticated Gmail client for a specific account.
 */
export async function getGmailClient(userId, accountId = null) {
  const where = { userId, provider: "google" };
  if (accountId) where.id = accountId;

  const account = await prisma.account.findFirst({ where });

  if (!account || !account.access_token) {
    throw new Error("User has no Google account linked or missing access token");
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.on('tokens', async (tokens) => {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
          ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        }
      });
    } catch (e) {
      console.error("Failed to update tokens in database:", e);
    }
  });

  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined
  });

  return google.gmail({ version: "v1", auth });
}

/**
 * Retrieves all connected Google accounts for a user and their email addresses
 */
export async function getConnectedAccounts(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: "google" }
  });

  const profiles = await Promise.all(accounts.map(async (acc) => {
    try {
      const gmail = await getGmailClient(userId, acc.id);
      const profile = await gmail.users.getProfile({ userId: "me" });
      return { id: acc.id, email: profile.data.emailAddress };
    } catch (e) {
      console.error(`Failed to fetch profile for account ${acc.id}:`, e.message);
      return { id: acc.id, email: "Unknown Account" };
    }
  }));

  return profiles;
}

/**
 * Returns an array of clients (for legacy compatibility if needed)
 */
export async function getAllGmailClients(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: "google" }
  });
  if (accounts.length === 0) throw new Error("No connected google accounts found");

  const clients = [];
  for (const acc of accounts) {
    try {
      const g = await getGmailClient(userId, acc.id);
      clients.push({ accountId: acc.id, gmail: g });
    } catch(e) {
      console.error(`Failed to init gmail for acc ${acc.id}`, e);
    }
  }
  return clients;
}

/**
 * Fetches the sidebar layout data (spaces) for the specified account.
 */
export async function getSidebarSpaces(userId, accountId = null) {
  if (accountId === "unified") {
    return [
      { name: "Inbox", query: "in:inbox" },
      { name: "All Mail", query: "-in:trash" },
      { name: "Starred", query: "is:starred" },
      { name: "Drafts", query: "in:draft" },
      { name: "Sent", query: "in:sent" },
      { name: "Services", query: "(receipt OR invoice OR order OR service) -in:trash -in:draft -in:spam" },
      { name: "Finance", query: "(bank OR statement OR payment OR finance) -in:trash -in:draft -in:spam" },
      { name: "Spam", query: "in:spam" },
      { name: "Trash", query: "in:trash" }
    ];
  }

  const gmail = await getGmailClient(userId, accountId);
  
  let labels = [];
  try {
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    labels = labelsRes.data.labels.map(l => l.name);
  } catch(e) {
    console.error("Could not fetch labels", e.message);
  }

  const linearAliases = labels
    .filter(l => l.startsWith('LinearVentures/'))
    .map(l => l.split('/')[1] + '@linearventures.in')
    .sort();

  const nanolissAliases = labels
    .filter(l => l.startsWith('Nanoliss/'))
    .map(l => l.split('/')[1] + '@nanoliss.in')
    .sort();

  const isNanolissMain = labels.includes('Nanoliss') || nanolissAliases.length > 0;
  const isLinearMain = labels.includes('LinearVentures') || linearAliases.length > 0;

  if (isNanolissMain && !nanolissAliases.includes('nanoliss.in@gmail.com')) {
    nanolissAliases.push('nanoliss.in@gmail.com');
  }

  const spaces = [
    { name: "All Mail", query: "-in:trash" },
    { name: "Starred", query: "is:starred" },
    { name: "Drafts", query: "in:draft" },
    { name: "Sent", query: "in:sent" },
  ];

  if (isLinearMain) {
    spaces.push({ 
      name: "Linear Ventures", 
      query: "(to:linearventures.in OR from:linearventures.in) -in:trash -in:draft",
      subSpaces: linearAliases.map(email => ({
        name: email,
        query: `(to:${email} OR from:${email}) -in:trash -in:draft`
      }))
    });
  }

  if (isNanolissMain) {
    spaces.push({ 
      name: "Nanoliss", 
      query: "(to:nanoliss.in OR from:nanoliss.in) -in:trash -in:draft",
      subSpaces: nanolissAliases.map(email => ({
        name: email,
        query: `(to:${email} OR from:${email}) -in:trash -in:draft`
      }))
    });
  }

  spaces.push(
    { name: "Services", query: "(receipt OR invoice OR order OR service) -in:trash -in:draft -in:spam" },
    { name: "Finance", query: "(bank OR statement OR payment OR finance) -in:trash -in:draft -in:spam" },
    { name: "Spam", query: "in:spam" },
    { name: "Trash", query: "in:trash" }
  );

  return spaces;
}

/**
 * Fetches emails from the specified account.
 */
export async function fetchEmails(userId, accountId = null, query = "") {
  try {
    if (accountId === "unified") {
      const accounts = await prisma.account.findMany({ where: { userId, provider: "google" } });
      const allEmailsPromises = accounts.map(async (acc) => {
        try {
          return await fetchEmailsForAccount(userId, acc.id, query);
        } catch(e) {
          console.error(`Failed to fetch for account ${acc.id}`, e);
          return [];
        }
      });
      const allEmailsArrays = await Promise.all(allEmailsPromises);
      const unifiedEmails = allEmailsArrays.flat();
      unifiedEmails.sort((a, b) => b.internalDate - a.internalDate);
      return unifiedEmails;
    }

    return await fetchEmailsForAccount(userId, accountId, query);
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
}

async function fetchEmailsForAccount(userId, accountId, query) {
  const gmail = await getGmailClient(userId, accountId);
  const activeAccountId = accountId || (await prisma.account.findFirst({ where: { userId, provider: "google" } })).id;

    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return [];

    const detailed = await Promise.all(
      messages.map(async (m) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const headers = msg.data.payload?.headers || [];
          const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
          
          const fromHeader = getHeader("From");
          const toHeader = getHeader("To");
          const match = fromHeader.match(/(.*?) <(.*?)>/);
          const senderName = match ? match[1].replace(/"/g, "").trim() : fromHeader;

          const internalDate = parseInt(msg.data.internalDate);

          return {
            id: msg.data.id,
            accountId: activeAccountId,
            threadId: msg.data.threadId,
            subject: getHeader("Subject") || "(No Subject)",
            sender: senderName,
            from: fromHeader,
            to: toHeader,
            preview: msg.data.snippet || "",
            date: new Date(internalDate).toISOString(),
            internalDate,
            isUnread: msg.data.labelIds ? msg.data.labelIds.includes("UNREAD") : false,
            isStarred: msg.data.labelIds ? msg.data.labelIds.includes("STARRED") : false,
          };
        } catch (err) {
          console.error(`Failed to fetch message ${m.id}`, err);
          return null;
        }
      })
    );

    const finalEmails = detailed.filter(e => e !== null);
    finalEmails.sort((a, b) => b.internalDate - a.internalDate);
    return finalEmails;
}

/**
 * Fetches the full body of a specific email.
 */
export async function getEmailBody(userId, accountId, messageId) {
  const gmail = await getGmailClient(userId, accountId);
  
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  let bodyData = "";
  let isHtml = false;
  const attachments = [];

  const extractParts = (part) => {
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body?.attachmentId || null,
        data: part.body?.data || null,
        size: part.body?.size || 0,
      });
    }

    if (part.mimeType === "text/html" && part.body?.data) {
      bodyData = Buffer.from(part.body.data, 'base64').toString('utf8');
      isHtml = true;
    }
    if (part.mimeType === "text/plain" && part.body?.data && !isHtml) {
      bodyData = Buffer.from(part.body.data, 'base64').toString('utf8');
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        extractParts(subPart);
      }
    }
  };

  if (msg.data.payload) {
    extractParts(msg.data.payload);
  }
  
  if (!bodyData && msg.data.payload?.body?.data) {
    bodyData = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf8');
    isHtml = msg.data.payload.mimeType === "text/html";
  }

  const listUnsubscribe = getHeader("List-Unsubscribe");
  let unsubscribeUrl = null;
  if (listUnsubscribe) {
    const match = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/) || listUnsubscribe.match(/<(mailto:[^>]+)>/);
    if (match) {
      unsubscribeUrl = match[1];
    }
  }

  return {
    id: msg.data.id,
    accountId,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    html: isHtml ? bodyData : null,
    text: !isHtml ? bodyData : null,
    attachments,
    unsubscribeUrl
  };
}

/**
 * Fetches all messages in a thread
 */
export async function getThread(userId, accountId, threadId) {
  const gmail = await getGmailClient(userId, accountId);
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full"
  });

  if (!res.data.messages) return [];

  return res.data.messages.map(msg => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    let bodyData = "";
    let isHtml = false;
    const attachments = [];

    const extractParts = (part) => {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body?.attachmentId || null,
          data: part.body?.data || null,
          size: part.body?.size || 0,
        });
      }

      if (part.mimeType === "text/html" && part.body?.data) {
        bodyData = Buffer.from(part.body.data, 'base64').toString('utf8');
        isHtml = true;
      }
      if (part.mimeType === "text/plain" && part.body?.data && !isHtml) {
        bodyData = Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          extractParts(subPart);
        }
      }
    };

    if (msg.payload) {
      extractParts(msg.payload);
    }
    
    if (!bodyData && msg.payload?.body?.data) {
      bodyData = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
      isHtml = msg.payload.mimeType === "text/html";
    }

    return {
      id: msg.id,
      accountId,
      threadId: msg.threadId,
      subject: getHeader("Subject"),
      from: getHeader("From"),
      to: getHeader("To"),
      date: getHeader("Date"),
      html: isHtml ? bodyData : null,
      text: !isHtml ? bodyData : null,
      attachments,
      isStarred: msg.labelIds ? msg.labelIds.includes("STARRED") : false,
      isUnread: msg.labelIds ? msg.labelIds.includes("UNREAD") : false,
    };
  });
}

/**
 * Sends an email using the Gmail API
 */
export async function sendEmail(userId, accountId, { to, cc, bcc, from, subject, body, attachments = [] }) {
  const gmail = await getGmailClient(userId, accountId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const finalBody = user?.signature ? `${body}\n\n-- \n${user.signature}` : body;

  const boundary = `----=_Part_${Math.random().toString(36).substring(2)}`;
  
  let str = "";
  if (attachments.length > 0) {
    str += `Content-Type: multipart/mixed; boundary="${boundary}"\n`;
    str += `MIME-Version: 1.0\n`;
    str += `to: ${to}\n`;
    if (cc) str += `cc: ${cc}\n`;
    if (bcc) str += `bcc: ${bcc}\n`;
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    
    str += `--${boundary}\n`;
    str += `Content-Type: text/plain; charset="UTF-8"\n`;
    str += `Content-Transfer-Encoding: 7bit\n\n`;
    str += `${finalBody}\n\n`;
    
    for (const att of attachments) {
      str += `--${boundary}\n`;
      str += `Content-Type: ${att.mimeType}; name="${att.filename}"\n`;
      str += `Content-Disposition: attachment; filename="${att.filename}"\n`;
      str += `Content-Transfer-Encoding: base64\n\n`;
      const b64 = att.data.replace(/(.{76})/g, "$1\n");
      str += `${b64}\n\n`;
    }
    str += `--${boundary}--\n`;
  } else {
    str += `Content-Type: text/plain; charset="UTF-8"\n`;
    str += `MIME-Version: 1.0\n`;
    str += `Content-Transfer-Encoding: 7bit\n`;
    str += `to: ${to}\n`;
    if (cc) str += `cc: ${cc}\n`;
    if (bcc) str += `bcc: ${bcc}\n`;
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    str += finalBody;
  }

  const encodedEmail = Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
    },
  });

  return res.data;
}

/**
 * Adds a new Send As alias
 */
export async function addSendAsAlias(userId, accountId, name, email) {
  const gmail = await getGmailClient(userId, accountId);
  
  const res = await gmail.users.settings.sendAs.create({
    userId: 'me',
    requestBody: {
      sendAsEmail: email,
      displayName: name,
      treatAsAlias: true
    }
  });

  return res.data;
}

/**
 * Gets all Send As aliases
 */
export async function getSendAsAliases(userId, accountId) {
  const gmail = await getGmailClient(userId, accountId);
  const res = await gmail.users.settings.sendAs.list({ userId: 'me' });
  return res.data.sendAs || [];
}

/**
 * Marks messages as read
 */
export async function markAsRead(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        removeLabelIds: ['UNREAD']
      }
    });
  }
}

/**
 * Marks messages as unread
 */
export async function markAsUnread(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: ['UNREAD']
      }
    });
  }
}

/**
 * Trashes messages
 */
export async function trashMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: ['TRASH'],
        removeLabelIds: ['INBOX']
      }
    });
  }
}

/**
 * Moves messages to a specific label (removes from INBOX, adds labelId)
 */
export async function moveMessages(userId, messages, labelId) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: [labelId],
        removeLabelIds: ['INBOX']
      }
    });
  }
}

/**
 * Archives messages (removes from INBOX)
 */
export async function archiveMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        removeLabelIds: ['INBOX']
      }
    });
  }
}

/**
 * Unsnoozes messages (adds to INBOX, marks UNREAD)
 */
export async function unsnoozeMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: ['INBOX', 'UNREAD']
      }
    });
  }
}

/**
 * Stars messages
 */
export async function starMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        addLabelIds: ['STARRED']
      }
    });
  }
}

/**
 * Unstars messages
 */
export async function unstarMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        removeLabelIds: ['STARRED']
      }
    });
  }
}

/**
 * Untrashes messages
 */
export async function untrashMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids,
        removeLabelIds: ['TRASH']
      }
    });
  }
}

/**
 * Permanently deletes messages
 */
export async function deleteMessages(userId, messages) {
  const byAccount = {};
  for(const msg of messages) {
    if(!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
    byAccount[msg.accountId].push(msg.id);
  }

  for(const [accountId, ids] of Object.entries(byAccount)) {
    const gmail = await getGmailClient(userId, accountId);
    await gmail.users.messages.batchDelete({
      userId: 'me',
      requestBody: {
        ids
      }
    });
  }
}

/**
 * Helper to ensure a label exists and return its ID
 */
async function ensureLabel(gmail, labelName) {
  try {
    const res = await gmail.users.labels.list({ userId: "me" });
    const existing = res.data.labels.find(l => l.name === labelName);
    if (existing) return existing.id;
    
    const createRes = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show"
      }
    });
    return createRes.data.id;
  } catch (e) {
    console.error("Error ensuring label", e);
    return null;
  }
}

/**
 * Performs the retroactive audit for all connected accounts
 */
export async function performAudit(userId, accountId) {
  let accounts = await prisma.account.findMany({ where: { userId, provider: "google" } });
  
  // If an accountId is provided, filter to only that account
  if (accountId) {
    accounts = accounts.filter(acc => acc.id === accountId);
  }
  
  const rules = [
    { name: "Organizer/Finance", query: "(bank OR statement OR payment OR finance OR invoice OR receipt) -in:trash -in:draft" },
    { name: "Organizer/Services", query: "(unsubscribe OR notification OR alert OR account) -in:trash -in:draft" },
    { name: "Organizer/Newsletters", query: "(newsletter OR digest OR \"weekly update\") -in:trash -in:draft" }
  ];

  for (const account of accounts) {
    try {
      const gmail = await getGmailClient(userId, account.id);
      
      for (const rule of rules) {
        const labelId = await ensureLabel(gmail, rule.name);
        if (!labelId) continue;
        
        let pageToken = undefined;
        do {
          const res = await gmail.users.messages.list({
            userId: "me",
            q: rule.query,
            maxResults: 200, // Process in batches
            pageToken
          });
          
          const messages = res.data.messages || [];
          if (messages.length > 0) {
            const ids = messages.map(m => m.id);
            await gmail.users.messages.batchModify({
              userId: "me",
              requestBody: {
                ids,
                addLabelIds: [labelId]
              }
            });
          }
          pageToken = res.data.nextPageToken;
        } while (pageToken);
      }
    } catch (e) {
      console.error(`Audit failed for account ${account.id}:`, e);
    }
  }
}


