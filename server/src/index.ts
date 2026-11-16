import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { startTelegramBot, stopTelegramBot } from './services/telegramBot';

const app = express();

// ── Security & logging ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Cookie & Body parsing ─────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not Found', status: 404 } });
});

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  console.log(`✅  Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  console.log(`    Health check: http://localhost:${env.PORT}/api/health`);
  // Initialize Telegram bot if configured
  void startTelegramBot();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  await stopTelegramBot();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Bye 👋');
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
