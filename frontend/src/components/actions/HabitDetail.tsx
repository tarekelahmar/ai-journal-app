/**
 * Habit Detail View — Track 3c Task 4
 *
 * Sections:
 *   1. Title + domain/source metadata
 *   2. Impact + Consistency cards (side-by-side)
 *   3. Before/after SVG chart (two-tone background zones at action start)
 *   4. AI interpretation (template text)
 *   5. Consistency calendar (grid of colored squares for current month)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { getHabitLogs } from '../../api/actions';
import { getDailyScores, type DailyScore } from '../../api/dailyScores';
import { scoreColor, scoreTextClass, colors } from '../../theme';
import type { Action, HabitLog } from '../../types/Action';

// ── Helpers ──────────────────────────────────────────────────────

function domainLabel(domain: string | null): string {
  if (!domain) return '';
  const labels: Record<string, string> = {
    career: 'Career', relationship: 'Relationship', family: 'Family',
    health: 'Health', finance: 'Finance', social: 'Social', purpose: 'Purpose',
  };
  return labels[domain] || domain;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'journal_extraction': return 'Extracted from journal';
    case 'ai_suggestion': return 'AI suggested';
    case 'user_created': return 'Created by you';
    default: return source;
  }
}

// ── Before/After Chart ───────────────────────────────────────────

function BeforeAfterChart({
  scores,
  actionStartDate,
}: {
  scores: DailyScore[];
  actionStartDate: string;
}) {
  if (scores.length < 3) {
    return (
      <div className="h-28 flex items-center justify-center text-sm text-journal-text-muted">
        Need more data for chart
      </div>
    );
  }

  const W = 320;
  const H = 100;
  const pad = { top: 8, right: 8, bottom: 16, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  const xScale = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;

  // Find split point index
  const splitIdx = sorted.findIndex((s) => s.date >= actionStartDate);
  const splitX = splitIdx > 0 ? xScale(splitIdx) : xScale(0);

  // Compute before/after averages
  const before = sorted.filter((s) => s.date < actionStartDate);
  const after = sorted.filter((s) => s.date >= actionStartDate);
  const beforeAvg = before.length > 0 ? before.reduce((s, r) => s + r.score, 0) / before.length : null;
  const afterAvg = after.length > 0 ? after.reduce((s, r) => s + r.score, 0) / after.length : null;

  const linePoints = sorted.map((s, i) => `${xScale(i)},${yScale(s.score)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Before zone (light muted) */}
        <rect
          x={pad.left}
          y={pad.top}
          width={Math.max(splitX - pad.left, 0)}
          height={innerH}
          fill={colors.surfaceAlt}
        />
        {/* After zone (light positive) */}
        <rect
          x={splitX}
          y={pad.top}
          width={Math.max(W - pad.right - splitX, 0)}
          height={innerH}
          fill={colors.positiveLight}
        />

        {/* Split line */}
        <line
          x1={splitX}
          y1={pad.top}
          x2={splitX}
          y2={pad.top + innerH}
          stroke={colors.positive}
          strokeWidth={1}
          strokeDasharray="3,2"
        />

        {/* Grid lines */}
        {[2, 4, 6, 8, 10].map((v) => (
          <line
            key={v}
            x1={pad.left}
            y1={yScale(v)}
            x2={W - pad.right}
            y2={yScale(v)}
            stroke={colors.border}
            strokeWidth={0.3}
          />
        ))}

        {/* Y labels */}
        {[2, 6, 10].map((v) => (
          <text key={v} x={pad.left - 5} y={yScale(v) + 3} textAnchor="end" fontSize="7" fill={colors.textMuted}>
            {v}
          </text>
        ))}

        {/* Score line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {sorted.map((s, i) => (
          <circle
            key={s.date}
            cx={xScale(i)}
            cy={yScale(s.score)}
            r={2}
            fill={scoreColor(s.score)}
            stroke="white"
            strokeWidth={0.8}
          />
        ))}

        {/* Before/After avg lines */}
        {beforeAvg !== null && splitIdx > 0 && (
          <line
            x1={pad.left}
            y1={yScale(beforeAvg)}
            x2={splitX}
            y2={yScale(beforeAvg)}
            stroke={colors.textMuted}
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
        {afterAvg !== null && (
          <line
            x1={splitX}
            y1={yScale(afterAvg)}
            x2={W - pad.right}
            y2={yScale(afterAvg)}
            stroke={colors.positive}
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        {beforeAvg !== null && (
          <span className="text-[10px] text-journal-text-muted">
            Before: {beforeAvg.toFixed(1)}
          </span>
        )}
        {afterAvg !== null && (
          <span className="text-[10px] text-journal-positive font-medium">
            After: {afterAvg.toFixed(1)}
          </span>
        )}
        {beforeAvg !== null && afterAvg !== null && (
          <span className={`text-[10px] font-semibold ${afterAvg > beforeAvg ? 'text-journal-positive' : 'text-journal-negative'}`}>
            {afterAvg > beforeAvg ? '▲' : '▼'}{Math.abs(afterAvg - beforeAvg).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Consistency Calendar ─────────────────────────────────────────

function ConsistencyCalendar({ logs }: { logs: HabitLog[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Build a set of completed dates
  const completedSet = new Set(
    logs.filter((l) => l.completed).map((l) => l.log_date),
  );

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells: React.ReactNode[] = [];

  // Header row
  dayNames.forEach((d, i) => {
    cells.push(
      <div key={`h-${i}`} className="text-[9px] text-journal-text-muted text-center font-medium">
        {d}
      </div>,
    );
  });

  // Empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`e-${i}`} />);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isCompleted = completedSet.has(dateStr);
    const isToday = day === now.getDate();
    const isPast = day < now.getDate();

    let bgColor = 'bg-journal-surface-alt'; // default: not logged
    if (isCompleted) bgColor = 'bg-journal-positive';
    else if (isPast) bgColor = 'bg-journal-negative-light';

    cells.push(
      <div
        key={day}
        className={`aspect-square rounded-sm flex items-center justify-center text-[9px] font-medium ${bgColor} ${
          isToday ? 'ring-1 ring-journal-accent' : ''
        } ${isCompleted ? 'text-white' : 'text-journal-text-muted'}`}
      >
        {day}
      </div>,
    );
  }

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <p className="text-[11px] text-journal-text-secondary font-medium mb-2 text-center">
        {monthName}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {cells}
      </div>
      <div className="flex items-center justify-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-journal-positive" />
          <span className="text-[9px] text-journal-text-muted">Done</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-journal-negative-light" />
          <span className="text-[9px] text-journal-text-muted">Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-journal-surface-alt" />
          <span className="text-[9px] text-journal-text-muted">Upcoming</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

interface HabitDetailProps {
  action: Action;
}

export function HabitDetail({ action }: HabitDetailProps) {
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

        const [scoresData, logsData] = await Promise.all([
          getDailyScores(60).catch(() => []),
          getHabitLogs(action.id, start, end).catch(() => []),
        ]);

        if (!cancelled) {
          setScores(scoresData);
          setLogs(logsData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [action.id]);

  // Consistency
  const consistency = useMemo(() => {
    const last30 = logs.filter((l) => {
      const d = new Date(l.log_date);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff;
    });
    const completed = last30.filter((l) => l.completed).length;
    return Math.round((completed / 30) * 100);
  }, [logs]);

  // Impact: avg score on days with vs without habit
  const impact = useMemo(() => {
    const logDates = new Set(logs.filter((l) => l.completed).map((l) => l.log_date));
    const withHabit = scores.filter((s) => logDates.has(s.date));
    const withoutHabit = scores.filter((s) => !logDates.has(s.date));

    if (withHabit.length < 2 || withoutHabit.length < 2) return null;

    const avgWith = withHabit.reduce((s, r) => s + r.score, 0) / withHabit.length;
    const avgWithout = withoutHabit.reduce((s, r) => s + r.score, 0) / withoutHabit.length;
    return { avgWith, avgWithout, diff: avgWith - avgWithout };
  }, [scores, logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-journal-text">{action.title}</h2>
        <p className="text-[12px] text-journal-text-muted mt-0.5">
          {domainLabel(action.primary_domain)}
          {action.primary_domain ? ' · ' : ''}
          {sourceLabel(action.source)}
          {' · '}
          Started {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Impact + Consistency cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Impact</p>
            {impact ? (
              <>
                <p className={`text-xl font-bold ${impact.diff > 0 ? 'text-journal-positive' : 'text-journal-negative'}`}>
                  {impact.diff > 0 ? '+' : ''}{impact.diff.toFixed(1)}
                </p>
                <p className="text-[10px] text-journal-text-muted mt-0.5">
                  {impact.avgWith.toFixed(1)} vs {impact.avgWithout.toFixed(1)}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-journal-text-muted">—</p>
            )}
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Consistency</p>
            <p className={`text-xl font-bold ${scoreTextClass(consistency / 10)}`}>
              {consistency}%
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">last 30 days</p>
          </div>
        </Card>
      </div>

      {/* Before/After Chart */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          Score Before & After
        </p>
        <BeforeAfterChart scores={scores} actionStartDate={action.created_at.split('T')[0]} />
      </Card>

      {/* AI interpretation */}
      {impact && (
        <Card variant="muted">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent mb-2">
            Insight
          </p>
          <p className="text-[13px] text-journal-text leading-relaxed">
            {impact.diff > 0.3
              ? `On days you ${action.title.toLowerCase()}, your average score is ${impact.diff.toFixed(1)} points higher. This habit appears to have a positive effect on your wellbeing.`
              : impact.diff < -0.3
                ? `Interestingly, days with this habit show a slightly lower average score (${Math.abs(impact.diff).toFixed(1)} points). This could be a confound — correlation isn't causation.`
                : `No clear score difference detected yet between days with and without this habit. Keep logging to build a clearer picture.`}
          </p>
        </Card>
      )}

      {/* Consistency Calendar */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          Consistency
        </p>
        <ConsistencyCalendar logs={logs} />
      </Card>
    </div>
  );
}
