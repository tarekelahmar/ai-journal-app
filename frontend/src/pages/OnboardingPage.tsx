/**
 * Onboarding — Score 7 life dimensions + optional context.
 *
 * Progress bar across top, one dimension at a time (or all at once).
 * "Set my baseline" CTA at the bottom.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { LIFE_DIMENSIONS } from '../theme';
import { scoreColor } from '../theme';
import { submitDomainCheckin } from '../api/domainCheckins';

interface DimensionScore {
  score: number;
  context: string;
}

const DEFAULT_SCORE = 5;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Each dimension gets a score (1-10) and optional context string
  const [scores, setScores] = useState<Record<string, DimensionScore>>(() => {
    const init: Record<string, DimensionScore> = {};
    for (const dim of LIFE_DIMENSIONS) {
      init[dim.key] = { score: DEFAULT_SCORE, context: '' };
    }
    return init;
  });

  const filledCount = LIFE_DIMENSIONS.filter(
    (d) => scores[d.key].score !== DEFAULT_SCORE || scores[d.key].context.length > 0,
  ).length;

  const handleScoreChange = (key: string, score: number) => {
    setScores((prev) => ({
      ...prev,
      [key]: { ...prev[key], score },
    }));
  };

  const handleContextChange = (key: string, context: string) => {
    setScores((prev) => ({
      ...prev,
      [key]: { ...prev[key], context },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Submit domain check-in as baseline
      const payload: Record<string, number> = {};
      for (const dim of LIFE_DIMENSIONS) {
        payload[dim.key] = scores[dim.key].score;
      }

      await submitDomainCheckin({
        career: payload.career,
        relationship: payload.relationship,
        family: payload.family,
        health: payload.health,
        finance: payload.finance,
        social: payload.social,
        purpose: payload.purpose,
      });

      navigate('/score');
    } catch (err) {
      console.error('Onboarding submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-journal-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <h1 className="text-2xl font-semibold text-journal-text">
          Where are you right now?
        </h1>
        <p className="text-sm text-journal-text-secondary mt-2">
          Score each area of your life. Be honest — this is your starting point,
          not a performance review.
        </p>
      </div>

      {/* Progress */}
      <div className="px-5 pb-4">
        <ProgressBar value={filledCount} max={7} size="sm" />
      </div>

      {/* Dimension cards */}
      <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-3">
        {LIFE_DIMENSIONS.map((dim) => {
          const entry = scores[dim.key];
          return (
            <Card key={dim.key} padding="lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-journal-text">
                    {dim.label}
                  </h3>
                </div>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: scoreColor(entry.score) }}
                >
                  {entry.score}
                </span>
              </div>

              {/* Score slider */}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={entry.score}
                onChange={(e) => handleScoreChange(dim.key, Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-3"
                style={{
                  background: `linear-gradient(to right, ${scoreColor(entry.score)} 0%, ${scoreColor(entry.score)} ${((entry.score - 1) / 9) * 100}%, #E8E4E0 ${((entry.score - 1) / 9) * 100}%, #E8E4E0 100%)`,
                }}
              />

              {/* Scale labels */}
              <div className="flex justify-between text-[10px] text-journal-text-muted mb-3">
                <span>Struggling</span>
                <span>Thriving</span>
              </div>

              {/* Context input */}
              <input
                type="text"
                placeholder="One line of context (optional)"
                value={entry.context}
                onChange={(e) => handleContextChange(dim.key, e.target.value)}
                className="w-full text-sm bg-journal-surface-alt rounded-xl px-3 py-2
                  text-journal-text placeholder:text-journal-text-muted
                  border-0 outline-none focus:ring-2 focus:ring-journal-accent/30"
              />
            </Card>
          );
        })}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-journal-bg px-5 py-4 safe-area-bottom border-t border-journal-border-light">
        <Button
          size="full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Set my baseline'}
        </Button>
      </div>
    </div>
  );
}
