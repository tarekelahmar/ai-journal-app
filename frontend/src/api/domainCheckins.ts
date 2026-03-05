/**
 * Domain Check-ins API client.
 *
 * Framework alignment (March 2026): 7 life dimensions.
 */
import apiClient from './client';

export interface DomainCheckinStatus {
  due: boolean;
  last_checkin_date: string | null;
  days_since: number | null;
}

export interface DomainCheckinSubmit {
  session_id?: number | null;
  career: number;
  relationship: number;
  family: number;
  health: number;
  finance: number;
  social: number;
  purpose: number;
}

export interface DomainCheckinResponse {
  id: number;
  checkin_date: string;
  career: number;
  relationship: number;
  family: number;
  health: number;
  finance: number;
  social: number;
  purpose: number;
}

/**
 * Check if a weekly domain check-in is due.
 */
export async function getDomainCheckinStatus(): Promise<DomainCheckinStatus> {
  const res = await apiClient.get('/domain-checkins/status');
  return res.data;
}

/**
 * Submit a weekly domain check-in.
 */
export async function submitDomainCheckin(
  data: DomainCheckinSubmit,
): Promise<DomainCheckinResponse> {
  const res = await apiClient.post('/domain-checkins', data);
  return res.data;
}

/**
 * Get domain check-in history.
 */
export async function getDomainCheckinHistory(
  weeks: number = 12,
): Promise<DomainCheckinResponse[]> {
  const res = await apiClient.get('/domain-checkins/history', { params: { weeks } });
  return res.data;
}
