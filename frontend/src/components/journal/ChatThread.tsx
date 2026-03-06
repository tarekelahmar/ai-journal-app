/**
 * Journal V3 — Chat Thread (wireframe-aligned).
 *
 * User messages: plain text with timestamp, no bubble, left-aligned.
 * AI responses: white card with 3px left border (warm secondary colour).
 * Action extraction cards: dashed-border cards below AI responses.
 * Score cards rendered inline.
 */
import React, { useEffect, useRef } from 'react';
import type { SessionGroup, ChatMessageData } from '../../types/JournalChat';
import { ActionExtractionCard } from './ActionExtractionCard';

// ── Session Divider ───────────────────────────────────────────────

function SessionDivider({ date, time }: { date: string; time: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-journal-border-light" />
      <span className="text-[11px] text-journal-text-muted font-medium tracking-wide">
        {date} &middot; {time}
      </span>
      <div className="flex-1 h-px bg-journal-border-light" />
    </div>
  );
}

// ── Timestamp ─────────────────────────────────────────────────────

function MessageTimestamp({ isoString }: { isoString: string }) {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

  let dayStr: string;
  if (diffDays === 0) dayStr = 'Today';
  else if (diffDays === 1) dayStr = 'Yesterday';
  else dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <p className="text-[11px] text-journal-text-muted mb-1">
      {dayStr}, {timeStr}
    </p>
  );
}

// ── User Message ──────────────────────────────────────────────────

function UserMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className="mb-4">
      <MessageTimestamp isoString={message.created_at} />
      <p className="text-[13.5px] text-journal-text leading-relaxed whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  );
}

// ── AI Message ────────────────────────────────────────────────────

function AIMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className="mb-4">
      <div className="bg-journal-surface rounded-card border-l-[3px] border-journal-border px-4 py-3.5">
        <p className="text-[13.5px] text-journal-text leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-journal-accent ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </p>
      </div>

      {/* Action extraction card below AI response */}
      {message.extractedActions && message.extractedActions.length > 0 && (
        <div className="mt-2">
          <ActionExtractionCard actions={message.extractedActions} />
        </div>
      )}
    </div>
  );
}

// ── Format helpers ───────────────────────────────────────────────

function formatSessionDate(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24));

  let dateStr: string;
  if (diffDays === 0) dateStr = 'Today';
  else if (diffDays === 1) dateStr = 'Yesterday';
  else dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { date: dateStr, time: timeStr };
}

// ── Main Component ───────────────────────────────────────────────

interface ChatThreadProps {
  sessionGroups: SessionGroup[];
  /** Inline score card rendered after session messages */
  renderScoreCard?: (sessionId: number, proposedScore: number | null) => React.ReactNode;
}

export function ChatThread({ sessionGroups, renderScoreCard }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionGroups]);

  if (sessionGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center px-6">
          <p className="text-sm text-journal-text-muted leading-relaxed">
            Start a conversation. How are you doing today?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {sessionGroups.map((group) => {
        const { date, time } = formatSessionDate(group.started_at);

        return (
          <div key={group.session_id}>
            <SessionDivider date={date} time={time} />
            {group.messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserMessage key={msg.id ?? `streaming-${idx}`} message={msg} />
              ) : (
                <AIMessage key={msg.id ?? `streaming-${idx}`} message={msg} />
              ),
            )}
            {/* Score card after the last assistant message if score was proposed */}
            {renderScoreCard && renderScoreCard(group.session_id, group.daily_score)}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
