import React, { useState, useEffect, useRef } from 'react';
import { createAction, createMilestone } from '../../api/actions';

// ── Types ────────────────────────────────────────────────────────

interface AddActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type ActionType = 'completable' | 'habit';

const DOMAINS = [
  { key: 'career', label: 'Career' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'family', label: 'Family' },
  { key: 'health', label: 'Health' },
  { key: 'finance', label: 'Finance' },
  { key: 'social', label: 'Social' },
  { key: 'purpose', label: 'Purpose' },
];

// ── Component ────────────────────────────────────────────────────

export function AddActionSheet({ isOpen, onClose, onCreated }: AddActionSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const [actionType, setActionType] = useState<ActionType>('completable');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => {
        setVisible(false);
        // Reset form on close
        setActionType('completable');
        setTitle('');
        setDomain(null);
        setMilestones(['']);
        setSubmitting(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Focus title input on open
  useEffect(() => {
    if (animateIn && titleRef.current) {
      const timer = setTimeout(() => titleRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [animateIn]);

  if (!visible) return null;

  const isAction = actionType === 'completable';
  const canCommit = title.trim().length > 0 && domain !== null && !submitting;

  // ── Milestone handlers ──────────────────────────────────────

  const updateMilestone = (index: number, value: string) => {
    setMilestones((prev) => prev.map((m, i) => (i === index ? value : m)));
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [''] : next;
    });
  };

  const addMilestone = () => {
    if (milestones.length < 5) {
      setMilestones((prev) => [...prev, '']);
    }
  };

  // ── Submit ──────────────────────────────────────────────────

  const handleCommit = async () => {
    if (!canCommit) return;
    setSubmitting(true);

    try {
      const action = await createAction({
        title: title.trim(),
        action_type: actionType,
        source: 'user_created',
        primary_domain: domain!,
      });

      // If completable and user entered milestones, create them
      if (actionType === 'completable') {
        const filledMilestones = milestones
          .map((m) => m.trim())
          .filter((m) => m.length > 0);

        if (filledMilestones.length > 0) {
          await Promise.all(
            filledMilestones.map((msTitle, i) =>
              createMilestone(action.id, { title: msTitle, sort_order: i }),
            ),
          );
        }
        // If no milestones entered, backend auto-generates via LLM/template
      }

      onCreated();
    } catch {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{
          backgroundColor: 'rgba(42,37,32,0.3)',
          opacity: animateIn ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white overflow-y-auto"
        style={{
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px 32px',
          boxShadow: '0 -8px 40px rgba(42,37,32,0.12)',
          maxHeight: '90vh',
          transform: animateIn ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease-out',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center mb-5">
          <div
            className="rounded-full"
            style={{ width: 40, height: 4, backgroundColor: '#E8E4E0' }}
          />
        </div>

        {/* Title */}
        <h2 className="text-[18px] font-bold text-journal-text mb-5">
          New commitment
        </h2>

        {/* Type toggle */}
        <div className="flex gap-2 mb-5">
          {([
            { type: 'completable' as ActionType, label: 'Action' },
            { type: 'habit' as ActionType, label: 'Ongoing' },
          ]).map(({ type, label }) => {
            const selected = actionType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setActionType(type);
                  if (type === 'habit') setMilestones(['']);
                }}
                className="text-[13px] font-semibold transition-colors"
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  backgroundColor: selected ? '#C4704B' : '#F5F0EB',
                  color: selected ? '#FFFFFF' : '#6B6B6B',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Title input */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            isAction
              ? 'e.g. Talk to James about scope'
              : 'e.g. Prioritise daily exercise'
          }
          className="w-full text-[14px] text-journal-text placeholder:text-journal-text-muted outline-none"
          style={{
            backgroundColor: '#F5F0EB',
            border: '1.5px solid #E8E4E0',
            borderRadius: 12,
            padding: '12px 14px',
          }}
        />

        {/* Guidance text */}
        <p className="text-[12px] text-journal-text-muted leading-[1.4] mt-2 mb-5">
          {isAction
            ? 'Be specific. What exactly needs to happen?'
            : 'Frame it as a principle, not a task.'}
        </p>

        {/* Domain selection */}
        <div className="flex flex-wrap gap-[6px] mb-5">
          {DOMAINS.map((d) => {
            const selected = domain === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setDomain(selected ? null : d.key)}
                className="text-[12px] transition-colors"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: selected ? '#F0DDD4' : '#F5F0EB',
                  border: selected ? '1.5px solid #C4704B' : '1.5px solid transparent',
                  color: selected ? '#C4704B' : '#6B6B6B',
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Milestones (Action type only) */}
        {isAction && (
          <div className="mb-5">
            <p
              className="text-[11px] uppercase tracking-wider font-semibold mb-2.5"
              style={{ color: '#9B9B9B' }}
            >
              Milestones (optional)
            </p>

            <div className="space-y-2">
              {milestones.map((ms, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ms}
                    onChange={(e) => updateMilestone(i, e.target.value)}
                    placeholder={`Milestone ${i + 1}`}
                    className="flex-1 text-[13px] text-journal-text placeholder:text-journal-text-muted outline-none"
                    style={{
                      backgroundColor: '#F5F0EB',
                      border: '1.5px solid #E8E4E0',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  />
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(i)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-journal-text-muted hover:text-journal-negative hover:bg-journal-negative-light transition-colors"
                      style={{ fontSize: 16 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {milestones.length < 5 && (
              <button
                onClick={addMilestone}
                className="text-[13px] font-medium mt-2"
                style={{ color: '#C4704B' }}
              >
                + Add milestone
              </button>
            )}
          </div>
        )}

        {/* Commit button */}
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          className="w-full text-[15px] font-semibold py-3.5 rounded-[12px] transition-colors"
          style={{
            backgroundColor: canCommit ? '#C4704B' : '#E8E4E0',
            color: canCommit ? '#FFFFFF' : '#9B9B9B',
          }}
        >
          {submitting ? 'Creating…' : 'Commit'}
        </button>
      </div>
    </div>
  );
}
