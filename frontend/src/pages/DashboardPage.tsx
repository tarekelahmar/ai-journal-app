/**
 * Dashboard Screen — Track 5 rewrite.
 *
 * Now uses a single GET /api/v1/analytics/dashboard endpoint instead of
 * 5+ parallel API calls. All metrics computed server-side.
 *
 * Sections (top → bottom):
 *   1. Header with date
 *   2. Headline metrics row (Floor · Trend · Streak)
 *   3. 30-day SVG area trend chart
 *   4. Impact bars (Whoop-style, centre-divided, showing impact_percentage)
 *   5. Life-domain horizontal bars with deltas
 *   6. AI weekly insight card (headline + body)
 */
import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { getDashboardAnalytics, type DashboardAnalytics, type ImpactFactor } from '../api/analytics';
import { scoreColor, scoreTextClass, colors } from '../theme';
import { LIFE_DIMENSIONS } from '../theme';

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Trend Chart (SVG area) ───────────────────────────────────────

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
  const pad = { top: 12, right: 8, bottom: 20, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  const xScale = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - 1) / 9) * innerH;

  const linePoints = sorted.map((s, i) => `${xScale(i)},${yScale(s.score)}`).join(' ');

  const areaPath = [
    `M ${xScale(0)},${yScale(sorted[0].score)}`,
    ...sorted.slice(1).map((s, i) => `L ${xScale(i + 1)},${yScale(s.score)}`),
    `L ${xScale(n - 1)},${pad.top + innerH}`,
    `L ${xScale(0)},${pad.top + innerH}`,
    'Z',
  ].join(' ');

  const yTicks = [2, 4, 6, 8, 10];

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
      {yTicks.map((v) => (
        <line key={v} x1={pad.left} y1={yScale(v)} x2={W - pad.right} y2={yScale(v)} stroke={colors.borderLight} strokeWidth={0.5} />
      ))}
      {yTicks.map((v) => (
        <text key={v} x={pad.left - 6} y={yScale(v) + 3} textAnchor="end" fontSize="8" fill={colors.textMuted}>{v}</text>
      ))}
      <path d={areaPath} fill={colors.positive} fillOpacity={0.12} />
      <polyline points={linePoints} fill="none" stroke={colors.positive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((s, i) => (
        <circle key={s.date} cx={xScale(i)} cy={yScale(s.score)} r={2.5} fill={scoreColor(s.score)} stroke="white" strokeWidth={1} />
      ))}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="8" fill={colors.textMuted}>{label}</text>
      ))}
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
        <h1 className="text-xl font-bold text-journal-text">Dashboard</h1>
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

  const trendIcon = data.trend_direction === 'up' ? '↑' : data.trend_direction === 'down' ? '↓' : '→';
  const trendColor = data.trend_direction === 'up'
    ? 'text-journal-positive'
    : data.trend_direction === 'down'
      ? 'text-journal-negative'
      : 'text-journal-amber';

  const hasDomains = Object.keys(data.current_domains).length > 0;
  const isEmpty = data.daily_scores.length === 0 && !hasDomains && data.impact_factors.length === 0;

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
        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Floor</p>
            <p className={`text-2xl font-bold ${data.floor !== null ? scoreTextClass(data.floor) : 'text-journal-text-muted'}`}>
              {data.floor !== null ? data.floor.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">
              {data.floor_start !== null ? `up from ${data.floor_start.toFixed(1)}` : '14-day low'}
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Trend</p>
            <p className={`text-2xl font-bold ${data.trend_avg !== null ? trendColor : 'text-journal-text-muted'}`}>
              {data.trend_avg !== null ? data.trend_avg.toFixed(1) : '—'}
            </p>
            <p className={`text-[10px] mt-0.5 ${data.trend_avg !== null ? trendColor : 'text-journal-text-muted'}`}>
              {data.trend_avg !== null ? `${trendIcon} 7-day avg` : 'No data'}
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Streak</p>
            <p className={`text-2xl font-bold ${data.best_streak > 0 ? 'text-journal-accent' : 'text-journal-text-muted'}`}>
              {data.best_streak}
            </p>
            <p className="text-[10px] text-journal-text-muted mt-0.5">
              {data.best_streak === 1 ? 'day' : 'days'}
              {data.streak_threshold !== null ? ` above ${data.streak_threshold}` : ''}
            </p>
          </div>
        </Card>
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
