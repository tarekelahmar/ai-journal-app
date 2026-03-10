/**
 * Journal V3 — Conversation screen (wireframe-aligned).
 *
 * No internal tabs — purely the conversation with the AI companion.
 * Renders inside AppShell (bottom nav provided by layout route).
 *
 * Structure (top to bottom):
 * 1. Header with date + "Journal" title + today's score badge (fixed)
 * 2. AI follow-up card (conditional — scrolls with content)
 * 3. Conversation thread (scrollable, auto-scrolls to bottom)
 * 4. Active habit pills (conditional)
 * 5. Text input area (fixed bottom)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  // Show today's score if available, otherwise show the most recent score
  const latestScore = dailyScores.length > 0 ? dailyScores[dailyScores.length - 1] : null;
  const displayScore = todayDailyScore ?? latestScore;
  const displayLabel = todayDailyScore ? 'Today' : latestScore ? 'Latest' : null;
  const scoreDisplay = displayScore
    ? displayScore.score % 1 === 0
      ? displayScore.score.toFixed(0)
      : displayScore.score.toFixed(1)
    : null;

  return (
    <div className="flex flex-col h-full bg-journal-bg">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2">
        <div>
          <p className="text-[13px] text-journal-text-muted">{formatDateHeader()}</p>
          <h1 className="text-2xl font-bold text-journal-text">Journal</h1>
        </div>
      </div>

      {/* ── Trend sparkline card with today's score ── */}
      {dailyScores.length >= 2 && (() => {
        const last7 = dailyScores.slice(-7);
        const scores = last7.map((d) => d.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Weekly change: compare last-7 avg vs previous-7 avg
        const prev7 = dailyScores.slice(-14, -7);
        const prevAvg = prev7.length > 0
          ? prev7.reduce((a, b) => a + b.score, 0) / prev7.length
          : avg;
        const weekDelta = avg - prevAvg;
        const deltaStr = (weekDelta >= 0 ? '+' : '') + weekDelta.toFixed(1);

        // Trend color: olive if rising/flat, amber if slight dip, red-ish if falling hard
        const trendColor =
          weekDelta >= 0 ? '#7A8F6B'       // olive — stable or improving
          : weekDelta >= -1 ? '#D4A24C'     // amber — slight decline
          : '#C4704B';                       // terracotta — notable decline

        // Build sparkline SVG path
        const W = 100;
        const H = 36;
        const pad = 2;
        const minS = Math.min(...scores);
        const maxS = Math.max(...scores);
        const range = maxS - minS || 1;
        const pts = scores.map((s, i) => {
          const x = pad + (i / Math.max(scores.length - 1, 1)) * (W - pad * 2);
          const y = H - pad - ((s - minS) / range) * (H - pad * 2);
          return `${x},${y}`;
        });
        const polyline = pts.join(' ');

        // End dot position
        const lastX = pad + ((scores.length - 1) / Math.max(scores.length - 1, 1)) * (W - pad * 2);
        const lastY = H - pad - ((scores[scores.length - 1] - minS) / range) * (H - pad * 2);

        return (
          <div className="px-4 pb-2">
            <div
              className="flex items-center rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4E0' }}
            >
              {/* Sparkline + trend stats */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke={trendColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={lastX} cy={lastY} r="3" fill={trendColor} />
                </svg>
                <div>
                  <p className="text-sm font-semibold" style={{ color: trendColor }}>
                    {deltaStr} this week
                  </p>
                  <p className="text-xs" style={{ color: '#9B9B9B' }}>
                    7-day avg: {avg.toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Score display (today or latest) — taps to /score */}
              {scoreDisplay && displayScore && (
                <>
                  <div className="mx-3 self-stretch" style={{ width: 1, backgroundColor: '#E8E4E0' }} />
                  <button
                    onClick={() => navigate('/score')}
                    className="text-center pl-1 cursor-pointer active:opacity-60 transition-opacity"
                  >
                    <p className="text-[10px] font-medium" style={{ color: '#9B9B9B' }}>{displayLabel}</p>
                    <p
                      className="text-[26px] font-bold leading-tight tabular-nums"
                      style={{ color: scoreColor(displayScore.score) }}
                    >
                      {scoreDisplay}
                    </p>
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Scrollable content: follow-up + conversation ── */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <ChatThread
          sessionGroups={sessionGroups}
          headerContent={
            overdueCompletable ? (
              <div className="pb-3">
                <FollowUpCard action={overdueCompletable} />
              </div>
            ) : undefined
          }
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
