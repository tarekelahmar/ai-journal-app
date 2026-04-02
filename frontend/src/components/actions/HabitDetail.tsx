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
import { getHabitLogs, listActions } from '../../api/actions';
import { getDailyScores, type DailyScore } from '../../api/dailyScores';
import { getJournalPatterns } from '../../api/journalPatterns';
import { scoreColor, scoreTextClass, colors } from '../../theme';
import type { Action, HabitLog } from '../../types/Action';
import type { JournalPatternData } from '../../types/JournalFactors';

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

  const W = 340;
  const H = 130;
  const pad = { top: 10, right: 42, bottom: 16, left: 28 };
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
  const beforeData = sorted.filter((s) => s.date < actionStartDate);
  const afterData = sorted.filter((s) => s.date >= actionStartDate);
  const beforeAvg = beforeData.length > 0 ? beforeData.reduce((s, r) => s + r.score, 0) / beforeData.length : null;
  const afterAvg = afterData.length > 0 ? afterData.reduce((s, r) => s + r.score, 0) / afterData.length : null;

  const linePoints = sorted.map((s, i) => `${xScale(i)},${yScale(s.score)}`).join(' ');

  // Zone label positions — centered in each zone
  const beforeMidX = pad.left + (splitX - pad.left) / 2;
  const afterMidX = splitX + (W - pad.right - splitX) / 2;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Before zone (rose/pink tint) */}
        <rect
          x={pad.left}
          y={pad.top}
          width={Math.max(splitX - pad.left, 0)}
          height={innerH}
          fill="#F5E6E2"
        />
        {/* After zone (green tint) */}
        <rect
          x={splitX}
          y={pad.top}
          width={Math.max(W - pad.right - splitX, 0)}
          height={innerH}
          fill="#E8EDE4"
        />

        {/* Zone labels — "Before" / "After" centered at top of each zone */}
        {splitIdx > 0 && (
          <text x={beforeMidX} y={pad.top + 14} textAnchor="middle" fontSize="10" fontWeight="500" fill={colors.textMuted}>
            Before
          </text>
        )}
        <text x={afterMidX} y={pad.top + 14} textAnchor="middle" fontSize="10" fontWeight="500" fill={colors.textSecondary}>
          After
        </text>

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
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Before avg dashed line + label below line at left */}
        {beforeAvg !== null && splitIdx > 0 && (
          <>
            <line
              x1={pad.left}
              y1={yScale(beforeAvg)}
              x2={splitX}
              y2={yScale(beforeAvg)}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="3,2"
            />
            <text
              x={pad.left + 2}
              y={yScale(beforeAvg) + 11}
              fontSize="8"
              fontWeight="600"
              fill={colors.textMuted}
            >
              {beforeAvg.toFixed(1)} avg
            </text>
          </>
        )}

        {/* After avg dashed line + label at right end */}
        {afterAvg !== null && (
          <>
            <line
              x1={splitX}
              y1={yScale(afterAvg)}
              x2={W - pad.right}
              y2={yScale(afterAvg)}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="3,2"
            />
            <text
              x={W - pad.right + 4}
              y={yScale(afterAvg) + 3}
              fontSize="8"
              fontWeight="600"
              fill={colors.textSecondary}
            >
              {afterAvg.toFixed(1)} avg
            </text>
          </>
        )}
      </svg>
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

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build day cells (no headers — rendered separately)
  const dayCells: React.ReactNode[] = [];

  // Empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    dayCells.push(<div key={`e-${i}`} style={{ width: 28, height: 28 }} />);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isCompleted = completedSet.has(dateStr);
    const isToday = day === now.getDate();
    const isPast = day < now.getDate();

    let style = 'bg-journal-surface opacity-40'; // future
    if (isCompleted) style = 'bg-journal-positive';
    else if (isPast) style = 'bg-journal-negative-light';

    dayCells.push(
      <div
        key={day}
        className={`rounded-[5px] ${style} ${isToday ? 'ring-1.5 ring-journal-accent' : ''}`}
        style={{ width: 28, height: 28 }}
      />,
    );
  }

  return (
    <div>
      <p className="text-[12px] text-journal-text-secondary font-medium mb-3 text-center">
        {monthName}
      </p>
      <div className="flex justify-center">
        <div className="inline-grid grid-cols-7" style={{ gap: '5px' }}>
          {/* Day-of-week headers */}
          {dayNames.map((d, i) => (
            <div key={`h-${i}`} className="text-[11px] text-journal-text-muted text-center" style={{ width: 28 }}>
              {d}
            </div>
          ))}
          {dayCells}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[4px] bg-journal-positive" />
          <span className="text-[11px] text-journal-text-muted">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-[4px] bg-journal-negative-light" />
          <span className="text-[11px] text-journal-text-muted">Missed</span>
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
  const [otherHabits, setOtherHabits] = useState<Action[]>([]);
  const [patterns, setPatterns] = useState<JournalPatternData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

        const [scoresData, logsData, allActions, patternsData] = await Promise.all([
          getDailyScores(60).catch(() => []),
          getHabitLogs(action.id, start, end).catch(() => []),
          listActions().catch(() => []),
          getJournalPatterns().catch(() => []),
        ]);

        if (!cancelled) {
          setScores(scoresData);
          setLogs(logsData);
          // Other active habits (excluding current)
          setOtherHabits(
            allActions.filter((a) => a.id !== action.id && a.action_type === 'habit' && a.status === 'active'),
          );
          setPatterns(patternsData);
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
        <div className="rounded-[16px] p-4" style={{ backgroundColor: colors.positive }}>
          <div className="text-center">
            <p className="text-[10px] tracking-wider text-white/80 mb-1">Score impact</p>
            {impact ? (
              <>
                <p className="text-[34px] font-bold text-white leading-tight">
                  {impact.diff > 0 ? '+' : ''}{impact.diff.toFixed(1)}
                </p>
                <p className="text-[10px] text-white/80 mt-0.5">
                  avg lift on active days
                </p>
              </>
            ) : (
              <p className="text-[34px] font-bold text-white/80 leading-tight">—</p>
            )}
          </div>
        </div>
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Consistency</p>
            <p className={`text-[34px] font-bold leading-tight ${scoreTextClass(consistency / 10)}`}>
              {consistency}%
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">last 30 days</p>
          </div>
        </Card>
      </div>

      {/* Before/After Chart */}
      <Card>
        <p className="text-[12px] font-semibold text-journal-text">Daily score over time</p>
        <p className="text-[11px] text-journal-text-muted mb-3">
          Before vs after starting {action.title.toLowerCase()}
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

      {/* Other factors in this period */}
      {(otherHabits.length > 0 || patterns.length > 0) && (
        <Card>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-1">
            Other factors in this period
          </p>
          <p className="text-[11px] text-journal-text-muted mb-3">
            Variables that may also be influencing your score
          </p>

          <div className="space-y-2.5">
            {/* Other active habits */}
            {otherHabits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center gap-2.5 py-1.5"
                style={{ borderBottom: '1px solid #F0EDE8' }}
              >
                <div
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#7A8F6B' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-journal-text truncate">{habit.title}</p>
                  <p className="text-[10px] text-journal-text-muted">
                    Ongoing · {domainLabel(habit.primary_domain)}
                  </p>
                </div>
              </div>
            ))}

            {/* Detected patterns */}
            {patterns
              .filter((p) => p.status === 'active' && p.n_observations >= 5)
              .slice(0, 4)
              .map((p) => (
                <div
                  key={p.pattern_name}
                  className="flex items-center gap-2.5 py-1.5"
                  style={{ borderBottom: '1px solid #F0EDE8' }}
                >
                  <div
                    className="shrink-0 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: p.effect_size > 0 ? '#7A8F6B' : '#C47A6B',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-journal-text truncate">
                      {p.description || p.pattern_name}
                    </p>
                    <p className="text-[10px] text-journal-text-muted">
                      Detected pattern · {p.effect_size > 0 ? '+' : ''}{p.effect_size.toFixed(1)} effect
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {otherHabits.length === 0 && patterns.filter((p) => p.status === 'active' && p.n_observations >= 5).length === 0 && (
            <p className="text-[12px] text-journal-text-muted text-center py-2">
              No other significant factors detected yet.
            </p>
          )}
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
