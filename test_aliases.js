const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const prisma = new PrismaClient();

async function testAliases() {
  const account = await prisma.account.findFirst({
    where: { provider: "google" },
  });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth });
  
  const res = await gmail.users.settings.sendAs.list({ userId: "me" });
  console.log("SendAs Emails:");
  console.log(res.data.sendAs.map(s => s.sendAsEmail));
}

testAliases().catch(console.error).finally(() => prisma.$disconnect());
