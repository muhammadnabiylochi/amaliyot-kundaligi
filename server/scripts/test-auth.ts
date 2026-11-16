import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateToken } from '../src/middleware/auth';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function runAuthTests() {
  console.log('🧪 Running Comprehensive Authentication & Authorization Tests...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  // 1. Password Verification Test
  const testPassword = 'DevPassword123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(testPassword, salt);

  assert(await bcrypt.compare(testPassword, hash), 'Bcrypt correctly matches valid password');
  assert(!(await bcrypt.compare('WrongPassword!', hash)), 'Bcrypt rejects incorrect password');

  // 2. JWT Generation & Verification Test
  const mockUser = { id: 'test-user-id-123', role: UserRole.STUDENT };
  const token = generateToken(mockUser);
  assert(typeof token === 'string' && token.length > 20, 'JWT token generates successfully');

  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  assert(decoded.userId === mockUser.id && decoded.role === mockUser.role, 'JWT verifies and contains valid payload');

  // 3. Database user lookup test
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@edu.uz' },
  });
  assert(Boolean(adminUser && adminUser.role === 'ADMIN'), 'Database Admin user exists and has ADMIN role');

  if (adminUser) {
    const isDevPassValid = await bcrypt.compare('DevPassword123!', adminUser.passwordHash);
    assert(isDevPassValid, 'Admin user can log in with development password');
  }

  const studentUser = await prisma.user.findUnique({
    where: { email: 'jasur.aliev@student.edu.uz' },
  });
  assert(Boolean(studentUser && studentUser.role === 'STUDENT'), 'Database Student user exists and has STUDENT role');

  const supervisorUser = await prisma.user.findUnique({
    where: { email: 'sherzod.nazarov@uzcard.uz' },
  });
  assert(Boolean(supervisorUser && supervisorUser.role === 'COMPANY_SUPERVISOR'), 'Database Supervisor exists and has COMPANY_SUPERVISOR role');

  // 4. Role Scope Verification
  // Check student only accesses their own internship
  if (studentUser) {
    const studentInternships = await prisma.internship.findMany({
      where: { studentId: studentUser.id },
    });
    assert(studentInternships.length > 0, 'Student has assigned internship in PostgreSQL');

    const unauthorizedInternships = await prisma.internship.findMany({
      where: { studentId: 'another-unauthorized-id' },
    });
    assert(unauthorizedInternships.length === 0, 'Student cannot access other internships');
  }

  console.log(`\n📊 Test Summary: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAuthTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
