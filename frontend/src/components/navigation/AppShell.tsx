import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/**
 * AppShell wraps authenticated screens with:
 * - A scrollable content area constrained to 680px centred column
 * - A floating bottom navigation bar
 *
 * The cream background fills the full viewport; content is centred within it.
 */
export function AppShell() {
  return (
    <div className="flex flex-col h-full bg-journal-bg">
      {/* Content area — centred 680px column */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <div className="w-full mx-auto flex-1 overflow-hidden flex flex-col" style={{ maxWidth: 680 }}>
          <Outlet />
        </div>
      </div>
      {/* Bottom padding so content isn't hidden behind floating nav */}
      <div className="h-[88px] shrink-0" />
      <BottomNav />
    </div>
  );
}
