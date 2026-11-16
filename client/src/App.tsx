import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import DiaryListPage from '@/pages/DiaryListPage';
import DiaryFormPage from '@/pages/DiaryFormPage';
import InternshipDetailsPage from '@/pages/InternshipDetailsPage';
import SupervisorReviewPage from '@/pages/SupervisorReviewPage';
import ReportsPage from '@/pages/ReportsPage';
import UserManagementPage from '@/pages/UserManagementPage';
import AttendancePage from '@/pages/AttendancePage';
import EvaluationListPage from '@/pages/EvaluationListPage';
import EvaluationDetailPage from '@/pages/EvaluationDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Auth Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated Dashboard Shell */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/diary" element={<DiaryListPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/diary/new" element={<DiaryFormPage />} />
          <Route path="/diary/edit/:id" element={<DiaryFormPage />} />
          <Route path="/internship/:id" element={<InternshipDetailsPage />} />
          <Route path="/reviews" element={<SupervisorReviewPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/evaluation" element={<EvaluationListPage />} />
          <Route path="/evaluation/:internshipId" element={<EvaluationDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users" element={<UserManagementPage />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
