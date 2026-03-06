/**
 * Journal V3 — Conversation screen (wireframe-aligned).
 *
 * No internal tabs — purely the conversation with the AI companion.
 * Renders inside AppShell (bottom nav provided by layout route).
 *
 * Structure (top to bottom):
 * 1. Header with date + "Journal" title + today's score badge
 * 2. Mini trend sparkline (7-day)
 * 3. AI follow-up card (conditional — when overdue completable actions exist)
 * 4. Conversation thread (scrollable)
 * 5. Active habit pills (conditional)
 * 6. Text input area (fixed bottom)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScoreSparkline } from '../components/journal/ScoreSparkline';
import { ChatThread } from '../components/journal/ChatThread';
import { ChatInput } from '../components/journal/ChatInput';
import { DailyScoreCard } from '../components/journal/DailyScoreCard';
import { FollowUpCard } from '../components/journal/FollowUpCard';
import { CommittedActionPill } from '../components/journal/CommittedActionPill';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getDailyScores } from '../api/dailyScores';
import { listActions } from '../api/actions';
import { scoreColor } from '../theme';
import {
  sendMessage,
  confirmDailyScore,
  getSessions,
} from '../api/journalChat';
import type { DailyScore } from '../api/dailyScores';
import type { Action } from '../types/Action';
import type { SessionGroup, ChatMessageData } from '../types/JournalChat';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateHeader(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function JournalPage() {
  const [loading, setLoading] = useState(true);

  // Chat state
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Score confirmation state
  const [scoreStates, setScoreStates] = useState<
    Record<number, { proposed: number; confirmed: boolean; confirming: boolean }>
  >({});

  // Daily scores for sparkline + header badge
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
  const todayDailyScore = dailyScores.find((s) => s.date === todayISO());

  // Active actions
  const [activeActions, setActiveActions] = useState<Action[]>([]);
  const activeHabits = activeActions.filter((a) => a.action_type === 'habit');
  const overdueCompletable = activeActions.find(
    (a) => a.action_type === 'completable' && a.status === 'active',
  );

  // ── Load initial data ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsRes, dailyScoresRes, actionsRes] = await Promise.allSettled([
        getSessions(30, 50),
        getDailyScores(14),
        listActions({ status: 'active' }),
      ]);

      // Build session groups
      if (sessionsRes.status === 'fulfilled') {
        const sessions = sessionsRes.value;
        const groups: SessionGroup[] = [];

        for (const s of sessions) {
          const msgs = s.messages ?? [];
          groups.push({
            session_id: s.id,
            started_at: s.started_at,
            daily_score: s.daily_score,
            score_confirmed: s.daily_score !== null,
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              created_at: m.created_at,
            })),
          });

          // Track score state for sessions with confirmed scores
          if (s.daily_score !== null) {
            setScoreStates((prev) => ({
              ...prev,
              [s.id]: { proposed: s.daily_score!, confirmed: true, confirming: false },
            }));
          }

          // Track the most recent session
          if (groups.length === 1) {
            setCurrentSessionId(s.id);
          }
        }

        // Reverse so oldest is first (sessions come newest-first from API)
        setSessionGroups(groups.reverse());
      }

      if (dailyScoresRes.status === 'fulfilled') {
        setDailyScores(dailyScoresRes.value);
      }

      if (actionsRes.status === 'fulfilled') {
        setActiveActions(actionsRes.value);
      }
    } catch (err) {
      console.error('Failed to load journal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Send message ───────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    setIsStreaming(true);

    // Optimistically add user message
    const userMsg: ChatMessageData = {
      id: null,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    // Streaming placeholder for assistant
    const streamingMsg: ChatMessageData = {
      id: null,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
    };

    setSessionGroups((prev) => {
      const groups = [...prev];
      if (groups.length > 0 && groups[groups.length - 1].session_id === currentSessionId) {
        const last = { ...groups[groups.length - 1] };
        last.messages = [...last.messages, userMsg, streamingMsg];
        groups[groups.length - 1] = last;
      } else {
        groups.push({
          session_id: currentSessionId ?? -1,
          started_at: new Date().toISOString(),
          daily_score: null,
          score_confirmed: false,
          messages: [userMsg, streamingMsg],
        });
      }
      return groups;
    });

    // Start SSE stream
    const controller = sendMessage(
      text,
      currentSessionId,
      // onToken
      (token) => {
        setSessionGroups((prev) => {
          const groups = [...prev];
          const lastGroup = { ...groups[groups.length - 1] };
          const msgs = [...lastGroup.messages];
          const lastMsg = { ...msgs[msgs.length - 1] };
          lastMsg.content += token;
          msgs[msgs.length - 1] = lastMsg;
          lastGroup.messages = msgs;
          groups[groups.length - 1] = lastGroup;
          return groups;
        });
      },
      // onDone
      (data) => {
        setIsStreaming(false);
        setCurrentSessionId(data.session_id);

        // Finalize the streaming message
        setSessionGroups((prev) => {
          const groups = [...prev];
          const lastGroup = { ...groups[groups.length - 1] };

          // Update session_id if temporary
          lastGroup.session_id = data.session_id;

          const msgs = [...lastGroup.messages];
          const lastMsg = { ...msgs[msgs.length - 1] };
          lastMsg.id = data.message_id;
          lastMsg.isStreaming = false;

          // Attach extracted actions to this assistant message
          if (data.extracted_actions && data.extracted_actions.length > 0) {
            lastMsg.extractedActions = data.extracted_actions;
          }

          msgs[msgs.length - 1] = lastMsg;
          lastGroup.messages = msgs;
          groups[groups.length - 1] = lastGroup;

          // Score proposal
          if (data.proposed_score != null && !scoreStates[data.session_id]?.confirmed) {
            setScoreStates((ss) => ({
              ...ss,
              [data.session_id]: { proposed: data.proposed_score!, confirmed: false, confirming: false },
            }));
          }

          return groups;
        });
      },
      // onError
      (error) => {
        setIsStreaming(false);
        console.error('Chat stream error:', error);

        setSessionGroups((prev) => {
          const groups = [...prev];
          const lastGroup = { ...groups[groups.length - 1] };
          const msgs = [...lastGroup.messages];
          const lastMsg = { ...msgs[msgs.length - 1] };
          lastMsg.content = lastMsg.content || 'Failed to get a response. Please try again.';
          lastMsg.isStreaming = false;
          msgs[msgs.length - 1] = lastMsg;
          lastGroup.messages = msgs;
          groups[groups.length - 1] = lastGroup;
          return groups;
        });
      },
    );

    abortRef.current = controller;
  }, [inputText, isStreaming, currentSessionId, scoreStates]);

  // ── Score confirmation ─────────────────────────────────────────

  const handleScoreConfirm = useCallback(
    async (sessionId: number, score: number) => {
      setScoreStates((prev) => ({
        ...prev,
        [sessionId]: { ...prev[sessionId], confirming: true },
      }));

      try {
        await confirmDailyScore(sessionId, score);

        setScoreStates((prev) => ({
          ...prev,
          [sessionId]: { proposed: score, confirmed: true, confirming: false },
        }));

        setSessionGroups((prev) =>
          prev.map((g) =>
            g.session_id === sessionId
              ? { ...g, daily_score: score, score_confirmed: true }
              : g,
          ),
        );

        // Refresh daily scores
        try {
          const scores = await getDailyScores(14);
          setDailyScores(scores);
        } catch {
          // Non-fatal
        }
      } catch (err) {
        console.error('Score confirmation failed:', err);
        setScoreStates((prev) => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], confirming: false },
        }));
      }
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const todayScoreDisplay = todayDailyScore
    ? todayDailyScore.score % 1 === 0
      ? todayDailyScore.score.toFixed(0)
      : todayDailyScore.score.toFixed(1)
    : null;

  return (
    <div className="flex flex-col h-full bg-journal-bg">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-journal-text-muted">{formatDateHeader()}</p>
            <h1 className="text-2xl font-bold text-journal-text">Journal</h1>
          </div>
          {todayScoreDisplay && (
            <div className="bg-journal-surface border border-journal-border rounded-xl px-3 py-1.5 text-center">
              <p className="text-[10px] text-journal-text-muted leading-none">Today</p>
              <p
                className="text-[26px] font-bold leading-tight tabular-nums"
                style={{ color: scoreColor(todayDailyScore!.score) }}
              >
                {todayScoreDisplay}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mini trend sparkline ── */}
      <div className="px-4 pb-2">
        <ScoreSparkline scores={dailyScores} days={7} />
      </div>

      {/* ── AI follow-up card (conditional) ── */}
      {overdueCompletable && (
        <div className="px-4 pb-2">
          <FollowUpCard action={overdueCompletable} />
        </div>
      )}

      {/* ── Conversation thread (scrollable) ── */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <ChatThread
          sessionGroups={sessionGroups}
          renderScoreCard={(sessionId) => {
            const state = scoreStates[sessionId];
            if (!state) return null;

            return (
              <DailyScoreCard
                key={`score-${sessionId}`}
                proposedScore={state.proposed}
                confirmed={state.confirmed}
                onConfirm={(score) => handleScoreConfirm(sessionId, score)}
                confirming={state.confirming}
              />
            );
          }}
        />

        {/* Active habit pills */}
        {activeHabits.length > 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-2">
            {activeHabits.slice(0, 2).map((habit) => (
              <CommittedActionPill key={habit.id} action={habit} />
            ))}
          </div>
        )}
      </div>

      {/* ── Text input ── */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        disabled={isStreaming}
      />
    </div>
  );
}
