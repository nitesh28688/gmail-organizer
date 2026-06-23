import { getGmailClient } from '../../lib/gmail.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAliases() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user");
  
  const account = await prisma.account.findFirst({ where: { userId: user.id } });
  if (!account) return console.log("No account");

  const gmail = await getGmailClient(user.id, account.id);
  const aliases = await gmail.users.settings.sendAs.list({ userId: "me" });
  
  console.log("REAL ALIASES:");
  console.log(JSON.stringify(aliases.data, null, 2));
}

checkAliases().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
