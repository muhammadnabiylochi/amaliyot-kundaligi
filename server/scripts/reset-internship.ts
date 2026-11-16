import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.internship.updateMany({
    where: { status: 'COMPLETED' },
    data: { status: 'ACTIVE' },
  });
  console.log('Updated to ACTIVE:', r.count);
  await prisma.$disconnect();
}
main().catch(console.error);
