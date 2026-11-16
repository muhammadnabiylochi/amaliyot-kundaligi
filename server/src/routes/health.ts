import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/health
 * Returns server status and database connectivity.
 */
router.get('/', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'error';
  let dbMessage = '';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch (err) {
    dbMessage = err instanceof Error ? err.message : 'Unknown database error';
  }

  const status = dbStatus === 'ok' ? 200 : 503;

  res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env['NODE_ENV'] ?? 'unknown',
    services: {
      database: {
        status: dbStatus,
        ...(dbMessage ? { message: dbMessage } : {}),
      },
    },
  });
});

export default router;
