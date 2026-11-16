import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  BookOpen,
  Server,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  GraduationCap,
} from 'lucide-react';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export default function HomePage(): JSX.Element {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const checkHealth = async (): Promise<void> => {
    setFetchStatus('loading');
    setErrorMessage('');

    try {
      const response = await api.get<HealthResponse>('/api/health');
      if (response.ok) {
        setHealth(response.data);
        setFetchStatus('success');
      } else {
        setHealth(response.data);
        setFetchStatus('error');
      }
    } catch (err) {
      setFetchStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not reach the server. Is it running?',
      );
    }
  };

  useEffect(() => {
    void checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <GraduationCap className="h-12 w-12 text-indigo-600" />
          <h1 className="text-4xl font-bold text-gray-900">Internship Diary</h1>
        </div>
        <p className="text-lg text-gray-600 font-medium">Elektron Amaliyot Kundaligi</p>
        <p className="text-sm text-gray-500 mt-1">
          University Internship Management &amp; Monitoring System
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
        {/* Frontend Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Frontend</h2>
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">React + Vite running</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Tailwind CSS · shadcn/ui ready</p>
        </div>

        {/* Backend Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Server className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Backend API</h2>
          </div>

          {fetchStatus === 'loading' && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking…</span>
            </div>
          )}

          {fetchStatus === 'success' && health && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Express API reachable</span>
            </div>
          )}

          {fetchStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {errorMessage || 'API not reachable — start the server'}
              </span>
            </div>
          )}

          {health && (
            <p className="text-xs text-gray-400 mt-2">
              Uptime: {health.uptime}s · env: {health.environment}
            </p>
          )}
        </div>
      </div>

      {/* Database Status */}
      {health && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-full max-w-2xl mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Database className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Database (PostgreSQL)</h2>
          </div>
          {health.services.database.status === 'ok' ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Connected via Prisma</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {health.services.database.message ?? 'Database not connected'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Re-check button */}
      <button
        onClick={() => void checkHealth()}
        disabled={fetchStatus === 'loading'}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {fetchStatus === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Server className="h-4 w-4" />
        )}
        Check API Health
      </button>

      {/* Footer */}
      <p className="text-xs text-gray-400 mt-10">
        Phase 1 — Foundation · Next: Auth, CRUD, Role-based access
      </p>
    </div>
  );
}
