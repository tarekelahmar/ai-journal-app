import React from 'react';

const variantStyles = {
  default: 'bg-journal-surface',
  elevated: 'bg-journal-surface shadow-sm',
  muted: 'bg-journal-surface-alt',
  positive: 'bg-journal-positive-light',
  negative: 'bg-journal-negative-light',
  amber: 'bg-journal-amber-light',
  accent: 'bg-journal-accent-light',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof variantStyles;
  padding?: keyof typeof paddingStyles;
  onClick?: () => void;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
}: CardProps) {
  const base = `rounded-card ${variantStyles[variant]} ${paddingStyles[padding]}`;
  const interactive = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';

  return (
    <div
      className={`${base} ${interactive} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      {children}
    </div>
  );
}
