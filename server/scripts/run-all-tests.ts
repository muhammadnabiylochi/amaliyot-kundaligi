/**
 * Runs every integration test script sequentially and prints a summary.
 * Usage: npm test   (requires a seeded database: npm run prisma:seed)
 * test-telegram is excluded by default because it may contact the real Telegram API;
 * pass --with-telegram to include it.
 */
import { spawnSync } from 'child_process';
import path from 'path';

const scripts = [
  'test-auth',
  'test-diary-flow',
  'test-lifecycle-review',
  'test-date-guards',
  'test-diary-bugfixes',
  'test-attendance',
  'test-attachments',
  'test-evaluation',
  'test-reports-export',
  'audit-security',
  'test-new-features',
  ...(process.argv.includes('--with-telegram') ? ['test-telegram'] : []),
];

const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
let totalPass = 0;
let totalFail = 0;
const rows: string[] = [];

for (const name of scripts) {
  const r = spawnSync(process.execPath, [tsxCli, path.join(__dirname, `${name}.ts`)], { encoding: 'utf8', env: process.env, timeout: 300_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const pass = (out.match(/PASS/g) ?? []).length;
  const fail = (out.match(/FAIL/g) ?? []).length + (r.status !== 0 && !/FAIL/.test(out) ? 1 : 0);
  totalPass += pass;
  totalFail += fail;
  rows.push(`${fail ? '❌' : '✅'} ${name.padEnd(24)} ${String(pass).padStart(3)} o'tdi  ${fail ? `${fail} xato` : ''}`);
  if (fail) {
    out
      .split('\n')
      .filter((l) => /FAIL|Error/.test(l) && !/prisma:/.test(l))
      .slice(0, 5)
      .forEach((l) => rows.push(`     ${l.trim()}`));
  }
}

console.log('\n' + rows.join('\n'));
console.log(`\nJAMI: ${totalPass} o'tdi, ${totalFail} xato`);
process.exit(totalFail ? 1 : 0);
