const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.findFirst();
  if(!user) return;
  await prisma.rule.createMany({
    data: [
      { userId: user.id, name: 'Linear Ventures', query: 'linear ventures OR from:linear OR subject:linear' },
      { userId: user.id, name: 'Nanoliss', query: 'nanoliss OR from:nanoliss OR subject:nanoliss' }
    ]
  });
  console.log('Seeded rules');
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
