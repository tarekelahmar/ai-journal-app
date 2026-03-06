/**
 * Daily Score Screen — the default landing page.
 *
 * - Date header
 * - Massive score display
 * - Full-width gradient slider (0.5 steps)
 * - Yesterday's log card
 * - 7-day mini bar chart
 * - "Log score & journal" CTA
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { scoreColor, scoreBgColor, colors } from '../theme';
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

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
}

// ── Mini Bar Chart ──────────────────────────────────────────────

function MiniBarChart({ scores, today }: { scores: DailyScore[]; today: string }) {
  // Build last 7 days
  const days: { date: string; score: number | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const entry = scores.find((s) => s.date === iso);
    days.push({ date: iso, score: entry?.score ?? null });
  }

  const maxBarHeight = 64;

  return (
    <div className="flex items-end justify-between gap-2 px-2">
      {days.map((day) => {
        const isToday = day.date === today;
        const barHeight = day.score != null ? (day.score / 10) * maxBarHeight : 4;
        const barColor = day.score != null ? scoreColor(day.score) : colors.borderLight;

        return (
          <div key={day.date} className="flex flex-col items-center flex-1">
            {/* Score label */}
            {day.score != null && (
              <span
                className="text-[10px] font-medium mb-1 tabular-nums"
                style={{ color: barColor }}
              >
                {day.score % 1 === 0 ? day.score.toFixed(0) : day.score.toFixed(1)}
              </span>
            )}
            {/* Bar */}
            <div
              className="w-full rounded-t-md transition-all duration-300"
              style={{
                height: `${barHeight}px`,
                backgroundColor: barColor,
                minHeight: '4px',
                opacity: day.score != null ? 1 : 0.3,
              }}
            />
            {/* Day label */}
            <span
              className={`text-[10px] mt-1.5 ${
                isToday ? 'font-semibold text-journal-text' : 'text-journal-text-muted'
              }`}
            >
              {formatShortDay(day.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

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

      // Check if today already has a score
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
      // Navigate to journal for further conversation
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

  return (
    <div className="flex-1 overflow-y-auto bg-journal-bg">
      <div className="px-5 py-6 space-y-6 max-w-lg mx-auto">
        {/* Date header */}
        <div>
          <h1 className="text-lg font-semibold text-journal-text">{formatDate(today)}</h1>
          <p className="text-sm text-journal-text-secondary mt-0.5">
            {todayLogged ? 'Score logged' : 'How are you today?'}
          </p>
        </div>

        {/* Score display card */}
        <Card padding="lg" className="text-center">
          {/* Massive score */}
          <div
            className="text-7xl font-bold tabular-nums leading-none py-4"
            style={{ color: scoreColor(score) }}
          >
            {displayScore}
          </div>

          {/* Score tint background */}
          <div
            className="rounded-xl py-1.5 px-4 mx-auto inline-block mt-2 mb-6"
            style={{ backgroundColor: scoreBgColor(score) }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: scoreColor(score) }}
            >
              {score >= 8 ? 'Great day' : score >= 6 ? 'Solid' : score >= 4 ? 'Okay' : 'Tough'}
            </span>
          </div>

          {/* Slider */}
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
              style={{
                background: `linear-gradient(to right, ${scoreColor(score)} 0%, ${scoreColor(score)} ${((score - 1) / 9) * 100}%, #E8E4E0 ${((score - 1) / 9) * 100}%, #E8E4E0 100%)`,
              }}
            />
            <div className="flex justify-between text-[10px] text-journal-text-muted mt-1.5">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </Card>

        {/* Yesterday's log */}
        {yesterdayScore && (
          <Card variant="muted" padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-journal-text-muted">Yesterday</p>
                <p className="text-sm font-medium text-journal-text mt-0.5">
                  {formatDate(yesterday)}
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

        {/* 7-day mini chart */}
        <Card padding="md">
          <h3 className="text-xs font-medium text-journal-text-secondary mb-3">Last 7 days</h3>
          <MiniBarChart scores={dailyScores} today={today} />
        </Card>

        {/* CTA */}
        {!todayLogged && (
          <Button
            size="full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Logging...' : 'Log score & journal'}
          </Button>
        )}

        {todayLogged && (
          <Button
            size="full"
            variant="secondary"
            onClick={() => navigate('/journal')}
          >
            Continue to journal
          </Button>
        )}
      </div>
    </div>
  );
}
