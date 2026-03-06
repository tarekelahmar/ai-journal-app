/**
 * Action Detail Page — Track 3c Task 3
 *
 * Router component: loads an action by :id, then renders
 * HabitDetail or CompletableDetail based on action_type.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAction } from '../api/actions';
import type { Action } from '../types/Action';
import { HabitDetail } from '../components/actions/HabitDetail';
import { CompletableDetail } from '../components/actions/CompletableDetail';

export default function ActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getAction(Number(id));
        if (!cancelled) setAction(data);
      } catch {
        if (!cancelled) setError('Action not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-journal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !action) {
    return (
      <div className="flex-1 px-4 py-6">
        <button
          onClick={() => navigate('/actions')}
          className="text-[13px] text-journal-accent mb-4"
        >
          ← Actions
        </button>
        <p className="text-sm text-journal-text-muted text-center py-12">
          {error || 'Action not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 pb-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/actions')}
        className="text-[13px] text-journal-accent mb-4 font-medium"
      >
        ← Actions
      </button>

      {action.action_type === 'habit' ? (
        <HabitDetail action={action} />
      ) : (
        <CompletableDetail action={action} onStatusChange={setAction} />
      )}
    </div>
  );
}
