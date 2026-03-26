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
import TutorDashboardPage from './pages/app/tutor/TutorDashboardPage';
import AvailableRequestsPage from './pages/app/tutor/AvailableRequestsPage';
import MyClassesPage from './pages/app/tutor/MyClassesPage';
import ProfilePage from './pages/app/ProfilePage';

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
