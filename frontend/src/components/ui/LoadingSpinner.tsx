import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  return (
    <div className="flex flex-col items-center justify-center py-8" role="status">
      <div
        className={`${sizeMap[size]} animate-spin rounded-full border-2 border-journal-border-light border-t-journal-accent`}
      />
      {label && <p className="mt-2 text-sm text-journal-text-secondary">{label}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}
