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
 * Gets all authenticated Gmail clients for the user.
 */
export async function getAllGmailClients(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: "google" },
  });

  return accounts.map(account => {
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

    return {
      accountId: account.id,
      gmail: google.gmail({ version: "v1", auth })
    };
  });
}

/**
 * Fetches standard spaces and their unread counts.
 */
export async function getSidebarSpaces(userId) {
  const clients = await getAllGmailClients(userId);
  
  let allLabels = [];
  await Promise.all(clients.map(async ({ gmail }) => {
    try {
      const labelsRes = await gmail.users.labels.list({ userId: "me" });
      allLabels.push(...labelsRes.data.labels.map(l => l.name));
    } catch(e) {
      console.error("Could not fetch labels", e.message);
    }
  }));

  const labels = [...new Set(allLabels)]; // deduplicate

  const linearAliases = labels
    .filter(l => l.startsWith('LinearVentures/'))
    .map(l => l.split('/')[1] + '@linearventures.in')
    .sort();

  const nanolissAliases = labels
    .filter(l => l.startsWith('Nanoliss/'))
    .map(l => l.split('/')[1] + '@nanoliss.in')
    .sort();
  
  if (!nanolissAliases.includes('nanoliss.in@gmail.com')) {
    nanolissAliases.push('nanoliss.in@gmail.com');
  }

  const spaces = [
    { name: "All Mail", query: "-in:trash" },
    { name: "Drafts", query: "in:draft" },
    { name: "Sent", query: "in:sent" },
    { 
      name: "Linear Ventures", 
      query: "(to:linearventures.in OR from:linearventures.in) -in:trash -in:draft",
      subSpaces: linearAliases.map(email => ({
        name: email,
        query: `(to:${email} OR from:${email}) -in:trash -in:draft`
      }))
    },
    { 
      name: "Nanoliss", 
      query: "(to:nanoliss.in OR from:nanoliss.in) -in:trash -in:draft",
      subSpaces: nanolissAliases.map(email => ({
        name: email,
        query: `(to:${email} OR from:${email}) -in:trash -in:draft`
      }))
    },
    { name: "Services", query: "(receipt OR invoice OR order OR service) -in:trash -in:draft -in:spam" },
    { name: "Finance", query: "(bank OR statement OR payment OR finance) -in:trash -in:draft -in:spam" },
    { name: "Spam", query: "in:spam" },
    { name: "Trash", query: "in:trash" },
  ];

  return spaces;
}

/**
 * Fetches a list of emails for a given query across all accounts
 */
export async function fetchEmails(userId, query = "in:inbox", maxResults = 20) {
  const clients = await getAllGmailClients(userId);
  
  const allMessagesPromises = clients.map(async ({ accountId, gmail }) => {
    try {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      const messages = res.data.messages || [];
      if (!messages.length) return [];

      const detailed = await Promise.all(
        messages.map(async (m) => {
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const headers = msg.data.payload?.headers || [];
          const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          return {
            id: msg.data.id,
            accountId,
            threadId: msg.data.threadId,
            snippet: msg.data.snippet,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject") || "(No Subject)",
            date: getHeader("Date"),
            isUnread: msg.data.labelIds?.includes("UNREAD") || false,
          };
        })
      );
      return detailed;
    } catch (e) {
      console.error(`Fetch emails failed for account ${accountId}`, e);
      return [];
    }
  });

  const arrays = await Promise.all(allMessagesPromises);
  const combined = arrays.flat();
  
  combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return combined.slice(0, maxResults);
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
  };
}

/**
 * Sends an email using the Gmail API
 */
export async function sendEmail(userId, accountId, { to, from, subject, body, attachments = [] }) {
  const gmail = await getGmailClient(userId, accountId);

  const boundary = `----=_Part_${Math.random().toString(36).substring(2)}`;
  
  let str = "";
  if (attachments.length > 0) {
    str += `Content-Type: multipart/mixed; boundary="${boundary}"\n`;
    str += `MIME-Version: 1.0\n`;
    str += `to: ${to}\n`;
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    
    str += `--${boundary}\n`;
    str += `Content-Type: text/plain; charset="UTF-8"\n`;
    str += `Content-Transfer-Encoding: 7bit\n\n`;
    str += `${body}\n\n`;
    
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
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    str += body;
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
