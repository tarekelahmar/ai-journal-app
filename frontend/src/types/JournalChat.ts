/**
 * Journal V3 Chat types.
 */

export interface SessionSummary {
  id: number;
  started_at: string;
  daily_score: number | null;
  message_count: number;
  preview: string;
  summary: string | null;
  messages?: SessionMessage[];
}

export interface SessionMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/** A message as displayed in the UI (may include streaming state) */
export interface ChatMessageData {
  id: number | null; // null while streaming
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  isStreaming?: boolean;
  /** Actions extracted from this assistant response (set on SSE done) */
  extractedActions?: ExtractedAction[];
}

/** Grouped messages under a session divider */
export interface SessionGroup {
  session_id: number;
  started_at: string;
  daily_score: number | null;
  score_confirmed: boolean;
  messages: ChatMessageData[];
}

export interface ScoreConfirmResult {
  confirmed: boolean;
  score: number;
  date: string;
}

/** Action extracted by the analysis LLM from conversation */
export type ExtractedAction = {
  text: string;
  action_type: 'habit' | 'completable';
  domain: string;
  confidence: number;
};

/** SSE event types from the chat endpoint */
export type SSETokenEvent = {
  type: 'token';
  content: string;
};

export type SSEDoneEvent = {
  type: 'done';
  session_id: number;
  message_id: number;
  proposed_score?: number;
  domain_checkin_due?: boolean;
  extracted_factors?: Record<string, any>;
  extracted_actions?: ExtractedAction[];
};

export type SSEEvent = SSETokenEvent | SSEDoneEvent;
