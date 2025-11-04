import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CircularProgress, Box } from '@mui/material';

type Role = 'admin' | 'manager' | 'operator';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[]; // optional role-based access control
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role as Role)) {
    // If user lacks role, send to dashboard (or a 403 page if added later)
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
