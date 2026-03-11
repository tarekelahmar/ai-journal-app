/**
 * Journal V3 — Chat Input (wireframe-aligned).
 *
 * Warm border, cream-tinted background.
 * Document upload button on left, terracotta send on right.
 * No "Rate your day" button — score is on the Daily Score screen.
 */
import React, { useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileSelect?: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onFileSelect,
  disabled = false,
  isUploading = false,
  placeholder = "What's on your mind...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      {/* Action row: upload + send */}
      <div className="flex items-center justify-between">
        {/* Document upload button */}
        <button
          className={`w-9 h-9 rounded-full bg-journal-surface border border-journal-border-light flex items-center justify-center transition-colors ${
            isUploading
              ? 'text-journal-accent'
              : 'text-journal-text-muted hover:text-journal-accent hover:border-journal-accent'
          }`}
          aria-label="Upload document"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? (
            /* Spinner */
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            /* Paperclip icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onFileSelect) {
              onFileSelect(file);
              e.target.value = ''; // Reset so same file can be re-selected
            }
          }}
        />

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
