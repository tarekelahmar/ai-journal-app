/**
 * Journal V3 Chat API client.
 *
 * Uses fetch() with ReadableStream for SSE (NOT EventSource — doesn't support POST).
 * All other endpoints use the standard apiClient.
 */
import apiClient from './client';
import type {
  SessionSummary,
  SessionMessage,
  ScoreConfirmResult,
  SSEEvent,
  ExtractedAction,
} from '../types/JournalChat';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Send a message and handle the SSE stream.
 * Returns an AbortController so the caller can cancel the stream.
 */
export function sendMessage(
  message: string,
  sessionId: number | undefined,
  onToken: (token: string) => void,
  onDone: (data: {
    session_id: number;
    message_id: number;
    proposed_score?: number;
    domain_checkin_due?: boolean;
    extracted_factors?: Record<string, any>;
    extracted_actions?: ExtractedAction[];
  }) => void,
  onError: (error: Error) => void,
): AbortController {
  const controller = new AbortController();

  const userId = localStorage.getItem('user_id') || '1';
  const authMode = import.meta.env.VITE_AUTH_MODE || 'public';

  const url = `${API_BASE}/api/v1/journal/chat${authMode === 'public' ? `?user_id=${userId}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authMode !== 'public') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const body = JSON.stringify({
    message,
    session_id: sessionId ?? null,
  });

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody.detail) {
            detail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
          }
        } catch { /* ignore parse errors */ }
        throw new Error(detail);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              if (event.type === 'token') {
                onToken(event.content);
              } else if (event.type === 'done') {
                receivedDone = true;
                onDone({
                  session_id: event.session_id,
                  message_id: event.message_id,
                  proposed_score: event.proposed_score,
                  domain_checkin_due: event.domain_checkin_due,
                  extracted_factors: event.extracted_factors,
                  extracted_actions: event.extracted_actions,
                });
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      // If the stream ended without a proper 'done' event, treat as error
      if (!receivedDone) {
        throw new Error('Stream ended unexpectedly. The message may have been too long to process.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    }
  })();

  return controller;
}

/**
 * Confirm the daily score for a session.
 */
export async function confirmDailyScore(
  sessionId: number,
  score: number,
): Promise<ScoreConfirmResult> {
  const res = await apiClient.post('/journal/chat/score', {
    session_id: sessionId,
    score,
  });
  return res.data;
}

/**
 * Get recent sessions for the user.
 * @param includeMessages Include messages for the N most recent sessions (avoids N+1).
 */
export async function getSessions(
  days: number = 30,
  includeMessages: number = 0,
): Promise<SessionSummary[]> {
  const res = await apiClient.get('/journal/sessions', {
    params: { days, include_messages: includeMessages },
  });
  return res.data;
}

/**
 * Get all messages for a session.
 */
export async function getSessionMessages(
  sessionId: number,
): Promise<SessionMessage[]> {
  const res = await apiClient.get(`/journal/sessions/${sessionId}/messages`);
  return res.data;
}
