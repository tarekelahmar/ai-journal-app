/**
 * Dashboard Screen — Track 5 rewrite.
 *
 * Now uses a single GET /api/v1/analytics/dashboard endpoint instead of
 * 5+ parallel API calls. All metrics computed server-side.
 *
 * Sections (top → bottom):
 *   1. Header ("Your progress" / "Dashboard")
 *   2. Headline metrics row (Floor · Trend · Streak) — color-block cards, left-aligned
 *   3. 30-day SVG smooth area trend chart (catmull-rom curves, terracotta)
 *   4. Impact bars (Whoop-style, centre-divided, showing impact_percentage)
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

/** Domain bar text class matching domainBarColor thresholds */
function domainTextClass(score: number): string {
  if (score >= 6) return 'text-journal-positive';
  if (score > 3) return 'text-journal-amber';
  return 'text-journal-negative';
}

// ── Data smoothing ──────────────────────────────────────────────

/** 3-point weighted moving average to soften sharp peaks in the data. */
function smoothData(
  scores: Array<{ date: string; score: number }>,
): Array<{ date: string; score: number }> {
  if (scores.length <= 2) return scores;
  return scores.map((s, i) => {
    if (i === 0 || i === scores.length - 1) return s;
    const smoothed =
      scores[i - 1].score * 0.25 + s.score * 0.5 + scores[i + 1].score * 0.25;
    return { ...s, score: smoothed };
  });
}

// ── Catmull-Rom to Cubic Bezier conversion ───────────────────────

/**
 * Convert data points into a smooth SVG cubic bezier path (Catmull-Rom).
 * Uses a relaxed divisor (4 instead of 6) for gentler, more flowing curves.
 */
function smoothLine(points: [number, number][]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
  }

  const T = 4; // Relaxed tension divisor (standard = 6, lower = rounder curves)
  const parts: string[] = [`M ${points[0][0]},${points[0][1]}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / T;
    const cp1y = p1[1] + (p2[1] - p0[1]) / T;
    const cp2x = p2[0] - (p3[0] - p1[0]) / T;
    const cp2y = p2[1] - (p3[1] - p1[1]) / T;

    parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }

  return parts.join(' ');
}

/** Like smoothLine but closes into an area fill at the bottom. */
function smoothArea(
  points: [number, number][],
  bottomY: number,
): string {
  const line = smoothLine(points);
  if (!line || points.length < 2) return '';
  const lastX = points[points.length - 1][0];
  const firstX = points[0][0];
  return `${line} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
}

// ── Trend Chart (SVG smooth area) ────────────────────────────────

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
  const smoothed = smoothData(sorted);
  const n = smoothed.length;

  const xScale = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;

  const points: [number, number][] = smoothed.map((s, i) => [xScale(i), yScale(s.score)]);
  const bottomY = pad.top + innerH;

  const linePath = smoothLine(points);
  const areaPath = smoothArea(points, bottomY);

  const yTicks = [2, 4, 6, 8, 10];

  // X-axis: start date + "Today" only
  const fmtShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const lastPt = points[n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Faint horizontal gridlines (no labels) */}
      {yTicks.map((v) => (
        <line key={v} x1={pad.left} y1={yScale(v)} x2={W - pad.right} y2={yScale(v)} stroke={colors.borderLight} strokeWidth={0.5} />
      ))}

      {/* Area fill — warm peach */}
      <path d={areaPath} fill={WARM_FILL} />

      {/* Smooth line — terracotta */}
      <path d={linePath} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

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
            <div className="relative h-2.5 bg-journal-surface-alt rounded-full overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-journal-border" />
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
                <span className={`text-[12px] font-semibold ${domainTextClass(score)}`}>
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
                  backgroundColor: domainBarColor(score),
                }}
              />
            </div>
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

      {/* ── Headline Metrics — color-block cards, left-aligned ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Floor — terracotta bg, left-aligned */}
        <div
          className="rounded-card p-4"
          style={{ backgroundColor: colors.accent }}
        >
          <p className="text-[10px] uppercase tracking-wider text-white/70 mb-1">Floor</p>
          <p className="text-2xl font-bold text-white">
            {data.floor !== null ? data.floor.toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-white/70 mt-0.5">
            {data.floor_start !== null ? `up from ${data.floor_start.toFixed(1)}` : '14-day low'}
          </p>
        </div>

        {/* Trend — olive bg, left-aligned, arrow + word */}
        <div
          className="rounded-card p-4"
          style={{ backgroundColor: colors.positive }}
        >
          <p className="text-[10px] uppercase tracking-wider text-white/70 mb-1">Trend</p>
          <p className="text-[30px] font-bold text-white leading-none">
            {trendArrow(data.trend_direction)}
          </p>
          <p className="text-[11px] font-medium text-white/90 mt-1">
            {trendWord(data.trend_direction)}
          </p>
          {data.trend_avg !== null && (
            <p className="text-[9px] text-white/60 mt-0.5">
              7-day avg: {data.trend_avg.toFixed(1)}
            </p>
          )}
        </div>

        {/* Streak — white bg with border, left-aligned */}
        <div
          className="rounded-card p-4 bg-journal-surface"
          style={{ border: `1px solid ${colors.border}` }}
        >
          <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Streak</p>
          <p className={`text-2xl font-bold ${data.best_streak > 0 ? 'text-journal-accent' : 'text-journal-text-muted'}`}>
            {data.best_streak}
          </p>
          <p className="text-[10px] text-journal-text-muted mt-0.5">
            {data.best_streak === 1 ? 'day' : 'days'}
            {data.streak_threshold !== null ? ` above ${data.streak_threshold}` : ''}
          </p>
        </div>
      </div>

      {/* ── 30-Day Trend Chart ──────────────────────────────── */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          30-Day Trend
        </p>
        <TrendChart scores={data.daily_scores} />
      </Card>

      {/* ── Impact Bars ─────────────────────────────────────── */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
          What Impacts Your Score
        </p>
        <ImpactBars factors={data.impact_factors} />
      </Card>

      {/* ── Life Domains ────────────────────────────────────── */}
      {hasDomains && (
        <Card>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
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
