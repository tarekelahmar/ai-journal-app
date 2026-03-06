import React from 'react';
import { Card } from '../components/ui/Card';

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-journal-text">Dashboard</h1>
      <Card>
        <div className="text-center py-12">
          <p className="text-sm text-journal-text-muted">
            Patterns, trends, and life domain insights coming soon.
          </p>
        </div>
      </Card>
    </div>
  );
}
