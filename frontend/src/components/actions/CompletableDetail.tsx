/**
 * Completable Detail View — Track 3c Task 5
 *
 * Sections:
 *   1. Title + domain/source metadata
 *   2. Status card (days since created, mention count, "Mark done" button)
 *   3. AI observation (template)
 *   4. Milestones with vertical connecting line
 *   5. Journal mentions timeline
 */
import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { listMilestones, toggleMilestone, updateAction } from '../../api/actions';
import { getSessions } from '../../api/journalChat';
import type { Action, ActionMilestone } from '../../types/Action';
import type { SessionSummary } from '../../types/JournalChat';

// ── Helpers ──────────────────────────────────────────────────────

function domainLabel(domain: string | null): string {
  if (!domain) return '';
  const labels: Record<string, string> = {
    career: 'Career', relationship: 'Relationship', family: 'Family',
    health: 'Health', finance: 'Finance', social: 'Social', purpose: 'Purpose',
  };
  return labels[domain] || domain;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'journal_extraction': return 'Extracted from journal';
    case 'ai_suggestion': return 'AI suggested';
    case 'user_created': return 'Created by you';
    default: return source;
  }
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatSessionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Status Card ──────────────────────────────────────────────────

function StatusCard({
  action,
  mentionCount,
  onMarkDone,
  marking,
}: {
  action: Action;
  mentionCount: number;
  onMarkDone: () => void;
  marking: boolean;
}) {
  const days = daysSince(action.created_at);
  const isCompleted = action.status === 'completed';
  const isOverdue = days > 14 && !isCompleted;

  return (
    <Card variant={isOverdue ? 'negative' : isCompleted ? 'positive' : 'default'}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-journal-text-muted mb-1">Status</p>
          <p className={`text-[14px] font-semibold ${
            isCompleted ? 'text-journal-positive' : isOverdue ? 'text-journal-negative' : 'text-journal-text'
          }`}>
            {isCompleted
              ? 'Completed'
              : isOverdue
                ? `${days} days — overdue`
                : `${days} day${days !== 1 ? 's' : ''} ago`}
          </p>
          <p className="text-[11px] text-journal-text-muted mt-0.5">
            {mentionCount} journal mention{mentionCount !== 1 ? 's' : ''}
          </p>
        </div>
        {!isCompleted && (
          <button
            onClick={onMarkDone}
            disabled={marking}
            className="shrink-0 text-[12px] font-medium px-4 py-1.5 rounded-full bg-journal-positive text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {marking ? '...' : 'Mark done'}
          </button>
        )}
        {isCompleted && (
          <span className="text-xl text-journal-positive">✓</span>
        )}
      </div>
    </Card>
  );
}

// ── Milestones ───────────────────────────────────────────────────

function MilestonesList({
  milestones,
  actionId,
  onToggle,
}: {
  milestones: ActionMilestone[];
  actionId: number;
  onToggle: (ms: ActionMilestone) => void;
}) {
  if (milestones.length === 0) return null;

  return (
    <Card>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
        Milestones
      </p>
      <div className="relative ml-3">
        {/* Vertical connecting line */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-journal-border" />

        <div className="space-y-3">
          {milestones.map((ms) => (
            <button
              key={ms.id}
              onClick={() => onToggle(ms)}
              className="flex items-start gap-3 w-full text-left group"
            >
              {/* Dot */}
              <div className={`relative z-10 mt-0.5 w-[11px] h-[11px] rounded-full border-2 shrink-0 transition-colors ${
                ms.is_completed
                  ? 'bg-journal-positive border-journal-positive'
                  : 'bg-white border-journal-border group-hover:border-journal-accent'
              }`}>
                {ms.is_completed && (
                  <svg className="w-full h-full text-white" viewBox="0 0 12 12">
                    <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] leading-snug ${
                  ms.is_completed
                    ? 'text-journal-text-secondary line-through'
                    : 'text-journal-text'
                }`}>
                  {ms.title}
                </p>
                {ms.completed_at && (
                  <p className="text-[10px] text-journal-text-muted mt-0.5">
                    {new Date(ms.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Journal Mentions Timeline ────────────────────────────────────

function MentionsTimeline({
  sessions,
  actionTitle,
}: {
  sessions: SessionSummary[];
  actionTitle: string;
}) {
  // Filter sessions whose preview or summary mentions the action title (case-insensitive)
  const needle = actionTitle.toLowerCase();
  const mentions = sessions.filter(
    (s) =>
      s.preview.toLowerCase().includes(needle) ||
      (s.summary && s.summary.toLowerCase().includes(needle)),
  );

  if (mentions.length === 0) return null;

  return (
    <Card>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-text-muted mb-3">
        Journal Mentions
      </p>
      <div className="space-y-2.5">
        {mentions.slice(0, 5).map((session) => (
          <div key={session.id} className="border-l-2 border-journal-border-light pl-3">
            <p className="text-[10px] text-journal-text-muted">
              {formatSessionDate(session.started_at)}
            </p>
            <p className="text-[12px] text-journal-text-secondary leading-snug mt-0.5 line-clamp-2">
              {session.preview}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────

interface CompletableDetailProps {
  action: Action;
  onStatusChange: (updated: Action) => void;
}

export function CompletableDetail({ action, onStatusChange }: CompletableDetailProps) {
  const [milestones, setMilestones] = useState<ActionMilestone[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [msData, sessionsData] = await Promise.all([
          listMilestones(action.id).catch(() => []),
          getSessions(60).catch(() => []),
        ]);
        if (!cancelled) {
          setMilestones(msData);
          setSessions(sessionsData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [action.id]);

  const handleMarkDone = async () => {
    setMarking(true);
    try {
      const updated = await updateAction(action.id, { status: 'completed' });
      onStatusChange(updated);
    } catch (err) {
      console.error('Failed to mark action done:', err);
    } finally {
      setMarking(false);
    }
  };

  const handleToggleMilestone = async (ms: ActionMilestone) => {
    try {
      const updated = await toggleMilestone(action.id, ms.id);
      setMilestones((prev) =>
        prev.map((m) => (m.id === ms.id ? updated : m)),
      );
    } catch (err) {
      console.error('Failed to toggle milestone:', err);
    }
  };

  // Count mentions
  const needle = action.title.toLowerCase();
  const mentionCount = sessions.filter(
    (s) =>
      s.preview.toLowerCase().includes(needle) ||
      (s.summary && s.summary.toLowerCase().includes(needle)),
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const days = daysSince(action.created_at);
  const isCompleted = action.status === 'completed';

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-journal-text">{action.title}</h2>
        <p className="text-[12px] text-journal-text-muted mt-0.5">
          {domainLabel(action.primary_domain)}
          {action.primary_domain ? ' · ' : ''}
          {sourceLabel(action.source)}
          {' · '}
          Created {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Status card */}
      <StatusCard
        action={action}
        mentionCount={mentionCount}
        onMarkDone={handleMarkDone}
        marking={marking}
      />

      {/* AI observation */}
      <Card variant="muted">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-journal-accent mb-2">
          Observation
        </p>
        <p className="text-[13px] text-journal-text leading-relaxed">
          {isCompleted
            ? `You completed this action. Well done! It was active for ${days} day${days !== 1 ? 's' : ''}.`
            : days > 14
              ? `This has been open for ${days} days. Consider whether it's still relevant, or break it into smaller steps.`
              : mentionCount > 2
                ? `You've mentioned this ${mentionCount} times in your journal. It seems to be on your mind — is there a blocker?`
                : `This action was created ${days} day${days !== 1 ? 's' : ''} ago. ${mentionCount > 0 ? `You've referenced it ${mentionCount} time${mentionCount !== 1 ? 's' : ''} in your journal.` : 'No journal mentions yet.'}`}
        </p>
      </Card>

      {/* Milestones */}
      <MilestonesList
        milestones={milestones}
        actionId={action.id}
        onToggle={handleToggleMilestone}
      />

      {/* Journal mentions */}
      <MentionsTimeline sessions={sessions} actionTitle={action.title} />
    </div>
  );
}
