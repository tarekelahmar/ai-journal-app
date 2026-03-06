import React from 'react';
import { Card } from '../components/ui/Card';

export default function ProfilePage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-journal-text">Profile</h1>
      <Card>
        <div className="text-center py-12">
          <p className="text-sm text-journal-text-muted">
            Account settings and preferences coming soon.
          </p>
        </div>
      </Card>
    </div>
  );
}
