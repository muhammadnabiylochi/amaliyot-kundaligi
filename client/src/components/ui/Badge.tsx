import React from 'react';
import { cn } from '@/lib/utils';
import { EntryStatus, InternshipStatus, UserRole, UserStatus } from '@/data/mock';

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

export function StatusBadge({ status }: { status: EntryStatus }) {
  switch (status) {
    case 'approved':
      return <Badge variant="success">Tasdiqlangan</Badge>;
    case 'submitted':
      return <Badge variant="warning">Ko'rib chiqilmoqda</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rad etilgan</Badge>;
    case 'draft':
    default:
      return <Badge variant="outline">Qoralama</Badge>;
  }
}

export function InternshipStatusBadge({ status }: { status: InternshipStatus }) {
  switch (status) {
    case 'active':
      return <Badge variant="info">Faol</Badge>;
    case 'completed':
      return <Badge variant="success">Tugallangan</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Bekor qilingan</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RoleBadge({ role }: { role: UserRole }) {
  switch (role) {
    case 'admin':
      return <Badge variant="destructive">Administrator</Badge>;
    case 'supervisor':
      return <Badge variant="info">Rahbar</Badge>;
    case 'student':
      return <Badge variant="secondary">Talaba</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return status === 'active' ? (
    <Badge variant="success">Faol</Badge>
  ) : (
    <Badge variant="secondary">Nofaol</Badge>
  );
}

export function AttendanceStatusBadge({ status }: { status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | string }) {
  switch (status) {
    case 'PRESENT':
      return <Badge variant="success">Kelgan</Badge>;
    case 'ABSENT':
      return <Badge variant="destructive">Kelmagan</Badge>;
    case 'LATE':
      return <Badge variant="warning">Kechikkan</Badge>;
    case 'EXCUSED':
      return <Badge variant="info">Sababli</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
