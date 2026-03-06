/**
 * Analytics API client — Track 5 Task 7.
 *
 * Single endpoint replacing 5+ parallel dashboard calls.
 */
import apiClient from './client';

export interface ImpactFactor {
  label: string;
  impact_percentage: number;
  direction: 'positive' | 'negative';
  effect_size: number;
}

export interface WeeklyInsight {
  headline: string;
  body: string;
  date_range: string;
}

export interface DashboardAnalytics {
  // Headline metrics
  floor: number | null;
  floor_start: number | null;
  trend_direction: 'up' | 'down' | 'stable';
  trend_avg: number | null;
  best_streak: number;
  streak_threshold: number | null;

  // Scores
  daily_scores: Array<{ date: string; score: number }>;

  // Impact factors
  impact_factors: ImpactFactor[];

  // Life domains
  current_domains: Record<string, number>;
  previous_domains: Record<string, number> | null;

  // Weekly insight
  weekly_insight: WeeklyInsight | null;

  // Actions summary
  habit_count: number;
  completable_count: number;
  completed_count: number;

  entry_count: number;
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const res = await apiClient.get('/analytics/dashboard');
  return res.data;
}
