/**
 * AI Follow-Up Card — shown at top of conversation when there are
 * active overdue completable actions.
 *
 * Uses a static template for now: "You said you'd [action]. Has that happened yet?"
 * Future: AI-generated follow-up text.
 */
import React from 'react';
import type { Action } from '../../types/Action';

interface FollowUpCardProps {
  action: Action;
}

export function FollowUpCard({ action }: FollowUpCardProps) {
  return (
    <div className="bg-journal-accent-light rounded-card px-4 py-3.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent">
        Following up
      </span>
      <p className="text-[13.5px] text-journal-text mt-1.5 leading-relaxed">
        You said you'd {action.title.toLowerCase()}. Has that happened yet?
      </p>
    </div>
  );
}
