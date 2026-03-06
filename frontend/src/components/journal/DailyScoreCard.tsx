/**
 * Journal V3 — Daily Score Card (wireframe-aligned).
 *
 * Appears inline in the chat when the companion proposes a score.
 * Shows a single slider (1.0-10.0, step 0.5), warm palette.
 * After confirmation: collapses to a compact pill ("Today: 7.0 ✓").
 */
import React, { useState } from 'react';
import { scoreColor } from '../../theme';

interface DailyScoreCardProps {
  proposedScore: number;
  confirmed: boolean;
  onConfirm: (score: number) => void;
  confirming?: boolean;
}

export function DailyScoreCard({
  proposedScore,
  confirmed,
  onConfirm,
  confirming = false,
}: DailyScoreCardProps) {
  const [value, setValue] = useState(proposedScore);
  const col = scoreColor(value);

  // ── Confirmed state: compact pill ──
  if (confirmed) {
    return (
      <div className="mb-4">
        <div className="bg-journal-positive-light rounded-xl px-4 py-2.5 inline-flex items-center gap-2">
          <span className="text-xs text-journal-text-secondary">Today</span>
          <span className="text-base font-bold" style={{ color: col }}>
            {value}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7A8F6B"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Interactive state: slider + confirm ──
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="mb-4">
      <div className="bg-journal-surface rounded-card border border-journal-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-journal-text-muted">How does today feel overall?</span>
          <span className="text-xl font-bold" style={{ color: col }}>
            {value}
          </span>
        </div>

        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer mb-3"
          style={{
            background: `linear-gradient(to right, ${col} ${pct}%, #E8E4E0 ${pct}%)`,
          }}
        />

        <div className="flex justify-between text-[10px] text-journal-text-muted mb-3">
          <span>Struggling</span>
          <span>Thriving</span>
        </div>

        <button
          onClick={() => onConfirm(value)}
          disabled={confirming}
          className="w-full py-2 bg-journal-accent hover:bg-journal-accent-hover text-white text-xs font-medium rounded-xl transition-colors disabled:bg-journal-surface-alt disabled:text-journal-text-muted disabled:cursor-not-allowed"
        >
          {confirming
            ? 'Saving...'
            : value === proposedScore
              ? 'Looks right'
              : `Confirm ${value}`}
        </button>
      </div>
    </div>
  );
}
