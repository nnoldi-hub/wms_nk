import { useState, useEffect, type ReactNode } from 'react';
import apiClient from '../services/api';
import { AuthContext, type User } from './AuthContextShared';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const disableVerify = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.['VITE_DISABLE_AUTH_VERIFY'] === 'true'
      || localStorage.getItem('wcTestMode') === 'true';
    if (disableVerify) {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      // Use /me endpoint to fetch current user (verify route not implemented in auth service)
      const response = await apiClient.get('/api/v1/auth/me');
      setUser(response.data.user || response.data);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await apiClient.post('/api/v1/auth/login', {
      username,
      password,
    });

    const { accessToken, refreshToken, user } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;