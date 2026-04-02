import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingState from '../ui/LoadingState';

function normalizedRole(user) {
  return String(user?.activeRole || user?.role || 'student').toLowerCase();
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingState message="Loading Claxi..." fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(normalizedRole(user))) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
