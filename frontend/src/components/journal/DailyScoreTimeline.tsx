/**
 * DailyScoreTimeline — D3 area chart for daily scores (1-10 scale).
 *
 * Adapted from WellnessTimeline (0-100 scale).
 * Shows last 7 day circles, key metrics, 30-day D3 trend, milestone markers,
 * and phase bands.
 *
 * Score zones:
 *   >= 7   green  (#22c55e / emerald-500)
 *   >= 5   amber  (#f59e0b)
 *   <  5   red    (#ef4444)
 */
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Card } from '../ui/Card';
import type { DailyScore } from '../../api/dailyScores';
import type { MilestoneData, PhaseData } from '../../api/milestones';

interface DailyScoreTimelineProps {
  scores: DailyScore[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  milestones?: MilestoneData[];
  phases?: PhaseData[];
}

function scoreColor(score: number): string {
  if (score >= 7) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500 text-white';
  if (score >= 6) return 'bg-amber-500 text-white';
  if (score >= 4) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
}

/** Compute 7-day moving average. */
function movingAverage(data: { date: string; score: number }[], window: number = 7) {
  return data.map((d, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((sum, s) => sum + s.score, 0) / slice.length;
    return { date: d.date, score: avg };
  });
}

/** Compute key metrics from score data. */
function computeMetrics(scores: DailyScore[]) {
  if (scores.length === 0) return null;
  const vals = scores.map((s) => s.score);
  const current = vals[vals.length - 1];
  const recent7 = vals.slice(-7);
  const avg7 = recent7.reduce((a, b) => a + b, 0) / recent7.length;
  const avg30 = vals.reduce((a, b) => a + b, 0) / vals.length;
  const floor = Math.min(...vals);
  const ceiling = Math.max(...vals);
  const mean = avg30;
  const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length;
  const volatility = Math.sqrt(variance);

  // Trend: compare recent 7 vs previous 7
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (vals.length >= 14) {
    const r7 = vals.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const p7 = vals.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    if (r7 - p7 > 0.5) trend = 'up';
    else if (p7 - r7 > 0.5) trend = 'down';
  }

  return { current, avg7, avg30, floor, ceiling, volatility, trend };
}

const MILESTONE_ICONS: Record<string, string> = {
  score_streak: '\u{1F525}',
  recovery: '\u{1F4AA}',
  pattern_confirmed: '\u{1F50D}',
  consistency: '\u{1F3AF}',
  domain_improvement: '\u{2B50}',
};

const PHASE_COLORS: Record<string, string> = {
  CRISIS: 'rgba(239,68,68,0.08)',
  STABILIZING: 'rgba(245,158,11,0.06)',
  BUILDING: 'rgba(59,130,246,0.06)',
  STABLE: 'rgba(16,185,129,0.06)',
  GROWING: 'rgba(139,92,246,0.08)',
};

export function DailyScoreTimeline({
  scores,
  selectedDate,
  onDateSelect,
  milestones = [],
  phases = [],
}: DailyScoreTimelineProps) {
  const chartRef = useRef<SVGSVGElement>(null);
  // scores are sorted oldest→newest; take last 7 for circles
  const recent = scores.slice(-7);
  const metrics = computeMetrics(scores);

  // D3 area chart for 30-day trend
  useEffect(() => {
    if (!chartRef.current || scores.length <= 1) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const width = chartRef.current.clientWidth || 320;
    const height = 120;
    const margin = { top: 8, right: 8, bottom: 20, left: 30 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Data is already sorted oldest→newest; take last 30
    const data = scores.slice(-30);

    const maData = movingAverage(data);

    const x = d3
      .scalePoint()
      .domain(data.map((d) => d.date))
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([1, 10]).range([innerH, 0]);

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Phase bands (behind everything)
    if (phases.length > 0) {
      for (const p of phases) {
        const color = PHASE_COLORS[p.phase];
        if (!color) continue;
        const phaseDates = data.filter(
          (d) => d.date >= p.week_start && d.date <= p.week_end,
        );
        if (phaseDates.length === 0) continue;
        const xStart = x(phaseDates[0].date)!;
        const xEnd = x(phaseDates[phaseDates.length - 1].date)!;
        const step =
          data.length > 1 ? x(data[1].date)! - x(data[0].date)! : 0;
        g.append('rect')
          .attr('x', Math.max(0, xStart - step / 2))
          .attr('y', 0)
          .attr('width', Math.min(innerW, xEnd - xStart + step))
          .attr('height', innerH)
          .attr('fill', color);
      }
    }

    // Zone tinting bands
    const y10 = y(10);
    const y7 = y(7);
    const y5 = y(5);
    const y1 = y(1);
    g.append('rect').attr('x', 0).attr('y', y10).attr('width', innerW).attr('height', y7 - y10).attr('fill', '#22c55e').attr('opacity', 0.03);
    g.append('rect').attr('x', 0).attr('y', y7).attr('width', innerW).attr('height', y5 - y7).attr('fill', '#f59e0b').attr('opacity', 0.03);
    g.append('rect').attr('x', 0).attr('y', y5).attr('width', innerW).attr('height', y1 - y5).attr('fill', '#ef4444').attr('opacity', 0.03);

    // Area fill
    const area = d3
      .area<{ date: string; score: number }>()
      .x((d) => x(d.date)!)
      .y0(innerH)
      .y1((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', '#6366f1')
      .attr('fill-opacity', 0.1);

    // Score line
    const line = d3
      .line<{ date: string; score: number }>()
      .x((d) => x(d.date)!)
      .y((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4);

    // 7-day MA line
    g.append('path')
      .datum(maData)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2);

    // Score dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.date)!)
      .attr('cy', (d) => y(d.score))
      .attr('r', 3)
      .attr('fill', (d) => scoreColor(d.score))
      .attr('stroke', 'white')
      .attr('stroke-width', 1);

    // Milestone markers on x-axis
    if (milestones.length > 0) {
      const chartDates = new Set(data.map((d) => d.date));
      const chartMilestones = milestones.filter((m) =>
        chartDates.has(m.detected_date),
      );
      g.selectAll('.milestone-marker')
        .data(chartMilestones)
        .enter()
        .append('text')
        .attr('x', (m) => x(m.detected_date)!)
        .attr('y', innerH + 1)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('dominant-baseline', 'auto')
        .text(
          (m) => MILESTONE_ICONS[m.milestone_type] || '\u{2728}',
        );
    }

    // X axis (every 7th date)
    const xAxis = d3
      .axisBottom(x)
      .tickValues(data.filter((_d, i) => i % 7 === 0).map((d) => d.date));
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('fill', '#9ca3af')
      .text((d) => formatDate(d as string));

    // Y axis (1-10 scale)
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .tickValues([1, 5, 10])
          .tickFormat((d) => `${d}`),
      )
      .selectAll('text')
      .attr('font-size', '9px')
      .attr('fill', '#9ca3af');

    // Remove axis lines
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').attr('stroke', '#f3f4f6');
  }, [scores, milestones, phases]);

  if (recent.length === 0) return null;

  return (
    <Card>
      {/* Last 7 day circles */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Last 7 Days</h3>
      <div className="flex items-end justify-between gap-1">
        {recent.map((ds) => {
          const isSelected = ds.date === selectedDate;
          const display =
            ds.score % 1 === 0 ? ds.score.toFixed(0) : ds.score.toFixed(1);
          return (
            <button
              key={ds.date}
              onClick={() => onDateSelect(ds.date)}
              className={`flex flex-col items-center flex-1 min-w-0 p-1 rounded-lg transition-colors ${
                isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-[10px] text-gray-400 mb-1">
                {formatDay(ds.date)}
              </span>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${getScoreColor(ds.score)} ${
                  isSelected ? 'ring-2 ring-primary-500 ring-offset-1' : ''
                }`}
              >
                {display}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">
                {formatDate(ds.date)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Key metrics */}
      {metrics && (
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-400">7d avg</div>
            <div className="text-sm font-semibold text-gray-700">
              {metrics.avg7.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">30d avg</div>
            <div className="text-sm font-semibold text-gray-700">
              {metrics.avg30.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Floor</div>
            <div className="text-sm font-semibold text-gray-700">
              {metrics.floor.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Trend</div>
            <div className="text-sm font-semibold">
              {metrics.trend === 'up' && (
                <span className="text-emerald-500">{'\u2191'}</span>
              )}
              {metrics.trend === 'down' && (
                <span className="text-red-500">{'\u2193'}</span>
              )}
              {metrics.trend === 'stable' && (
                <span className="text-gray-400">{'\u2192'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* D3 area chart for 30-day trend */}
      {scores.length > 7 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs text-gray-500">30-Day Trend</h4>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t-2 border-indigo-500" />
              <span className="text-[9px] text-gray-400">7d avg</span>
            </span>
          </div>
          <svg ref={chartRef} className="w-full" style={{ height: 120 }} />
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <h4 className="text-xs text-gray-500 mb-2">Milestones</h4>
          <div className="space-y-1.5">
            {milestones.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <span className="text-sm">
                  {MILESTONE_ICONS[m.milestone_type] || '\u{2728}'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700">{m.description}</div>
                  <div className="text-[10px] text-gray-400">
                    {m.detected_date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
