/**
 * Onboarding — Score 7 life dimensions in a compact one-screen layout.
 *
 * - 3-segment progress bar (step 2 of 3)
 * - Heading + subtext
 * - 7 compact dimension cards (tap to expand)
 * - "Set my baseline" CTA
 *
 * No bottom nav — standalone flow.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIFE_DIMENSIONS } from '../theme';
import { colors } from '../theme';
import { submitDomainCheckin } from '../api/domainCheckins';

interface DimensionScore {
  score: number;
  context: string;
}

const DEFAULT_SCORE = 5;

// Onboarding-specific score colour: ≤3 red, 4-5 amber, ≥6 green
function dimScoreColor(score: number): string {
  if (score >= 6) return colors.positive;
  if (score >= 4) return colors.amber;
  return colors.negative;
}

// Gradient colours for the expanded slider
const GRADIENT_LEFT = '#C47A6B';
const GRADIENT_MID = '#B8A48C';
const GRADIENT_RIGHT = '#7A8F6B';
const TRACK_UNFILLED = '#F3F0EB';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, DimensionScore>>(() => {
    const init: Record<string, DimensionScore> = {};
    for (const dim of LIFE_DIMENSIONS) {
      init[dim.key] = { score: DEFAULT_SCORE, context: '' };
    }
    return init;
  });

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

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
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
    <div className="min-h-full bg-journal-bg flex flex-col mx-auto w-full" style={{ maxWidth: 680 }}>
      <div className="px-5 pt-10 flex flex-col flex-1">

        {/* 2b: Progress bar — 3 segments, step 2 of 3 */}
        <div className="flex gap-1 mb-8">
          <div className="flex-1 h-[3px] rounded-sm" style={{ backgroundColor: colors.accent }} />
          <div className="flex-1 h-[3px] rounded-sm" style={{ backgroundColor: colors.accent }} />
          <div className="flex-1 h-[3px] rounded-sm" style={{ backgroundColor: colors.border }} />
        </div>

        {/* 2a: Heading */}
        <h1
          className="text-journal-text"
          style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, marginBottom: 8 }}
        >
          Score your life{'\n'}
          <br />as it is today.
        </h1>
        <p
          className="text-journal-text-secondary"
          style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5, marginBottom: 28 }}
        >
          Be honest. This is your starting point — not a judgement.
          Tap any dimension to add context.
        </p>

        {/* 2c: Dimension cards */}
        <div className="flex flex-col" style={{ gap: 10 }}>
          {LIFE_DIMENSIONS.map((dim) => {
            const entry = scores[dim.key];
            const isExpanded = expandedKey === dim.key;
            const fillPct = ((entry.score - 1) / 9) * 100;
            const barFillColor = dimScoreColor(entry.score);

            // Slider gradient for expanded state
            const sliderFillPct = ((entry.score - 1) / 9) * 100;
            const sliderBg = `linear-gradient(to right, ${GRADIENT_LEFT} 0%, ${GRADIENT_MID} ${sliderFillPct * 0.5}%, ${GRADIENT_RIGHT} ${sliderFillPct}%, ${TRACK_UNFILLED} ${sliderFillPct}%, ${TRACK_UNFILLED} 100%)`;

            return (
              <div
                key={dim.key}
                className="bg-white"
                style={{ borderRadius: 16, padding: '16px 20px' }}
              >
                {/* Collapsed row — always visible */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(dim.key)}
                >
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
                      {dim.label}
                    </p>
                    {!isExpanded && (
                      <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        Tap to add why
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {/* Mini progress bar — 70px */}
                    <div
                      style={{
                        width: 70,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#F3F0EB',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${fillPct}%`,
                          height: '100%',
                          borderRadius: 3,
                          backgroundColor: barFillColor,
                          transition: 'width 0.2s ease, background-color 0.2s ease',
                        }}
                      />
                    </div>
                    {/* Score number */}
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: barFillColor,
                        minWidth: 24,
                        textAlign: 'right',
                      }}
                    >
                      {entry.score}
                    </span>
                  </div>
                </div>

                {/* Expanded content — slider + context input */}
                {isExpanded && (
                  <div style={{ marginTop: 14 }}>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={entry.score}
                      onChange={(e) => handleScoreChange(dim.key, Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: sliderBg }}
                    />
                    <div className="flex justify-between text-[10px] text-journal-text-muted mt-1 mb-3">
                      <span>1</span>
                      <span>10</span>
                    </div>
                    <input
                      type="text"
                      placeholder="One line of context (optional)"
                      value={entry.context}
                      onChange={(e) => handleContextChange(dim.key, e.target.value)}
                      className="w-full bg-journal-surface-alt rounded-xl px-3 py-2
                        text-journal-text placeholder:text-journal-text-muted
                        border-0 outline-none focus:ring-2 focus:ring-journal-accent/30"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2d: CTA */}
        <div style={{ marginTop: 28, paddingBottom: 32 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full text-white font-semibold disabled:opacity-60"
            style={{
              backgroundColor: colors.accent,
              borderRadius: 14,
              padding: 16,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {submitting ? 'Saving...' : 'Set my baseline'}
          </button>
        </div>
      </div>
    </div>
  );
}
