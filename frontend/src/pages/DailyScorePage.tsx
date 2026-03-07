/**
 * Daily Score Screen — the default landing page.
 *
 * - Date header
 * - Massive score display (no mood label)
 * - Full-width gradient slider (0.5 steps)
 * - Yesterday's log card (with time)
 * - 7-day mini bar chart (slim bars, no numbers, today stub)
 * - "Log score & journal" CTA
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { scoreColor, colors } from '../theme';
import { getDailyScores, logDailyScore } from '../api/dailyScores';
import type { DailyScore } from '../api/dailyScores';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "Fri, March 6 · 8:45 PM" */
function formatDateWithTime(dateStr: string, createdAt?: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });

  if (createdAt) {
    try {
      const ts = new Date(createdAt);
      const timePart = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart} \u00B7 ${timePart}`;
    } catch {
      // fall through
    }
  }

  return datePart;
}

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
}

// ── Gradient slider colors ─────────────────────────────────────

const GRADIENT_LEFT = colors.negative;   // clay red
const GRADIENT_MID = colors.amber;       // amber/tan
const GRADIENT_RIGHT = colors.positive;  // olive/sage green
const TRACK_UNFILLED = colors.borderLight; // light grey

// ── Mini Bar Chart ─────────────────────────────────────────────

function MiniBarChart({ scores, today }: { scores: DailyScore[]; today: string }) {
  const days: { date: string; score: number | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const entry = scores.find((s) => s.date === iso);
    days.push({ date: iso, score: entry?.score ?? null });
  }

  return (
    <div className="flex items-end justify-between gap-3 px-1">
      {days.map((day) => {
        const isToday = day.date === today;
        const hasScore = day.score != null;
        // Bar height proportional to score: score * 6px
        const barHeight = hasScore ? day.score! * 6 : 4;
        const barColor = hasScore ? scoreColor(day.score!) : colors.border;

        return (
          <div key={day.date} className="flex flex-col items-center flex-1">
            {/* Bar */}
            <div
              className="rounded-t-md transition-all duration-300"
              style={{
                width: 22,
                height: `${barHeight}px`,
                backgroundColor: barColor,
                minHeight: '4px',
                opacity: hasScore ? 1 : 0.4,
              }}
            />
            {/* Day label */}
            <span
              className="text-[10px] mt-1.5"
              style={{
                color: isToday && !hasScore ? colors.accent : (isToday ? '#2C2C2C' : colors.textMuted),
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {formatShortDay(day.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function DailyScorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(5.0);
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
  const [todayLogged, setTodayLogged] = useState(false);

  const today = todayISO();
  const yesterday = yesterdayISO();
  const yesterdayScore = dailyScores.find((s) => s.date === yesterday);

  const loadScores = useCallback(async () => {
    try {
      const scores = await getDailyScores(14);
      setDailyScores(scores);

      const todayEntry = scores.find((s) => s.date === today);
      if (todayEntry) {
        setScore(todayEntry.score);
        setTodayLogged(true);
      }
    } catch (err) {
      console.error('Failed to load daily scores:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await logDailyScore(today, score);
      setTodayLogged(true);
      navigate('/journal');
    } catch (err) {
      console.error('Failed to log score:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const displayScore = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);

  // Slider gradient: full gradient from red → amber → green across the filled portion
  const fillPct = ((score - 1) / 9) * 100;
  const sliderBg = `linear-gradient(to right, ${GRADIENT_LEFT} 0%, ${GRADIENT_MID} ${fillPct * 0.5}%, ${GRADIENT_RIGHT} ${fillPct}%, ${TRACK_UNFILLED} ${fillPct}%, ${TRACK_UNFILLED} 100%)`;

  return (
    <div className="flex-1 overflow-y-auto bg-journal-bg">
      <div className="px-5 py-6 space-y-6 mx-auto w-full" style={{ maxWidth: 680 }}>
        {/* Date header */}
        <div>
          <h1 className="text-lg font-semibold text-journal-text">{formatDate(today)}</h1>
          <p className="text-sm text-journal-text-secondary mt-0.5">
            {todayLogged ? 'Score logged' : "How's your day?"}
          </p>
        </div>

        {/* Score display card */}
        <Card padding="lg" className="text-center">
          {/* 3a: Massive score — 100px, weight 700 */}
          <div
            className="font-bold tabular-nums leading-none py-4"
            style={{ fontSize: 100, color: scoreColor(score) }}
          >
            {displayScore}
          </div>

          {/* "out of 10" muted text — no mood label (3b) */}
          <p className="text-sm text-journal-text-muted mb-6">out of 10</p>

          {/* 3c: Slider with smooth full-width gradient */}
          <div className="px-2">
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              disabled={todayLogged}
              className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-default"
              style={{ background: sliderBg }}
            />
            <div className="flex justify-between text-[10px] text-journal-text-muted mt-1.5">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </Card>

        {/* 3d: Yesterday's log — with time */}
        {yesterdayScore && (
          <Card variant="muted" padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-journal-text-muted">Yesterday</p>
                <p className="text-sm font-medium text-journal-text mt-0.5">
                  {formatDateWithTime(yesterday, yesterdayScore.created_at)}
                </p>
              </div>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: scoreColor(yesterdayScore.score) }}
              >
                {yesterdayScore.score % 1 === 0
                  ? yesterdayScore.score.toFixed(0)
                  : yesterdayScore.score.toFixed(1)}
              </span>
            </div>
          </Card>
        )}

        {/* 3e: 7-day mini chart — slim bars, no numbers, today stub */}
        <Card padding="md">
          <h3 className="text-xs font-medium text-journal-text-secondary mb-3">Last 7 days</h3>
          <MiniBarChart scores={dailyScores} today={today} />
        </Card>

        {/* 3g: CTA — visible above floating nav (AppShell adds 88px bottom padding) */}
        {!todayLogged && (
          <div className="pb-2">
            <Button
              size="full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Logging...' : 'Log score & journal'}
            </Button>
          </div>
        )}

        {todayLogged && (
          <div className="pb-2">
            <Button
              size="full"
              variant="secondary"
              onClick={() => navigate('/journal')}
            >
              Continue to journal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
