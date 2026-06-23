const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

async function scanEmails() {
  const account = await prisma.account.findFirst({
    where: { provider: "google" },
  });

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth });
  
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "to:linearventures.in OR to:nanoliss.in OR from:linearventures.in OR from:nanoliss.in",
    maxResults: 500,
  });

  if (!res.data.messages) {
    console.log("No messages found");
    return;
  }

  const emails = new Set();
  
  for (const m of res.data.messages) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: m.id,
      format: "metadata",
      metadataHeaders: ["To", "Cc", "Bcc", "From", "Delivered-To"],
    });
    
    const headers = msg.data.payload.headers;
    for (const h of headers) {
      const val = h.value.toLowerCase();
      // Extract emails using a basic regex
      const matches = val.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
      if (matches) {
        for (const match of matches) {
          if (match.endsWith('@linearventures.in') || match.endsWith('@nanoliss.in')) {
            emails.add(match);
          }
        }
      }
    }
  }

  console.log("Found Emails:");
  console.log(Array.from(emails).sort());
}

scanEmails().catch(console.error).finally(() => prisma.$disconnect());
