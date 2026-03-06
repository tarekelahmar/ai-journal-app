import React from 'react';

const variantStyles = {
  primary:
    'bg-journal-accent text-white hover:bg-journal-accent-hover active:bg-journal-accent-hover',
  secondary:
    'bg-journal-surface-alt text-journal-text hover:bg-journal-border-light',
  ghost:
    'bg-transparent text-journal-text-secondary hover:bg-journal-surface-alt',
  danger:
    'bg-journal-negative text-white hover:opacity-90',
};

const sizeStyles = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-6 py-3',
  full: 'text-base px-6 py-3.5 w-full',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-card
        transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
