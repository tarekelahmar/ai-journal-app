/**
 * Actions List Screen — Track 3c Task 2
 *
 * Sections:
 *   1. Header
 *   2. Summary cards row (Habits · To complete · Done)
 *   3. Habits section — consistency bars, score impact, 3px positive left border
 *   4. Completables section — status badges (overdue / in-progress / not-started)
 *   5. Completed section — collapsible
 *
 * Each action card navigates to /actions/:id
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { listActions, getHabitLogs } from '../api/actions';
import type { Action, HabitLog } from '../types/Action';
import { scoreTextClass } from '../theme';

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

function statusBadge(action: Action): { label: string; className: string } {
  const days = daysSince(action.created_at);
  if (days > 14) {
    return { label: 'Overdue', className: 'bg-journal-negative-light text-journal-negative' };
  }
  if (days > 3) {
    return { label: 'In progress', className: 'bg-journal-amber-light text-journal-amber' };
  }
  return { label: 'Not started', className: 'bg-journal-surface-alt text-journal-text-muted' };
}

// ── Summary Cards ────────────────────────────────────────────────

function SummaryCards({
  habitCount,
  completableCount,
  doneCount,
}: {
  habitCount: number;
  completableCount: number;
  doneCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <div className="text-center">
          <p className="text-2xl font-bold text-journal-positive">{habitCount}</p>
          <p className="text-[10px] text-journal-text-muted uppercase tracking-wider mt-0.5">Habits</p>
        </div>
      </Card>
      <Card>
        <div className="text-center">
          <p className="text-2xl font-bold text-journal-accent">{completableCount}</p>
          <p className="text-[10px] text-journal-text-muted uppercase tracking-wider mt-0.5">To complete</p>
        </div>
      </Card>
      <Card>
        <div className="text-center">
          <p className="text-2xl font-bold text-journal-text-muted">{doneCount}</p>
          <p className="text-[10px] text-journal-text-muted uppercase tracking-wider mt-0.5">Done</p>
        </div>
      </Card>
    </div>
  );
}

// ── Habit Row ────────────────────────────────────────────────────

function HabitRow({
  action,
  consistency,
  onClick,
}: {
  action: Action;
  consistency: number; // 0-100
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3.5 border-l-[3px] border-journal-positive"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-journal-text leading-snug truncate">
            {action.title}
          </p>
          <p className="text-[11px] text-journal-text-muted mt-0.5">
            {domainLabel(action.primary_domain)}
            {action.primary_domain ? ' · ' : ''}
            {sourceLabel(action.source)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-[13px] font-semibold ${scoreTextClass(consistency / 10)}`}>
            {consistency}%
          </p>
          <p className="text-[10px] text-journal-text-muted">consistency</p>
        </div>
      </div>
      {/* Consistency bar */}
      <div className="mt-2 h-1.5 bg-journal-surface-alt rounded-full overflow-hidden">
        <div
          className="h-full bg-journal-positive rounded-full transition-all duration-500"
          style={{ width: `${Math.max(consistency, 2)}%` }}
        />
      </div>
    </button>
  );
}

// ── Completable Row ──────────────────────────────────────────────

function CompletableRow({
  action,
  milestoneCount,
  onClick,
}: {
  action: Action;
  milestoneCount?: number;
  onClick: () => void;
}) {
  const badge = statusBadge(action);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-journal-text leading-snug truncate">
            {action.title}
          </p>
          <p className="text-[11px] text-journal-text-muted mt-0.5">
            {domainLabel(action.primary_domain)}
            {action.primary_domain ? ' · ' : ''}
            {sourceLabel(action.source)}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {milestoneCount !== undefined && milestoneCount > 0 && (
            <span className="text-[10px] text-journal-text-muted">
              {milestoneCount} milestone{milestoneCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Completed Row ────────────────────────────────────────────────

function CompletedRow({ action, onClick }: { action: Action; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card bg-white p-3 opacity-60"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-journal-text-secondary line-through truncate">
            {action.title}
          </p>
          <p className="text-[10px] text-journal-text-muted mt-0.5">
            {domainLabel(action.primary_domain)} · Completed
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-journal-positive font-medium">✓</span>
      </div>
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function ActionsPage() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<Action[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<number, HabitLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allActions = await listActions().catch(() => [] as Action[]);
        if (cancelled) return;
        setActions(allActions);

        // Fetch habit logs for each active habit (last 30 days)
        const habits = allActions.filter((a) => a.action_type === 'habit' && a.status === 'active');
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

        const logEntries = await Promise.all(
          habits.map(async (h) => {
            const logs = await getHabitLogs(h.id, start, end).catch(() => []);
            return [h.id, logs] as const;
          }),
        );

        if (cancelled) return;
        const logsMap: Record<number, HabitLog[]> = {};
        logEntries.forEach(([id, logs]) => { logsMap[id] = logs; });
        setHabitLogs(logsMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Categorize actions
  const { activeHabits, activeCompletables, completed } = useMemo(() => {
    const activeHabits = actions.filter((a) => a.action_type === 'habit' && a.status === 'active');
    const activeCompletables = actions.filter((a) => a.action_type === 'completable' && a.status === 'active');
    const completed = actions.filter((a) => a.status === 'completed');
    return { activeHabits, activeCompletables, completed };
  }, [actions]);

  // Compute consistency % for a habit (completed days / 30)
  const getConsistency = (actionId: number): number => {
    const logs = habitLogs[actionId] || [];
    const completedDays = logs.filter((l) => l.completed).length;
    return Math.round((completedDays / 30) * 100);
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
      <h1 className="text-xl font-bold text-journal-text">Actions</h1>

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
          {/* Summary cards */}
          <SummaryCards
            habitCount={activeHabits.length}
            completableCount={activeCompletables.length}
            doneCount={completed.length}
          />

          {/* ── Habits Section ──────────────────────────────── */}
          {activeHabits.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-2.5">
                Habits
              </p>
              <div className="space-y-2">
                {activeHabits.map((action) => (
                  <HabitRow
                    key={action.id}
                    action={action}
                    consistency={getConsistency(action.id)}
                    onClick={() => navigate(`/actions/${action.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Completables Section ────────────────────────── */}
          {activeCompletables.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-2.5">
                To Complete
              </p>
              <div className="space-y-2">
                {activeCompletables.map((action) => (
                  <CompletableRow
                    key={action.id}
                    action={action}
                    onClick={() => navigate(`/actions/${action.id}`)}
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
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-2.5"
              >
                <span
                  className="transition-transform duration-200"
                  style={{ transform: showCompleted ? 'rotate(90deg)' : 'rotate(0)' }}
                >
                  ▶
                </span>
                Completed ({completed.length})
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {completed.map((action) => (
                    <CompletedRow
                      key={action.id}
                      action={action}
                      onClick={() => navigate(`/actions/${action.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
