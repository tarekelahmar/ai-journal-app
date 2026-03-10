/**
 * Route guard — redirects unauthenticated users to /login in private mode.
 * In public (dev) mode, passes through without checking.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'public';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (AUTH_MODE === 'private' && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
