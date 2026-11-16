import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

export type UserRole = 'ADMIN' | 'STUDENT' | 'COMPANY_SUPERVISOR' | 'UNIVERSITY_SUPERVISOR';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  department?: string;
  group?: string;
  studentNumber?: string;
  studyProgram?: string;
  phone?: string | null;
  position?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const res = await api.get<{ success: boolean; data: AuthUser }>('/api/auth/me');
      if (res.ok && res.data?.data) {
        setUser(res.data.data);
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.post<{
        success: boolean;
        data?: { token: string; user: AuthUser };
        error?: { message: string };
      }>('/api/auth/login', { email, password });

      if (res.ok && res.data?.data) {
        const { token, user: loggedInUser } = res.data.data;
        localStorage.setItem('auth_token', token);
        setUser(loggedInUser);
        // Load the full profile (phone, study programme, etc.) in the background
        void checkAuth();
        return { success: true };
      }

      const errorMessage = res.data?.error?.message || "Elektron pochta yoki parol noto'g'ri.";
      return { success: false, error: errorMessage };
    } catch (err: any) {
      return { success: false, error: err.message || "Server bilan aloqa uzildi." };
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
