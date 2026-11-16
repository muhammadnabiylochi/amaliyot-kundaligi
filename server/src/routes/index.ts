import { Router } from 'express';
import authRouter from './auth';
import healthRouter from './health';
import dashboardRouter from './dashboard';
import diaryRouter from './diary';
import diaryAttachmentsRouter from './diaryAttachments';
import attendanceRouter from './attendance';
import internshipsRouter from './internships';
import usersRouter from './users';
import reportsRouter from './reports';
import evaluationRouter from './evaluation';
import telegramRouter from './telegram';

const router = Router();

router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/dashboard', dashboardRouter);
router.use('/diary', diaryRouter);
router.use('/diary', diaryAttachmentsRouter);
router.use('/attendance', attendanceRouter);
router.use('/evaluation', evaluationRouter);
router.use('/internships', internshipsRouter);
router.use('/users', usersRouter);
router.use('/reports', reportsRouter);
router.use('/telegram', telegramRouter);

export default router;
