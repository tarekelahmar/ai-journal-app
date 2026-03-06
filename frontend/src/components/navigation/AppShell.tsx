import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/**
 * AppShell wraps authenticated screens with:
 * - A scrollable content area (flex-1)
 * - A fixed bottom navigation bar
 */
export function AppShell() {
  return (
    <div className="flex flex-col h-full bg-journal-bg">
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
