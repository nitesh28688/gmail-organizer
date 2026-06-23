const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

async function investigate() {
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
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined
  });

  const gmail = google.gmail({ version: "v1", auth });
  
  // Get all labels
  const labelsRes = await gmail.users.labels.list({ userId: "me" });
  console.log("Labels:", labelsRes.data.labels.map(l => l.name));
}

investigate().catch(console.error).finally(() => prisma.$disconnect());
