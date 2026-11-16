/**
 * Container start hook: loads demo data only when SEED_DEMO_DATA=true AND the database has no users yet.
 * Safe to run on every start — it never touches a database that already contains data.
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'child_process';
import path from 'path';

async function main() {
  if (process.env.SEED_DEMO_DATA !== 'true') return;
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) {
    console.log(`[seed] Database already has ${users} users — skipping demo seed.`);
    return;
  }
  console.log('[seed] Empty database — loading demo data...');
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const r = spawnSync(process.execPath, [tsxCli, path.join(__dirname, 'seed.ts')], { stdio: 'inherit' });
  if (r.status !== 0) console.error('[seed] Demo seed failed (the app will still start).');
}

main().catch((e) => console.error('[seed] error:', e));
