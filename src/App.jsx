import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AppShell from './layouts/AppShell';
import ProtectedRoute from './components/app/ProtectedRoute';
import AppHomeRedirect from './pages/app/AppHomeRedirect';
import StudentDashboardPage from './pages/app/student/StudentDashboardPage';
import RequestClassPage from './pages/app/student/RequestClassPage';
import StudentRequestsPage from './pages/app/student/StudentRequestsPage';
import StudentSessionsPage from './pages/app/student/StudentSessionsPage';
import TutorDashboardPage from './pages/app/tutor/TutorDashboardPage';
import AvailableRequestsPage from './pages/app/tutor/AvailableRequestsPage';
import MyClassesPage from './pages/app/tutor/MyClassesPage';
import TutorSessionsPage from './pages/app/tutor/TutorSessionsPage';
import ProfilePage from './pages/app/ProfilePage';
import SettingsPage from './pages/app/SettingsPage';
import OnboardingPage from './pages/app/OnboardingPage';
import TutorPaymentsPage from './pages/app/tutor/TutorPaymentsPage';
import SessionRoomPage from './pages/app/SessionRoomPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<AppHomeRedirect />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="session/:id" element={<SessionRoomPage />} />

          <Route
            path="student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="student/request-class"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <RequestClassPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="student/requests"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="student/sessions"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentSessionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="tutor"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/available-requests"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <AvailableRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/my-classes"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <MyClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/sessions"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorSessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor/payments"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorPaymentsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
