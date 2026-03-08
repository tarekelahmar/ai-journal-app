/**
 * Dashboard Screen — Track 5 rewrite.
 *
 * Sections (top → bottom):
 *   1. Header ("Your progress" / "Dashboard")
 *   2. Headline metrics row (Floor · Trend · Streak) — square color-block cards
 *   3. 30-day SVG area trend chart (straight lines, terracotta)
 *   4. Impact bars (Whoop-style, centre-divided, HURTS/HELPS header)
 *   5. Life-domain horizontal bars with deltas
 *   6. AI weekly insight card (headline + body)
 */
import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { getDashboardAnalytics, type DashboardAnalytics, type ImpactFactor } from '../api/analytics';
import { colors } from '../theme';
import { LIFE_DIMENSIONS } from '../theme';

// ── Helpers ──────────────────────────────────────────────────────

/** Domain bar color: ≤3 → red, >3 to <6 → amber, ≥6 → green */
function domainBarColor(score: number): string {
  if (score >= 6) return colors.positive;
  if (score > 3) return colors.amber;
  return colors.negative;
}

// ── Trend Chart (SVG, straight lines) ────────────────────────────

const WARM_FILL = '#F5E6DD';

function TrendChart({ scores }: { scores: Array<{ date: string; score: number }> }) {
  if (scores.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-journal-text-muted">
        Need at least 2 data points for chart
      </div>
    );
  }

  const W = 320;
  const H = 120;
  const pad = { top: 12, right: 8, bottom: 20, left: 12 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  const xScale = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;

  const points: [number, number][] = sorted.map((s, i) => [xScale(i), yScale(s.score)]);
  const bottomY = pad.top + innerH;

  // Straight-line path (L commands)
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`)
    .join(' ');

  const areaPath = [
    linePath,
    `L ${points[n - 1][0]},${bottomY}`,
    `L ${points[0][0]},${bottomY}`,
    'Z',
  ].join(' ');

  const yTicks = [2, 4, 6, 8, 10];

  const fmtShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const lastPt = points[n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Faint horizontal gridlines */}
      {yTicks.map((v) => (
        <line key={v} x1={pad.left} y1={yScale(v)} x2={W - pad.right} y2={yScale(v)} stroke={colors.borderLight} strokeWidth={0.5} />
      ))}

      {/* Area fill — warm peach */}
      <path d={areaPath} fill={WARM_FILL} />

      {/* Straight line — terracotta */}
      <path d={linePath} fill="none" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Single dot on rightmost point — terracotta */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r={3.5} fill={colors.accent} stroke="white" strokeWidth={1.5} />

      {/* X-axis: start date (left) + "Today" (right) */}
      <text x={xScale(0)} y={H - 4} textAnchor="start" fontSize="8" fill={colors.textMuted}>
        {fmtShort(sorted[0].date)}
      </text>
      <text x={xScale(n - 1)} y={H - 4} textAnchor="end" fontSize="8" fill={colors.textMuted}>
        Today
      </text>
    </svg>
  );
}

// ── Impact Bars (Whoop-style, using impact_percentage) ───────────

function ImpactBars({ factors }: { factors: ImpactFactor[] }) {
  if (factors.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-journal-text-muted">
        Journal more to discover patterns
      </div>
    );
  }

  const maxPct = Math.max(...factors.map((f) => f.impact_percentage), 1);

  return (
    <div>
      {/* HURTS / % IMPACT / HELPS header row */}
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-[9px] uppercase tracking-wider font-bold text-journal-negative">Hurts</span>
        <span className="text-[9px] uppercase tracking-wider text-journal-text-muted">% Impact</span>
        <span className="text-[9px] uppercase tracking-wider font-bold text-journal-positive">Helps</span>
      </div>

      <div className="space-y-3">
        {factors.map((factor) => {
          const isPositive = factor.direction === 'positive';
          const pct = (factor.impact_percentage / maxPct) * 50;

          return (
            <div key={factor.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-journal-text-secondary">{factor.label}</span>
                <span className={`text-[11px] font-medium ${isPositive ? 'text-journal-positive' : 'text-journal-negative'}`}>
                  {isPositive ? '+' : '-'}{factor.impact_percentage}%
                </span>
              </div>
              {/* Bar container — relative, no overflow hidden so centre line extends */}
              <div className="relative" style={{ height: 18 }}>
                {/* Bar track */}
                <div
                  className="absolute rounded-full bg-journal-surface-alt"
                  style={{ top: 4, bottom: 4, left: 0, right: 0 }}
                />
                {/* Filled portion */}
                <div
                  className={`absolute rounded-full ${
                    isPositive ? 'bg-journal-positive' : 'bg-journal-negative'
                  }`}
                  style={{
                    top: 4,
                    bottom: 4,
                    left: isPositive ? '50%' : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
                {/* Centre divider line — extends 4px above and below bar */}
                <div
                  className="absolute z-10"
                  style={{
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 2,
                    marginLeft: -1,
                    backgroundColor: '#8C8278',
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
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
    <div className="space-y-2.5">
      {LIFE_DIMENSIONS.map((dim) => {
        const score = current[dim.key] ?? 0;
        const rounded = Math.round(score);
        const prevScore = previous?.[dim.key] ?? null;
        const delta = prevScore !== null ? Math.round(score - prevScore) : null;
        const pct = ((score - 1) / 9) * 100;

        // Delta colour class
        const deltaClass =
          delta !== null && delta > 0
            ? 'text-journal-positive'
            : delta !== null && delta < 0
              ? 'text-journal-negative'
              : 'text-journal-text-muted';

        return (
          <div key={dim.key} className="flex items-center" style={{ gap: 10 }}>
            {/* Domain name — fixed width */}
            <span className="text-[12px] text-journal-text-secondary shrink-0" style={{ width: 80 }}>
              {dim.shortLabel}
            </span>

            {/* Bar — takes remaining space, matches impact bar thickness */}
            <div className="flex-1 h-2.5 bg-journal-surface-alt rounded-full overflow-hidden min-w-0">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: domainBarColor(score),
                }}
              />
            </div>

            {/* Score number — always dark, bold */}
            <span
              className="text-[15px] font-bold text-journal-text shrink-0"
              style={{ width: 20, textAlign: 'right' }}
            >
              {rounded}
            </span>

            {/* Delta — colour-coded by direction */}
            <span
              className={`text-[11px] font-semibold shrink-0 ${deltaClass}`}
              style={{ width: 28, textAlign: 'right' }}
            >
              {delta !== null && delta !== 0
                ? `${delta > 0 ? '+' : ''}${delta}`
                : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Trend direction helpers ─────────────────────────────────────

function trendArrow(dir: string): string {
  if (dir === 'up') return '↑';
  if (dir === 'down') return '↓';
  return '→';
}

function trendWord(dir: string): string {
  if (dir === 'up') return 'Climbing';
  if (dir === 'down') return 'Sliding';
  return 'Stable';
}

// ── Main Component ───────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const analytics = await getDashboardAnalytics().catch(() => null);
        if (!cancelled) setData(analytics);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div>
          <p className="text-[13px] text-journal-text-muted">Your progress</p>
          <h1 className="text-2xl font-bold text-journal-text">Dashboard</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-journal-text-muted">
              Start journaling to see your dashboard come alive.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const hasDomains = Object.keys(data.current_domains).length > 0;
  const isEmpty = data.daily_scores.length === 0 && !hasDomains && data.impact_factors.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 pb-8 space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <p className="text-[13px] text-journal-text-muted">Your progress</p>
        <h1 className="text-2xl font-bold text-journal-text">Dashboard</h1>
      </div>

      {/* ── Headline Metrics — square color-block cards ──────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Floor — terracotta bg */}
        <div
          className="rounded-card p-4 flex flex-col justify-between"
          style={{ backgroundColor: colors.accent, aspectRatio: '1' }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/70">Floor</p>
          <p className="text-[50px] font-bold text-white leading-none">
            {data.floor !== null ? data.floor.toFixed(1) : '—'}
          </p>
          <p className="text-[12px] text-white/70">
            {data.floor_start !== null ? `up from ${data.floor_start.toFixed(1)}` : '14-day low'}
          </p>
        </div>

        {/* Trend — olive bg, arrow + word */}
        <div
          className="rounded-card p-4 flex flex-col justify-between"
          style={{ backgroundColor: colors.positive, aspectRatio: '1' }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/70">Trend</p>
          <p className="text-[50px] font-bold text-white leading-none">
            {trendArrow(data.trend_direction)}
          </p>
          <div>
            <p className="text-[12px] font-medium text-white/90">
              {trendWord(data.trend_direction)}
            </p>
            {data.trend_avg !== null && (
              <p className="text-[10px] text-white/60 mt-0.5">
                7-day avg: {data.trend_avg.toFixed(1)}
              </p>
            )}
          </div>
        </div>

        {/* Streak — white bg with border */}
        <div
          className="rounded-card p-4 flex flex-col justify-between bg-journal-surface"
          style={{ border: `1px solid ${colors.border}`, aspectRatio: '1' }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wider text-journal-text-muted">Streak</p>
          <p className={`text-[50px] font-bold leading-none ${data.best_streak > 0 ? 'text-journal-accent' : 'text-journal-text-muted'}`}>
            {data.best_streak}
          </p>
          <p className="text-[12px] text-journal-text-muted">
            {data.best_streak === 1 ? 'day' : 'days'}
            {data.streak_threshold !== null ? ` above ${data.streak_threshold}` : ''}
          </p>
        </div>
      </div>

      {/* ── 30-Day Trend Chart ──────────────────────────────── */}
      <Card>
        <div className="mb-3">
          <p className="text-[12px] font-semibold text-journal-text-secondary">
            30-day trend
          </p>
          <p className="text-[11px] text-journal-text-muted mt-0.5">
            Daily scores with weekly average
          </p>
        </div>
        <TrendChart scores={data.daily_scores} />
      </Card>

      {/* ── Impact Bars ─────────────────────────────────────── */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-secondary mb-3">
          What Impacts Your Score
        </p>
        <ImpactBars factors={data.impact_factors} />
      </Card>

      {/* ── Life Domains ────────────────────────────────────── */}
      {hasDomains && (
        <Card>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-secondary mb-3">
            Life Domains
          </p>
          <DomainBars current={data.current_domains} previous={data.previous_domains} />
        </Card>
      )}

      {/* ── Weekly Insight ──────────────────────────────────── */}
      {data.weekly_insight && (
        <Card variant="muted">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent mb-2">
            Weekly Insight
          </p>
          <p className="text-[14px] font-semibold text-journal-text mb-1.5">
            {data.weekly_insight.headline}
          </p>
          <p className="text-[13px] text-journal-text leading-relaxed whitespace-pre-line">
            {data.weekly_insight.body}
          </p>
        </Card>
      )}

      {/* ── Based on N entries ──────────────────────────────── */}
      {data.entry_count > 0 && (
        <p className="text-[10px] text-journal-text-muted text-center">
          Based on {data.entry_count} entries
        </p>
      )}

      {/* Empty state */}
      {isEmpty && (
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
