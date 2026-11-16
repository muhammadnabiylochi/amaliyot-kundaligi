import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, UserRole } from '@/context/AuthContext';
import { I18nProvider } from '@/i18n';
import { ConfirmProvider, ToastProvider } from '@/components/ui/extra';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoadingState } from '@/components/ui/FeedbackStates';
import LoginPage from '@/pages/LoginPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Route-level code splitting keeps the first load small (charts load only when needed)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const DiaryListPage = lazy(() => import('@/pages/DiaryListPage'));
const DiaryFormPage = lazy(() => import('@/pages/DiaryFormPage'));
const InternshipDetailsPage = lazy(() => import('@/pages/InternshipDetailsPage'));
const MyInternshipRedirect = lazy(() => import('@/pages/MyInternshipRedirect'));
const InternshipsPage = lazy(() => import('@/pages/InternshipsPage'));
const CatalogPage = lazy(() => import('@/pages/CatalogPage'));
const JournalPage = lazy(() => import('@/pages/JournalPage'));
const SupervisorReviewPage = lazy(() => import('@/pages/SupervisorReviewPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const UserManagementPage = lazy(() => import('@/pages/UserManagementPage'));
const AttendancePage = lazy(() => import('@/pages/AttendancePage'));
const EvaluationListPage = lazy(() => import('@/pages/EvaluationListPage'));
const EvaluationDetailPage = lazy(() => import('@/pages/EvaluationDetailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const VerifyPage = lazy(() => import('@/pages/VerifyPage'));

const SUPERVISORS: UserRole[] = ['ADMIN', 'COMPANY_SUPERVISOR', 'UNIVERSITY_SUPERVISOR'];

/** Renders children only for allowed roles; others are sent to the dashboard. */
function RequireRole({ roles, children }: { roles: UserRole[]; children: JSX.Element }) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App(): JSX.Element {
  return (
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Suspense fallback={<LoadingState className="min-h-[50vh]" />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verify/:internshipId" element={<VerifyPage />} />

                {/* Authenticated shell */}
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/diary" element={<DiaryListPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/diary/new" element={<RequireRole roles={['STUDENT', 'ADMIN']}><DiaryFormPage /></RequireRole>} />
                  <Route path="/diary/edit/:id" element={<RequireRole roles={['STUDENT', 'ADMIN']}><DiaryFormPage /></RequireRole>} />
                  <Route path="/internship/mine" element={<MyInternshipRedirect />} />
                  <Route path="/internship/:id" element={<InternshipDetailsPage />} />
                  <Route path="/internships" element={<RequireRole roles={SUPERVISORS}><InternshipsPage /></RequireRole>} />
                  <Route path="/catalog" element={<RequireRole roles={['ADMIN']}><CatalogPage /></RequireRole>} />
                  <Route path="/journal" element={<RequireRole roles={SUPERVISORS}><JournalPage /></RequireRole>} />
                  <Route path="/reviews" element={<RequireRole roles={SUPERVISORS}><SupervisorReviewPage /></RequireRole>} />
                  <Route path="/reports" element={<RequireRole roles={SUPERVISORS}><ReportsPage /></RequireRole>} />
                  <Route path="/evaluation" element={<EvaluationListPage />} />
                  <Route path="/evaluation/:internshipId" element={<EvaluationDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/users" element={<RequireRole roles={['ADMIN']}><UserManagementPage /></RequireRole>} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
