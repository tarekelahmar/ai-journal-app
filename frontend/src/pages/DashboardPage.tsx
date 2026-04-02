/**
 * Dashboard Screen — Visual refresh with terracotta gradient hero.
 *
 * Sections:
 *   1. Terracotta gradient block: header, inline metrics, avg score + toggle, bezier chart
 *   2. Curved SVG transition to cream
 *   3. Content cards: This Week nav, Impact bars, Life domains, Weekly insight
 */
import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardAnalytics, type DashboardAnalytics, type ImpactFactor } from '../api/analytics';
import { colors, LIFE_DIMENSIONS } from '../theme';

// ── Helpers ──────────────────────────────────────────────────────

function domainBarColor(score: number): string {
  if (score >= 6) return colors.positive;
  if (score > 3) return colors.amber;
  return colors.negative;
}

function trendArrow(dir: string): string {
  if (dir === 'up') return '↑';
  if (dir === 'down') return '↓';
  return '→';
}

function trendWord(dir: string): string {
  if (dir === 'up') return 'climbing';
  if (dir === 'down') return 'sliding';
  return 'stable';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Bezier curve generation ─────────────────────────────────────

/** Convert data points to smooth SVG cubic bezier path (catmull-rom) */
function toBezierPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
  if (points.length === 2) {
    const [x1, y1] = points[0];
    const [x2, y2] = points[1];
    const mx = (x1 + x2) / 2;
    return `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }

  let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }

  return d;
}

// ── Week helpers ────────────────────────────────────────────────

/** Get Monday and Sunday dates for a given week offset (0 = current week) */
function getWeekRange(offset: number): { monday: Date; sunday: Date } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

/** Map scores to day-of-week slots (0=Mon to 6=Sun) */
function scoresToWeekSlots(
  scores: Array<{ date: string; score: number }>,
  mondayStr: string,
  sundayStr: string,
): (number | null)[] {
  const slots: (number | null)[] = [null, null, null, null, null, null, null];
  for (const s of scores) {
    if (s.date < mondayStr || s.date > sundayStr) continue;
    const d = new Date(s.date + 'T12:00:00');
    let dow = d.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // 0=Mon
    slots[dow] = s.score;
  }
  return slots;
}

// ── Chart coordinate helpers ────────────────────────────────────

const CW = 400;
const CH = 140;
const CHART_PAD_X = 30;
const CHART_TOP = 10;
const CHART_BOTTOM = 108;
const LABEL_Y = 132;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function chartX(dayIndex: number): number {
  return CHART_PAD_X + dayIndex * ((CW - 2 * CHART_PAD_X) / 6);
}

function chartY(score: number): number {
  return CHART_TOP + (CHART_BOTTOM - CHART_TOP) * (1 - (score - 1) / 9);
}

/** Build [x,y] points from week slots, skipping nulls */
function slotsToPoints(slots: (number | null)[]): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null) {
      pts.push([chartX(i), chartY(slots[i]!)]);
    }
  }
  return pts;
}

// ── Impact Bars (kept) ──────────────────────────────────────────

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
              <div className="relative" style={{ height: 18 }}>
                <div
                  className="absolute rounded-full bg-journal-surface-alt"
                  style={{ top: 4, bottom: 4, left: 0, right: 0 }}
                />
                <div
                  className={`absolute rounded-full ${isPositive ? 'bg-journal-positive' : 'bg-journal-negative'}`}
                  style={{
                    top: 4,
                    bottom: 4,
                    left: isPositive ? '50%' : `${50 - pct}%`,
                    width: `${pct}%`,
                  }}
                />
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

// ── Domain Bars (kept) ──────────────────────────────────────────

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

        const deltaClass =
          delta !== null && delta > 0
            ? 'text-journal-positive'
            : delta !== null && delta < 0
              ? 'text-journal-negative'
              : 'text-journal-text-muted';

        return (
          <div key={dim.key} className="flex items-center" style={{ gap: 10 }}>
            <span className="text-[12px] text-journal-text-secondary shrink-0" style={{ width: 80 }}>
              {dim.shortLabel}
            </span>
            <div className="flex-1 h-2.5 bg-journal-surface-alt rounded-full overflow-hidden min-w-0">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: domainBarColor(score),
                }}
              />
            </div>
            <span
              className="text-[16px] font-bold text-journal-text shrink-0"
              style={{ width: 20, textAlign: 'right' }}
            >
              {rounded}
            </span>
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

// ── Main Component ──────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);

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


  // ── Derive chart data from scores + period ───────────────────
  const chartData = useMemo(() => {
    if (!data || data.daily_scores.length === 0) return null;

    const sorted = [...data.daily_scores].sort((a, b) => a.date.localeCompare(b.date));

    if (period === 'weekly') {
      const { monday, sunday } = getWeekRange(weekOffset);
      const mondayStr = dateToStr(monday);
      const sundayStr = dateToStr(sunday);

      const { monday: prevMon, sunday: prevSun } = getWeekRange(weekOffset - 1);
      const prevMonStr = dateToStr(prevMon);
      const prevSunStr = dateToStr(prevSun);

      const currentSlots = scoresToWeekSlots(sorted, mondayStr, sundayStr);
      const previousSlots = scoresToWeekSlots(sorted, prevMonStr, prevSunStr);

      const currentVals = currentSlots.filter((s): s is number => s !== null);
      const previousVals = previousSlots.filter((s): s is number => s !== null);

      const avg = currentVals.length > 0
        ? currentVals.reduce((a, b) => a + b, 0) / currentVals.length
        : null;
      const prevAvg = previousVals.length > 0
        ? previousVals.reduce((a, b) => a + b, 0) / previousVals.length
        : null;

      return {
        currentPoints: slotsToPoints(currentSlots),
        previousPoints: slotsToPoints(previousSlots),
        avg,
        delta: avg !== null && prevAvg !== null ? avg - prevAvg : null,
      };
    } else {
      // Monthly: last 30 days as current, previous 30 as ghost
      const today = new Date();
      const thirtyAgo = new Date(today);
      thirtyAgo.setDate(today.getDate() - 30);
      const sixtyAgo = new Date(today);
      sixtyAgo.setDate(today.getDate() - 60);

      const thirtyStr = dateToStr(thirtyAgo);
      const sixtyStr = dateToStr(sixtyAgo);

      const currentScores = sorted.filter((s) => s.date >= thirtyStr);
      const previousScores = sorted.filter((s) => s.date >= sixtyStr && s.date < thirtyStr);

      // Map to 7 evenly spaced points for consistent chart rendering
      const mapToSlots = (scores: Array<{ date: string; score: number }>): (number | null)[] => {
        if (scores.length === 0) return [null, null, null, null, null, null, null];
        const slots: (number | null)[] = [];
        const step = Math.max(1, scores.length / 7);
        for (let i = 0; i < 7; i++) {
          const idx = Math.min(Math.round(i * step), scores.length - 1);
          slots.push(scores[idx].score);
        }
        return slots;
      };

      const currentSlots = mapToSlots(currentScores);
      const previousSlots = mapToSlots(previousScores);

      const currentVals = currentScores.map((s) => s.score);
      const previousVals = previousScores.map((s) => s.score);

      const avg = currentVals.length > 0
        ? currentVals.reduce((a, b) => a + b, 0) / currentVals.length
        : null;
      const prevAvg = previousVals.length > 0
        ? previousVals.reduce((a, b) => a + b, 0) / previousVals.length
        : null;

      return {
        currentPoints: slotsToPoints(currentSlots),
        previousPoints: slotsToPoints(previousSlots),
        avg,
        delta: avg !== null && prevAvg !== null ? avg - prevAvg : null,
      };
    }
  }, [data, period, weekOffset]);

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── No data state ─────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div>
          <p style={{ fontSize: 13, color: colors.textMuted }}>Your progress</p>
          <h1 className="text-2xl font-bold text-journal-text">Dashboard</h1>
        </div>
        <div style={{ background: 'white', borderRadius: 22, padding: 20 }}>
          <div className="text-center py-8">
            <p className="text-sm text-journal-text-muted">
              Start journaling to see your dashboard come alive.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasDomains = Object.keys(data.current_domains).length > 0;
  const isEmpty = data.daily_scores.length === 0 && !hasDomains && data.impact_factors.length === 0;
  const { monday: currentMonday, sunday: currentSunday } = getWeekRange(weekOffset);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ═══════════════════════════════════════════════════════════
          TERRACOTTA GRADIENT BLOCK
          ═══════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: 'linear-gradient(180deg, #C4704B 0%, #D4896A 70%, #D99A7A 100%)',
          position: 'relative',
          paddingBottom: 40,
        }}
      >
        {/* ── Header + Metrics + Avg (padded content) ──────────── */}
        <div style={{ padding: '24px 24px 0' }}>
          {/* Header */}
          <p style={{ fontSize: 13, color: 'white', opacity: 0.7, fontWeight: 500, marginBottom: 2 }}>
            Your progress
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', margin: '0 0 24px' }}>
            Dashboard
          </h1>

          {/* ── Inline Metrics ──────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            {/* Floor */}
            <div>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'white', opacity: 0.55, fontWeight: 600, marginBottom: 4 }}>
                Floor
              </p>
              <p style={{ fontSize: 36, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {data.floor !== null ? data.floor.toFixed(1) : '—'}
              </p>
              <p style={{ fontSize: 11, color: 'white', opacity: 0.5 }}>
                {data.floor_start !== null ? `from ${data.floor_start.toFixed(1)}` : '14-day low'}
              </p>
            </div>

            {/* Trend */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'white', opacity: 0.55, fontWeight: 600, marginBottom: 4 }}>
                Trend
              </p>
              <p style={{ fontSize: 36, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {trendArrow(data.trend_direction)}
              </p>
              <p style={{ fontSize: 11, color: 'white', opacity: 0.5 }}>
                {trendWord(data.trend_direction)}
              </p>
            </div>

            {/* Streak */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'white', opacity: 0.55, fontWeight: 600, marginBottom: 4 }}>
                Streak
              </p>
              <p style={{ fontSize: 36, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {data.best_streak}
              </p>
              <p style={{ fontSize: 11, color: 'white', opacity: 0.5 }}>
                {data.best_streak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />

          {/* ── Average Score + Period Toggle ───────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3 }}>
                Average Score{' '}
                {chartData?.delta != null && (
                  <span style={{ color: chartData.delta >= 0 ? '#B8E6B0' : '#FFB0A0', fontWeight: 700, opacity: 1 }}>
                    {chartData.delta >= 0 ? '▲' : '▼'} {Math.abs(chartData.delta).toFixed(1)}
                  </span>
                )}
              </p>
              <p style={{ fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1, marginTop: 4 }}>
                {chartData?.avg != null ? chartData.avg.toFixed(1) : '—'}
              </p>
            </div>

            {/* Toggle pill */}
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: 3,
                display: 'flex',
              }}
            >
              {(['weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setWeekOffset(0); }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: period === p ? '#FFFFFF' : 'transparent',
                    color: period === p ? '#C4704B' : 'rgba(255,255,255,0.65)',
                    transition: 'all 0.2s',
                  }}
                >
                  {p === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chart SVG (full width, no horizontal padding) ─────── */}
        {chartData && chartData.currentPoints.length >= 2 ? (
          <>
            <svg
              width="100%"
              viewBox={`0 0 ${CW} ${CH}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
            >
              {/* (a) Weekly average dashed line */}
              {chartData.avg != null && (
                <>
                  <line
                    x1={0}
                    y1={chartY(chartData.avg)}
                    x2={CW}
                    y2={chartY(chartData.avg)}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                  <text
                    x={CW - 8}
                    y={chartY(chartData.avg) - 6}
                    textAnchor="end"
                    fontSize={8}
                    fill="rgba(255,255,255,0.3)"
                  >
                    avg {chartData.avg.toFixed(1)}
                  </text>
                </>
              )}

              {/* (b) Previous period bezier (ghost, dashed) */}
              {chartData.previousPoints.length >= 2 && (
                <path
                  d={toBezierPath(chartData.previousPoints)}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1.5}
                  strokeDasharray="6,5"
                  strokeLinecap="round"
                />
              )}

              {/* (c) Current period bezier (thick white) */}
              <path
                d={toBezierPath(chartData.currentPoints)}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* (d) Current position dot with glow ring */}
              {(() => {
                const lastPt = chartData.currentPoints[chartData.currentPoints.length - 1];
                return (
                  <>
                    <circle cx={lastPt[0]} cy={lastPt[1]} r={16} fill="rgba(255,255,255,0.12)" />
                    <circle cx={lastPt[0]} cy={lastPt[1]} r={8} fill="#FFFFFF" />
                  </>
                );
              })()}

              {/* (e) Day labels */}
              {DAY_LABELS.map((label, i) => (
                <text
                  key={i}
                  x={chartX(i)}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fontSize={10}
                  fill="rgba(255,255,255,0.3)"
                >
                  {label}
                </text>
              ))}
            </svg>

            {/* (f) Legend */}
            <div style={{ display: 'flex', gap: 16, padding: '8px 24px 4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                current
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                previous
              </span>
            </div>
          </>
        ) : (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            Need more data points for chart
          </div>
        )}

        {/* ── Curved bottom edge ────────────────────────────────── */}
        <svg
          viewBox="0 0 400 48"
          preserveAspectRatio="none"
          style={{
            display: 'block',
            width: '100%',
            height: 48,
            position: 'absolute',
            bottom: -1,
            left: 0,
          }}
        >
          <path d="M0,48 L0,0 Q200,40 400,0 L400,48 Z" fill="#FAF8F5" />
        </svg>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CONTENT BELOW CURVE (cream background)
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '0 16px 32px' }}>
        <div className="space-y-4">

          {/* ── This Week navigation card ───────────────────────── */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 2px 12px rgba(42,37,32,0.04)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.text }}>
                {period === 'weekly' ? 'This Week' : 'This Month'}
              </p>
              <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {fmtDate(currentMonday)} — {fmtDate(currentSunday)}
              </p>
            </div>
            {period === 'weekly' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: '#F5F0EB',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: colors.textSecondary,
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={() => { if (weekOffset < 0) setWeekOffset(weekOffset + 1); }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: '#F5F0EB',
                    border: 'none',
                    cursor: weekOffset >= 0 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: colors.textSecondary,
                    opacity: weekOffset >= 0 ? 0.4 : 1,
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* ── Impact Bars card ─────────────────────────────────── */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 22,
              boxShadow: '0 4px 20px rgba(42,37,32,0.04)',
              padding: 20,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
              What impacts your score
            </p>
            <p style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
              Based on {data.entry_count} entries
            </p>
            <ImpactBars factors={data.impact_factors} />
          </div>

          {/* ── Life Domains card ────────────────────────────────── */}
          {hasDomains && (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 22,
                boxShadow: '0 4px 20px rgba(42,37,32,0.04)',
                padding: 20,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 16 }}>
                Life domains
              </p>
              <DomainBars current={data.current_domains} previous={data.previous_domains} />
            </div>
          )}

          {/* ── Weekly Insight card ──────────────────────────────── */}
          {data.weekly_insight && (
            <div
              style={{
                background: '#EDE6DC',
                borderRadius: 22,
                borderLeft: '4px solid #B8A48C',
                padding: 20,
              }}
            >
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#B8A48C', fontWeight: 600, marginBottom: 10 }}>
                Weekly Insight · {data.weekly_insight.date_range}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: colors.text, lineHeight: '1.35', marginBottom: 8 }}>
                {data.weekly_insight.headline}
              </p>
              <p style={{ fontSize: 13, color: colors.textSecondary, lineHeight: '1.55', whiteSpace: 'pre-line' }}>
                {data.weekly_insight.body}
              </p>
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────── */}
          {isEmpty && (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 22,
                boxShadow: '0 4px 20px rgba(42,37,32,0.04)',
                padding: 20,
              }}
            >
              <div className="text-center py-8">
                <p className="text-sm text-journal-text-muted">
                  Start journaling to see your dashboard come alive.
                </p>
                <p className="text-xs text-journal-text-muted mt-1">
                  Log daily scores and chat to build your personal insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
