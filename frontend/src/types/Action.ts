/**
 * Action types — framework-aligned (March 2026).
 *
 * Actions are things users commit to doing, linked to life domains.
 * Two types: "habit" (ongoing) and "completable" (has a finish line).
 */

export type ActionType = 'habit' | 'completable';
export type ActionStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type ActionSource = 'journal_extraction' | 'ai_suggestion' | 'user_created';

export interface Action {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  action_type: ActionType;
  status: ActionStatus;
  source: ActionSource;
  primary_domain: string | null;
  target_frequency: number | null;
  difficulty: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActionMilestone {
  id: number;
  action_id: number;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface HabitLog {
  id: number;
  action_id: number;
  user_id: number;
  log_date: string;
  completed: boolean;
  created_at: string;
}
