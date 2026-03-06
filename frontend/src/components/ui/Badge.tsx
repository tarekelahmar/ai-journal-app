import React from 'react';

const variantStyles = {
  accent: 'bg-journal-accent-light text-journal-accent',
  positive: 'bg-journal-positive-light text-journal-positive',
  negative: 'bg-journal-negative-light text-journal-negative',
  amber: 'bg-journal-amber-light text-journal-amber',
  muted: 'bg-journal-surface-alt text-journal-text-secondary',
  neutral: 'bg-journal-surface-alt text-journal-text-secondary',
};

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
};

interface BadgeProps {
  label: string;
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
}

export function Badge({ label, variant = 'neutral', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {label}
    </span>
  );
}
