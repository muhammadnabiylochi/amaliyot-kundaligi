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
import companiesRouter from './companies';
import groupsRouter from './groups';
import journalRouter from './journal';
import notificationsRouter from './notifications';
import finalReportRouter, { publicRouter } from './finalReport';

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
router.use('/companies', companiesRouter);
router.use('/groups', groupsRouter);
router.use('/journal', journalRouter);
router.use('/notifications', notificationsRouter);
router.use('/reports/final', finalReportRouter);
router.use('/public', publicRouter);

export default router;
