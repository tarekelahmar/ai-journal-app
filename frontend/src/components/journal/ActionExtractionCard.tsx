/**
 * Inline Action Extraction Card — dashed border card showing actions
 * extracted from the conversation by the analysis LLM.
 *
 * Each action has a "Commit" button that creates it via the Actions API.
 */
import React, { useState } from 'react';
import type { ExtractedAction } from '../../types/JournalChat';
import { createAction } from '../../api/actions';

interface ActionExtractionCardProps {
  actions: ExtractedAction[];
}

function domainLabel(domain: string): string {
  const labels: Record<string, string> = {
    career: 'Career',
    relationship: 'Relationship',
    family: 'Family',
    health: 'Health',
    finance: 'Finance',
    social: 'Social',
    purpose: 'Purpose',
  };
  return labels[domain] || domain;
}

function typeLabel(type: string): string {
  return type === 'habit' ? 'Habit' : 'Completable';
}

export function ActionExtractionCard({ actions }: ActionExtractionCardProps) {
  // Track commit state per action index
  const [commitStates, setCommitStates] = useState<Record<number, 'idle' | 'committing' | 'committed'>>(
    () => {
      const init: Record<number, 'idle' | 'committing' | 'committed'> = {};
      actions.forEach((_, i) => { init[i] = 'idle'; });
      return init;
    },
  );

  const handleCommit = async (action: ExtractedAction, index: number) => {
    setCommitStates((prev) => ({ ...prev, [index]: 'committing' }));
    try {
      await createAction({
        title: action.text,
        action_type: action.action_type,
        source: 'journal_extraction',
        primary_domain: action.domain,
      });
      setCommitStates((prev) => ({ ...prev, [index]: 'committed' }));
    } catch (err) {
      console.error('Failed to commit action:', err);
      setCommitStates((prev) => ({ ...prev, [index]: 'idle' }));
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="rounded-card border-[1.5px] border-dashed border-journal-accent/40 bg-journal-surface p-4 mb-4">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent">
        Actions from this conversation
      </span>

      <div className="mt-3 space-y-0">
        {actions.map((action, i) => {
          const state = commitStates[i];
          return (
            <div key={i}>
              {i > 0 && <div className="border-t border-journal-border-light my-2.5" />}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-journal-text leading-snug">
                    {action.text}
                  </p>
                  <p className="text-[11px] text-journal-text-muted mt-0.5">
                    {domainLabel(action.domain)} &middot; {typeLabel(action.action_type)}
                  </p>
                </div>
                <button
                  onClick={() => handleCommit(action, i)}
                  disabled={state !== 'idle'}
                  className={`shrink-0 text-[12px] font-medium px-3 py-1 rounded-full transition-colors ${
                    state === 'committed'
                      ? 'bg-journal-positive-light text-journal-positive'
                      : state === 'committing'
                        ? 'bg-journal-surface-alt text-journal-text-muted'
                        : 'bg-journal-accent text-white hover:bg-journal-accent-hover'
                  }`}
                >
                  {state === 'committed' ? 'Committed' : state === 'committing' ? '...' : 'Commit'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
