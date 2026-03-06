/**
 * Committed Action Pill — small status indicator for active habits.
 *
 * Shows: green dot + action title + consistency count.
 */
import React from 'react';
import type { Action } from '../../types/Action';

interface CommittedActionPillProps {
  action: Action;
  /** Number of days completed in the tracking period */
  completedDays?: number;
  /** Total days in the tracking period */
  totalDays?: number;
}

export function CommittedActionPill({
  action,
  completedDays,
  totalDays,
}: CommittedActionPillProps) {
  const hasConsistency = completedDays != null && totalDays != null;

  return (
    <div className="inline-flex items-center gap-2 bg-journal-positive-light rounded-xl px-3 py-1.5">
      <div className="w-2 h-2 rounded-full bg-journal-positive shrink-0" />
      <span className="text-[12px] text-journal-positive font-medium truncate">
        {action.title}
      </span>
      {hasConsistency && (
        <span className="text-[12px] text-journal-positive font-bold shrink-0">
          {completedDays} of {totalDays} days
        </span>
      )}
    </div>
  );
}
