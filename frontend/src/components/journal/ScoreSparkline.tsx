/**
 * ScoreSparkline — Compact SVG sparkline for daily scores (1-10).
 * Warm palette: olive/sage line, trend direction + 7-day average.
 */
import React from 'react';
import { colors } from '../../theme';
import type { DailyScore } from '../../api/dailyScores';

interface ScoreSparklineProps {
  scores: DailyScore[];
  days?: number;
}

const HEIGHT = 48;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const DOT_RADIUS = 3;
const CHART_WIDTH = 200;

function trendInfo(scores: DailyScore[]): { label: string; color: string } | null {
  if (scores.length < 3) return null;
  const recent = scores.slice(-3);
  const older = scores.slice(-6, -3);
  if (older.length === 0) return null;

  const recentAvg = recent.reduce((s, d) => s + d.score, 0) / recent.length;
  const olderAvg = older.reduce((s, d) => s + d.score, 0) / older.length;
  const diff = recentAvg - olderAvg;

  if (diff > 0.3) return { label: 'Trending up', color: colors.positive };
  if (diff < -0.3) return { label: 'Trending down', color: colors.negative };
  return { label: 'Holding steady', color: colors.textMuted };
}

export function ScoreSparkline({ scores, days = 7 }: ScoreSparklineProps) {
  const data = scores.slice(-days);
  const trend = trendInfo(scores);
  const avg = data.length > 0
    ? (data.reduce((s, d) => s + d.score, 0) / data.length).toFixed(1)
    : null;

  if (data.length === 0) {
    return (
      <div className="bg-journal-surface rounded-card px-4 py-3 flex items-center justify-center">
        <p className="text-[11px] text-journal-text-muted">
          Your trend will appear after a few entries
        </p>
      </div>
    );
  }

  // Scale y-axis to actual data range with 1-point padding, clamped 1-10
  const rawScores = data.map((d) => d.score);
  const rawMin = Math.min(...rawScores);
  const rawMax = Math.max(...rawScores);
  // Ensure minimum 2-point range so identical scores sit in the middle
  let yMin = Math.max(1, rawMin - 1);
  let yMax = Math.min(10, rawMax + 1);
  if (yMax - yMin < 2) {
    const mid = (rawMin + rawMax) / 2;
    yMin = Math.max(1, mid - 1);
    yMax = Math.min(10, mid + 1);
  }

  const plotWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const toY = (score: number) => {
    const ratio = (score - yMin) / (yMax - yMin);
    return PAD_TOP + plotHeight - ratio * plotHeight;
  };
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const toX = (i: number) => PAD_LEFT + i * xStep;

  const points = data.map((d, i) => `${toX(i)},${toY(d.score)}`).join(' ');
  const lastIdx = data.length - 1;

  return (
    <div className="bg-journal-surface rounded-card px-4 py-3 flex items-center gap-4">
      {/* SVG sparkline */}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: HEIGHT }}
        >
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={colors.positive}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End dot */}
          <circle
            cx={toX(lastIdx)}
            cy={toY(data[lastIdx].score)}
            r={DOT_RADIUS + 1}
            fill={colors.positive}
          />
        </svg>
      </div>

      {/* Trend text */}
      <div className="shrink-0 text-right">
        {trend && (
          <p className="text-[12px] font-semibold" style={{ color: trend.color }}>
            {trend.color === colors.positive ? '\u2191' : trend.color === colors.negative ? '\u2193' : '\u2192'}{' '}
            {trend.label}
          </p>
        )}
        {avg && (
          <p className="text-[11px] text-journal-text-muted mt-0.5">
            7-day avg: {avg}
          </p>
        )}
      </div>
    </div>
  );
}
