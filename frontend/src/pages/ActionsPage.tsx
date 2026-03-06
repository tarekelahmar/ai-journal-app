import React from 'react';
import { Card } from '../components/ui/Card';

export default function ActionsPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-journal-text">Actions</h1>
      <Card>
        <div className="text-center py-12">
          <p className="text-sm text-journal-text-muted">
            Track habits and commitments extracted from your journal.
          </p>
          <p className="text-xs text-journal-text-muted mt-2">
            Start journaling to see your first actions appear here.
          </p>
        </div>
      </Card>
    </div>
  );
}
