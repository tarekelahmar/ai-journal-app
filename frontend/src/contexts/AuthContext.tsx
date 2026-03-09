/**
 * Auth context — supports both public (dev) and private (production JWT) modes.
 *
 * Public mode: uses numeric user_id in localStorage (alpha dev).
 * Private mode: JWT access token from /auth/login, userId from /auth/me.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'public';

interface AuthContextType {
  userId: number | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Alpha-only: set user ID directly */
  setUserId: (id: number | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem('user_id');
    return stored ? parseInt(stored, 10) : null;
  });

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('accessToken');
  });

  // Persist userId to localStorage
  useEffect(() => {
    if (userId) {
      localStorage.setItem('user_id', userId.toString());
    } else {
      localStorage.removeItem('user_id');
    }
  }, [userId]);

  // Persist accessToken to localStorage
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    } else {
      localStorage.removeItem('accessToken');
    }
  }, [accessToken]);

  // On mount in private mode: if we have a token but no userId, fetch /auth/me
  useEffect(() => {
    if (AUTH_MODE === 'private' && accessToken && !userId) {
      const client = axios.create({
        baseURL: `${API_BASE}/api/v1`,
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      client
        .get('/auth/me')
        .then((res) => {
          setUserIdState(res.data.id);
        })
        .catch(() => {
          // Token is invalid — clear everything
          setAccessToken(null);
          setUserIdState(null);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    // OAuth2PasswordRequestForm expects form-urlencoded with "username" field
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const res = await axios.post(`${API_BASE}/api/v1/auth/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const token = res.data.access_token;
    setAccessToken(token);

    // Fetch user profile to get userId
    const meRes = await axios.get(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    setUserIdState(meRes.data.id);
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUserIdState(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user_id');
  }, []);

  const setUserId = useCallback((id: number | null) => {
    setUserIdState(id);
  }, []);

  const isAuthenticated = AUTH_MODE === 'private'
    ? accessToken !== null && userId !== null
    : userId !== null;

  return (
    <AuthContext.Provider
      value={{
        userId,
        accessToken,
        isAuthenticated,
        login,
        logout,
        setUserId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
