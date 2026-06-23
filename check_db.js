const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const account = await prisma.account.findFirst();
  console.log("Account:", account);
}

check().catch(console.error).finally(() => prisma.$disconnect());
