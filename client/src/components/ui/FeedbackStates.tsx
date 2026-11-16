import React from 'react';
import { Loader2, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Ma'lumotlar yuklanmoqda...", className }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title = "Ma'lumot topilmadi",
  description = "Ayni paytda bu bo'limda hech qanday yozuv mavjud emas.",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 ${className || ''}`}>
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h4 className="text-base font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Xatolik yuz berdi",
  message = "Server bilan aloqada xatolik kuzatildi. Iltimos qaytadan urinib ko'ring.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-rose-100 bg-rose-50/50 ${className || ''}`}>
      <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-100/50">
          <RefreshCw className="h-4 w-4" />
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
