import React from 'react';
import { cn } from '@/lib/utils';
import type { ApiRole, EntryStatus, InternshipStatus, UserRole, UserStatus } from '@/lib/types';
import { useI18n } from '@/i18n';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    outline: 'border-border text-foreground',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: EntryStatus | string }) {
  const { t } = useI18n();
  switch (String(status).toLowerCase()) {
    case 'approved':
      return <Badge variant="success">{t('Tasdiqlangan')}</Badge>;
    case 'submitted':
      return <Badge variant="warning">{t("Ko'rib chiqilmoqda")}</Badge>;
    case 'returned':
      return <Badge variant="destructive">{t('Qaytarilgan')}</Badge>;
    case 'rejected':
      return <Badge variant="destructive">{t('Rad etilgan')}</Badge>;
    case 'draft':
    default:
      return <Badge variant="outline">{t('Qoralama')}</Badge>;
  }
}

export function InternshipStatusBadge({ status }: { status: InternshipStatus | string }) {
  const { t } = useI18n();
  switch (String(status).toLowerCase()) {
    case 'active':
      return <Badge variant="info">{t('Faol')}</Badge>;
    case 'planned':
      return <Badge variant="secondary">{t('Rejalashtirilgan')}</Badge>;
    case 'completed':
      return <Badge variant="success">{t('Tugallangan')}</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">{t('Bekor qilingan')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RoleBadge({ role }: { role: UserRole | ApiRole }) {
  const { t } = useI18n();
  switch (role) {
    case 'admin':
    case 'ADMIN':
      return <Badge variant="destructive">{t('Administrator')}</Badge>;
    case 'COMPANY_SUPERVISOR':
      return <Badge variant="info">{t('Korxona rahbari')}</Badge>;
    case 'UNIVERSITY_SUPERVISOR':
      return <Badge variant="info">{t("Ta'lim muassasasi rahbari")}</Badge>;
    case 'supervisor':
      return <Badge variant="info">{t('Rahbar')}</Badge>;
    case 'student':
    case 'STUDENT':
      return <Badge variant="secondary">{t('Talaba')}</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useI18n();
  return status === 'active' ? <Badge variant="success">{t('Faol')}</Badge> : <Badge variant="secondary">{t('Nofaol')}</Badge>;
}

export function AttendanceStatusBadge({ status }: { status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | string }) {
  const { t } = useI18n();
  switch (status) {
    case 'PRESENT':
      return <Badge variant="success">{t('Kelgan')}</Badge>;
    case 'ABSENT':
      return <Badge variant="destructive">{t('Kelmagan')}</Badge>;
    case 'LATE':
      return <Badge variant="warning">{t('Kechikkan')}</Badge>;
    case 'EXCUSED':
      return <Badge variant="info">{t('Sababli')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
