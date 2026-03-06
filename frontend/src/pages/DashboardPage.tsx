/**
 * Dashboard Screen — Track 3c Task 1
 *
 * Sections (top → bottom):
 *   1. Header with date
 *   2. Headline metrics row (Floor · Trend · Streak)
 *   3. 30-day SVG area trend chart
 *   4. Impact bars (Whoop-style, centre-divided)
 *   5. Life-domain horizontal bars with deltas
 *   6. AI weekly insight card
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { getDailyScores, type DailyScore } from '../api/dailyScores';
import { getJournalPatterns } from '../api/journalPatterns';
import { getCurrentDomainScores, getDomainScoreHistory } from '../api/lifeDomains';
import { getWeeklySynthesis } from '../api/milestones';
import { scoreColor, scoreTextClass, colors } from '../theme';
import { LIFE_DIMENSIONS } from '../theme';
import type { JournalPatternData } from '../types/JournalFactors';
import type { LifeDomainScoreData } from '../types/LifeDomain';

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function computeFloor(scores: DailyScore[], days: number): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = scores.filter((s) => new Date(s.date) >= cutoff);
  if (recent.length === 0) return null;
  return Math.min(...recent.map((s) => s.score));
}

function computeTrend(scores: DailyScore[], days: number): { avg: number; direction: 'up' | 'down' | 'flat' } | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = scores.filter((s) => new Date(s.date) >= cutoff);
  if (recent.length === 0) return null;

  const avg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;

  // Compare first half vs second half for direction
  const mid = Math.floor(recent.length / 2);
  if (mid === 0) return { avg, direction: 'flat' };

  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);
  const firstAvg = firstHalf.reduce((s, r) => s + r.score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, r) => s + r.score, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const direction = diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'flat';
  return { avg, direction };
}

function computeStreak(scores: DailyScore[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (sorted[i].date === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Trend Chart (SVG area) ───────────────────────────────────────

function TrendChart({ scores }: { scores: DailyScore[] }) {
  if (scores.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-journal-text-muted">
        Need at least 2 data points for chart
      </div>
    );
  }

  const W = 320;
  const H = 120;
  const pad = { top: 12, right: 8, bottom: 20, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  const xScale = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;

  // Build polyline points
  const linePoints = sorted.map((s, i) => `${xScale(i)},${yScale(s.score)}`).join(' ');

  // Build area path (fill under curve)
  const areaPath = [
    `M ${xScale(0)},${yScale(sorted[0].score)}`,
    ...sorted.slice(1).map((s, i) => `L ${xScale(i + 1)},${yScale(s.score)}`),
    `L ${xScale(n - 1)},${pad.top + innerH}`,
    `L ${xScale(0)},${pad.top + innerH}`,
    'Z',
  ].join(' ');

  // Y-axis labels
  const yTicks = [2, 4, 6, 8, 10];

  // X-axis labels — show first, middle, last
  const xLabels: { i: number; label: string }[] = [];
  const fmtShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  if (n > 0) xLabels.push({ i: 0, label: fmtShort(sorted[0].date) });
  if (n > 2) xLabels.push({ i: Math.floor(n / 2), label: fmtShort(sorted[Math.floor(n / 2)].date) });
  if (n > 1) xLabels.push({ i: n - 1, label: fmtShort(sorted[n - 1].date) });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((v) => (
        <line
          key={v}
          x1={pad.left}
          y1={yScale(v)}
          x2={W - pad.right}
          y2={yScale(v)}
          stroke={colors.borderLight}
          strokeWidth={0.5}
        />
      ))}

      {/* Y labels */}
      {yTicks.map((v) => (
        <text
          key={v}
          x={pad.left - 6}
          y={yScale(v) + 3}
          textAnchor="end"
          fontSize="8"
          fill={colors.textMuted}
        >
          {v}
        </text>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={colors.positive} fillOpacity={0.12} />

      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={colors.positive}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {sorted.map((s, i) => (
        <circle
          key={s.date}
          cx={xScale(i)}
          cy={yScale(s.score)}
          r={2.5}
          fill={scoreColor(s.score)}
          stroke="white"
          strokeWidth={1}
        />
      ))}

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={xScale(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize="8"
          fill={colors.textMuted}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// ── Impact Bars (Whoop-style) ────────────────────────────────────

function ImpactBars({ patterns }: { patterns: JournalPatternData[] }) {
  // Sort by absolute effect size, take top 6
  const sorted = [...patterns]
    .filter((p) => p.status === 'active' || p.status === 'confirmed')
    .sort((a, b) => Math.abs(b.effect_size) - Math.abs(a.effect_size))
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-journal-text-muted">
        Journal more to discover patterns
      </div>
    );
  }

  const maxEffect = Math.max(...sorted.map((p) => Math.abs(p.effect_size)), 1);

  return (
    <div className="space-y-3">
      {sorted.map((pattern) => {
        const isPositive = pattern.effect_size > 0;
        const pct = (Math.abs(pattern.effect_size) / maxEffect) * 50; // max 50% of width per side
        const label = pattern.input_factors[0]
          ? pattern.input_factors[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : pattern.pattern_name;

        return (
          <div key={pattern.pattern_name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-journal-text-secondary">{label}</span>
              <span className={`text-[11px] font-medium ${isPositive ? 'text-journal-positive' : 'text-journal-negative'}`}>
                {isPositive ? '+' : ''}{pattern.effect_size.toFixed(1)}
              </span>
            </div>
            <div className="relative h-2.5 bg-journal-surface-alt rounded-full overflow-hidden">
              {/* Centre line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-journal-border" />
              {/* Bar */}
              <div
                className={`absolute top-0 bottom-0 rounded-full ${
                  isPositive ? 'bg-journal-positive' : 'bg-journal-negative'
                }`}
                style={{
                  left: isPositive ? '50%' : `${50 - pct}%`,
                  width: `${pct}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Domain Bars ──────────────────────────────────────────────────

function DomainBars({
  current,
  previous,
}: {
  current: Record<string, number>;
  previous: Record<string, number> | null;
}) {
  return (
    <div className="space-y-3">
      {LIFE_DIMENSIONS.map((dim) => {
        const score = current[dim.key] ?? 0;
        const prevScore = previous?.[dim.key] ?? null;
        const delta = prevScore !== null ? score - prevScore : null;
        const pct = ((score - 1) / 9) * 100;

        return (
          <div key={dim.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-journal-text-secondary">{dim.shortLabel}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[12px] font-semibold ${scoreTextClass(score)}`}>
                  {score.toFixed(1)}
                </span>
                {delta !== null && delta !== 0 && (
                  <span className={`text-[10px] font-medium ${delta > 0 ? 'text-journal-positive' : 'text-journal-negative'}`}>
                    {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-journal-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: scoreColor(score),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function DashboardPage() {
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [patterns, setPatterns] = useState<JournalPatternData[]>([]);
  const [domainCurrent, setDomainCurrent] = useState<LifeDomainScoreData | null>(null);
  const [domainHistory, setDomainHistory] = useState<LifeDomainScoreData[]>([]);
  const [weeklySynthesis, setWeeklySynthesis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scoresData, patternsData, domainData, historyData, synthesisData] = await Promise.all([
          getDailyScores(60).catch(() => [] as DailyScore[]),
          getJournalPatterns().catch(() => [] as JournalPatternData[]),
          getCurrentDomainScores().catch(() => null),
          getDomainScoreHistory(30).catch(() => [] as LifeDomainScoreData[]),
          getWeeklySynthesis().catch(() => null),
        ]);

        if (cancelled) return;

        setScores(scoresData);
        setPatterns(patternsData);
        setDomainCurrent(domainData);
        setDomainHistory(historyData);

        // Extract narrative text from synthesis
        if (synthesisData?.data) {
          const data = synthesisData.data;
          const text = data.narrative || data.summary || data.insight || null;
          setWeeklySynthesis(typeof text === 'string' ? text : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Derived metrics
  const floor = useMemo(() => computeFloor(scores, 7), [scores]);
  const trend = useMemo(() => computeTrend(scores, 7), [scores]);
  const streak = useMemo(() => computeStreak(scores), [scores]);

  // Last 30 days for the chart
  const chartScores = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return scores.filter((s) => new Date(s.date) >= cutoff);
  }, [scores]);

  // Previous domain scores (oldest in history, to compute deltas)
  const previousDomain = useMemo(() => {
    if (domainHistory.length < 2) return null;
    return domainHistory[0].scores;
  }, [domainHistory]);

  const trendIcon = trend?.direction === 'up' ? '↑' : trend?.direction === 'down' ? '↓' : '→';
  const trendColor = trend?.direction === 'up'
    ? 'text-journal-positive'
    : trend?.direction === 'down'
      ? 'text-journal-negative'
      : 'text-journal-amber';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] text-journal-text-muted uppercase tracking-wider">
          {formatDate(new Date())}
        </p>
        <h1 className="text-xl font-bold text-journal-text mt-0.5">Dashboard</h1>
      </div>

      {/* ── Headline Metrics ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Floor */}
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Floor</p>
            <p className={`text-2xl font-bold ${floor !== null ? scoreTextClass(floor) : 'text-journal-text-muted'}`}>
              {floor !== null ? floor.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">7-day low</p>
          </div>
        </Card>

        {/* Trend */}
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Trend</p>
            <p className={`text-2xl font-bold ${trend ? trendColor : 'text-journal-text-muted'}`}>
              {trend ? trend.avg.toFixed(1) : '—'}
            </p>
            <p className={`text-[10px] mt-0.5 ${trend ? trendColor : 'text-journal-text-muted'}`}>
              {trend ? `${trendIcon} 7-day avg` : 'No data'}
            </p>
          </div>
        </Card>

        {/* Streak */}
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Streak</p>
            <p className={`text-2xl font-bold ${streak > 0 ? 'text-journal-accent' : 'text-journal-text-muted'}`}>
              {streak}
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">
              {streak === 1 ? 'day' : 'days'}
            </p>
          </div>
        </Card>
      </div>

      {/* ── 30-Day Trend Chart ──────────────────────────────── */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          30-Day Trend
        </p>
        <TrendChart scores={chartScores} />
      </Card>

      {/* ── Impact Bars ─────────────────────────────────────── */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          What Impacts Your Score
        </p>
        <ImpactBars patterns={patterns} />
      </Card>

      {/* ── Life Domains ────────────────────────────────────── */}
      {domainCurrent && (
        <Card>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
            Life Domains
          </p>
          <DomainBars current={domainCurrent.scores} previous={previousDomain} />
        </Card>
      )}

      {/* ── Weekly Insight ──────────────────────────────────── */}
      {weeklySynthesis && (
        <Card variant="muted">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent mb-2">
            Weekly Insight
          </p>
          <p className="text-[13px] text-journal-text leading-relaxed">
            {weeklySynthesis}
          </p>
        </Card>
      )}

      {/* Empty state */}
      {scores.length === 0 && !domainCurrent && patterns.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-journal-text-muted">
              Start journaling to see your dashboard come alive.
            </p>
            <p className="text-xs text-journal-text-muted mt-1">
              Log daily scores and chat to build your personal insights.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
