/**
 * Actions API client — framework-aligned (March 2026).
 */
import apiClient from './client';
import type { Action, ActionMilestone, HabitLog } from '../types/Action';

// ── Action CRUD ─────────────────────────────────────────────────

export async function createAction(data: {
  title: string;
  description?: string;
  action_type: 'habit' | 'completable';
  source?: string;
  primary_domain?: string;
  target_frequency?: number;
  difficulty?: number;
}): Promise<Action> {
  const res = await apiClient.post('/actions', data);
  return res.data;
}

export async function listActions(params?: {
  status?: string;
  domain?: string;
}): Promise<Action[]> {
  const res = await apiClient.get('/actions', { params });
  return res.data;
}

export async function getAction(actionId: number): Promise<Action> {
  const res = await apiClient.get(`/actions/${actionId}`);
  return res.data;
}

export async function updateAction(
  actionId: number,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    primary_domain: string;
    target_frequency: number;
    difficulty: number;
    sort_order: number;
  }>,
): Promise<Action> {
  const res = await apiClient.patch(`/actions/${actionId}`, data);
  return res.data;
}

export async function deleteAction(actionId: number): Promise<void> {
  await apiClient.delete(`/actions/${actionId}`);
}

// ── Milestones ──────────────────────────────────────────────────

export async function createMilestone(
  actionId: number,
  data: { title: string; sort_order?: number },
): Promise<ActionMilestone> {
  const res = await apiClient.post(`/actions/${actionId}/milestones`, data);
  return res.data;
}

export async function listMilestones(actionId: number): Promise<ActionMilestone[]> {
  const res = await apiClient.get(`/actions/${actionId}/milestones`);
  return res.data;
}

export async function toggleMilestone(
  actionId: number,
  milestoneId: number,
): Promise<ActionMilestone> {
  const res = await apiClient.patch(`/actions/${actionId}/milestones/${milestoneId}`);
  return res.data;
}

export async function deleteMilestone(actionId: number, milestoneId: number): Promise<void> {
  await apiClient.delete(`/actions/${actionId}/milestones/${milestoneId}`);
}

// ── Habit Logs ──────────────────────────────────────────────────

export async function logHabit(
  actionId: number,
  data: { log_date: string; completed?: boolean },
): Promise<HabitLog> {
  const res = await apiClient.post(`/actions/${actionId}/logs`, data);
  return res.data;
}

export async function getHabitLogs(
  actionId: number,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  const res = await apiClient.get(`/actions/${actionId}/logs`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
}
