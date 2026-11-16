import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  PORT: z
    .string()
    .default('3001')
    .transform(Number)
    .refine((n) => n > 0 && n < 65536, 'PORT must be between 1 and 65535'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Public URL used in QR codes / Telegram links. On Render it defaults to the service's own URL.
  CLIENT_URL: z.string().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default('amaliyot_kundalik_uz_bot'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
