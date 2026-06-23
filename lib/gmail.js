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
    const gmail = await getGmailClient(userId, accountId);
    
    // We get the actual accountId used (in case null was passed and it defaulted)
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
          const match = fromHeader.match(/(.*?) <(.*?)>/);
          const senderName = match ? match[1].replace(/"/g, "").trim() : fromHeader;

          const internalDate = parseInt(msg.data.internalDate);

          return {
            id: msg.data.id,
            accountId: activeAccountId,
            threadId: msg.data.threadId,
            subject: getHeader("Subject") || "(No Subject)",
            sender: senderName,
            preview: msg.data.snippet || "",
            date: new Date(internalDate).toISOString(),
            internalDate,
            isUnread: msg.data.labelIds ? msg.data.labelIds.includes("UNREAD") : false,
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
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
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
