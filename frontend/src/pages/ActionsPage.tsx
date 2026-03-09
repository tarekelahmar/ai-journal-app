/**
 * Actions List Screen — Refinement 15 redesign
 *
 * Sections:
 *   1. Header ("Your commitments" / "Actions")
 *   2. AI Suggestion card (when qualified)
 *   3. Ongoing section — habit-type actions with domain badge, consistency, score impact
 *   4. Actions section — completable-type actions sorted by milestone progress
 *   5. Completed section — collapsible, hidden by default, with "Reopen" buttons
 *
 * No summary cards. No status badges (OVERDUE, IN PROGRESS, etc.).
 * Visual signals (left border colour, domain badge colour) communicate state.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { listActions, getHabitLogs, listMilestones, createAction, updateAction, getDomainSuggestion, dismissSuggestion } from '../api/actions';
import type { DomainSuggestion } from '../api/actions';
import type { Action, ActionMilestone, HabitLog } from '../types/Action';
import { getDailyScores, type DailyScore } from '../api/dailyScores';
import { AddActionSheet } from '../components/actions/AddActionSheet';

// ── Helpers ──────────────────────────────────────────────────────

function domainLabel(domain: string | null): string {
  if (!domain) return '';
  const labels: Record<string, string> = {
    career: 'Career',
    relationship: 'Relationship',
    family: 'Family',
    health: 'Health',
    finance: 'Finance',
    social: 'Social',
    purpose: 'Purpose',
  };
  return labels[domain] || domain;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'journal_extraction': return 'From journal';
    case 'ai_suggestion': return 'AI suggested';
    case 'user_created': return 'You created';
    default: return source;
  }
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format date as "Feb 24" */
function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Completable left-border colour by milestone state:
 * - No progress + >7 days old → negative (tension)
 * - No progress + ≤7 days → neutral border
 * - Some milestones done → accent (working on it)
 * - All milestones done → positive (almost there)
 */
function completableBorderColor(action: Action, milestones: ActionMilestone[]): string {
  const completedMs = milestones.filter((m) => m.is_completed).length;
  const totalMs = milestones.length;

  if (totalMs > 0 && completedMs === totalMs) return '#7A8F6B'; // all done — positive
  if (completedMs > 0) return '#C4704B'; // some done — accent/terracotta
  if (daysSince(action.created_at) > 7) return '#C47A6B'; // stale — negative/red
  return '#E8E3DC'; // fresh — neutral
}

/**
 * Domain badge colour for completable actions:
 * - Stale (>7 days, 0 progress) → negative tint
 * - Otherwise → accent tint
 */
function completableDomainBadge(action: Action, milestones: ActionMilestone[]): { bg: string; text: string } {
  const completedMs = milestones.filter((m) => m.is_completed).length;
  if (daysSince(action.created_at) > 7 && completedMs === 0) {
    return { bg: '#F5E6E2', text: '#C47A6B' }; // negative
  }
  return { bg: '#F5E6DD', text: '#C4704B' }; // accent
}

// ── Ongoing Row (was Habit Row) ─────────────────────────────────

function OngoingRow({
  action,
  consistency,
  completedDays,
  totalDays,
  scoreDiff,
  onClick,
}: {
  action: Action;
  consistency: number; // 0-100
  completedDays: number;
  totalDays: number;
  scoreDiff: number | null; // null = not enough data
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3.5"
      style={{ borderLeft: '3px solid #7A8F6B' }}
    >
      {/* Title row + score impact */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-journal-text leading-snug">
            {action.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {/* Domain badge (positive pill) */}
            {action.primary_domain && (
              <span
                className="text-[10px] font-semibold shrink-0"
                style={{
                  backgroundColor: '#E8EDE4',
                  color: '#7A8F6B',
                  padding: '2px 7px',
                  borderRadius: 6,
                }}
              >
                {domainLabel(action.primary_domain)}
              </span>
            )}
            <span className="text-[11px] text-journal-text-muted">
              {sourceLabel(action.source)}
            </span>
          </div>
        </div>
        {/* Score impact */}
        <div className="shrink-0 text-right">
          <p
            className="text-[16px] font-bold"
            style={{
              color: scoreDiff === null ? '#8C8278' : scoreDiff >= 0 ? '#7A8F6B' : '#C47A6B',
            }}
          >
            {scoreDiff === null
              ? '—'
              : `${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(1)}`}
          </p>
          <p className="text-[10px] text-journal-text-muted">score lift</p>
        </div>
      </div>

      {/* Consistency section — separated by thin line */}
      <div
        className="mt-3 pt-2.5"
        style={{ borderTop: '1px solid #E8E3DC' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-journal-text-secondary">Consistency</span>
          <span className="text-[11px] font-semibold text-journal-text">
            {consistency}% · {completedDays} of {totalDays} days
          </span>
        </div>
        <div className="h-1.5 bg-journal-surface-alt rounded-full overflow-hidden">
          <div
            className="h-full bg-journal-positive rounded-full transition-all duration-500"
            style={{ width: `${Math.max(consistency, 2)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ── Action Row (Completable) ────────────────────────────────────

function ActionRow({
  action,
  milestones,
  onClick,
  onMarkDone,
}: {
  action: Action;
  milestones: ActionMilestone[];
  onClick: () => void;
  onMarkDone: (e: React.MouseEvent) => void;
}) {
  const borderColor = completableBorderColor(action, milestones);
  const badge = completableDomainBadge(action, milestones);
  const completedMs = milestones.filter((m) => m.is_completed).length;
  const totalMs = milestones.length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3.5"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-journal-text leading-snug">
            {action.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {action.primary_domain && (
              <span
                className="text-[10px] font-semibold shrink-0"
                style={{
                  backgroundColor: badge.bg,
                  color: badge.text,
                  padding: '2px 7px',
                  borderRadius: 6,
                }}
              >
                {domainLabel(action.primary_domain)}
              </span>
            )}
            <span className="text-[11px] text-journal-text-muted">
              Since {fmtShortDate(action.created_at)}
            </span>
          </div>
        </div>
        {/* Mark as done button */}
        <span
          role="button"
          tabIndex={0}
          onClick={onMarkDone}
          onKeyDown={(e) => { if (e.key === 'Enter') onMarkDone(e as any); }}
          className="shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-[#E8EDE4]"
          style={{
            width: 32,
            height: 32,
            border: '2px solid #D4CFC8',
          }}
          title="Mark as done"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9B9B9B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </div>

      {/* Milestone dots */}
      {totalMs > 0 && (
        <div
          className="mt-3 pt-2.5 flex items-center gap-2"
          style={{ borderTop: '1px solid #E8E3DC' }}
        >
          <div className="flex items-center gap-1">
            {milestones.map((ms) => (
              <span
                key={ms.id}
                className="inline-block w-[7px] h-[7px] rounded-full"
                style={{
                  backgroundColor: ms.is_completed ? '#7A8F6B' : '#E8E3DC',
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-journal-text-muted">
            {completedMs} of {totalMs}
          </span>
        </div>
      )}
    </button>
  );
}

// ── Completed Row ────────────────────────────────────────────────

function CompletedRow({
  action,
  onClick,
  onReopen,
}: {
  action: Action;
  onClick: () => void;
  onReopen: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3"
      style={{ borderLeft: '3px solid #7A8F6B', opacity: 0.7 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-journal-text-secondary line-through truncate">
            {action.title}
          </p>
          <p className="text-[10px] text-journal-text-muted mt-0.5">
            {domainLabel(action.primary_domain)}
            {action.updated_at ? ` · Completed ${fmtShortDate(action.updated_at)}` : ' · Completed'}
          </p>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={onReopen}
          onKeyDown={(e) => { if (e.key === 'Enter') onReopen(e as any); }}
          className="shrink-0 text-[12px] font-medium text-journal-accent hover:underline"
        >
          Reopen
        </span>
      </div>
    </button>
  );
}

// ── Summary Cards ───────────────────────────────────────────────

function SummaryCards({
  ongoingCount,
  todoCount,
  doneCount,
}: {
  ongoingCount: number;
  todoCount: number;
  doneCount: number;
}) {
  const cards = [
    { count: ongoingCount, label: 'Ongoing', bg: '#E8EDE4', color: '#7A8F6B' },
    { count: todoCount, label: 'To do', bg: '#F5E6DD', color: '#C4704B' },
    { count: doneCount, label: 'Done', bg: '#E8E3DC', color: '#8C8278' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[14px] px-3 py-4 flex flex-col items-center justify-center"
          style={{ backgroundColor: card.bg }}
        >
          <span
            className="text-[28px] font-bold leading-none"
            style={{ color: card.color }}
          >
            {card.count}
          </span>
          <span
            className="text-[12px] font-medium mt-1.5"
            style={{ color: card.color }}
          >
            {card.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Suggestion Card ──────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onCommit,
  onDismiss,
  committing,
}: {
  suggestion: DomainSuggestion;
  onCommit: () => void;
  onDismiss: () => void;
  committing: boolean;
}) {
  return (
    <div
      className="rounded-[16px] p-5"
      style={{ backgroundColor: '#F5E6DD' }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-wider mb-3"
        style={{ color: '#C4704B' }}
      >
        Suggested action
      </p>

      <p className="text-[14px] text-journal-text leading-relaxed">
        {suggestion.evidence_text}
      </p>

      <p className="text-[16px] font-bold text-journal-text mt-3 leading-snug">
        {suggestion.suggested_action}
      </p>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={onCommit}
          disabled={committing}
          className="flex-1 text-[14px] font-semibold text-white py-2.5 rounded-[12px] transition-opacity"
          style={{ backgroundColor: '#C4704B', opacity: committing ? 0.6 : 1 }}
        >
          {committing ? 'Adding…' : 'Commit'}
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 text-[14px] font-medium py-2.5 rounded-[12px] border"
          style={{ color: '#8C8278', borderColor: '#D4CFC8', backgroundColor: 'transparent' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function ActionsPage() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<Action[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<number, HabitLog[]>>({});
  const [milestonesMap, setMilestonesMap] = useState<Record<number, ActionMilestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
  const [suggestion, setSuggestion] = useState<DomainSuggestion | null>(null);
  const [committing, setCommitting] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const fetchAllData = async (signal?: { cancelled: boolean }) => {
    try {
      const allActions = await listActions().catch(() => [] as Action[]);
      if (signal?.cancelled) return;
      setActions(allActions);

      // Fetch habit logs for each active ongoing action (last 30 days)
      const habits = allActions.filter((a) => a.action_type === 'habit' && a.status === 'active');
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

      const logEntries = await Promise.all(
        habits.map(async (h) => {
          const logs = await getHabitLogs(h.id, start, end).catch(() => []);
          return [h.id, logs] as const;
        }),
      );

      if (signal?.cancelled) return;
      const logsMap: Record<number, HabitLog[]> = {};
      logEntries.forEach(([id, logs]) => { logsMap[id] = logs; });
      setHabitLogs(logsMap);

      // Fetch daily scores for impact calculation (60 days)
      const scoresData = await getDailyScores(60).catch(() => []);
      if (!signal?.cancelled) setDailyScores(scoresData);

      // Fetch milestones for completable actions
      const completables = allActions.filter(
        (a) => a.action_type === 'completable' && (a.status === 'active' || a.status === 'completed'),
      );
      const msEntries = await Promise.all(
        completables.map(async (c) => {
          const ms = await listMilestones(c.id).catch(() => []);
          return [c.id, ms] as const;
        }),
      );
      if (signal?.cancelled) return;
      const msMap: Record<number, ActionMilestone[]> = {};
      msEntries.forEach(([id, ms]) => { msMap[id] = ms; });
      setMilestonesMap(msMap);

      // Fetch domain suggestion
      const sug = await getDomainSuggestion().catch(() => null);
      if (!signal?.cancelled) setSuggestion(sug);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    fetchAllData(signal);
    return () => { signal.cancelled = true; };
  }, []);

  const refreshActions = () => {
    fetchAllData();
  };

  // Categorize actions
  const { ongoing, activeActions, completed, sortedActions } = useMemo(() => {
    const ongoing = actions.filter((a) => a.action_type === 'habit' && a.status === 'active');
    const activeActions = actions.filter((a) => a.action_type === 'completable' && a.status === 'active');
    const completed = actions.filter((a) => a.status === 'completed');

    // Sort completable actions by milestone progress (most milestones completed first)
    const sortedActions = [...activeActions].sort((a, b) => {
      const msA = milestonesMap[a.id] || [];
      const msB = milestonesMap[b.id] || [];
      const progressA = msA.length > 0 ? msA.filter((m) => m.is_completed).length / msA.length : 0;
      const progressB = msB.length > 0 ? msB.filter((m) => m.is_completed).length / msB.length : 0;
      return progressB - progressA;
    });

    return { ongoing, activeActions, completed, sortedActions };
  }, [actions, milestonesMap]);

  // Compute consistency for an ongoing action
  const totalDays = 30;
  const getCompletedDays = (actionId: number): number => {
    const logs = habitLogs[actionId] || [];
    return logs.filter((l) => l.completed).length;
  };

  // Compute score impact for a habit: avg score on habit days vs non-habit days
  const getScoreDiff = (actionId: number): number | null => {
    const logs = habitLogs[actionId] || [];
    const logDates = new Set(logs.filter((l) => l.completed).map((l) => l.log_date));
    const withHabit = dailyScores.filter((s) => logDates.has(s.date));
    const withoutHabit = dailyScores.filter((s) => !logDates.has(s.date));
    if (withHabit.length < 2 || withoutHabit.length < 2) return null;
    const avgWith = withHabit.reduce((sum, s) => sum + s.score, 0) / withHabit.length;
    const avgWithout = withoutHabit.reduce((sum, s) => sum + s.score, 0) / withoutHabit.length;
    return avgWith - avgWithout;
  };

  // ── Handlers ───────────────────────────────────────────────────
  const handleCommitSuggestion = async () => {
    if (!suggestion || committing) return;
    setCommitting(true);
    try {
      await createAction({
        title: suggestion.suggested_action,
        action_type: suggestion.suggested_type,
        source: 'ai_suggestion',
        primary_domain: suggestion.domain,
      });
      setSuggestion(null);
      const refreshed = await listActions().catch(() => [] as Action[]);
      setActions(refreshed);
    } catch {
      // silently fail
    } finally {
      setCommitting(false);
    }
  };

  const handleReopen = async (actionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateAction(actionId, { status: 'active' });
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: 'active' } : a)),
      );
    } catch {
      // silently fail
    }
  };

  const handleMarkDone = async (actionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateAction(actionId, { status: 'completed' });
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: 'completed', updated_at: new Date().toISOString() } : a)),
      );
    } catch {
      // silently fail
    }
  };

  const handleDismissSuggestion = async () => {
    if (!suggestion) return;
    try {
      await dismissSuggestion(suggestion.domain);
    } catch {
      // silently fail
    }
    setSuggestion(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = actions.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <p className="text-[13px] text-journal-text-muted">Your commitments</p>
        <h1 className="text-2xl font-bold text-journal-text">Actions</h1>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-journal-text-muted">
              No actions yet.
            </p>
            <p className="text-xs text-journal-text-muted mt-1">
              Start journaling — actions will be extracted automatically.
            </p>
          </div>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* ── Summary Cards ────────────────────────────────── */}
          <SummaryCards
            ongoingCount={ongoing.length}
            todoCount={sortedActions.length}
            doneCount={completed.length}
          />

          {/* ── Domain Suggestion ──────────────────────────── */}
          {suggestion && (
            <SuggestionCard
              suggestion={suggestion}
              onCommit={handleCommitSuggestion}
              onDismiss={handleDismissSuggestion}
              committing={committing}
            />
          )}

          {/* ── Ongoing Section ─────────────────────────────── */}
          {ongoing.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-journal-text-muted mb-2.5">
                Ongoing
              </p>
              <div className="space-y-2">
                {ongoing.map((action) => {
                  const days = getCompletedDays(action.id);
                  const pct = Math.round((days / totalDays) * 100);
                  return (
                    <OngoingRow
                      key={action.id}
                      action={action}
                      consistency={pct}
                      completedDays={days}
                      totalDays={totalDays}
                      scoreDiff={getScoreDiff(action.id)}
                      onClick={() => navigate(`/actions/${action.id}`)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Actions Section (Completables) ──────────────── */}
          {sortedActions.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-journal-text-muted mb-2.5">
                Actions
              </p>
              <div className="space-y-2">
                {sortedActions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    milestones={milestonesMap[action.id] || []}
                    onClick={() => navigate(`/actions/${action.id}`)}
                    onMarkDone={(e) => handleMarkDone(action.id, e)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Completed Section (collapsible) ─────────────── */}
          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-journal-text-muted px-3 py-1.5 rounded-full bg-journal-surface-alt hover:bg-journal-border-light transition-colors"
              >
                <span
                  className="text-[9px] transition-transform duration-200"
                  style={{ transform: showCompleted ? 'rotate(90deg)' : 'rotate(0)' }}
                >
                  ▸
                </span>
                {completed.length} completed
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2.5">
                  {completed.map((action) => (
                    <CompletedRow
                      key={action.id}
                      action={action}
                      onClick={() => navigate(`/actions/${action.id}`)}
                      onReopen={(e) => handleReopen(action.id, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── FAB: Add Action ─────────────────────────────── */}
      {!showAddSheet && (
        <button
          onClick={() => setShowAddSheet(true)}
          className="fixed z-50 flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#C4704B',
            color: '#FFFFFF',
            bottom: 90,
            right: 'max(16px, calc((100vw - 680px) / 2 + 16px))',
            boxShadow: '0 4px 12px rgba(196,112,75,0.3)',
          }}
          aria-label="Add action"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* ── Add Action Sheet ─────────────────────────────── */}
      <AddActionSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onCreated={() => {
          setShowAddSheet(false);
          refreshActions();
        }}
      />
    </div>
  );
}
