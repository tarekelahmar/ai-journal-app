/**
 * Journal V3 — Chat Input (wireframe-aligned).
 *
 * Warm border, cream-tinted background.
 * Voice button (non-functional) on left, terracotta send on right.
 * No "Rate your day" button — score is on the Daily Score screen.
 */
import React, { useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "What's on your mind...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="px-4 py-3 bg-journal-bg">
      {/* Text area card */}
      <div className="bg-journal-surface border border-journal-border rounded-card px-4 py-3 mb-2.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-[14px] text-journal-text placeholder:text-journal-text-muted resize-none outline-none disabled:opacity-50"
          style={{ minHeight: 20, maxHeight: 120 }}
        />
      </div>

      {/* Action row: voice + send */}
      <div className="flex items-center justify-between">
        {/* Voice button (non-functional) */}
        <button
          className="w-9 h-9 rounded-full bg-journal-surface border border-journal-border-light flex items-center justify-center text-journal-text-muted"
          aria-label="Voice input"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`text-[13px] font-semibold px-5 py-2 rounded-full transition-colors ${
            canSend
              ? 'bg-journal-accent text-white hover:bg-journal-accent-hover'
              : 'bg-journal-surface-alt text-journal-text-muted'
          }`}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
