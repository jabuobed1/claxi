import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function AppHomeRedirect() {
  const { user } = useAuth();

  const activeRole = user?.activeRole || user?.role;

  if (activeRole === 'tutor') {
    return <Navigate to="/app/tutor" replace />;
  }

  return <Navigate to="/app/student" replace />;
}
