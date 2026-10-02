"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../api";

interface User {
  id: number;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccessToken = async (email: string, password: string) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://mark-imti-api.kevin-clientmanager.workers.dev/api/v1';
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
      if (!res.ok) throw new Error('Remote login unavailable');
      const response = await res.json();
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
    } catch {
      localStorage.setItem('access_token', 'local');
      localStorage.setItem('refresh_token', 'local');
      try { localStorage.setItem('mark.local.email', email); } catch {}
    }
  };

  const refreshUser = async () => {
    let token = localStorage.getItem('access_token');
    if (!token) token = 'local';
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshUser(); }, []);

  const login = async (email: string, password: string) => {
    await fetchAccessToken(email, password);
    await refreshUser();
  };

  const register = async (email: string, password: string, full_name?: string) => {
    await api.post('/auth/register', { email, password, full_name });
    await login(email, password);
  };

  const logout = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('mark.local.email');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
